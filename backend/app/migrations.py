"""Idempotent additive migration for existing v1 SQLite/PostgreSQL installations."""
from sqlalchemy import inspect, text

def migrate(engine):
    inspector=inspect(engine)
    if 'users' not in inspector.get_table_names():
        return
    columns={c['name'] for c in inspector.get_columns('users')}
    with engine.begin() as connection:
        if 'student_id' not in columns:
            connection.execute(text('ALTER TABLE users ADD COLUMN student_id INTEGER REFERENCES students(id)'))
            connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_users_student_id ON users(student_id)'))
        if 'must_change_password' not in columns:
            connection.execute(text('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE'))
        if 'shared_with_student' not in {c['name'] for c in inspector.get_columns('interventions')}:
            connection.execute(text('ALTER TABLE interventions ADD COLUMN shared_with_student BOOLEAN NOT NULL DEFAULT FALSE'))
