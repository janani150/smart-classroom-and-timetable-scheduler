"""
routes.py — Complete API routes for Smart Classroom
=====================================================
Sections:
  1.  Helpers
  2.  Auth            POST /signup  POST /login
  3.  Profile         GET  /profile/{role}?email=...
  4.  Students        CRUD /students  +  POST /students/assign-class
  5.  Teachers        CRUD /teachers
  6.  Admins          CRUD /admins
  7.  College         GET/POST/DELETE /college
  8.  Departments     GET/POST/DELETE /departments
  9.  Classes         CRUD /classes
  10. Subjects        CRUD /subjects
  11. Timetable Rules GET/POST/DELETE /timetable-rules
  12. Timetable Gen   POST /timetable/generate
  13. Timetable CRUD  GET/PUT/DELETE /timetables
  14. Timetable Pub   POST /timetables/publish  /timetables/unpublish
  15. Student view    GET  /student/timetable?classId=
  16. Attendance      GET/POST /attendance  GET /attendance/summary/{class_id}
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from bson import ObjectId
import hashlib
import logging
import random
import bcrypt
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# JWT
from jose import JWTError, jwt

from app.database import db
from app.models import (
    SignupRequest, LoginRequest,
    StudentCreate, StudentUpdate,
    TeacherCreate, TeacherUpdate,
    AdminCreate,
    CollegeSave,
    DepartmentCreate,
    ClassCreate, ClassUpdate,
    TimetableRulesSave,
    TimetableGenerateRequest,
    TimetablePublishRequest,
    TimetableEntry,
)

logger = logging.getLogger(__name__)
router  = APIRouter()
security = HTTPBearer(auto_error=False)

# ── JWT config (set these in your .env) ──────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "smartclassroom_secret_change_in_production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# ── SMTP config (set these in your .env for email features) ──────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")      # your Gmail address
SMTP_PASS     = os.getenv("SMTP_PASS", "")      # Gmail app password
SMTP_FROM     = os.getenv("SMTP_FROM", SMTP_USER)


# ══════════════════════════════════════════════════
#  1. HELPERS
# ══════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """bcrypt hash — slow by design, salted automatically."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """
    Supports both old SHA-256 hashes and new bcrypt hashes.
    Old accounts have a 64-char hex SHA-256 hash.
    New accounts have a bcrypt hash starting with $2b$.
    """
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        try:
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        except Exception:
            return False
    else:
        # Legacy SHA-256
        return hashlib.sha256(plain.encode()).hexdigest() == hashed


def serialize_doc(doc: dict) -> dict:
    """Convert ObjectId _id to string so FastAPI can JSON-serialise it."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_token(email: str, role: str) -> str:
    """Create a signed JWT token valid for JWT_EXPIRE_HOURS."""
    payload = {
        "sub":   email,
        "role":  role,
        "exp":   datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat":   datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises HTTPException on failure."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """FastAPI dependency — validates Bearer token and returns payload."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    return decode_token(credentials.credentials)


def require_role(*roles):
    """Dependency factory — only allows specified roles."""
    def _check(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user
    return _check


# ── Email helper ─────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, html_body: str) -> bool:
    """
    Send an HTML email via SMTP.
    Returns True on success, False if SMTP is not configured or fails.
    Set SMTP_USER and SMTP_PASS in .env to enable.
    """
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — email not sent")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM or SMTP_USER
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM or SMTP_USER, to, msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email failed to {to}: {e}")
        return False


def email_template(title: str, body_html: str) -> str:
    """Minimal branded HTML email template."""
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center;">
        <h2 style="color:#fff;margin:0;">🎓 SmartClass</h2>
      </div>
      <div style="padding:28px;">
        <h3 style="color:#1e1b4b;margin-top:0;">{title}</h3>
        {body_html}
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">
          This is an automated message from SmartClass. Do not reply to this email.
        </p>
      </div>
    </div>
    """


COLLECTION_MAP = {
    "student": "students",
    "teacher": "teachers",
    "admin":   "admins",
}

DAY_ORDER = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5}


# ══════════════════════════════════════════════════
#  2. AUTH
# ══════════════════════════════════════════════════

@router.post("/signup", status_code=201)
def signup_user(data: SignupRequest):
    """Register a new student / teacher / admin."""
    collection_name = COLLECTION_MAP[data.role]

    if db[collection_name].find_one({"email": data.email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    if data.role == "student":
        if not data.year or not data.section:
            raise HTTPException(
                status_code=400,
                detail="year and section are required for students",
            )

    user_doc = {
        "name":       data.name,
        "email":      data.email,
        "password":   hash_password(data.password),
        "role":       data.role,
        "department": data.department,
        "created_at": str(date.today()),
    }

    if data.role == "student":
        user_doc["year"]    = data.year
        user_doc["section"] = data.section

    db[collection_name].insert_one(user_doc)

    # Send welcome email (non-blocking — fails silently if SMTP not configured)
    send_email(
        to      = data.email,
        subject = "Welcome to SmartClass! 🎓",
        html_body = email_template(
            title = f"Welcome, {data.name}!",
            body_html = f"""
            <p>Your <strong>{data.role}</strong> account has been created successfully.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;color:#6b7280;">Email</td><td style="padding:8px;font-weight:600;">{data.email}</td></tr>
              <tr style="background:#f9fafb;"><td style="padding:8px;color:#6b7280;">Role</td><td style="padding:8px;font-weight:600;">{data.role.capitalize()}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">Department</td><td style="padding:8px;font-weight:600;">{data.department or '—'}</td></tr>
            </table>
            <p>You can now <a href="#" style="color:#4f46e5;">log in to SmartClass</a>.</p>
            """
        )
    )

    return {"message": f"{data.role.capitalize()} registered successfully"}


@router.post("/login")
def login_user(data: LoginRequest):
    """
    Authenticate and return user info.
    Auto-upgrades legacy SHA-256 passwords to bcrypt on first login.
    Students also get classId, year, section.
    Teachers also get subjects, department.
    """
    collection_name = COLLECTION_MAP[data.role]
    user = db[collection_name].find_one({"email": data.email})

    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Silently upgrade old SHA-256 hash to bcrypt on successful login
    stored_hash = user["password"]
    if not (stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$")):
        db[collection_name].update_one(
            {"email": data.email},
            {"$set": {"password": hash_password(data.password)}}
        )
        logger.info(f"Upgraded password hash for {data.email} from SHA-256 to bcrypt")

    response: Dict[str, Any] = {
        "message": "Login successful",
        "role":    data.role,
        "name":    user.get("name", "User"),
        "email":   data.email,
        "token":   create_token(data.email, data.role),   # ← JWT token
    }

    if data.role == "student":
        response["classId"]    = user.get("classId", "")
        response["year"]       = user.get("year", "")
        response["section"]    = user.get("section", "")
        response["department"] = user.get("department", "")

    if data.role == "teacher":
        response["subjects"]       = user.get("subjects", [])
        response["department"]     = user.get("department", "")
        response["qualifications"] = user.get("qualifications", "")

    return response


# ══════════════════════════════════════════════════
#  3. PROFILE
#  Uses query param for email — avoids URL routing
#  issues with @ and . in email addresses.
#  Usage: GET /api/profile/student?email=user@example.com
# ══════════════════════════════════════════════════

@router.get("/profile/{role}")
def get_profile(
    role:  str,
    email: str = Query(..., description="User email address"),
):
    """
    GET /api/profile/student?email=user@example.com
    GET /api/profile/teacher?email=teacher@example.com
    GET /api/profile/admin?email=admin@example.com
    Returns full user document minus password.
    """
    if role not in COLLECTION_MAP:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db[COLLECTION_MAP[role]].find_one(
        {"email": email},
        {"_id": 0, "password": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail=f"No {role} found with email '{email}'")
    return user


@router.post("/change-password")
def change_password(data: Dict[str, Any]):
    """
    Change password for any user role.
    Body: { "email": "...", "role": "student|teacher|admin",
            "currentPassword": "...", "newPassword": "..." }
    Sends a confirmation email if SMTP is configured.
    """
    email        = data.get("email", "").strip()
    role         = data.get("role", "").strip()
    current_pw   = data.get("currentPassword", "")
    new_pw       = data.get("newPassword", "")

    if not email or not role or not current_pw or not new_pw:
        raise HTTPException(status_code=400, detail="email, role, currentPassword and newPassword are required")
    if role not in COLLECTION_MAP:
        raise HTTPException(status_code=400, detail="Invalid role")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    collection = COLLECTION_MAP[role]
    user = db[collection].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(current_pw, user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    db[collection].update_one(
        {"email": email},
        {"$set": {"password": hash_password(new_pw), "passwordChangedAt": str(date.today())}}
    )

    # Send confirmation email
    send_email(
        to        = email,
        subject   = "Password changed — SmartClass",
        html_body = email_template(
            title     = "Password Changed Successfully",
            body_html = f"""
            <p>Hi <strong>{user.get('name', 'User')}</strong>,</p>
            <p>Your SmartClass password was changed on <strong>{date.today()}</strong>.</p>
            <p style="color:#ef4444;">If you did not make this change, please contact your admin immediately.</p>
            """
        )
    )

    return {"message": "Password changed successfully"}


# ══════════════════════════════════════════════════
#  4. STUDENTS
# ══════════════════════════════════════════════════

@router.get("/students")
def get_students():
    docs = list(db.students.find({}, {"password": 0}))
    return [serialize_doc(d) for d in docs]


@router.post("/students", status_code=201)
def create_student(student: StudentCreate):
    if db.students.find_one({"email": student.email}):
        raise HTTPException(status_code=409, detail="Email already exists")
    if db.students.find_one({"student_id": student.student_id}):
        raise HTTPException(status_code=409, detail="Student ID already exists")

    data = student.model_dump()
    data["created_at"] = str(date.today())
    db.students.insert_one(data)
    return {"message": "Student created successfully"}


@router.put("/students/{student_id}")
def update_student(student_id: str, student: StudentUpdate):
    result = db.students.update_one(
        {"student_id": student_id},
        {"$set": {**student.model_dump(), "updated_at": str(date.today())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student updated successfully"}


@router.delete("/students/{student_id}")
def delete_student(student_id: str):
    result = db.students.delete_one({"student_id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted successfully"}


@router.post("/students/assign-class")
def assign_class_to_student(data: Dict[str, Any]):
    """
    Admin assigns a classId to a student.
    Body: { "email": "student@example.com", "classId": "CSE-1-A" }
    Uses POST with body (not PATCH with email in URL) to avoid
    URL routing issues with @ symbol in email addresses.
    """
    email    = data.get("email", "").strip()
    class_id = data.get("classId", "").strip()

    if not email or not class_id:
        raise HTTPException(status_code=400, detail="email and classId are required")
    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=404, detail=f"Class '{class_id}' does not exist")

    result = db.students.update_one(
        {"email": email},
        {"$set": {"classId": class_id, "updated_at": str(date.today())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"No student found with email '{email}'")
    return {"message": f"Student {email} assigned to class {class_id}"}


# ══════════════════════════════════════════════════
#  5. TEACHERS
# ══════════════════════════════════════════════════

@router.get("/teachers")
def get_teachers():
    docs = list(db.teachers.find({}, {"password": 0}))
    return [serialize_doc(d) for d in docs]


@router.post("/teachers", status_code=201)
def create_teacher(teacher: TeacherCreate):
    if db.teachers.find_one({"email": teacher.email}):
        raise HTTPException(status_code=409, detail="Email already exists")

    data = teacher.model_dump()
    data["created_at"] = str(date.today())
    db.teachers.insert_one(data)
    db.college.update_one({}, {"$inc": {"teachers": 1}}, upsert=True)
    return {"message": "Teacher added successfully"}


@router.put("/teachers/{teacher_id}")
def update_teacher(teacher_id: str, teacher: TeacherUpdate):
    try:
        oid = ObjectId(teacher_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid teacher ID")

    result = db.teachers.update_one(
        {"_id": oid},
        {"$set": {**teacher.model_dump(), "updated_at": str(date.today())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {"message": "Teacher updated successfully"}


@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: str):
    try:
        oid = ObjectId(teacher_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid teacher ID")

    result = db.teachers.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    db.college.update_one({}, {"$inc": {"teachers": -1}}, upsert=True)
    return {"message": "Teacher deleted successfully"}


# ══════════════════════════════════════════════════
#  6. ADMINS
# ══════════════════════════════════════════════════

@router.get("/admins")
def get_admins():
    docs = list(db.admins.find({}, {"password": 0}))
    return [serialize_doc(d) for d in docs]


@router.post("/admins", status_code=201)
def create_admin(admin: AdminCreate):
    if db.admins.find_one({"email": admin.email}):
        raise HTTPException(status_code=409, detail="Email already exists")
    data = admin.model_dump()
    data["created_at"] = str(date.today())
    db.admins.insert_one(data)
    return {"message": "Admin created successfully"}


# ══════════════════════════════════════════════════
#  7. COLLEGE
# ══════════════════════════════════════════════════

@router.get("/college")
def get_college():
    doc = db.college.find_one({}, {"_id": 0})
    return doc or {}


@router.post("/college")
def save_college(data: CollegeSave):
    db.college.update_one({}, {"$set": data.model_dump()}, upsert=True)
    return {"message": "College details saved"}


@router.delete("/college")
def delete_college():
    result = db.college.delete_many({})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No college details found")
    return {"message": "College details deleted"}


# ══════════════════════════════════════════════════
#  8. DEPARTMENTS
# ══════════════════════════════════════════════════

@router.get("/departments")
def get_departments():
    docs = list(db.departments.find({}))
    return [serialize_doc(d) for d in docs]


@router.post("/departments", status_code=201)
def add_department(dept: DepartmentCreate):
    if db.departments.find_one({"name": dept.name}):
        raise HTTPException(status_code=409, detail="Department already exists")
    db.departments.insert_one({"name": dept.name})
    db.college.update_one({}, {"$inc": {"departments": 1}}, upsert=True)
    return {"message": "Department added"}


@router.delete("/departments/{dept_id}")
def delete_department(dept_id: str):
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid department ID")

    result = db.departments.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    db.college.update_one({}, {"$inc": {"departments": -1}}, upsert=True)
    return {"message": "Department deleted"}


# ══════════════════════════════════════════════════
#  9. CLASSES
# ══════════════════════════════════════════════════

def _validate_class_data(data) -> str:
    if not db.departments.find_one({"name": data.department}):
        raise HTTPException(status_code=400, detail="Department does not exist")
    valid_semesters = {2 * data.year - 1, 2 * data.year}
    if data.semester not in valid_semesters:
        raise HTTPException(
            status_code=400,
            detail=f"For year {data.year}, semester must be one of {sorted(valid_semesters)}",
        )
    return f"{data.department}-{data.year}-{data.section.upper()}"


@router.get("/classes")
def get_classes():
    docs = list(db.classes.find({}))
    return [serialize_doc(d) for d in docs]


@router.post("/classes", status_code=201)
def add_class(data: ClassCreate):
    class_id = _validate_class_data(data)
    if db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=409, detail="Class already exists")
    class_doc = {
        **data.model_dump(),
        "classId":   class_id,
        "section":   data.section.upper(),
        "createdAt": str(date.today()),
    }
    db.classes.insert_one(class_doc)
    return {"message": "Class added", "classId": class_id}


@router.put("/classes/{class_id}")
def update_class(class_id: str, data: ClassUpdate):
    new_class_id = _validate_class_data(data)
    if new_class_id != class_id:
        if db.classes.find_one({"classId": new_class_id}):
            raise HTTPException(status_code=409, detail="New class ID already exists")
    update_doc = {**data.model_dump(), "section": data.section.upper(), "updatedAt": str(date.today())}
    if new_class_id != class_id:
        update_doc["classId"] = new_class_id
    result = db.classes.update_one({"classId": class_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class updated"}


@router.delete("/classes/{class_id}")
def delete_class(class_id: str):
    result = db.classes.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted"}


# ══════════════════════════════════════════════════
#  10. SUBJECTS
# ══════════════════════════════════════════════════

@router.get("/subjects")
def get_all_subjects():
    docs = list(db.subjects.find({}))
    return [serialize_doc(d) for d in docs]


@router.get("/subjects/{class_id}")
def get_subjects_for_class(class_id: str):
    docs = list(db.subjects.find({"classId": class_id}))
    return [serialize_doc(d) for d in docs]


@router.post("/subjects", status_code=201)
def create_subject(data: Dict[str, Any]):
    class_id       = data.get("classId", "").strip()
    subject_name   = data.get("subject", "").strip()
    faculty_name   = data.get("faculty", "").strip()
    hours_per_week = data.get("hours_per_week", 0)

    if not class_id or not subject_name or not faculty_name:
        raise HTTPException(status_code=400, detail="classId, subject and faculty are required")
    if not isinstance(hours_per_week, int) or not (1 <= hours_per_week <= 10):
        raise HTTPException(status_code=400, detail="hours_per_week must be 1-10")
    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=400, detail="Class does not exist")
    if db.subjects.find_one({"classId": class_id, "subject": subject_name}):
        raise HTTPException(status_code=409, detail="Subject already exists for this class")

    doc = {
        "classId": class_id, "subject": subject_name,
        "faculty": faculty_name, "hours_per_week": hours_per_week,
        "created_at": str(date.today()),
    }
    result = db.subjects.insert_one(doc)
    return {"message": "Subject added", "id": str(result.inserted_id)}


@router.put("/subjects/{subject_id}")
def update_subject(subject_id: str, data: Dict[str, Any]):
    try:
        oid = ObjectId(subject_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subject ID")

    subject_name   = data.get("subject", "").strip()
    faculty_name   = data.get("faculty", "").strip()
    hours_per_week = data.get("hours_per_week", 0)

    if not subject_name or not faculty_name:
        raise HTTPException(status_code=400, detail="subject and faculty are required")
    if not isinstance(hours_per_week, int) or not (1 <= hours_per_week <= 10):
        raise HTTPException(status_code=400, detail="hours_per_week must be 1-10")

    update_data: Dict[str, Any] = {
        "subject": subject_name, "faculty": faculty_name,
        "hours_per_week": hours_per_week, "updated_at": str(date.today()),
    }
    if data.get("classId"):
        update_data["classId"] = data["classId"].strip()

    result = db.subjects.update_one({"_id": oid}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"message": "Subject updated"}


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: str):
    try:
        oid = ObjectId(subject_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subject ID")

    result = db.subjects.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"message": "Subject deleted"}


# ══════════════════════════════════════════════════
#  11. TIMETABLE RULES
# ══════════════════════════════════════════════════

@router.get("/timetable-rules")
def get_all_timetable_rules():
    return list(db.timetable_rules.find({}, {"_id": 0}))


@router.get("/timetable-rules/{class_id}")
def get_timetable_rules(class_id: str):
    rules = db.timetable_rules.find_one({"classId": class_id}, {"_id": 0})
    return rules or {}


@router.post("/timetable-rules")
def save_timetable_rules(data: TimetableRulesSave):
    if not db.classes.find_one({"classId": data.classId}):
        raise HTTPException(status_code=400, detail="Class does not exist")
    if len(data.subjects) != data.numSubjects:
        raise HTTPException(status_code=400, detail="Number of subjects does not match numSubjects")

    rules_doc = {
        **data.model_dump(),
        "lunchBreak": data.lunchBreak.model_dump(),
        "createdAt":  str(date.today()),
    }
    db.timetable_rules.update_one({"classId": data.classId}, {"$set": rules_doc}, upsert=True)
    return {"message": "Timetable rules saved"}


@router.delete("/timetable-rules/{class_id}")
def delete_timetable_rules(class_id: str):
    result = db.timetable_rules.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rules not found")
    return {"message": "Timetable rules deleted"}


# ══════════════════════════════════════════════════
#  12. TIMETABLE GENERATOR
# ══════════════════════════════════════════════════

@router.post("/timetable/generate")
def generate_timetable(request: TimetableGenerateRequest):
    class_id = request.classId

    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=404, detail="Class not found")

    rules = db.timetable_rules.find_one({"classId": class_id})
    if not rules:
        raise HTTPException(status_code=404, detail="Timetable rules not found. Set up rules first.")

    subjects = list(db.subjects.find({"classId": class_id}, {"_id": 0}))
    if not subjects:
        raise HTTPException(status_code=404, detail="No subjects found for this class. Add subjects first.")

    teacher_unavailable: Dict[str, set] = {}
    for fac in db.teachers.find({}, {"name": 1, "unavailable_slots": 1}):
        name = fac.get("name", "")
        if name:
            teacher_unavailable[name] = set(fac.get("unavailable_slots", []))

    working_days = sorted(
        rules.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"]),
        key=lambda d: DAY_ORDER.get(d, 99),
    )
    periods_per_day = rules.get("periodsPerDay", 6)

    slots = [
        f"{day}-P{period}"
        for day in working_days
        for period in range(1, periods_per_day + 1)
    ]
    total_slots = len(slots)

    assignments_needed = [
        {"subject": sub.get("subject", "Unknown"), "faculty": sub.get("faculty", "Unassigned")}
        for sub in subjects
        for _ in range(sub.get("hours_per_week", 0))
    ]
    total_hours_needed = len(assignments_needed)

    if total_hours_needed == 0:
        raise HTTPException(status_code=400, detail="All subjects have 0 hours_per_week.")
    if total_hours_needed > total_slots:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough slots ({total_slots}) for required hours ({total_hours_needed}).",
        )

    max_same    = rules.get("maxSameSubjectPerDay", 1)
    no_clash    = rules.get("noFacultyClash", True)
    max_retries = 10
    best_schedule: Dict[str, Any] = {}
    best_count  = 0

    for retry in range(max_retries):
        random.shuffle(assignments_needed)
        temp_schedule:      Dict[str, Any]  = {}
        used_per_day:       Dict[str, list] = {day: [] for day in working_days}
        teacher_slots_used: Dict[str, set]  = {}
        assigned = 0

        for assignment in assignments_needed:
            subject = assignment["subject"]
            faculty = assignment["faculty"]
            for slot in slots:
                if slot in temp_schedule:
                    continue
                day = slot.split("-")[0]
                if [e["subject"] for e in used_per_day[day]].count(subject) >= max_same:
                    continue
                if no_clash and slot in teacher_slots_used.get(faculty, set()):
                    continue
                if slot in teacher_unavailable.get(faculty, set()):
                    continue
                temp_schedule[slot] = {"subject": subject, "faculty": faculty}
                used_per_day[day].append({"subject": subject, "faculty": faculty})
                teacher_slots_used.setdefault(faculty, set()).add(slot)
                assigned += 1
                break

        if assigned > best_count:
            best_count    = assigned
            best_schedule = temp_schedule
        if best_count == total_hours_needed:
            break

    if best_count < total_hours_needed:
        raise HTTPException(
            status_code=500,
            detail=f"Could only assign {best_count}/{total_hours_needed} hours after {max_retries} retries.",
        )

    existing    = db.timetables.find_one({"classId": class_id}, {"version": 1})
    new_version = (existing.get("version", 0) + 1) if existing else 1

    timetable_doc = {
        "classId":           class_id,
        "version":           new_version,
        "generatedAt":       datetime.utcnow().isoformat() + "Z",
        "schedule":          best_schedule,
        "totalSlots":        total_slots,
        "assignedHours":     best_count,
        "workingDaysSorted": working_days,
        "isPublished":       False,
    }

    db.timetables.update_one({"classId": class_id}, {"$set": timetable_doc}, upsert=True)
    logger.info(f"[generate] v{new_version} saved for {class_id}")
    return {"message": "Timetable generated successfully", "timetable": timetable_doc}


# ══════════════════════════════════════════════════
#  13. TIMETABLE CRUD
# ══════════════════════════════════════════════════

@router.get("/timetables")
def get_all_timetables():
    try:
        docs = list(db.timetables.find({}, {
            "_id": 1, "classId": 1, "version": 1, "generatedAt": 1,
            "schedule": 1, "totalSlots": 1, "assignedHours": 1,
            "workingDaysSorted": 1, "isPublished": 1,
        }))
        return [serialize_doc(d) for d in docs]
    except Exception as e:
        logger.error(f"get_all_timetables error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch timetables")


@router.get("/timetables/{class_id}/{version}")
def get_timetable_by_version(class_id: str, version: int):
    doc = db.timetables.find_one({"classId": class_id, "version": version})
    if not doc:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return serialize_doc(doc)


@router.put("/timetables/bulk-update")
def bulk_update_timetables(timetables: List[TimetableEntry]):
    if not timetables:
        return {"message": "No timetables to update"}

    updated_count = 0
    for tt in timetables:
        try:
            oid = ObjectId(tt.id)
        except Exception:
            continue

        result = db.timetables.update_one(
            {"_id": oid},
            {"$set": {
                "schedule":      tt.schedule,
                "assignedHours": tt.assignedHours,
                "totalSlots":    tt.totalSlots,
                "version":       (tt.version or 0) + 1,
                "generatedAt":   datetime.utcnow().isoformat() + "Z",
            }},
        )
        if result.modified_count:
            updated_count += 1

    return {"message": f"Updated {updated_count} timetables successfully"}


@router.delete("/timetables/{class_id}")
def delete_timetable(class_id: str):
    result = db.timetables.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return {"message": "Timetable deleted"}


# ══════════════════════════════════════════════════
#  14. TIMETABLE PUBLISH / UNPUBLISH
# ══════════════════════════════════════════════════

@router.post("/timetables/publish")
def publish_timetable(data: TimetablePublishRequest):
    result = db.timetables.update_many(
        {"classId": data.classId},
        {"$set": {"isPublished": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No timetable found for this class")
    return {"message": "Timetable published", "updated": result.modified_count}


@router.post("/timetables/unpublish")
def unpublish_timetable(data: TimetablePublishRequest):
    result = db.timetables.update_many(
        {"classId": data.classId},
        {"$set": {"isPublished": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No timetable found for this class")
    return {"message": "Timetable unpublished", "updated": result.modified_count}


# ══════════════════════════════════════════════════
#  15. STUDENT TIMETABLE VIEW
#  Only returns published timetables.
# ══════════════════════════════════════════════════

@router.get("/student/timetable")
def get_student_timetable(
    classId: str = Query(..., description="The student's classId e.g. CSE-1-A")
):
    doc = db.timetables.find_one({"classId": classId, "isPublished": True})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"No published timetable for class '{classId}'. Ask admin to publish.",
        )
    return serialize_doc(doc)


# ══════════════════════════════════════════════════
#  16. ATTENDANCE
# ══════════════════════════════════════════════════

@router.get("/attendance")
def get_attendance(
    classId: Optional[str] = Query(None),
    date:    Optional[str] = Query(None),
    faculty: Optional[str] = Query(None),
):
    query: Dict[str, Any] = {}
    if classId: query["classId"] = classId
    if date:    query["date"]    = date
    if faculty: query["faculty"] = faculty
    docs = list(db.attendance.find(query, {"_id": 0}))
    return docs


@router.post("/attendance", status_code=201)
def save_attendance(data: Dict[str, Any]):
    class_id = data.get("classId", "").strip()
    att_date = data.get("date", "").strip()
    slot_key = data.get("slotKey", "").strip()

    if not class_id or not att_date or not slot_key:
        raise HTTPException(status_code=400, detail="classId, date and slotKey are required")

    present = data.get("present", [])
    absent  = data.get("absent",  [])
    total   = data.get("total", len(present) + len(absent))
    rate    = round(len(present) / total * 100, 1) if total else 0.0

    record: Dict[str, Any] = {
        "classId": class_id, "date": att_date, "slotKey": slot_key,
        "faculty": data.get("faculty", ""),
        "present": present, "absent": absent,
        "total": total, "rate": rate,
        "savedAt": datetime.utcnow().isoformat() + "Z",
    }

    db.attendance.update_one(
        {"classId": class_id, "date": att_date, "slotKey": slot_key},
        {"$set": record},
        upsert=True,
    )
    return {"message": "Attendance saved", "rate": f"{rate}%"}


@router.get("/attendance/summary/{class_id}")
def get_attendance_summary(class_id: str):
    records = list(db.attendance.find({"classId": class_id}, {"_id": 0}))
    if not records:
        return []

    summary: Dict[str, Dict[str, Any]] = {}
    for rec in records:
        for sid in rec.get("present", []):
            if sid not in summary:
                summary[sid] = {"student_id": sid, "present": 0, "total": 0}
            summary[sid]["present"] += 1
            summary[sid]["total"]   += 1
        for sid in rec.get("absent", []):
            if sid not in summary:
                summary[sid] = {"student_id": sid, "present": 0, "total": 0}
            summary[sid]["total"] += 1

    result = []
    for s in summary.values():
        s["rate"] = round(s["present"] / s["total"] * 100, 1) if s["total"] else 0.0
        result.append(s)

    return sorted(result, key=lambda x: x["rate"], reverse=True)


@router.get("/attendance/student")
def get_student_attendance_history(
    studentId: str = Query(..., description="student_id or email of the student"),
    classId:   Optional[str] = Query(None, description="Filter by class ID"),
):
    """
    Full attendance history for one student.
    Returns each session record showing present/absent status.
    Used by the student SPA — Attendance History view.
    """
    # Build query — match by student_id or email inside present/absent arrays
    query: Dict[str, Any] = {}
    if classId:
        query["classId"] = classId

    records = list(db.attendance.find(query, {"_id": 0}))

    history = []
    total_sessions = 0
    total_present  = 0

    for rec in records:
        present_list = rec.get("present", [])
        absent_list  = rec.get("absent",  [])
        all_ids      = present_list + absent_list

        # Only include records where this student appears
        if studentId not in all_ids:
            continue

        was_present = studentId in present_list
        total_sessions += 1
        if was_present:
            total_present += 1

        history.append({
            "classId": rec.get("classId", ""),
            "date":    rec.get("date", ""),
            "slotKey": rec.get("slotKey", ""),
            "faculty": rec.get("faculty", ""),
            "status":  "present" if was_present else "absent",
        })

    # Sort by date descending
    history.sort(key=lambda x: x["date"], reverse=True)

    overall_rate = round(total_present / total_sessions * 100, 1) if total_sessions else 0.0

    return {
        "studentId":      studentId,
        "totalSessions":  total_sessions,
        "totalPresent":   total_present,
        "totalAbsent":    total_sessions - total_present,
        "overallRate":    overall_rate,
        "history":        history,
    }


# ══════════════════════════════════════════════════
#  17. SLOT CHANGE REQUESTS
#  Students submit requests → stored in DB
#  Admin views, approves (applies swap), or rejects
# ══════════════════════════════════════════════════

@router.get("/slot-change-requests")
def get_slot_change_requests(
    status:  Optional[str] = Query(None, description="Filter: pending / approved / rejected"),
    classId: Optional[str] = Query(None, description="Filter by class ID"),
):
    """Admin: get all slot change requests."""
    query: Dict[str, Any] = {}
    if status:  query["status"]  = status
    if classId: query["classId"] = classId
    docs = list(db.slot_change_requests.find({}, {"_id": 1, "studentName": 1, "studentEmail": 1,
                                                    "classId": 1, "currentSlot": 1, "newSlot": 1,
                                                    "reason": 1, "status": 1, "submittedAt": 1}))
    return [serialize_doc(d) for d in docs]


@router.post("/slot-change-requests", status_code=201)
def submit_slot_change_request(data: Dict[str, Any]):
    """
    Student submits a slot change request.
    Body: { studentName, studentEmail, classId, currentSlot, newSlot, reason }
    """
    required = ["studentEmail", "classId", "currentSlot", "newSlot"]
    for f in required:
        if not data.get(f, "").strip():
            raise HTTPException(status_code=400, detail=f"{f} is required")

    doc = {
        "studentName":  data.get("studentName", "").strip(),
        "studentEmail": data.get("studentEmail", "").strip(),
        "classId":      data.get("classId", "").strip(),
        "currentSlot":  data.get("currentSlot", "").strip(),
        "newSlot":      data.get("newSlot", "").strip(),
        "reason":       data.get("reason", "").strip(),
        "status":       "pending",
        "submittedAt":  datetime.utcnow().isoformat() + "Z",
    }
    result = db.slot_change_requests.insert_one(doc)
    return {"message": "Request submitted", "id": str(result.inserted_id)}


@router.patch("/slot-change-requests/{request_id}")
def update_slot_change_status(request_id: str, data: Dict[str, Any]):
    """
    Admin approves or rejects a slot change request.
    Body: { "status": "approved" | "rejected" }
    On approval, automatically applies the slot swap to the timetable.
    """
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    new_status = data.get("status", "").strip()
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    req = db.slot_change_requests.find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # If approving, apply the actual slot swap in the timetable
    if new_status == "approved":
        class_id = req["classId"]
        old_slot = req["currentSlot"]
        new_slot = req["newSlot"]

        tt = db.timetables.find_one({"classId": class_id})
        if tt:
            schedule  = dict(tt.get("schedule", {}))
            old_entry = schedule.get(old_slot)
            new_entry = schedule.get(new_slot)

            if old_entry:
                schedule[new_slot] = old_entry
                if new_entry:
                    schedule[old_slot] = new_entry
                else:
                    schedule.pop(old_slot, None)

                db.timetables.update_one(
                    {"classId": class_id},
                    {"$set": {
                        "schedule":    schedule,
                        "version":     tt.get("version", 1) + 1,
                        "generatedAt": datetime.utcnow().isoformat() + "Z",
                    }}
                )

    db.slot_change_requests.update_one(
        {"_id": oid},
        {"$set": {"status": new_status, "resolvedAt": datetime.utcnow().isoformat() + "Z"}}
    )
    return {"message": f"Request {new_status}"}


# ══════════════════════════════════════════════════
#  17. TEACHER NOTIFICATIONS
#  Stores notifications per teacher email.
#  Used to alert teachers when their slot is swapped.
# ══════════════════════════════════════════════════

@router.get("/notifications/teacher")
def get_teacher_notifications(
    email: str = Query(..., description="Teacher email address"),
):
    """Get all notifications for a teacher, newest first."""
    docs = list(db.teacher_notifications.find(
        {"recipientEmail": email},
        {"_id": 1, "recipientEmail": 1, "type": 1, "title": 1,
         "body": 1, "read": 1, "createdAt": 1}
    ).sort("createdAt", -1).limit(50))
    return [serialize_doc(d) for d in docs]


@router.post("/notifications/teacher", status_code=201)
def create_teacher_notification(data: Dict[str, Any]):
    """
    Create a notification for a teacher.
    Body: { recipientEmail, type, title, body }
    Called internally when a slot swap affects another teacher.
    """
    recipient = data.get("recipientEmail", "").strip()
    title     = data.get("title", "").strip()
    body      = data.get("body", "").strip()

    if not recipient or not title:
        raise HTTPException(status_code=400, detail="recipientEmail and title are required")

    doc = {
        "recipientEmail": recipient,
        "type":      data.get("type", "info"),
        "title":     title,
        "body":      body,
        "read":      False,
        "status":    "pending",
        "swapMeta":  data.get("swapMeta"),   # stores classId, oldSlot, newSlot, swapperEmail
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    result = db.teacher_notifications.insert_one(doc)
    return {"message": "Notification created", "id": str(result.inserted_id)}


@router.patch("/notifications/teacher/{notif_id}/read")
def mark_teacher_notification_read(notif_id: str):
    """Mark a single notification as read."""
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    db.teacher_notifications.update_one({"_id": oid}, {"$set": {"read": True}})
    return {"message": "Marked as read"}


@router.patch("/notifications/teacher/read-all")
def mark_all_teacher_notifications_read(
    email: str = Query(..., description="Teacher email"),
):
    """Mark all notifications for a teacher as read."""
    db.teacher_notifications.update_many(
        {"recipientEmail": email},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}


@router.post("/notifications/teacher/{notif_id}/respond")
def respond_to_slot_swap_notification(notif_id: str, data: Dict[str, Any]):
    """
    Displaced teacher accepts or rejects a slot swap notification.
    - accept  → marks notification as read + status=accepted
    - reject  → reverses the timetable swap + status=rejected
    Body: { "status": "accepted" | "rejected", "responderEmail": "..." }
    """
    try:
        oid = ObjectId(notif_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    decision = data.get("status", "").strip()
    if decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'accepted' or 'rejected'")

    notif = db.teacher_notifications.find_one({"_id": oid})
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notif.get("status") and notif["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Already {notif['status']}")

    # If rejected, reverse the swap using stored swap metadata
    if decision == "rejected":
        swap_meta = notif.get("swapMeta")
        if swap_meta:
            class_id  = swap_meta.get("classId")
            old_slot  = swap_meta.get("oldSlot")   # original slot of the swapper
            new_slot  = swap_meta.get("newSlot")   # original slot of the displaced teacher
            tt = db.timetables.find_one({"classId": class_id})
            if tt:
                schedule  = dict(tt.get("schedule", {}))
                # Current state after swap: new_slot has swapper's subject, old_slot has displaced's
                # Reverse: put them back
                swapper_entry   = schedule.get(new_slot)  # swapper is now at new_slot
                displaced_entry = schedule.get(old_slot)  # displaced is now at old_slot

                if swapper_entry:
                    schedule[old_slot] = swapper_entry   # swapper goes back
                if displaced_entry:
                    schedule[new_slot] = displaced_entry  # displaced goes back
                elif new_slot in schedule:
                    del schedule[new_slot]

                db.timetables.update_one(
                    {"classId": class_id},
                    {"$set": {
                        "schedule":    schedule,
                        "version":     tt.get("version", 1) + 1,
                        "generatedAt": datetime.utcnow().isoformat() + "Z",
                    }}
                )

                # Notify the original swapper that their change was rejected
                swapper_email = swap_meta.get("swapperEmail")
                if swapper_email:
                    responder_name = data.get("responderEmail", "The other teacher")
                    db.teacher_notifications.insert_one({
                        "recipientEmail": swapper_email,
                        "type":      "error",
                        "title":     "Slot swap was rejected",
                        "body":      f"Your slot swap in {class_id} ({old_slot} ↔ {new_slot}) "
                                     f"was rejected by {responder_name}. The original timetable has been restored.",
                        "read":      False,
                        "status":    "info",
                        "createdAt": datetime.utcnow().isoformat() + "Z",
                    })

    # Update notification status and mark as read
    db.teacher_notifications.update_one(
        {"_id": oid},
        {"$set": {
            "read":        True,
            "status":      decision,
            "respondedAt": datetime.utcnow().isoformat() + "Z",
        }}
    )
    return {"message": f"Swap {decision}"}