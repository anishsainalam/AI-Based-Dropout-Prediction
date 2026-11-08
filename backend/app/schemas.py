from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
import math
import re

FEATURES = ['attendance', 'cgpa', 'backlogs', 'assignment_completion', 'lms_activity', 'credits_ratio']
LABELS = {'attendance':'Attendance', 'cgpa':'CGPA', 'backlogs':'Active backlogs', 'assignment_completion':'Assignment completion', 'lms_activity':'Weekly learning activity', 'credits_ratio':'Credits completed'}
RANGES = {'attendance':(0,100), 'cgpa':(0,10), 'backlogs':(0,20), 'assignment_completion':(0,100), 'lms_activity':(0,100), 'credits_ratio':(0,100)}

class Features(BaseModel):
    model_config = ConfigDict(extra='forbid')
    attendance: float = Field(ge=0, le=100)
    cgpa: float = Field(ge=0, le=10)
    backlogs: int = Field(ge=0, le=20)
    assignment_completion: float = Field(ge=0, le=100)
    lms_activity: float = Field(ge=0, le=100)
    credits_ratio: float = Field(ge=0, le=100)

    @field_validator('*', mode='before')
    @classmethod
    def finite(cls, v):
        if isinstance(v, bool):
            raise ValueError('Enter a number, not true or false')
        if isinstance(v, (float, int)) and not math.isfinite(v):
            raise ValueError('Must be a finite number')
        return v

class StudentInput(Features):
    student_id: str = Field(min_length=2, max_length=40, pattern=r'^[A-Za-z0-9_-]+$')
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(default='', max_length=160)
    department: str = Field(min_length=2, max_length=80)
    semester: int = Field(ge=1, le=12)

    @field_validator('name', 'department', 'email', mode='before')
    @classmethod
    def strip_text(cls, value):
        return str(value).strip() if value is not None else ''

    @field_validator('email')
    @classmethod
    def email_format(cls, value):
        if value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Enter a valid email address')
        return value

class LoginInput(BaseModel):
    email: str = Field(default='', max_length=160)
    enrollment_number: str = Field(default='', max_length=40)
    portal: Literal['professor','student'] = 'professor'
    password: str = Field(min_length=1, max_length=256)

class PasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)

class InterventionInput(BaseModel):
    category: Literal['Academic support', 'Attendance check-in', 'Mentoring', 'Learning plan']
    note: str = Field(min_length=5, max_length=2000)
    due_date: date
    shared_with_student: bool = False

class InterventionUpdate(BaseModel):
    status: Literal['open', 'resolved']

class ProvisionStudent(BaseModel):
    student_id: int = Field(gt=0)

class AccountStatus(BaseModel):
    active: bool

class MappingInput(BaseModel):
    mapping: dict[str,str]
    transforms: dict[str,Literal['identity','fraction_to_percent','gpa4_to10','marks100_to10']] = Field(default_factory=dict)
    defaults: dict[str,str | int] = Field(default_factory=dict)
