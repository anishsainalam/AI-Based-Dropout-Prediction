"""Organization-issued student credentials and tightly scoped student access."""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from .database import User, Student, Intervention, AuthSession, AuditEvent, get_db
from .security import admin_user, student_user, password_hash
from .schemas import ProvisionStudent, AccountStatus, FEATURES

router=APIRouter(prefix='/api')

def account_view(user,student):
    return {'id':user.id,'student_id':student.id,'enrollment_number':student.student_id,'name':student.name,'department':student.department,'active':user.active,'must_change_password':user.must_change_password}

def student_account(db,user_id):
    account=db.get(User,user_id)
    if not account or account.role!='student' or account.student_id is None:
        raise HTTPException(404,'Student account not found.')
    return account

@router.get('/admin/student-accounts')
def list_accounts(user:User=Depends(admin_user),db:Session=Depends(get_db)):
    rows=db.execute(select(User,Student).join(Student,User.student_id==Student.id).where(User.role=='student').order_by(Student.name)).all()
    return [account_view(u,s) for u,s in rows]

@router.post('/admin/student-accounts',status_code=201)
def provision(payload:ProvisionStudent,user:User=Depends(admin_user),db:Session=Depends(get_db)):
    student=db.get(Student,payload.student_id)
    if not student: raise HTTPException(404,'Import the student record before issuing an account.')
    if db.scalar(select(User).where(User.student_id==student.id)):
        raise HTTPException(409,'This student already has an account. Use reset password if needed.')
    password=secrets.token_urlsafe(18)
    account=User(email=f'student-{student.id}@accounts.continuum.invalid',name=student.name,role='student',student_id=student.id,password_hash=password_hash(password),must_change_password=True)
    db.add(account)
    db.add(AuditEvent(user_id=user.id,action='Issued student account',detail=student.student_id))
    db.commit()
    return {**account_view(account,student),'temporary_password':password,'message':'Share privately with this student. This password is shown only in this response.'}

@router.post('/admin/student-accounts/{account_id}/reset-password')
def reset(account_id:int,user:User=Depends(admin_user),db:Session=Depends(get_db)):
    account=student_account(db,account_id)
    password=secrets.token_urlsafe(18)
    account.password_hash=password_hash(password)
    account.must_change_password=True
    db.execute(delete(AuthSession).where(AuthSession.user_id==account.id))
    student=db.get(Student,account.student_id)
    db.add(AuditEvent(user_id=user.id,action='Reset student password',detail=student.student_id))
    db.commit()
    return {**account_view(account,student),'temporary_password':password,'message':'Previous sessions were revoked. Share this temporary password privately.'}

@router.patch('/admin/student-accounts/{account_id}')
def toggle_account(account_id:int,payload:AccountStatus,user:User=Depends(admin_user),db:Session=Depends(get_db)):
    account=student_account(db,account_id)
    account.active=payload.active
    db.execute(delete(AuthSession).where(AuthSession.user_id==account.id))
    student=db.get(Student,account.student_id)
    db.add(AuditEvent(user_id=user.id,action='Updated student access',detail=f'{student.student_id}: {"active" if payload.active else "suspended"}'))
    db.commit()
    return account_view(account,student)

@router.get('/student/me')
def own_record(user:User=Depends(student_user),db:Session=Depends(get_db)):
    # No client-selected student ID: scope comes exclusively from the authenticated account.
    student=db.get(Student,user.student_id)
    if not student: raise HTTPException(404,'Contact your institution to link your student record.')
    fields=['student_id','name','email','department','semester','updated_at']+FEATURES
    plans=db.scalars(select(Intervention).where(Intervention.student_id==student.id,Intervention.shared_with_student.is_(True)).order_by(Intervention.due_date)).all()
    return {**{f:getattr(student,f) for f in fields},'support_plans':[{'id':p.id,'category':p.category,'note':p.note,'due_date':p.due_date,'status':p.status,'professor':db.get(User,p.owner_id).name} for p in plans]}
