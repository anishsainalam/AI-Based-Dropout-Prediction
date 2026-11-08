"""Flexible, reviewable import mapping. Never infer absent academic measurements."""
import csv
import io
import json
import re
import time
import uuid
import zipfile
from pathlib import Path
from difflib import SequenceMatcher
from xml.etree.ElementTree import ParseError
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import ValidationError
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from .database import ImportSource, ImportBatch, Student, User, AuditEvent, get_db
from .security import staff_user
from .schemas import StudentInput, MappingInput, FEATURES, LABELS
from .imports import MAX_BYTES, MAX_ROWS, COLUMNS

router=APIRouter(prefix='/api/imports')
ALIASES={
 'student_id':['student id','enrollment number','enrolment number','enrollment no','enrolment no','enroll no','enrollment','enrolment','roll number','roll no','rollno','registration number','registration no','reg no','student code','admission number','university id'],
 'name':['name','student name','full name','student full name','learner name'],
 'email':['email','email address','student email','email id','mail'],
 'department':['department','dept','program','programme','branch','course name','major'],
 'semester':['semester','sem','current semester','semester number'],
 'attendance':['attendance','attendance percentage','attendance percent','attendance pct','attendance rate','attend pct','attendance %'],
 'cgpa':['cgpa','cumulative gpa','gpa','grade point average','cumulative grade point average','academic score'],
 'backlogs':['backlogs','active backlogs','number of backlogs','arrears','pending subjects','failed courses','backlog count'],
 'assignment_completion':['assignment completion','assignment completion rate','assignment completion percentage','assignments percent','assignment %','assignment rate','assignment completion pct'],
 'lms_activity':['lms activity','lms sessions','weekly sessions','weekly learning activity','learning sessions','weekly lms sessions','average weekly sessions'],
 'credits_ratio':['credits ratio','credits completed percentage','credit completion rate','credits percent','credits completion %','credit completion percentage'],
 'classes_attended':['classes attended','attended classes','lectures attended','present classes'],
 'classes_total':['total classes','classes scheduled','scheduled classes','total lectures'],
 'assignments_done':['assignments completed','completed assignments','assignments submitted'],
 'assignments_total':['total assignments','assignments due','assigned assignments'],
 'credits_earned':['credits earned','earned credits','credits completed'],
 'credits_expected':['credits expected','expected credits','required credits','total credits'],
}
DERIVED={'attendance':('classes_attended','classes_total'),'assignment_completion':('assignments_done','assignments_total'),'credits_ratio':('credits_earned','credits_expected')}
FIELD_LABELS={**LABELS,'student_id':'Enrollment / student ID','name':'Student name','email':'Email (optional)','department':'Department','semester':'Semester','classes_attended':'Classes attended','classes_total':'Total classes','assignments_done':'Assignments completed','assignments_total':'Total assignments','credits_earned':'Credits earned','credits_expected':'Expected credits'}

def normalize(value):
    return re.sub(r'[^a-z0-9]','',str(value).lower().replace('%','percentage'))

def read_table(filename,content):
    suffix=Path(filename).suffix.lower()
    try:
        if suffix=='.csv':
            text=content.decode('utf-8-sig')
            try: dialect=csv.Sniffer().sniff(text[:8192],delimiters=',;\t|')
            except csv.Error: dialect=csv.excel
            reader=csv.reader(io.StringIO(text),dialect)
            headers=next(reader,[])
            rows=[]
            for row in reader:
                if not any(str(v).strip() for v in row): continue
                if len(row)!=len(headers): raise HTTPException(400,f'Row {len(rows)+2} has a different number of cells from the header.')
                rows.append(row)
                if len(rows)>MAX_ROWS: break
        elif suffix=='.xlsx':
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(i.file_size for i in archive.infolist())>30*1024*1024:
                    raise HTTPException(400,'Expanded workbook exceeds 30 MB.')
            from openpyxl import load_workbook
            book=load_workbook(io.BytesIO(content),read_only=True,data_only=False)
            iterator=book.worksheets[0].iter_rows(values_only=True)
            headers=list(next(iterator,[]));rows=[]
            for row in iterator:
                if not any(v is not None for v in row): continue
                rows.append(list(row))
                if len(rows)>MAX_ROWS: break
            book.close()
        else: raise HTTPException(400,'Choose a CSV or XLSX file.')
        headers=[str(h or '').strip() for h in headers]
        if not headers or any(not h for h in headers) or len(set(headers))!=len(headers):
            raise HTTPException(400,'Each column must have a non-empty, unique header.')
        if len(headers)>100: raise HTTPException(400,'Use at most 100 columns in one file.')
        if not rows: raise HTTPException(400,'The file has no student rows.')
        if len(rows)>MAX_ROWS: raise HTTPException(400,'Import up to 5,000 rows at a time.')
        return headers,[{h:str(v).strip() if v is not None else '' for h,v in zip(headers,row)} for row in rows]
    except HTTPException: raise
    except (ValueError,UnicodeError,zipfile.BadZipFile,KeyError,TypeError,ParseError,csv.Error):
        raise HTTPException(400,'Cannot read this file. Choose an unprotected XLSX or a UTF-8 CSV.')

def suggestions(headers):
    mapping={};confidence={}
    for target,aliases in ALIASES.items():
        normalized={normalize(a) for a in aliases+[target]}
        exact=[h for h in headers if normalize(h) in normalized]
        if len(exact)==1:
            mapping[target]=exact[0];confidence[target]='recognized'
        elif len(exact)>1:
            confidence[target]='ambiguous'
        else:
            matches=sorted([(max(SequenceMatcher(None,normalize(h),a).ratio() for a in normalized),h) for h in headers],reverse=True)
            if matches and matches[0][0]>=.85 and (len(matches)==1 or matches[0][0]-matches[1][0]>.08):
                mapping[target]=matches[0][1];confidence[target]='suggested â€” verify'
    # Do not map one source into unrelated fields by fuzzy coincidence.
    reused={v for v in mapping.values() if list(mapping.values()).count(v)>1}
    for source in reused:
        targets=[key for key,value in mapping.items() if value==source]
        recognized=[key for key in targets if confidence[key]=='recognized']
        # Preserve an unambiguous exact/alias match over fuzzy guesses for count fields.
        keep=recognized[0] if len(recognized)==1 else None
        for key in targets:
            if key!=keep:
                mapping.pop(key)
                confidence[key]='ambiguous'
    return mapping,confidence

def numeric(value):
    text=str(value).strip()
    if text.startswith(('=','+','@')): raise ValueError('Formula cells are not accepted; use exported values.')
    return float(text.rstrip('%').replace(',',''))

def mapped_records(rows,payload):
    unknown=set(payload.mapping)-set(ALIASES)
    if unknown: raise HTTPException(400,'Unknown target fields: '+', '.join(sorted(unknown)))
    if set(payload.defaults)-{'department','semester'}: raise HTTPException(400,'Only department and semester can be assigned a common value.')
    if set(payload.transforms)-set(FEATURES): raise HTTPException(400,'Conversions can be applied only to academic features.')
    assigned=[v for v in payload.mapping.values() if v]
    if len(assigned)!=len(set(assigned)): raise HTTPException(400,'Map each source column to only one field.')
    if set(assigned)-set(rows[0]): raise HTTPException(400,'A mapped source column does not exist.')
    required=set(COLUMNS)-{'email'}
    available={k for k,v in payload.mapping.items() if v}|{k for k,v in payload.defaults.items() if str(v).strip()}
    for target,(a,b) in DERIVED.items():
        if a in available and b in available: available.add(target)
    missing=required-available
    if missing: raise HTTPException(400,'Map these required fields before continuing: '+', '.join(FIELD_LABELS[x] for x in sorted(missing))+'. Missing academic measurements cannot be invented.')
    records,errors,seen=[],[],set()
    for index,row in enumerate(rows,start=2):
        record={k:row[v] for k,v in payload.mapping.items() if v and k in COLUMNS}
        for k,v in payload.defaults.items():
            if k not in record: record[k]=v
        try:
            for target,(a,b) in DERIVED.items():
                if target not in record and payload.mapping.get(a) and payload.mapping.get(b):
                    numerator=numeric(row[payload.mapping[a]]);denominator=numeric(row[payload.mapping[b]])
                    if denominator<=0 or numerator<0 or numerator>denominator:
                        raise ValueError(f'{FIELD_LABELS[target]} needs nonnegative completed values no greater than a positive total.')
                    record[target]=round(numerator/denominator*100,4)
            for field in FEATURES:
                record[field]=numeric(record[field])
                conversion=payload.transforms.get(field,'identity')
                if conversion=='fraction_to_percent':
                    if field not in ('attendance','assignment_completion','credits_ratio') or not 0<=record[field]<=1:
                        raise ValueError(f'Fraction conversion for {FIELD_LABELS[field]} requires a percentage field between 0 and 1.')
                    record[field]*=100
                elif conversion=='gpa4_to10':
                    if field!='cgpa' or not 0<=record[field]<=4: raise ValueError('GPA conversion requires a CGPA on a 0â€“4 scale.')
                    record[field]*=2.5
                elif conversion=='marks100_to10':
                    if field!='cgpa' or not 0<=record[field]<=100: raise ValueError('Marks conversion requires an explicitly approved 0â€“100 CGPA equivalent.')
                    record[field]/=10
            record=StudentInput.model_validate(record).model_dump()
            if record['student_id'] in seen: raise ValueError('Duplicate enrollment/student ID in this file.')
            seen.add(record['student_id']);records.append(record)
        except ValidationError as exc:
            errors.extend({'row':index,'field':str(e['loc'][0]),'message':e['msg']} for e in exc.errors())
        except (ValueError,TypeError) as exc:
            errors.append({'row':index,'field':'conversion','message':str(exc)})
    return records,errors

@router.post('/inspect')
async def inspect_upload(file:UploadFile=File(...),user:User=Depends(staff_user),db:Session=Depends(get_db)):
    content=await file.read(MAX_BYTES+1);await file.close()
    if len(content)>MAX_BYTES: raise HTTPException(413,'Upload limit is 5 MB.')
    headers,rows=read_table(file.filename or '',content)
    db.execute(delete(ImportSource).where(ImportSource.expires<time.time()))
    source=ImportSource(id=str(uuid.uuid4()),owner_id=user.id,filename=Path(file.filename or 'upload').name[:200],payload=json.dumps({'headers':headers,'rows':rows}),expires=time.time()+3600)
    db.add(source);db.commit()
    mapping,confidence=suggestions(headers)
    return {'id':source.id,'filename':source.filename,'row_count':len(rows),'columns':headers,'sample':rows[:3],'mapping':mapping,'confidence':confidence,'fields':[{'key':k,'label':FIELD_LABELS[k],'required':k in COLUMNS and k!='email','derived':k not in COLUMNS} for k in ALIASES],'expires_in_minutes':60}

@router.post('/{source_id}/map')
def review_mapping(source_id:str,payload:MappingInput,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    source=db.get(ImportSource,source_id)
    if not source or source.owner_id!=user.id or source.expires<time.time(): raise HTTPException(404,'Upload expired or unavailable. Upload your file again.')
    data=json.loads(source.payload)
    records,errors=mapped_records(data['rows'],payload)
    batch=ImportBatch(id=str(uuid.uuid4()),owner_id=user.id,filename=source.filename,row_count=len(data['rows']),status='rejected' if errors else 'ready',payload=json.dumps(records) if not errors else '[]',errors=json.dumps(errors[:100]))
    db.add(batch);db.add(AuditEvent(user_id=user.id,action='Mapped student import',detail=f'{len(data["rows"])} rows; {len(errors)} errors'))
    # Clear raw staging data after a successful mapping; expired abandoned files are removed on upload.
    if not errors: db.delete(source)
    db.commit()
    existing=set(db.scalars(select(Student.student_id).where(Student.student_id.in_([r['student_id'] for r in records]))).all()) if records else set()
    return {'id':batch.id,'filename':batch.filename,'row_count':batch.row_count,'status':batch.status,'created':0,'updated':0,'created_at':batch.created_at,'errors':errors[:100],'error_count':len(errors),'preview':records[:5],'to_create':len(records)-len(existing),'to_update':len(existing)}
