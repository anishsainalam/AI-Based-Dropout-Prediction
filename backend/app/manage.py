"""Local administrator utility: python -m app.manage create-user EMAIL NAME --role faculty."""
import argparse
import getpass
from sqlalchemy import select
from .database import SessionLocal, Base, engine, User
from .security import password_hash

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['create-user'])
    parser.add_argument('email')
    parser.add_argument('name')
    parser.add_argument('--role',choices=['admin','faculty'],default='faculty')
    args=parser.parse_args()
    password=getpass.getpass('Password (at least 12 characters): ')
    if len(password)<12: raise SystemExit('Password must have at least 12 characters.')
    if password!=getpass.getpass('Confirm password: '): raise SystemExit('Passwords do not match.')
    if '@' not in args.email: raise SystemExit('A valid email is required.')
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email==args.email.strip().lower())):
            raise SystemExit('An account with that email already exists.')
        db.add(User(email=args.email.strip().lower(),name=args.name,role=args.role,password_hash=password_hash(password)))
        db.commit()
    print('Account created.')
