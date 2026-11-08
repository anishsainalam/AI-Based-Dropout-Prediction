import csv
import io
import json
import os
import secrets
import threading
import time
import uuid
from collections import Counter, defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
import joblib
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from sqlalchemy import select, func, or_, delete, update
from sqlalchemy.orm import Session
from .config import ARTIFACTS, DATA, DEMO, ROOT, ORIGINS, COOKIE_SECURE, SESSION_SECONDS, PRODUCTION
from .database import Base, engine, SessionLocal, get_db, Student, User, AuthSession, Intervention, ImportBatch, AuditEvent, now
from .schemas import Features, StudentInput, LoginInput, PasswordInput, InterventionInput, InterventionUpdate, FEATURES
from .security import current_user, staff_user, admin_user, password_hash, verify_password, token_hash
from .ml import Predictor, train, demo_dataset
from .seed import seed
from .migrations import migrate
from .accounts import router as accounts_router
from .mapping import router as mapping_router
from .body_limit import RequestBodyLimit
from .history import snapshot, history_view
from .database import PredictionHistory
from sqlalchemy.exc import IntegrityError
from .imports import parse_upload, MAX_BYTES, COLUMNS, csv_safe

predictor: Predictor
import_lock=threading.Lock()
attempts: dict[str, deque] = defaultdict(deque)
attempt_lock=threading.Lock()
dummy_password_hash=password_hash(secrets.token_urlsafe(24))

@asynccontextmanager
async def lifespan(app):
    global predictor
    migrate(engine)
    Base.metadata.create_all(engine)
    artifact=ARTIFACTS/'model.joblib'
    if artifact.exists():
        bundle=joblib.load(artifact)
    elif DEMO:
        frame=demo_dataset()
        frame.to_csv(DATA/'demo-training.csv',index=False)
        bundle=train(frame)
    else:
        raise RuntimeError('No model found. Train a model with observed outcomes before starting a non-demo installation.')
    if not DEMO and bundle['report']['is_demo']:
        raise RuntimeError('A synthetic model cannot serve a non-demo installation. Train on real observed outcomes first.')
    predictor=Predictor(bundle)
    with SessionLocal() as db:
        seed(db,predictor)
        # Existing installations retain their latest known snapshot only, not invented history.
        for student in db.scalars(select(Student).where(~select(PredictionHistory.id).where(PredictionHistory.student_id==Student.id).exists())).all():
            snapshot(db, student, 'Baseline snapshot', timestamp=student.predicted_at)
        db.commit()
        # Recompute stored snapshots when a newly trained artifact is activated.
        stale=db.scalars(select(Student).where(Student.model_version!=predictor.report['version'])).all()
        if stale:
            predictions=predictor.predict([student_dict(s) for s in stale])
            for student,prediction in zip(stale,predictions):
                for key,value in prediction.items(): setattr(student,key,value)
                student.predicted_at=now()
                snapshot(db,student,'Model activated')
            db.commit()
    yield

app=FastAPI(title='Continuum Student Success API',version='1.0.0',lifespan=lifespan,docs_url='/api/docs',openapi_url='/api/openapi.json',redoc_url=None)
app.include_router(accounts_router)
app.include_router(mapping_router)
app.add_middleware(CORSMiddleware,allow_origins=ORIGINS,allow_credentials=True,allow_methods=['GET','POST','PATCH'],allow_headers=['Content-Type','X-CSRF-Token'])
app.add_middleware(RequestBodyLimit,max_bytes=MAX_BYTES+65536)

@app.middleware('http')
async def security_headers(request: Request, call_next):
    origin=request.headers.get('origin')
    if request.method not in ('GET','HEAD','OPTIONS') and origin and origin not in ORIGINS:
        return JSONResponse({'detail':'This origin is not allowed.'},status_code=403)
    try:
        size=int(request.headers.get('content-length','0'))
    except ValueError:
        return JSONResponse({'detail':'Invalid request size.'},status_code=400)
    if size>MAX_BYTES+65536:
        return JSONResponse({'detail':'Upload limit is 5 MB.'},status_code=413)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='same-origin'
    response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
    if PRODUCTION:
        response.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control']='no-store'
    else:
        response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    return response

def audit(db,user,action,detail):
    db.add(AuditEvent(user_id=user.id if user else None,action=action,detail=detail))

def student_dict(student):
    return {c.name:getattr(student,c.name) for c in Student.__table__.columns}

def get_student(db,student_id):
    student=db.get(Student,student_id)
    if not student: raise HTTPException(404,'Student not found.')
    return student

def user_dict(user):
    return {'id':user.id,'email':user.email if user.role!='student' else '', 'name':user.name,'role':user.role,'student_id':user.student_id,'must_change_password':user.must_change_password}

def intervention_dict(item,db):
    student=db.get(Student,item.student_id)
    owner=db.get(User,item.owner_id)
    return {**{c.name:getattr(item,c.name) for c in Intervention.__table__.columns},'student_name':student.name,'student_code':student.student_id,'owner_name':owner.name}

def batch_dict(batch):
    return {k:getattr(batch,k) for k in ('id','filename','row_count','status','created','updated','created_at')}

@app.exception_handler(RequestValidationError)
async def validation_handler(request,exc):
    # Never echo uploaded values, credentials, non-finite numbers or exception objects.
    return JSONResponse({'detail':[{'loc':e['loc'],'msg':e['msg'],'type':e['type']} for e in exc.errors()]},status_code=422)

@app.exception_handler(IntegrityError)
async def conflict_handler(request,exc):
    return JSONResponse({'detail':'A conflicting record was saved by another request. Refresh and try again.'},status_code=409)

@app.get('/api/health')
def health():
    with engine.connect() as connection:
        connection.execute(select(1))
    return {'status':'ok','service':'continuum','model_ready':bool(predictor)}

@app.get('/api/config')
def config():
    return {'demo_mode':DEMO}

@app.post('/api/auth/login')
def login(payload: LoginInput,request: Request,response: Response,db: Session=Depends(get_db)):
    address=request.client.host if request.client else 'unknown'
    current=time.time()
    with attempt_lock:
        for key in list(attempts):
            while attempts[key] and attempts[key][0]<current-300: attempts[key].popleft()
            if not attempts[key]: del attempts[key]
        queue=attempts[address]
        if len(queue)>=10: raise HTTPException(429,'Too many sign-in attempts. Try again in five minutes.')
        queue.append(current)
    if payload.portal=='student':
        user=db.scalar(select(User).join(Student,User.student_id==Student.id).where(User.role=='student',Student.student_id==payload.enrollment_number.strip()))
    else:
        user=db.scalar(select(User).where(User.email==payload.email.strip().lower(),User.role.in_(['admin','faculty'])))
    valid=verify_password(payload.password,user.password_hash if user else dummy_password_hash)
    if not user or not valid or not user.active:
        raise HTTPException(401,'Sign-in ID or password is incorrect.')
    old=request.cookies.get('continuum_session')
    if old: db.execute(delete(AuthSession).where(AuthSession.token_hash==token_hash(old)))
    db.execute(delete(AuthSession).where(AuthSession.expires<current))
    token,csrf=secrets.token_urlsafe(48),secrets.token_urlsafe(32)
    db.add(AuthSession(token_hash=token_hash(token),csrf=csrf,user_id=user.id,expires=current+SESSION_SECONDS))
    audit(db,user,'Signed in','Student portal' if user.role=='student' else 'Faculty workspace')
    db.commit()
    response.set_cookie('continuum_session',token,max_age=SESSION_SECONDS,httponly=True,secure=COOKIE_SECURE,samesite='strict',path='/')
    return {'user':user_dict(user),'csrf':csrf}

@app.get('/api/auth/me')
def me(request: Request,user: User=Depends(current_user)):
    return {'user':user_dict(user),'csrf':request.state.auth_session.csrf}

@app.post('/api/auth/logout')
def logout(request: Request,response: Response,user: User=Depends(current_user),db: Session=Depends(get_db)):
    db.delete(request.state.auth_session)
    audit(db,user,'Signed out','Session revoked')
    db.commit()
    response.delete_cookie('continuum_session',path='/',secure=COOKIE_SECURE,samesite='strict',httponly=True)
    return {'ok':True}

@app.post('/api/auth/password')
def change_password(payload:PasswordInput,user:User=Depends(current_user),db:Session=Depends(get_db)):
    if not verify_password(payload.current_password,user.password_hash):
        raise HTTPException(400,'Current password is incorrect.')
    if payload.current_password==payload.new_password:
        raise HTTPException(400,'Choose a different password from the temporary or current password.')
    user.password_hash=password_hash(payload.new_password)
    user.must_change_password=False
    db.execute(delete(AuthSession).where(AuthSession.user_id==user.id))
    audit(db,user,'Changed password','All sessions revoked')
    db.commit()
    return {'ok':True}

@app.get('/api/overview')
def overview(user:User=Depends(staff_user),db:Session=Depends(get_db)):
    students=db.scalars(select(Student)).all()
    counts=Counter(s.risk for s in students)
    departments=[]
    for department in sorted(set(s.department for s in students)):
        group=[s for s in students if s.department==department]
        departments.append({'name':department,'total':len(group),**{risk:sum(s.risk==risk for s in group) for risk in ('low','moderate','high')}})
    cases=db.scalars(select(Intervention).where(Intervention.status=='open').order_by(Intervention.due_date)).all()
    return {'total':len(students),'risk_counts':{r:counts[r] for r in ('low','moderate','high')},'average_attendance':round(sum(s.attendance for s in students)/len(students),1) if students else 0,'active_interventions':len(cases),'departments':departments,'attention': [student_dict(s) for s in sorted(students,key=lambda x:x.probability,reverse=True)[:5]],'upcoming':[intervention_dict(i,db) for i in cases[:4]],'updated_at':max((s.predicted_at for s in students),default=None),'demo_mode':DEMO,'model':predictor.report['selected_model']}

def filtered_students(search,department,risk):
    query=select(Student)
    if search:
        escaped=search.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')
        query=query.where(or_(Student.name.ilike(f'%{escaped}%',escape='\\'),Student.student_id.ilike(f'%{escaped}%',escape='\\')))
    if department: query=query.where(Student.department==department)
    if risk: query=query.where(Student.risk==risk)
    return query

@app.get('/api/students')
def students(search:str=Query('',max_length=100),department:str='',risk:Literal['','low','moderate','high']='',sort:Literal['risk','name','attendance']='risk',page:int=Query(1,ge=1),page_size:int=Query(12,ge=1,le=100),user:User=Depends(staff_user),db:Session=Depends(get_db)):
    query=filtered_students(search,department,risk)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    order=Student.probability.desc() if sort=='risk' else Student.name if sort=='name' else Student.attendance
    rows=db.scalars(query.order_by(order,Student.id).offset((page-1)*page_size).limit(page_size)).all()
    departments=db.scalars(select(Student.department).distinct().order_by(Student.department)).all()
    return {'items':[student_dict(s) for s in rows],'total':total,'page':page,'page_size':page_size,'departments':departments}

@app.get('/api/students/export')
def export_students(search:str='',department:str='',risk:Literal['','low','moderate','high']='',user:User=Depends(staff_user),db:Session=Depends(get_db)):
    rows=db.scalars(filtered_students(search,department,risk).order_by(Student.probability.desc())).all()
    columns=COLUMNS+['probability','risk','model_version','predicted_at','source']
    output=io.StringIO(newline='')
    writer=csv.writer(output)
    writer.writerow(columns)
    for student in rows: writer.writerow([csv_safe(getattr(student,k)) for k in columns])
    audit(db,user,'Exported students',f'{len(rows)} records')
    db.commit()
    return Response('\ufeff'+output.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="continuum-risk-report.csv"'})

@app.get('/api/students/{student_id}')
def student_detail(student_id:int,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    student=get_student(db,student_id)
    record=student_dict(student)
    cases=db.scalars(select(Intervention).where(Intervention.student_id==student_id).order_by(Intervention.created_at.desc())).all()
    explanation=predictor.explain_details(record)
    return {**record,'explanations':explanation['values'],'explanation':explanation,'interventions':[intervention_dict(c,db) for c in cases]}

@app.patch('/api/students/{student_id}')
def edit_student(student_id:int,payload:Features,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    student=get_student(db,student_id)
    values=payload.model_dump()
    for k,v in {**values,**predictor.predict([values])[0]}.items(): setattr(student,k,v)
    student.predicted_at=student.updated_at=now()
    snapshot(db,student,'Academic update',user)
    audit(db,user,'Updated student',student.student_id)
    db.commit()
    return student_dict(student)

@app.post('/api/predict')
def predict(payload:Features,user:User=Depends(staff_user)):
    record=payload.model_dump()
    explanation=predictor.explain_details(record)
    return {**predictor.predict([record])[0],'explanations':explanation['values'],'explanation':explanation,'saved':False}

@app.post('/api/students/{student_id}/interventions',status_code=201)
def add_intervention(student_id:int,payload:InterventionInput,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    student=get_student(db,student_id)
    if not payload.note.strip(): raise HTTPException(422,'Write a brief support note.')
    item=Intervention(student_id=student_id,owner_id=user.id,category=payload.category,note=payload.note.strip(),due_date=payload.due_date.isoformat(),shared_with_student=payload.shared_with_student)
    db.add(item)
    audit(db,user,'Created support plan',student.student_id)
    db.commit()
    return intervention_dict(item,db)

@app.get('/api/interventions')
def interventions(status:Literal['all','open','resolved']='all',user:User=Depends(staff_user),db:Session=Depends(get_db)):
    query=select(Intervention)
    if status!='all': query=query.where(Intervention.status==status)
    return [intervention_dict(i,db) for i in db.scalars(query.order_by(Intervention.due_date)).all()]

@app.patch('/api/interventions/{intervention_id}')
def update_intervention(intervention_id:int,payload:InterventionUpdate,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    item=db.get(Intervention,intervention_id)
    if not item: raise HTTPException(404,'Support plan not found.')
    item.status=payload.status
    audit(db,user,'Updated support plan',f'Plan {item.id}: {payload.status}')
    db.commit()
    return intervention_dict(item,db)

@app.get('/api/imports/template')
def template(format:Literal['csv','xlsx']='csv',user:User=Depends(staff_user)):
    import pandas as pd
    row={'student_id':'NEW2026001','name':'Sample Student','email':'sample@example.edu','department':'Computer Science','semester':2,'attendance':78,'cgpa':7.2,'backlogs':1,'assignment_completion':82,'lms_activity':12,'credits_ratio':85}
    frame=pd.DataFrame([row])[COLUMNS]
    if format=='csv':
        return Response(frame.to_csv(index=False),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="student-template.csv"'})
    output=io.BytesIO()
    frame.to_excel(output,index=False,engine='openpyxl')
    return Response(output.getvalue(),media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="student-template.xlsx"'})

@app.post('/api/imports/preview')
async def preview_import(file:UploadFile=File(...),user:User=Depends(staff_user),db:Session=Depends(get_db)):
    content=await file.read(MAX_BYTES+1)
    await file.close()
    if len(content)>MAX_BYTES: raise HTTPException(413,'Upload limit is 5 MB.')
    if not content: raise HTTPException(400,'The file is empty.')
    records,errors,count=parse_upload(file.filename or '',content)
    # Raw input stays out of logs and the filesystem. Only normalized staging data is saved.
    batch=ImportBatch(id=str(uuid.uuid4()),owner_id=user.id,filename=Path(file.filename or 'upload').name[:200],row_count=count,status='rejected' if errors else 'ready',payload=json.dumps(records) if not errors else '[]',errors=json.dumps(errors[:100]))
    db.add(batch)
    audit(db,user,'Validated import',f'{count} rows; {len(errors)} validation errors')
    db.commit()
    existing=set(db.scalars(select(Student.student_id).where(Student.student_id.in_([r['student_id'] for r in records]))).all()) if records else set()
    return {**batch_dict(batch),'errors':errors[:100],'error_count':len(errors),'preview':records[:5],'to_create':len(records)-len(existing),'to_update':len(existing)}

@app.post('/api/imports/{batch_id}/commit')
def commit_import(batch_id:str,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    # Conditional claim + transaction prevents repeat or concurrent commits across workers.
    with import_lock:
        batch=db.get(ImportBatch,batch_id)
        if not batch or batch.owner_id!=user.id: raise HTTPException(404,'Import not found.')
        if batch.status=='imported': return batch_dict(batch)
        if batch.status!='ready': raise HTTPException(409,'Fix validation errors and upload a new file before importing.')
        claimed=db.execute(update(ImportBatch).where(ImportBatch.id==batch_id,ImportBatch.status=='ready').values(status='processing'))
        if claimed.rowcount!=1:
            db.rollback()
            raise HTTPException(409,'This import is already being processed. Refresh the history.')
        records=json.loads(batch.payload)
        predictions=predictor.predict(records)
        created=updated=0
        for record,prediction in zip(records,predictions):
            student=db.scalar(select(Student).where(Student.student_id==record['student_id']))
            if student:
                for key,value in {**record,**prediction}.items(): setattr(student,key,value)
                student.source='import'
                student.updated_at=student.predicted_at=now()
                updated+=1
            else:
                student=Student(**record,**prediction,source='import')
                db.add(student)
                created+=1
            snapshot(db,student,'CSV/XLSX import',user)
            account=db.scalar(select(User).where(User.student_id==student.id))
            if account: account.name=student.name
        batch.status='imported'
        batch.created,batch.updated=created,updated
        batch.payload='[]'
        audit(db,user,'Imported students',f'{created} created; {updated} updated')
        db.commit()
        return batch_dict(batch)

@app.get('/api/imports')
def imports(user:User=Depends(staff_user),db:Session=Depends(get_db)):
    return [batch_dict(b) for b in db.scalars(select(ImportBatch).where(ImportBatch.owner_id==user.id).order_by(ImportBatch.created_at.desc()).limit(30)).all()]

@app.get('/api/model')
def model(user:User=Depends(staff_user)):
    return predictor.report

@app.get('/api/audit')
def audit_events(user:User=Depends(admin_user),db:Session=Depends(get_db)):
    return [{c.name:getattr(a,c.name) for c in AuditEvent.__table__.columns} for a in db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(100)).all()]

@app.post('/api/students',status_code=201)
def create_student(payload:StudentInput,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    values=payload.model_dump()
    student=Student(**values,**predictor.predict([values])[0],source='manual')
    try:
        db.add(student)
        snapshot(db,student,'Student created',user)
        audit(db,user,'Created student',student.student_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'That enrollment number already exists. Open the existing student to update it.')
    return student_dict(student)

@app.patch('/api/students/{student_id}/profile')
def edit_profile(student_id:int,payload:StudentInput,user:User=Depends(staff_user),db:Session=Depends(get_db)):
    student=get_student(db,student_id)
    values=payload.model_dump()
    try:
        for k,v in {**values,**predictor.predict([values])[0]}.items(): setattr(student,k,v)
        student.predicted_at=student.updated_at=now()
        snapshot(db,student,'Profile update',user)
        account=db.scalar(select(User).where(User.student_id==student.id))
        if account: account.name=student.name
        audit(db,user,'Updated profile',student.student_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'That enrollment number belongs to another student.')
    return student_dict(student)

@app.get('/api/students/{student_id}/history')
def prediction_history(student_id:int,page:int=Query(1,ge=1),page_size:int=Query(10,ge=1,le=100),user:User=Depends(staff_user),db:Session=Depends(get_db)):
    get_student(db,student_id)
    query=select(PredictionHistory).where(PredictionHistory.student_id==student_id)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    items=db.scalars(query.order_by(PredictionHistory.id.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return {'items':[history_view(i) for i in items],'total':total,'page':page,'page_size':page_size}

@app.get('/api/analytics')
def analytics(department:str=Query('',max_length=80),semester:int|None=Query(None,ge=1,le=12),user:User=Depends(staff_user),db:Session=Depends(get_db)):
    from datetime import date
    from .schemas import LABELS
    query=select(Student)
    if department: query=query.where(Student.department==department)
    if semester: query=query.where(Student.semester==semester)
    rows=db.scalars(query).all()
    ids=[s.id for s in rows]
    plans=db.scalars(select(Intervention).where(Intervention.student_id.in_(ids))).all() if ids else []
    open_plans=[p for p in plans if p.status=='open']
    supported={p.student_id for p in open_plans}
    high=[s for s in rows if s.risk=='high']
    groups=[]
    for name in sorted({s.department for s in rows}):
        group=[s for s in rows if s.department==name]
        groups.append({'name':name,'total':len(group),'mean_probability':sum(s.probability for s in group)/len(group),
            **{r:sum(s.risk==r for s in group) for r in ('low','moderate','high')}})
    previous={}
    # Compare each student's latest two snapshots, only within the same model version.
    if ids:
        ranked=select(PredictionHistory.id,func.row_number().over(partition_by=PredictionHistory.student_id,order_by=PredictionHistory.id.desc()).label('rank')).where(PredictionHistory.student_id.in_(ids)).subquery()
        for item in db.scalars(select(PredictionHistory).join(ranked,ranked.c.id==PredictionHistory.id).where(ranked.c.rank<=2).order_by(PredictionHistory.id.desc())):
            previous.setdefault(item.student_id,[]).append(item)
    changes={'decreased':0,'increased':0,'stable':0,'model_changed':0,'not_enough_history':0}
    for s in rows:
        history=previous.get(s.id,[])
        if len(history)<2: changes['not_enough_history']+=1
        elif history[0].model_version!=history[1].model_version: changes['model_changed']+=1
        else:
            delta=history[0].probability-history[1].probability
            changes['increased' if delta>.005 else 'decreased' if delta<-.005 else 'stable']+=1
    return {'total':len(rows),'risk_counts':{r:sum(s.risk==r for s in rows) for r in ('low','moderate','high')},
        'departments':groups,'department_options':db.scalars(select(Student.department).distinct().order_by(Student.department)).all(),
        'features':[{'key':f,'label':LABELS[f],'mean':sum(getattr(s,f) for s in rows)/len(rows) if rows else None,'reference':predictor.medians[f]} for f in FEATURES],
        'support':{'open':len(open_plans),'resolved':sum(p.status=='resolved' for p in plans),'overdue':sum(p.due_date<date.today().isoformat() for p in open_plans),
            'high_total':len(high),'high_supported':sum(s.id in supported for s in high),'unassigned':[student_dict(s) for s in sorted(high,key=lambda s:s.probability,reverse=True) if s.id not in supported][:8]},
        'changes':changes,'model_version':predictor.report['version'],'demo_mode':DEMO}

dist=ROOT/'frontend'/'dist'
if dist.exists():
    app.mount('/assets',StaticFiles(directory=dist/'assets'),name='assets')

@app.get('/{path:path}',include_in_schema=False)
def spa(path:str):
    if path=='api' or path.startswith('api/'):
        raise HTTPException(404,'API endpoint not found.')
    if not (dist/'index.html').exists():
        raise HTTPException(503,'Build the frontend or use the development server on port 5173.')
    if path=='favicon.svg': return FileResponse(dist/'favicon.svg')
    return FileResponse(dist/'index.html')
