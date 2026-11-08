from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Integer, Float, Text, ForeignKey, Boolean, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import DATABASE_URL

def now():
    return datetime.now(timezone.utc).isoformat()

engine = create_engine(DATABASE_URL, connect_args={'check_same_thread':False, 'timeout':30} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def sqlite_config(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default='faculty')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey('students.id'), nullable=True, unique=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)

class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    csrf: Mapped[str] = mapped_column(String(80))
    expires: Mapped[float] = mapped_column(Float)

class Student(Base):
    __tablename__ = 'students'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[str] = mapped_column(String(160), default='')
    department: Mapped[str] = mapped_column(String(80), index=True)
    semester: Mapped[int] = mapped_column(Integer)
    attendance: Mapped[float] = mapped_column(Float)
    cgpa: Mapped[float] = mapped_column(Float)
    backlogs: Mapped[int] = mapped_column(Integer)
    assignment_completion: Mapped[float] = mapped_column(Float)
    lms_activity: Mapped[float] = mapped_column(Float)
    credits_ratio: Mapped[float] = mapped_column(Float)
    probability: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String(10), index=True)
    model_version: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(20), default='import')
    predicted_at: Mapped[str] = mapped_column(String(40), default=now)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)

class PredictionHistory(Base):
    __tablename__ = 'prediction_history'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'), nullable=True)
    probability: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String(10))
    model_version: Mapped[str] = mapped_column(String(80))
    features: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(40), default=now, index=True)

class Intervention(Base):
    __tablename__ = 'interventions'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    category: Mapped[str] = mapped_column(String(60))
    note: Mapped[str] = mapped_column(Text)
    due_date: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default='open')
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    shared_with_student: Mapped[bool] = mapped_column(Boolean, default=False)

class ImportSource(Base):
    __tablename__ = 'import_sources'
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    filename: Mapped[str] = mapped_column(String(200))
    payload: Mapped[str] = mapped_column(Text)
    expires: Mapped[float] = mapped_column(Float)

class ImportBatch(Base):
    __tablename__ = 'imports'
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    filename: Mapped[str] = mapped_column(String(200))
    row_count: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    payload: Mapped[str] = mapped_column(Text)
    errors: Mapped[str] = mapped_column(Text, default='[]')
    created: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(40), default=now)

class AuditEvent(Base):
    __tablename__ = 'audit_events'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    detail: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[str] = mapped_column(String(40), default=now)

def get_db():
    with SessionLocal() as db:
        yield db
