import os
from datetime import date, timedelta
from sqlalchemy import select, func
from .database import User, Student, Intervention
from .security import password_hash
from .ml import demo_dataset
from .config import DEMO

def seed(db, predictor):
    if not db.scalar(select(func.count()).select_from(User)):
        if DEMO:
            users=[('faculty@continuum.demo','Dr. Ananya Rao','faculty','Continuum@2026'),('admin@continuum.demo','Campus Administrator','admin','ContinuumAdmin@2026')]
        else:
            email,password=os.getenv('ADMIN_EMAIL','').strip().lower(),os.getenv('ADMIN_PASSWORD','')
            if not email or '@' not in email or len(password)<12:
                raise RuntimeError('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before first startup.')
            users=[(email,os.getenv('ADMIN_NAME','Administrator'),'admin',password)]
        for email,name,role,password in users:
            db.add(User(email=email,name=name,role=role,password_hash=password_hash(password)))
        db.commit()
    if DEMO and not db.scalar(select(func.count()).select_from(Student)):
        first=['Aarav','Diya','Ishaan','Anika','Vihaan','Meera','Arjun','Sana','Kabir','Riya','Aditya','Nisha','Rohan','Ira','Dev','Kavya','Siddharth','Tara','Neel','Avni','Reyansh','Maya','Aryan','Zoya']
        last=['Sharma','Patel','Reddy','Nair','Mehta','Das','Rao','Kapoor','Singh','Verma']
        departments=['Computer Science','Business Administration','Mechanical Engineering','Electronics','Data Science','Civil Engineering']
        records=demo_dataset(240,seed=817).drop(columns=['dropout']).to_dict('records')
        predictions=predictor.predict(records)
        for i,(row,prediction) in enumerate(zip(records,predictions)):
            db.add(Student(**row,**prediction,student_id=f'STU{2024001+i}',name=f'{first[i%24]} {last[i//24]}',email=f'student{i+1}@example.edu',department=departments[i%6],semester=2+(i%3)*2,source='demo'))
        db.commit()
        owner=db.scalar(select(User).where(User.role=='faculty'))
        students=db.scalars(select(Student).order_by(Student.probability.desc()).limit(8)).all()
        notes=['Arrange a short check-in to understand recent attendance and agree on next steps.','Review current backlogs together and identify one course to prioritize.','Offer a weekly study plan and connect the student with a peer mentor.']
        for i,s in enumerate(students):
            db.add(Intervention(student_id=s.id,owner_id=owner.id,category=['Attendance check-in','Academic support','Mentoring'][i%3],note=notes[i%3],due_date=(date.today()+timedelta(days=i-1)).isoformat()))
        db.commit()
    if DEMO:
        demo_student=db.scalar(select(Student).where(Student.student_id=='STU2024001'))
        if demo_student and not db.scalar(select(User).where(User.student_id==demo_student.id)):
            db.add(User(email=f'student-{demo_student.id}@accounts.continuum.invalid',name=demo_student.name,role='student',student_id=demo_student.id,password_hash=password_hash('StudentDemo@2026'),must_change_password=False))
            db.commit()
