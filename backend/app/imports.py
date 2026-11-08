import csv
import io
import math
import zipfile
from pathlib import Path
import pandas as pd
from fastapi import HTTPException
from pydantic import ValidationError
from .schemas import StudentInput

MAX_BYTES=5*1024*1024
MAX_ROWS=5000
COLUMNS=list(StudentInput.model_fields)

def parse_upload(filename, content):
    suffix=Path(filename).suffix.lower()
    if suffix not in ('.csv','.xlsx'):
        raise HTTPException(400,'Choose a .csv or .xlsx file.')
    try:
        if suffix=='.csv':
            text=content.decode('utf-8-sig')
            headers=next(csv.reader(io.StringIO(text)),[])
            frame=pd.read_csv(io.StringIO(text),dtype=str,keep_default_na=False,nrows=MAX_ROWS+1)
        else:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(i.file_size for i in archive.infolist())>30*1024*1024:
                    raise HTTPException(400,'The expanded workbook is too large. Use CSV instead.')
            from openpyxl import load_workbook
            book=load_workbook(io.BytesIO(content),read_only=True,data_only=False)
            sheet=book.worksheets[0]
            iterator=sheet.iter_rows(values_only=True)
            headers=list(next(iterator,[]))
            rows=[]
            for row in iterator:
                if len(rows)>MAX_ROWS:
                    break
                if any(v is not None for v in row):
                    rows.append(row)
            frame=pd.DataFrame(rows,columns=headers)
            book.close()
        headers=[str(h).strip() for h in headers]
        if len(headers)!=len(set(headers)):
            raise HTTPException(400,'Duplicate column names found. Each header must be unique.')
        frame.columns=[str(c).strip() for c in frame.columns]
        missing=set(COLUMNS)-{'email'}-set(frame.columns)
        unknown=set(frame.columns)-set(COLUMNS)
        if missing:
            raise HTTPException(400,'Missing columns: '+', '.join(sorted(missing)))
        if unknown:
            raise HTTPException(400,'Unexpected columns: '+', '.join(sorted(unknown))+'. Use the provided template; imports must not contain outcome labels.')
        if frame.empty:
            raise HTTPException(400,'The file contains no student rows.')
        if len(frame)>MAX_ROWS:
            raise HTTPException(400,f'Import up to {MAX_ROWS:,} students per file.')
        records,errors,seen=[],[],set()
        for i,row in enumerate(frame.to_dict('records'),start=2):
            cleaned={k:('' if v is None or isinstance(v,float) and math.isnan(v) else v) for k,v in row.items()}
            try:
                item=StudentInput.model_validate(cleaned).model_dump()
                if item['student_id'] in seen:
                    errors.append({'row':i,'field':'student_id','message':'Student ID appears more than once in this file.'})
                seen.add(item['student_id'])
                records.append(item)
            except ValidationError as e:
                for error in e.errors():
                    errors.append({'row':i,'field':str(error['loc'][0]),'message':error['msg']})
        return records,errors,len(frame)
    except HTTPException:
        raise
    except (ValueError,UnicodeError,zipfile.BadZipFile,KeyError,TypeError,pd.errors.ParserError):
        raise HTTPException(400,'This file could not be read. Use a UTF-8 CSV or an unprotected XLSX workbook.')

def csv_safe(value):
    value=str(value)
    return "'"+value if value.lstrip().startswith(('=','+','-','@','\t','\r')) else value
