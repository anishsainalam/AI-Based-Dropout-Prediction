import io
import os
import json
import shutil
import tempfile
from pathlib import Path
import pandas as pd
import pytest

TEST_ROOT=Path(tempfile.mkdtemp(prefix='continuum-tests-'))
os.environ['DATA_DIR']=str(TEST_ROOT)
os.environ['DATABASE_URL']=f'sqlite:///{TEST_ROOT / "test.db"}'
os.environ['DEMO_MODE']='true'
os.environ['APP_ENV']='test'
os.environ['COOKIE_SECURE']='false'
# Reuse our locally trained artifact; tests do not retrain on each run.
source=Path(__file__).resolve().parents[2]/'data'/'artifacts'
if source.exists(): shutil.copytree(source,TEST_ROOT/'artifacts')

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, User
from app.security import password_hash

@pytest.fixture(scope='module')
def client():
    with TestClient(app) as value:
        yield value

@pytest.fixture()
def auth(client):
    result=client.post('/api/auth/login',json={'email':'faculty@continuum.demo','password':'Continuum@2026'})
    assert result.status_code==200,result.text
    return {'X-CSRF-Token':result.json()['csrf']}

def record(code='TEST001'):
    return dict(student_id=code,name='Test Student',email='test@example.edu',department='Computer Science',semester=4,attendance=55,cgpa=5.4,backlogs=3,assignment_completion=58,lms_activity=7,credits_ratio=63)

def send_file(client,headers,rows,name='students.csv'):
    frame=pd.DataFrame(rows)
    if name.endswith('.xlsx'):
        buf=io.BytesIO();frame.to_excel(buf,index=False);content=buf.getvalue()
    else: content=frame.to_csv(index=False).encode()
    return client.post('/api/imports/preview',headers=headers,files={'file':(name,content)})

def test_auth_rejects_anonymous_and_wrong_password(client):
    client.cookies.clear()
    assert client.get('/api/students').status_code==401
    assert client.post('/api/auth/login',json={'email':'faculty@continuum.demo','password':'wrong'}).status_code==401

def test_login_cookie_csrf_and_roles(client,auth):
    assert 'continuum_session' in client.cookies
    assert client.get('/api/auth/me').json()['user']['role']=='faculty'
    assert client.get('/api/audit').status_code==403
    values={k:v for k,v in record().items() if k in ('attendance','cgpa','backlogs','assignment_completion','lms_activity','credits_ratio')}
    assert client.post('/api/predict',json=values).status_code==403
    assert client.post('/api/predict',headers={**auth,'Origin':'https://evil.example'},json=values).status_code==403
    result=client.post('/api/predict',headers=auth,json=values)
    assert result.status_code==200
    assert 0<=result.json()['probability']<=1
    assert len(result.json()['explanations'])==6
    assert result.json()['saved'] is False
    assert client.post('/api/predict',headers=auth,json={**values,'attendance':101}).status_code==422

def test_directory_pagination_search_risk_and_detail(client,auth):
    first=client.get('/api/students?page=1').json()
    second=client.get('/api/students?page=2').json()
    assert first['total']==240
    assert not ({s['id'] for s in first['items']}&{s['id'] for s in second['items']})
    filtered=client.get('/api/students?risk=high').json()
    assert all(s['risk']=='high' for s in filtered['items'])
    s=first['items'][0]
    assert client.get('/api/students',params={'search':s['student_id']}).json()['total']==1
    assert client.get('/api/students?search=%25').json()['total']==0
    detail=client.get(f'/api/students/{s["id"]}').json()
    assert len(detail['explanations'])==6
    assert client.get('/api/students/999999').status_code==404

def test_csv_import_preview_commit_idempotent_and_update(client,auth):
    before=client.get('/api/overview').json()['total']
    response=send_file(client,auth,[record()])
    assert response.status_code==200,response.text
    preview=response.json()
    assert preview['error_count']==0 and preview['to_create']==1
    assert client.get('/api/overview').json()['total']==before
    commit=client.post(f'/api/imports/{preview["id"]}/commit',headers=auth)
    assert commit.status_code==200,commit.text
    assert commit.json()['created']==1
    assert client.post(f'/api/imports/{preview["id"]}/commit',headers=auth).json()['created']==1
    assert client.get('/api/overview').json()['total']==before+1
    updated=send_file(client,auth,[{**record(),'attendance':89}]).json()
    assert updated['to_update']==1
    assert client.post(f'/api/imports/{updated["id"]}/commit',headers=auth).json()['updated']==1
    student=client.get('/api/students?search=TEST001').json()['items'][0]
    assert student['attendance']==89

def test_xlsx_import_and_atomic_rejection(client,auth):
    preview=send_file(client,auth,[record('XLSX001')],'students.xlsx').json()
    assert preview['error_count']==0
    assert client.post(f'/api/imports/{preview["id"]}/commit',headers=auth).status_code==200
    before=client.get('/api/overview').json()['total']
    bad=send_file(client,auth,[record('GOODROW'),{**record('BADROW'),'attendance':150}]).json()
    assert bad['status']=='rejected'
    assert bad['errors'][0]['row']==3
    assert client.post(f'/api/imports/{bad["id"]}/commit',headers=auth).status_code==409
    assert client.get('/api/overview').json()['total']==before
    duplicated=send_file(client,auth,[record('DUPE'),record('DUPE')]).json()
    assert duplicated['error_count']>0
    missing=send_file(client,auth,[{'student_id':'BAD'}])
    assert missing.status_code==400
    outcome=send_file(client,auth,[{**record(),'dropout':1}])
    assert outcome.status_code==400
    assert client.post('/api/imports/preview',headers=auth,files={'file':('bad.xlsx',b'invalid')}).status_code==400
    assert client.post('/api/imports/preview',headers=auth,files={'file':('bad.exe',b'123')}).status_code==400

def test_support_plan_persistence_and_feature_update(client,auth):
    student=client.get('/api/students?search=TEST001').json()['items'][0]
    result=client.post(f'/api/students/{student["id"]}/interventions',headers=auth,json={'category':'Mentoring','note':'Arrange a weekly academic check-in.','due_date':'2026-10-01'})
    assert result.status_code==201,result.text
    plan=result.json()
    assert client.patch(f'/api/interventions/{plan["id"]}',headers=auth,json={'status':'resolved'}).json()['status']=='resolved'
    features={k:student[k] for k in ('attendance','cgpa','backlogs','assignment_completion','lms_activity','credits_ratio')}
    features['cgpa']=8.5
    saved=client.patch(f'/api/students/{student["id"]}',headers=auth,json=features)
    assert saved.status_code==200
    detail=client.get(f'/api/students/{student["id"]}').json()
    assert detail['cgpa']==8.5
    assert detail['interventions'][0]['status']=='resolved'

def test_templates_exports_and_model_integrity(client,auth):
    assert client.get('/api/imports/template?format=csv').status_code==200
    xlsx=client.get('/api/imports/template?format=xlsx')
    assert xlsx.status_code==200 and xlsx.content[:2]==b'PK'
    exported=client.get('/api/students/export?risk=high')
    assert exported.status_code==200 and 'probability' in exported.text
    card=client.get('/api/model').json()
    assert len(card['comparison'])==5
    assert 'CatBoost' in {candidate['name'] for candidate in card['comparison']}
    assert card['catboost_version']
    assert card['selected_model']==max(card['comparison'],key=lambda c:c['average_precision'])['name']
    assert sum(card['split'][k] for k in ('train','validation','test'))==card['dataset_rows']
    assert sum(sum(r) for r in card['test_metrics']['confusion_matrix'])==card['split']['test']
    assert len(card['importance'])==6 and card['is_demo'] is True
    assert client.get('/api/not-an-endpoint').status_code==404

def test_admin_audit_and_logout_invalidation(client):
    response=client.post('/api/auth/login',json={'email':'admin@continuum.demo','password':'ContinuumAdmin@2026'})
    assert response.status_code==200
    assert 'HttpOnly' in response.headers['set-cookie'] and 'SameSite=strict' in response.headers['set-cookie']
    assert client.get('/api/audit').status_code==200
    cookie=client.cookies.get('continuum_session')
    headers={'X-CSRF-Token':response.json()['csrf']}
    assert client.post('/api/auth/logout',headers=headers).status_code==200
    client.cookies.set('continuum_session',cookie)
    assert client.get('/api/auth/me').status_code==401

def test_password_change_revokes_all_sessions(client):
    from app.main import attempts
    attempts.clear()
    client.cookies.clear()
    with SessionLocal() as db:
        db.add(User(email='test-account@example.edu',name='Test Account',role='faculty',password_hash=password_hash('TestAccount@2026')))
        db.commit()
    session=client.post('/api/auth/login',json={'email':'test-account@example.edu','password':'TestAccount@2026'}).json()
    assert client.post('/api/auth/password',headers={'X-CSRF-Token':session['csrf']},json={'current_password':'TestAccount@2026','new_password':'UpdatedAccount@2026'}).status_code==200
    assert client.get('/api/auth/me').status_code==401
    assert client.post('/api/auth/login',json={'email':'test-account@example.edu','password':'TestAccount@2026'}).status_code==401
    assert client.post('/api/auth/login',json={'email':'test-account@example.edu','password':'UpdatedAccount@2026'}).status_code==200

def test_login_throttle(client):
    from app.main import attempts
    attempts.clear()
    for _ in range(10): assert client.post('/api/auth/login',json={'email':'bad@example.edu','password':'wrong'}).status_code==401
    assert client.post('/api/auth/login',json={'email':'bad@example.edu','password':'wrong'}).status_code==429
    attempts.clear()

def login_as(client,portal='professor',identity='faculty@continuum.demo',password='Continuum@2026'):
    from app.main import attempts
    attempts.clear();client.cookies.clear()
    result=client.post('/api/auth/login',json={'portal':portal,'email':identity if portal=='professor' else '', 'enrollment_number':identity if portal=='student' else '', 'password':password})
    assert result.status_code==200,result.text
    return {'X-CSRF-Token':result.json()['csrf']}

def test_student_cannot_access_staff_or_other_students(client):
    headers=login_as(client,'student','STU2024001','StudentDemo@2026')
    own=client.get('/api/student/me')
    assert own.status_code==200 and own.json()['student_id']=='STU2024001'
    assert 'probability' not in own.json() and 'password_hash' not in own.text
    for path in ['/api/overview','/api/students','/api/students/2','/api/students/export','/api/imports','/api/imports/template','/api/interventions','/api/model','/api/admin/student-accounts','/api/audit']:
        assert client.get(path).status_code==403,path
    values={k:v for k,v in record().items() if k in ('attendance','cgpa','backlogs','assignment_completion','lms_activity','credits_ratio')}
    assert client.patch('/api/students/1',headers=headers,json=values).status_code==403
    assert client.post('/api/predict',headers=headers,json=values).status_code==403
    assert client.post('/api/admin/student-accounts',headers=headers,json={'student_id':2}).status_code==403
    assert client.post('/api/imports/inspect',headers=headers,files={'file':('a.csv',b'a,b\n1,2')}).status_code==403
    assert client.get('/api/student/me?student_id=2').json()['student_id']=='STU2024001'
    assert client.post('/api/auth/register',json={}).status_code==405

def test_only_explicitly_shared_plans_reach_student(client):
    headers=login_as(client)
    for shared in (False,True):
        assert client.post('/api/students/1/interventions',headers=headers,json={'category':'Academic support','note':'Shared action for student.' if shared else 'Private faculty note must stay private.','due_date':'2026-10-01','shared_with_student':shared}).status_code==201
    login_as(client,'student','STU2024001','StudentDemo@2026')
    result=client.get('/api/student/me')
    assert 'Shared action for student.' in result.text
    assert 'Private faculty note' not in result.text

def test_organization_issues_resets_and_suspends_accounts(client):
    faculty=login_as(client)
    assert client.post('/api/admin/student-accounts',headers=faculty,json={'student_id':2}).status_code==403
    admin=login_as(client,identity='admin@continuum.demo',password='ContinuumAdmin@2026')
    issue=client.post('/api/admin/student-accounts',headers=admin,json={'student_id':2})
    assert issue.status_code==201,issue.text
    issued=issue.json();temporary=issued['temporary_password'];account_id=issued['id']
    assert len(temporary)>=20
    listing=client.get('/api/admin/student-accounts')
    assert temporary not in listing.text and 'password_hash' not in listing.text
    assert client.post('/api/admin/student-accounts',headers=admin,json={'student_id':2}).status_code==409
    student=login_as(client,'student',issued['enrollment_number'],temporary)
    assert client.get('/api/auth/me').json()['user']['must_change_password'] is True
    assert client.get('/api/student/me').status_code==403
    assert client.post('/api/auth/password',headers=student,json={'current_password':temporary,'new_password':'PersonalStudent@2026'}).status_code==200
    assert client.get('/api/auth/me').status_code==401
    login_as(client,'student',issued['enrollment_number'],'PersonalStudent@2026')
    assert client.get('/api/student/me').json()['student_id']==issued['enrollment_number']
    old_cookie=client.cookies.get('continuum_session')
    admin=login_as(client,identity='admin@continuum.demo',password='ContinuumAdmin@2026')
    reset=client.post(f'/api/admin/student-accounts/{account_id}/reset-password',headers=admin)
    assert reset.status_code==200
    assert reset.json()['temporary_password']!=temporary
    client.cookies.clear();client.cookies.set('continuum_session',old_cookie)
    assert client.get('/api/auth/me').status_code==401
    admin=login_as(client,identity='admin@continuum.demo',password='ContinuumAdmin@2026')
    assert client.patch(f'/api/admin/student-accounts/{account_id}',headers=admin,json={'active':False}).status_code==200
    client.cookies.clear()
    assert client.post('/api/auth/login',json={'portal':'student','enrollment_number':issued['enrollment_number'],'password':reset.json()['temporary_password']}).status_code==401

def test_flexible_headers_derived_values_and_explicit_conversion(client):
    headers=login_as(client)
    row={'Enrollment No':'FLEX001','Full Name':'Flexible Student','Dept':'Data Science','Sem':4,'Attended classes':18,'Total classes':20,'GPA':3.2,'Arrears':1,'Assignments submitted':8,'Assignments due':10,'Weekly LMS Sessions':12,'Credits earned':15,'Expected credits':20,'Unrelated Notes':'ignored extra column'}
    inspect=client.post('/api/imports/inspect',headers=headers,files={'file':('different-headers.csv',pd.DataFrame([row]).to_csv(index=False).encode())})
    assert inspect.status_code==200,inspect.text
    source=inspect.json()
    assert source['mapping']['student_id']=='Enrollment No'
    assert source['mapping']['classes_attended']=='Attended classes'
    mapped=client.post(f'/api/imports/{source["id"]}/map',headers=headers,json={'mapping':source['mapping'],'transforms':{'cgpa':'gpa4_to10'}})
    assert mapped.status_code==200,mapped.text
    result=mapped.json()
    assert result['error_count']==0,result
    s=result['preview'][0]
    assert s['attendance']==90 and s['assignment_completion']==80 and s['credits_ratio']==75 and s['cgpa']==8
    assert 'Unrelated Notes' not in s
    assert client.post(f'/api/imports/{result["id"]}/commit',headers=headers).status_code==200

def test_mapping_missing_ambiguous_and_cross_user_access(client):
    headers=login_as(client)
    row=record('MAP002');row.pop('lms_activity')
    inspection=client.post('/api/imports/inspect',headers=headers,files={'file':('missing.csv',pd.DataFrame([row]).to_csv(index=False).encode())}).json()
    result=client.post(f'/api/imports/{inspection["id"]}/map',headers=headers,json={'mapping':inspection['mapping']})
    assert result.status_code==400 and 'cannot be invented' in result.text
    admin=login_as(client,identity='admin@continuum.demo',password='ContinuumAdmin@2026')
    assert client.post(f'/api/imports/{inspection["id"]}/map',headers=admin,json={'mapping':inspection['mapping']}).status_code==404
    from app.mapping import suggestions
    mapping,confidence=suggestions(['Enrollment No','Roll No'])
    assert 'student_id' not in mapping and confidence['student_id']=='ambiguous'

def test_streamed_body_limit_and_protected_files(client):
    headers=login_as(client)
    response=client.post('/api/imports/inspect',headers={**headers,'content-type':'application/octet-stream'},content=(b'x'*65536 for _ in range(90)))
    assert response.status_code==413
    for path in ['/.env','/data/continuum.db','/backend/app/security.py']:
        response=client.get(path)
        assert 'password_hash' not in response.text and 'ADMIN_PASSWORD=' not in response.text and not response.content.startswith(b'SQLite format')


def test_direct_create_profile_collision_and_immutable_history(client):
    headers=login_as(client)
    created=client.post('/api/students',headers=headers,json=record('DIRECT001'))
    assert created.status_code==201,created.text
    sid=created.json()['id']
    original=client.get(f'/api/students/{sid}/history').json()
    assert original['total']==1 and original['items'][0]['reason']=='Student created'
    assert client.post('/api/students',headers=headers,json=record('DIRECT001')).status_code==409
    edited=client.patch(f'/api/students/{sid}/profile',headers=headers,json={**record('DIRECT001'),'name':'Updated Name','attendance':91})
    assert edited.status_code==200
    history=client.get(f'/api/students/{sid}/history').json()
    assert history['total']==2
    assert history['items'][0]['features']['attendance']==91
    assert history['items'][1]==original['items'][0]
    collision=client.patch(f'/api/students/{sid}/profile',headers=headers,json=record('STU2024001'))
    assert collision.status_code==409
    assert client.get(f'/api/students/{sid}').json()['name']=='Updated Name'
    assert client.get(f'/api/students/{sid}/history').json()['total']==2
    assert client.get(f'/api/students/{sid}/history?page_size=1&page=2').json()['items'][0]==original['items'][0]
    assert client.get(f'/api/students/{sid}/history?page=0').status_code==422

def test_import_snapshots_and_scenarios_do_not_write_history(client):
    headers=login_as(client)
    preview=send_file(client,headers,[record('HIST001')]).json()
    assert client.post(f'/api/imports/{preview["id"]}/commit',headers=headers).status_code==200
    sid=client.get('/api/students?search=HIST001').json()['items'][0]['id']
    assert client.get(f'/api/students/{sid}/history').json()['total']==1
    assert client.post(f'/api/imports/{preview["id"]}/commit',headers=headers).status_code==200
    assert client.get(f'/api/students/{sid}/history').json()['total']==1
    from app.schemas import FEATURES
    values={f:record()[f] for f in FEATURES}
    prediction=client.post('/api/predict',headers=headers,json=values).json()
    assert prediction['saved'] is False
    assert abs(prediction['explanation']['baseline']+sum(v['effect'] for v in prediction['explanations'])-prediction['probability'])<1e-6
    assert client.get(f'/api/students/{sid}/history').json()['total']==1
    preview=send_file(client,headers,[{**record('HIST001'),'attendance':99}]).json()
    client.post(f'/api/imports/{preview["id"]}/commit',headers=headers)
    assert client.get(f'/api/students/{sid}/history').json()['total']==2

def test_analytics_counts_filters_and_student_denial(client):
    headers=login_as(client)
    result=client.get('/api/analytics').json()
    assert result['total']==client.get('/api/overview').json()['total']
    assert sum(result['risk_counts'].values())==result['total']
    assert sum(result['changes'].values())==result['total']
    filtered=client.get('/api/analytics?department=Computer%20Science&semester=4').json()
    assert all(d['name']=='Computer Science' for d in filtered['departments'])
    assert client.get('/api/analytics?department=Nonexistent').json()['total']==0
    assert client.get('/api/analytics?semester=13').status_code==422
    student=login_as(client,'student','STU2024001','StudentDemo@2026')
    for endpoint in ['/api/analytics','/api/students/1/history','/api/students/2/history']:
        assert client.get(endpoint).status_code==403
    assert client.post('/api/students',headers=student,json=record('DENIED')).status_code==403
    assert client.patch('/api/students/1/profile',headers=student,json=record('DENIED')).status_code==403

def test_prediction_history_survives_restart_and_new_model_activation(client):
    import app.main as main
    from app.database import Student, PredictionHistory
    from sqlalchemy import select,func
    headers=login_as(client)
    # Mark one stored model stale, as a prior model activation would leave it.
    with SessionLocal() as db:
        student=db.get(Student,1)
        student.model_version='old-test-model'
        db.commit()
        count=db.scalar(select(func.count()).select_from(PredictionHistory).where(PredictionHistory.student_id==1))
    with TestClient(app) as restarted:
        login_as(restarted)
        history=restarted.get('/api/students/1/history').json()
        assert history['total']==count+1
        assert history['items'][0]['reason']=='Model activated'
        assert history['items'][0]['model_version']==main.predictor.report['version']
    with TestClient(app) as restarted:
        login_as(restarted)
        assert restarted.get('/api/students/1/history').json()['total']==count+1


def test_template_exact_headers_win_over_fuzzy_count_aliases(client):
    from app.mapping import suggestions
    from app.imports import COLUMNS
    mapping,confidence=suggestions(COLUMNS)
    assert mapping=={field:field for field in COLUMNS}
    assert all(confidence[field]=='recognized' for field in COLUMNS)
    headers=login_as(client)
    file=client.get('/api/imports/template?format=xlsx')
    inspection=client.post('/api/imports/inspect',headers=headers,files={'file':('template.xlsx',file.content)}).json()
    result=client.post(f'/api/imports/{inspection["id"]}/map',headers=headers,json={'mapping':inspection['mapping']})
    assert result.status_code==200 and result.json()['error_count']==0

def test_prediction_invalid_numbers_and_identity_do_not_leak(client):
    headers=login_as(client)
    from app.schemas import FEATURES
    values={f:record()[f] for f in FEATURES}
    for invalid in ['NaN','Infinity',True,None,-1,101]:
        response=client.post('/api/predict',headers=headers,json={**values,'attendance':invalid})
        assert response.status_code==422,response.text
        assert 'input' not in response.json()['detail'][0]
    assert client.post('/api/predict',headers=headers,json={**values,'name':'excluded'}).status_code==422
