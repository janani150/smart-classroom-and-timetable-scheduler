from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import date
import re


def _validate_email_str(v: str) -> str:
    """Simple email format check – no external package required."""
    if v and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
        raise ValueError("Invalid email address")
    return v.lower().strip()


# ─────────────────────────────────────────────
#  Auth
# ─────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str                        # "student" | "teacher" | "admin"
    department: str
    year: Optional[int] = None       # students only
    section: Optional[str] = None    # students only

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("student", "teacher", "admin"):
            raise ValueError("role must be student, teacher, or admin")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("student", "teacher", "admin"):
            raise ValueError("role must be student, teacher, or admin")
        return v


# ─────────────────────────────────────────────
#  Student
# ─────────────────────────────────────────────

class StudentCreate(BaseModel):
    student_id: str
    name: str
    email: str
    department: str
    year: int
    section: str
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)


class StudentUpdate(BaseModel):
    name: str
    email: str
    department: str
    year: int
    section: str
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)


# ─────────────────────────────────────────────
#  Teacher
# ─────────────────────────────────────────────

class TeacherCreate(BaseModel):
    name: str
    email: str
    department: str
    subjects: List[str] = []
    qualifications: Optional[str] = ""
    role: Optional[str] = ""

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)


class TeacherUpdate(TeacherCreate):
    pass


# ─────────────────────────────────────────────
#  Admin
# ─────────────────────────────────────────────

class AdminCreate(BaseModel):
    name: str
    email: str
    department: str

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email_str(v)


# ─────────────────────────────────────────────
#  College
# ─────────────────────────────────────────────

class CollegeSave(BaseModel):
    college_id: Optional[str] = ""
    name: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""        # unified field name (no more contact/phone split)
    email: Optional[str] = None
    established_year: Optional[int] = 0

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return _validate_email_str(v)
        return v


# ─────────────────────────────────────────────
#  Department
# ─────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Department name must not be empty")
        return v.strip()


# ─────────────────────────────────────────────
#  Class
# ─────────────────────────────────────────────

class ClassCreate(BaseModel):
    department: str
    academicYear: str
    year: int
    semester: int
    section: str
    strength: int

    @field_validator("strength", "year", "semester")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Must be greater than 0")
        return v


class ClassUpdate(ClassCreate):
    pass


# ─────────────────────────────────────────────
#  Timetable rules
# ─────────────────────────────────────────────

class LunchBreak(BaseModel):
    start: str = "12:30"
    end: str = "13:30"


class TimetableRulesSave(BaseModel):
    classId: str
    numSubjects: int
    subjects: List[str]
    workingDays: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    periodsPerDay: int
    periodDuration: int = 60
    lunchBreak: LunchBreak = LunchBreak()
    maxSameSubjectPerDay: int = 1
    noFacultyClash: bool = True

    @field_validator("numSubjects")
    @classmethod
    def num_subjects_range(cls, v: int) -> int:
        if not (1 <= v <= 20):
            raise ValueError("numSubjects must be 1–20")
        return v

    @field_validator("periodsPerDay")
    @classmethod
    def periods_range(cls, v: int) -> int:
        if not (1 <= v <= 10):
            raise ValueError("periodsPerDay must be 1–10")
        return v

    @field_validator("maxSameSubjectPerDay")
    @classmethod
    def max_same_range(cls, v: int) -> int:
        if not (1 <= v <= 3):
            raise ValueError("maxSameSubjectPerDay must be 1–3")
        return v


# ─────────────────────────────────────────────
#  Timetable generate / publish
# ─────────────────────────────────────────────

class TimetableGenerateRequest(BaseModel):
    classId: str


class TimetablePublishRequest(BaseModel):
    classId: str


# ─────────────────────────────────────────────
#  Bulk timetable update
# ─────────────────────────────────────────────

class TimetableEntry(BaseModel):
    id: str                          # MongoDB _id as string
    schedule: dict
    assignedHours: Optional[int] = None
    totalSlots: Optional[int] = None
    version: Optional[int] = 0