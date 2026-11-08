import hashlib
import hmac
import secrets
import time
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from .database import AuthSession, User, get_db

def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),600_000).hex()
    return f'pbkdf2_sha256$600000${salt}${digest}'

def verify_password(password, encoded):
    try:
        _, rounds, salt, digest = encoded.split('$')
        actual = hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),int(rounds)).hex()
        return hmac.compare_digest(digest,actual)
    except (ValueError,TypeError):
        return False

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get('continuum_session', '')
    session = db.get(AuthSession,token_hash(token)) if token else None
    if session is None or session.expires < time.time():
        raise HTTPException(401,'Please sign in to continue.')
    user = db.get(User,session.user_id)
    if not user or not user.active:
        raise HTTPException(401,'Account unavailable.')
    if user.must_change_password and request.url.path not in ('/api/auth/me','/api/auth/password','/api/auth/logout'):
        raise HTTPException(403,'Change your temporary password before accessing your account.')
    if request.method not in ('GET','HEAD','OPTIONS') and not hmac.compare_digest(request.headers.get('x-csrf-token',''),session.csrf):
        raise HTTPException(403,'Session verification failed. Refresh the page and try again.')
    request.state.auth_session = session
    return user

def staff_user(user: User = Depends(current_user)):
    if user.role not in ('admin','faculty'):
        raise HTTPException(403,'Professor access required.')
    return user

def student_user(user: User = Depends(current_user)):
    if user.role != 'student' or user.student_id is None:
        raise HTTPException(403,'Student access required.')
    return user

def admin_user(user: User = Depends(current_user)):
    if user.role != 'admin':
        raise HTTPException(403,'Administrator access required.')
    return user
