from pydantic import BaseModel
from datetime import date
from typing import List


# ---------- STUDENT ----------
class StudentCreate(BaseModel):
    student_id: str
    name: str
    department: str
    year: int
    email: str
    phone: str


class Student(StudentCreate):
    created_at: date


# ---------- TEACHER ----------
class TeacherCreate(BaseModel):
    teacher_id: str
    name: str
    department: str
    email: str
    subjects: List[str]


class Teacher(TeacherCreate):
    created_at: date


# ---------- ADMIN ----------
class AdminCreate(BaseModel):
    admin_id: str
    name: str
    email: str
    role: str


# ---------- COLLEGE ----------
class CollegeCreate(BaseModel):
    college_id: str
    name: str
    address: str
    phone: str
    email: str
    established_year: int


class TimetableRequest(BaseModel):
    college_id: str | None = None  # Optional fetch trigger
    old_version_id: str | None = None  # For incremental gen