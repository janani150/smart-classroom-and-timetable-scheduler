"""
routes.py — Complete API routes for Smart Classroom
=====================================================
Sections:
  1.  Helpers
  2.  Auth          POST /signup  POST /login
  3.  Students      CRUD /students
  4.  Teachers      CRUD /teachers
  5.  Admins        CRUD /admins
  6.  College       GET/POST/DELETE /college
  7.  Departments   GET/POST/DELETE /departments
  8.  Classes       CRUD /classes
  9.  Subjects      CRUD /subjects
  10. Timetable Rules   GET/POST/DELETE /timetable-rules
  11. Timetable Gen     POST /timetable/generate
  12. Timetable CRUD    GET/PUT/DELETE /timetables
  13. Timetable Publish POST /timetables/publish  /timetables/unpublish
  14. Student view      GET  /student/timetable?classId=
  15. Attendance        GET/POST /attendance  GET /attendance/summary/{class_id}

  NOTE: There is no separate /profile endpoint.
        All user data (name, email, role, dept, classId, subjects...)
        is returned in the /login response and stored in sessionStorage
        by the frontend SPAs. No extra profile API call is needed.
"""


from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import date, datetime
from bson import ObjectId
import logging
import random
import bcrypt

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
router = APIRouter()


# ══════════════════════════════════════════════════
#  1. HELPERS
# ══════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """bcrypt hash — slow by design, salted automatically."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def serialize_doc(doc: dict) -> dict:
    """Convert ObjectId _id to string so FastAPI can JSON-serialise it."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


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
    return {"message": f"{data.role.capitalize()} registered successfully"}


@router.post("/login")
def login_user(data: LoginRequest):
    """
    Authenticate and return user info.
    Students also get classId, year, section.
    Teachers also get subjects, department.
    """
    collection_name = COLLECTION_MAP[data.role]
    user = db[collection_name].find_one({"email": data.email})

    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    response: Dict[str, Any] = {
        "message": "Login successful",
        "role":    data.role,
        "name":    user.get("name", "User"),
        "email":   data.email,
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
#  3. STUDENTS
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


@router.patch("/students/{student_email}/assign-class")
def assign_class_to_student(student_email: str, data: Dict[str, Any]):
    """
    Admin assigns a classId to a student by their email.
    Body: { "classId": "CSE-1-A" }
    """
    class_id = data.get("classId", "").strip()
    if not class_id:
        raise HTTPException(status_code=400, detail="classId is required")
    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=404, detail=f"Class '{class_id}' does not exist")

    result = db.students.update_one(
        {"email": student_email},
        {"$set": {"classId": class_id, "updated_at": str(date.today())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": f"Student assigned to class {class_id}"}

    # Add this after the STUDENTS section (around line 200-220)

@router.get("/profile/student/{email}")
def get_student_profile(email: str):
    """
    Get student profile data including current classId.
    This allows students to see updates made by admin without logging out.
    """
    student = db.students.find_one(
        {"email": email}, 
        {"password": 0}  # Exclude password
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return serialize_doc(student)


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
    db.college.update_one(
        {},
        {"$set": data.model_dump()},
        upsert=True,
    )
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
    """Shared validation for class create & update. Returns classId string."""
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

    update_doc = {
        **data.model_dump(),
        "section":   data.section.upper(),
        "updatedAt": str(date.today()),
    }
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
#  Used by: admin SPA (subjects view), timetable
#           generator, student timetable SPA
# ══════════════════════════════════════════════════

@router.get("/subjects")
def get_all_subjects():
    """Return all subjects across all classes."""
    docs = list(db.subjects.find({}))
    return [serialize_doc(d) for d in docs]


@router.get("/subjects/{class_id}")
def get_subjects_for_class(class_id: str):
    """Return subjects for one specific class."""
    docs = list(db.subjects.find({"classId": class_id}))
    return [serialize_doc(d) for d in docs]


@router.post("/subjects", status_code=201)
def create_subject(data: Dict[str, Any]):
    class_id       = data.get("classId", "").strip()
    subject_name   = data.get("subject", "").strip()
    faculty_name   = data.get("faculty", "").strip()
    hours_per_week = data.get("hours_per_week", 0)

    if not class_id or not subject_name or not faculty_name:
        raise HTTPException(
            status_code=400,
            detail="classId, subject and faculty are required",
        )
    if not isinstance(hours_per_week, int) or not (1 <= hours_per_week <= 10):
        raise HTTPException(status_code=400, detail="hours_per_week must be 1–10")
    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=400, detail="Class does not exist")
    if db.subjects.find_one({"classId": class_id, "subject": subject_name}):
        raise HTTPException(status_code=409, detail="Subject already exists for this class")

    doc = {
        "classId":        class_id,
        "subject":        subject_name,
        "faculty":        faculty_name,
        "hours_per_week": hours_per_week,
        "created_at":     str(date.today()),
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
        raise HTTPException(status_code=400, detail="hours_per_week must be 1–10")

    update_data: Dict[str, Any] = {
        "subject":        subject_name,
        "faculty":        faculty_name,
        "hours_per_week": hours_per_week,
        "updated_at":     str(date.today()),
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
        raise HTTPException(
            status_code=400,
            detail="Number of subjects does not match numSubjects",
        )

    rules_doc = {
        **data.model_dump(),
        "lunchBreak": data.lunchBreak.model_dump(),
        "createdAt":  str(date.today()),
    }
    db.timetable_rules.update_one(
        {"classId": data.classId},
        {"$set": rules_doc},
        upsert=True,
    )
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
    """
    Auto-generate a clash-free timetable for a class.
    Prerequisites: class exists, rules saved, subjects added.
    Uses random-shuffle + retry backtracking to fill slots.
    """
    class_id = request.classId

    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=404, detail="Class not found")

    rules = db.timetable_rules.find_one({"classId": class_id})
    if not rules:
        raise HTTPException(
            status_code=404,
            detail="Timetable rules not found. Set up rules first.",
        )

    subjects = list(db.subjects.find({"classId": class_id}, {"_id": 0}))
    if not subjects:
        raise HTTPException(
            status_code=404,
            detail="No subjects found for this class. Add subjects first.",
        )

    # Teacher unavailability  {name: {slot, ...}}
    teacher_unavailable: Dict[str, set] = {}
    for fac in db.teachers.find({}, {"name": 1, "unavailable_slots": 1}):
        name = fac.get("name", "")
        if name:
            teacher_unavailable[name] = set(fac.get("unavailable_slots", []))

    # Sort working days into canonical week order
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

    # Expand each subject into individual period assignments
    assignments_needed = [
        {"subject": sub.get("subject", "Unknown"), "faculty": sub.get("faculty", "Unassigned")}
        for sub in subjects
        for _ in range(sub.get("hours_per_week", 0))
    ]
    total_hours_needed = len(assignments_needed)

    if total_hours_needed == 0:
        raise HTTPException(
            status_code=400,
            detail="All subjects have 0 hours_per_week. Set hours > 0 for at least one subject.",
        )
    if total_hours_needed > total_slots:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough slots ({total_slots}) for required hours ({total_hours_needed}). "
                f"Increase periodsPerDay or reduce subject hours."
            ),
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

                # Constraint 1: max same subject per day
                if [e["subject"] for e in used_per_day[day]].count(subject) >= max_same:
                    continue

                # Constraint 2: no faculty clash across classes
                if no_clash and slot in teacher_slots_used.get(faculty, set()):
                    continue

                # Constraint 3: teacher's pre-declared unavailability
                if slot in teacher_unavailable.get(faculty, set()):
                    continue

                temp_schedule[slot] = {"subject": subject, "faculty": faculty}
                used_per_day[day].append({"subject": subject, "faculty": faculty})
                teacher_slots_used.setdefault(faculty, set()).add(slot)
                assigned += 1
                break

        logger.info(f"[generate] Retry {retry + 1}: {assigned}/{total_hours_needed}")

        if assigned > best_count:
            best_count    = assigned
            best_schedule = temp_schedule

        if best_count == total_hours_needed:
            break

    if best_count < total_hours_needed:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Could only assign {best_count}/{total_hours_needed} hours after "
                f"{max_retries} retries. "
                f"Try relaxing constraints or reducing subject hours."
            ),
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

    db.timetables.update_one(
        {"classId": class_id},
        {"$set": timetable_doc},
        upsert=True,
    )

    logger.info(f"[generate] v{new_version} saved for {class_id}")
    return {"message": "Timetable generated successfully", "timetable": timetable_doc}


# ══════════════════════════════════════════════════
#  13. TIMETABLE CRUD
# ══════════════════════════════════════════════════

@router.get("/timetables")
def get_all_timetables():
    """Return all timetables (_id as string)."""
    try:
        docs = list(db.timetables.find({}, {
            "_id": 1, "classId": 1, "version": 1,
            "generatedAt": 1, "schedule": 1,
            "totalSlots": 1, "assignedHours": 1,
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
    """
    Batch-update schedule data for one or more timetables.
    Used by the admin timetable viewer's inline editor.
    """
    if not timetables:
        return {"message": "No timetables to update"}

    updated_count = 0
    for tt in timetables:
        try:
            oid = ObjectId(tt.id)
        except Exception:
            logger.warning(f"bulk_update: invalid ObjectId skipped — {tt.id}")
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

    logger.info(f"bulk_update: updated {updated_count} timetables")
    return {"message": f"Updated {updated_count} timetables successfully"}


@router.delete("/timetables/{class_id}")
def delete_timetable(class_id: str):
    """Delete the timetable for a class entirely."""
    result = db.timetables.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return {"message": "Timetable deleted"}


# ══════════════════════════════════════════════════
#  14. TIMETABLE PUBLISH / UNPUBLISH
# ══════════════════════════════════════════════════

@router.post("/timetables/publish")
def publish_timetable(data: TimetablePublishRequest):
    """
    Mark a timetable as published so students can see it.
    Called from the admin Generate or Viewer pages.
    """
    result = db.timetables.update_many(
        {"classId": data.classId},
        {"$set": {"isPublished": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No timetable found for this class")
    return {"message": "Timetable published", "updated": result.modified_count}


@router.post("/timetables/unpublish")
def unpublish_timetable(data: TimetablePublishRequest):
    """Pull a timetable back to draft (hide from students)."""
    result = db.timetables.update_many(
        {"classId": data.classId},
        {"$set": {"isPublished": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No timetable found for this class")
    return {"message": "Timetable unpublished", "updated": result.modified_count}


# ══════════════════════════════════════════════════
#  15. STUDENT TIMETABLE VIEW
#  Returns only published timetables.
#  The student SPA calls: GET /api/student/timetable?classId=CSE-1-A
# ══════════════════════════════════════════════════

@router.get("/student/timetable")
def get_student_timetable(
    classId: str = Query(..., description="The student's classId e.g. CSE-1-A")
):
    """
    Serve the published timetable for a student's class.
    Students cannot see unpublished timetables.
    """
    doc = db.timetables.find_one({"classId": classId, "isPublished": True})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No published timetable for class '{classId}'. "
                f"Ask your admin to publish the timetable."
            ),
        )
    return serialize_doc(doc)


# ══════════════════════════════════════════════════
#  16. ATTENDANCE
#  Teachers POST records; admin/teacher GET reports.
#  Collection: db.attendance
# ══════════════════════════════════════════════════

@router.get("/attendance")
def get_attendance(
    classId: Optional[str] = Query(None, description="Filter by class ID"),
    date:    Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    faculty: Optional[str] = Query(None, description="Filter by faculty name"),
):
    """Fetch attendance records with optional filters."""
    query: Dict[str, Any] = {}
    if classId: query["classId"] = classId
    if date:    query["date"]    = date
    if faculty: query["faculty"] = faculty

    docs = list(db.attendance.find(query, {"_id": 0}))
    return docs


@router.post("/attendance", status_code=201)
def save_attendance(data: Dict[str, Any]):
    """
    Save or update one attendance record (upsert by classId + date + slotKey).

    Expected body:
    {
        "classId":   "CSE-1-A",
        "date":      "2025-12-25",
        "slotKey":   "Mon-P2",
        "faculty":   "Dr. Ravi Kumar",
        "present":   ["stud_id_1", "stud_id_2"],
        "absent":    ["stud_id_3"],
        "total":     30
    }
    """
    class_id = data.get("classId", "").strip()
    att_date = data.get("date", "").strip()
    slot_key = data.get("slotKey", "").strip()

    if not class_id or not att_date or not slot_key:
        raise HTTPException(
            status_code=400,
            detail="classId, date and slotKey are required",
        )

    present = data.get("present", [])
    absent  = data.get("absent",  [])
    total   = data.get("total", len(present) + len(absent))
    rate    = round(len(present) / total * 100, 1) if total else 0.0

    record: Dict[str, Any] = {
        "classId":  class_id,
        "date":     att_date,
        "slotKey":  slot_key,
        "faculty":  data.get("faculty", ""),
        "present":  present,
        "absent":   absent,
        "total":    total,
        "rate":     rate,
        "savedAt":  datetime.utcnow().isoformat() + "Z",
    }

    db.attendance.update_one(
        {"classId": class_id, "date": att_date, "slotKey": slot_key},
        {"$set": record},
        upsert=True,
    )
    return {"message": "Attendance saved", "rate": f"{rate}%"}


@router.get("/attendance/summary/{class_id}")
def get_attendance_summary(class_id: str):
    """
    Per-student attendance summary for a class.
    Returns: [{student_id, present, total, rate}, ...]
    Sorted by rate descending.
    """
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