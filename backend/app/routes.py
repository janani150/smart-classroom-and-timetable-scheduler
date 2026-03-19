# routes.py - Full Routes (All Endpoints + Fixed Imports/Logic)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any  # 🔥 FIXED: Added Any + List/Dict
from datetime import date, datetime  # For dates/timestamps
import hashlib
from bson import ObjectId
import logging  # For logger
import random  # For generate randomization



# Assuming app.database.db is imported - adjust if needed
from app.database import db  # Your MongoDB instance

# Logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

# ================= Password Hashing =================
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

# ================= Signup APIs =================
@router.post("/signup")
def signup_user(data: Dict[str, Any]):
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")
    department = data.get("department")
    year = data.get("year")
    section = data.get("section")   # ✅ ADD THIS

    if not name or not email or not password or not role or not department:
        raise HTTPException(status_code=400, detail="Missing required fields")

    hashed_password = hash_password(password)

    user_data = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": role,
        "department": department
    }

    if role == "student":
        if not year or not section:
            raise HTTPException(
                status_code=400,
                detail="Year and Section required for students"
            )

        user_data["year"] = year
        user_data["section"] = section   # ✅ STORE IT

        db.students.insert_one(user_data)

    elif role == "teacher":
        db.teachers.insert_one(user_data)

    elif role == "admin":
        db.admins.insert_one(user_data)

    else:
        raise HTTPException(status_code=400, detail="Invalid role")

    return {"message": f"{role.capitalize()} registered successfully"}


# ================= Login API =================
@router.post("/login")
def login_user(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not email or not password or not role:
        raise HTTPException(status_code=400, detail="All fields required")

    collection_map = {
        "student": db.students,
        "teacher": db.teachers,
        "admin": db.admins
    }

    user = collection_map[role].find_one({"email": email})

    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login success",
        "role": role,
        "name": user.get("name", "User")
    }

# ================= Student APIs =================
@router.get("/students")
def get_students():
    return list(db.students.find({}, {"_id": 0}))

class StudentCreate(BaseModel):
    name: str
    email: str
    department: str
    year: int

@router.post("/students")
def create_student(student: StudentCreate):
    data = student.dict()
    data["created_at"] = str(date.today())
    db.students.insert_one(data)
    return {"message": "Student created successfully"}

@router.put("/students/{student_id}")
def update_student(student_id: str, student: StudentCreate):
    result = db.students.update_one(
        {"student_id": student_id},
        {"$set": student.dict()}
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

# ================= Teacher APIs =================
@router.get("/teachers")
def get_teachers():
    teachers = list(db.teachers.find({}, {"password": 0}))
    for teacher in teachers:
        if '_id' in teacher:
            teacher['_id'] = str(teacher['_id'])
    return teachers

@router.post("/teachers")
def create_teacher(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email required")
    teacher_data = {
        "name": name,
        "email": email,
        "department": data.get("department", ""),
        "subjects": data.get("subjects", []),
        "qualifications": data.get("qualifications", ""),
        "role": data.get("role", ""),
        "created_at": str(date.today())
    }
    db.teachers.insert_one(teacher_data)
    db.college.update_one({}, {"$inc": {"teachers": 1}}, upsert=True)
    return {"message": "Teacher added"}

@router.put("/teachers/{teacher_id}")
def update_teacher(teacher_id: str, data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    teacher_oid = ObjectId(teacher_id)
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email required")
    update_data = {
        "name": name,
        "email": email,
        "department": data.get("department", ""),
        "subjects": data.get("subjects", []),
        "qualifications": data.get("qualifications", ""),
        "role": data.get("role", ""),
        "updated_at": str(date.today())
    }
    result = db.teachers.update_one({"_id": teacher_oid}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {"message": "Teacher updated"}

@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: str):
    teacher_oid = ObjectId(teacher_id)
    result = db.teachers.delete_one({"_id": teacher_oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    db.college.update_one({}, {"$inc": {"teachers": -1}}, upsert=True)
    return {"message": "Teacher deleted"}

# ================= Admin APIs =================
class AdminCreate(BaseModel):
    name: str
    email: str
    department: str

@router.get("/admins")
def get_admins():
    return list(db.admins.find({}, {"_id": 0}))

@router.post("/admins")
def create_admin(admin: AdminCreate):
    db.admins.insert_one(admin.dict())
    return {"message": "Admin created successfully"}

# ================= College APIs =================
@router.get("/college")
def get_college():
    college_doc = db.college.find_one({}, {"_id": 0})
    if college_doc and 'phone' in college_doc:
        college_doc['contact'] = college_doc['phone']
    return college_doc or {}

@router.post("/college")
def save_college(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    mapped_data = data.copy()
    if 'contact' in mapped_data:
        mapped_data['phone'] = mapped_data.pop('contact')
    mapped_data.setdefault('college_id', '')
    mapped_data.setdefault('established_year', 0)
    db.college.update_one({}, {"$set": mapped_data}, upsert=True)
    return {"message": "College details saved"}

@router.delete("/college")
def delete_college():
    result = db.college.delete_many({})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No college details found")
    return {"message": "College details deleted"}

# ================= Departments APIs =================
@router.get("/departments")
def get_departments():
    depts = list(db.departments.find({}))
    for dept in depts:
        if '_id' in dept:
            dept['_id'] = str(dept['_id'])
    return depts

@router.post("/departments")
def add_department(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name required")
    db.departments.insert_one({"name": name})
    db.college.update_one({}, {"$inc": {"departments": 1}}, upsert=True)
    return {"message": "Department added"}

@router.delete("/departments/{dept_id}")
def delete_department(dept_id: str):
    dept_oid = ObjectId(dept_id)
    result = db.departments.delete_one({"_id": dept_oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    db.college.update_one({}, {"$inc": {"departments": -1}}, upsert=True)
    return {"message": "Department deleted"}

# ================= Classes APIs =================
@router.get("/classes")
def get_classes():
    classes = list(db.classes.find({}, {"_id": 0}))
    for cls in classes:
        if '_id' in cls:
            cls['_id'] = str(cls['_id'])
    return classes

@router.post("/classes")
def add_class(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    department = data.get("department", "").strip()
    academic_year = data.get("academicYear", "").strip()
    year = data.get("year", 0)
    semester = data.get("semester", 0)
    section = data.get("section", "").strip().upper()
    strength = data.get("strength", 0)

    if not all([department, academic_year, year > 0, semester > 0, section, strength > 0]):
        raise HTTPException(status_code=400, detail="All fields required: department, academicYear, year, semester, section, strength > 0")

    if not db.departments.find_one({"name": department}):
        raise HTTPException(status_code=400, detail="Department must exist")

    if not (semester in [2*year-1, 2*year]):
        raise HTTPException(status_code=400, detail="Semester must be odd/even for the year (e.g., year 2: 3 or 4)")

    class_id = f"{department}-{year}-{section}"

    if db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=400, detail="Class with this ID already exists")

    class_data = {
        "classId": class_id,
        "department": department,
        "academicYear": academic_year,
        "year": year,
        "semester": semester,
        "section": section,
        "strength": strength,
        "createdAt": str(date.today())
    }
    db.classes.insert_one(class_data)
    return {"message": "Class added", "class": class_data}

@router.put("/classes/{class_id}")
def update_class(class_id: str, data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    department = data.get("department", "").strip()
    academic_year = data.get("academicYear", "").strip()
    year = data.get("year", 0)
    semester = data.get("semester", 0)
    section = data.get("section", "").strip().upper()
    strength = data.get("strength", 0)

    if not all([department, academic_year, year > 0, semester > 0, section, strength > 0]):
        raise HTTPException(status_code=400, detail="All fields required: department, academicYear, year, semester, section, strength > 0")

    if not db.departments.find_one({"name": department}):
        raise HTTPException(status_code=400, detail="Department must exist")

    if not (semester in [2*year-1, 2*year]):
        raise HTTPException(status_code=400, detail="Semester must be odd/even for the year (e.g., year 2: 3 or 4)")

    new_class_id = f"{department}-{year}-{section}"
    if new_class_id != class_id:
        if db.classes.find_one({"classId": new_class_id}):
            raise HTTPException(status_code=400, detail="New class ID would conflict")

    update_data = {
        "department": department,
        "academicYear": academic_year,
        "year": year,
        "semester": semester,
        "section": section,
        "strength": strength,
        "updatedAt": str(date.today())
    }
    if new_class_id != class_id:
        update_data["classId"] = new_class_id

    result = db.classes.update_one({"classId": class_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class updated"}

@router.delete("/classes/{class_id}")
def delete_class(class_id: str):
    result = db.classes.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted"}

# ================= Profile API =================
@router.get("/profile/{role}/{email}")
def get_profile(role: str, email: str):
    collection_map = {
        "student": db.students,
        "teacher": db.teachers,
        "admin": db.admins
    }

    if role not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = collection_map[role].find_one(
        {"email": email},
        {"_id": 0, "password": 0}
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

# ================= Timetable Rules APIs =================
@router.get("/timetable-rules/{class_id}")
def get_timetable_rules(class_id: str):
    rules = db.timetable_rules.find_one({"classId": class_id}, {"_id": 0})
    return rules or {}

@router.post("/timetable-rules")
def save_timetable_rules(data: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    class_id = data.get("classId")
    if not class_id:
        raise HTTPException(status_code=400, detail="classId required")

    if not db.classes.find_one({"classId": class_id}):
        raise HTTPException(status_code=400, detail="Class must exist")

    num_subjects = data.get("numSubjects", 0)
    if num_subjects < 1 or num_subjects > 20:
        raise HTTPException(status_code=400, detail="numSubjects must be 1-20")

    subjects = data.get("subjects", [])
    if len(subjects) != num_subjects:
        raise HTTPException(status_code=400, detail="Number of subjects must match the provided list")
    for sub in subjects:
        if not sub or not isinstance(sub, str):
            raise HTTPException(status_code=400, detail="All subjects must be non-empty strings")

    periods_per_day = data.get("periodsPerDay", 0)
    if periods_per_day <= 0 or periods_per_day > 10:
        raise HTTPException(status_code=400, detail="periodsPerDay must be 1-10")

    max_same_subject_per_day = data.get("maxSameSubjectPerDay", 1)
    if max_same_subject_per_day < 1 or max_same_subject_per_day > 3:
        raise HTTPException(status_code=400, detail="maxSameSubjectPerDay must be 1-3")

    rules_data = {
        "classId": class_id,
        "numSubjects": num_subjects,
        "subjects": subjects,
        "workingDays": data.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"]),
        "periodsPerDay": periods_per_day,
        "periodDuration": data.get("periodDuration", 60),
        "lunchBreak": data.get("lunchBreak", {"start": "12:30", "end": "13:30"}),
        "maxSameSubjectPerDay": max_same_subject_per_day,
        "noFacultyClash": data.get("noFacultyClash", True),
        "createdAt": str(date.today())
    }

    db.timetable_rules.update_one(
        {"classId": class_id},
        {"$set": rules_data},
        upsert=True
    )
    return {"message": "Timetable rules saved"}

@router.delete("/timetable-rules/{class_id}")
def delete_timetable_rules(class_id: str):
    result = db.timetable_rules.delete_one({"classId": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rules not found")
    return {"message": "Timetable rules deleted successfully"}

@router.get("/timetable-rules")
def get_all_timetable_rules():
    rules = list(db.timetable_rules.find({}, {"_id": 0}))
    return rules

# ================= Timetable Generator APIs =================
@router.post("/timetable/generate")
def generate_timetable(request: Dict[str, Any]):  # 🔥 FIXED: Dict[str, Any]
    class_id = request.get("classId")
    if not class_id:
        raise HTTPException(status_code=400, detail="classId is required")
    
    class_res = db.classes.find_one({"classId": class_id})
    if not class_res:
        raise HTTPException(status_code=404, detail="Class not found")
    
    rules = db.timetable_rules.find_one({"classId": class_id})
    if not rules:
        raise HTTPException(status_code=404, detail="Rules not found for this class")
    
    subjects = list(db.subjects.find({"classId": class_id}, {"_id": 0}))
    if not subjects:
        raise HTTPException(status_code=404, detail="No subjects found for this class")
    
    teacher_list = list(db.teachers.find({}, {"_id": 0, "name": 1, "unavailable_slots": 1}))
    if not teacher_list:
        logger.warning("No teachers found in db.teachers—using empty unavailable slots.")
    
    teacher_unavailable = {}
    for fac in teacher_list:
        name = fac.get("name", "")
        if name:
            teacher_unavailable[name] = set(fac.get("unavailable_slots", []))
    
    logger.info(f"Loaded unavailable slots for teachers: {list(teacher_unavailable.keys())}")
    
    working_days_raw = rules.get("workingDays", ["Mon", "Tue", "Wed", "Thu", "Fri"])
    day_order = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4}
    working_days = sorted(working_days_raw, key=lambda d: day_order.get(d, 99))
    logger.info(f"Sorted working days: {working_days}")
    
    periods_per_day = rules.get("periodsPerDay", 6)
    slots = []
    for day in working_days:
        for period in range(1, periods_per_day + 1):
            slot_id = f"{day}-P{period}"
            slots.append(slot_id)
    
    total_slots = len(slots)
    
    total_hours_needed = sum(sub.get("hours_per_week", 0) for sub in subjects)
    if total_hours_needed > total_slots:
        raise HTTPException(status_code=400, detail=f"Not enough slots ({total_slots}) for required hours ({total_hours_needed})")
    if total_hours_needed < (periods_per_day * len(working_days)) / 2:
        logger.warning(f"Low hours ({total_hours_needed}) may leave schedule sparse—consider adding more subject hours in DB.")
    
    assignments_needed = []
    for sub in subjects:
        subject_name = sub.get("subject", "Unknown")
        faculty_name = sub.get("faculty", "Unassigned")
        hours = sub.get("hours_per_week", 0)
        for _ in range(hours):
            assignments_needed.append({
                "subject": subject_name,
                "faculty": faculty_name
            })
    
    logger.info(f"Prepared {len(assignments_needed)} assignments for {len(subjects)} subjects: {total_hours_needed} total hours.")
    
    slots.sort(key=lambda s: (s.split('-')[0], int(s.split('-')[1][1:])))
    
    teacher_slots = {t.get("name", ""): set() for t in teacher_list if t.get("name")}
    
    schedule = {}
    used_slots_per_day = {day: [] for day in working_days}
    assigned_count = 0
    max_retries = 5
    best_schedule = {}
    
    for retry in range(max_retries):
        random.shuffle(assignments_needed)
        temp_schedule = {}
        temp_used_per_day = {day: [] for day in working_days}
        temp_teacher_slots = {k: set(v) for k, v in teacher_slots.items()}
        temp_assigned = 0
        
        for assignment in assignments_needed:
            subject = assignment["subject"]
            faculty = assignment["faculty"]
            
            assigned_this = False
            for slot in slots:
                if slot in temp_schedule:
                    continue
                
                day = slot.split("-")[0]
                
                day_subjects = [sch.get("subject") for sch in temp_used_per_day[day]]
                if day_subjects.count(subject) >= rules.get("maxSameSubjectPerDay", 1):
                    continue
                
                if rules.get("noFacultyClash", True) and slot in temp_teacher_slots.get(faculty, set()):
                    continue
                
                if slot in teacher_unavailable.get(faculty, set()):
                    continue
                
                temp_schedule[slot] = {"subject": subject, "faculty": faculty}
                temp_used_per_day[day].append({"subject": subject, "faculty": faculty})
                if faculty in temp_teacher_slots:
                    temp_teacher_slots[faculty].add(slot)
                temp_assigned += 1
                assigned_this = True
                break
            
            if not assigned_this:
                logger.debug(f"Retry {retry+1}: Skipped {subject} by {faculty}.")
        
        if temp_assigned > assigned_count:
            assigned_count = temp_assigned
            best_schedule = temp_schedule
            if assigned_count == total_hours_needed:
                break
        
        logger.info(f"Retry {retry+1}: Assigned {temp_assigned}/{total_hours_needed} hours.")
    
    schedule = best_schedule
    
    if assigned_count < total_hours_needed:
        raise HTTPException(status_code=500, detail=f"Only assigned {assigned_count}/{total_hours_needed} hours after {max_retries} retries. Try increasing subject hours or relaxing rules.")
    
    timetable = {
        "classId": class_id,
        "version": 1,
        "generatedAt": datetime.now().isoformat(),
        "schedule": schedule,
        "totalSlots": total_slots,
        "assignedHours": assigned_count,
        "workingDaysSorted": working_days
    }
    
    existing = db.timetables.find_one({"classId": class_id})
    if existing:
        version = existing.get("version", 0) + 1
        timetable["version"] = version
        db.timetables.update_one({"classId": class_id}, {"$set": timetable})
    else:
        db.timetables.insert_one(timetable)
    
    logger.info(f"Generated timetable v{timetable['version']} for {class_id} with {assigned_count} assignments.")
    return {"message": "Timetable generated successfully", "timetable": timetable}

# ================= Timetable Fetch/Update APIs =================
@router.get("/timetables")
async def get_all_timetables():
    try:
        data = list(db.timetables.find({}, {  # Use your db.timetables
            "_id": 1, "classId": 1, "version": 1, "generatedAt": 1,
            "schedule": 1, "totalSlots": 1, "assignedHours": 1, "workingDaysSorted": 1
        }))
        if not data:
            logger.info("No timetables in DB!")
            return []
        for doc in data:
            doc["_id"] = str(doc["_id"])
            logger.info(f"Fetched doc for {doc['classId']}: schedule keys = {list(doc.get('schedule', {}).keys()) if doc.get('schedule') else 'EMPTY!'}")
        return data
    except Exception as e:
        logger.error(f"GET Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch: {str(e)}")

@router.put("/timetables/bulk-update")
async def bulk_update_timetables(timetables: List[Dict[str, Any]]):  # 🔥 FIXED: List[Dict[str, Any]]
    try:
        if not timetables:
            return {"message": "No timetables to update"}
        updated_count = 0
        for tt in timetables:
            if "_id" not in tt:
                continue
            doc_id = ObjectId(tt["_id"])
            update_data = {
                "$set": {
                    "schedule": tt.get("schedule", {}),
                    "assignedHours": tt.get("assignedHours"),
                    "totalSlots": tt.get("totalSlots"),  # Match your field name
                    "version": tt.get("version", 0) + 1,
                    "generatedAt": datetime.utcnow().isoformat() + "Z"
                }
            }
            result = db.timetables.update_one({"_id": doc_id}, update_data)  # Use db.timetables
            if result.modified_count > 0:
                updated_count += 1
        logger.info(f"Bulk updated {updated_count} timetables")
        return {"message": f"Updated {updated_count} timetables successfully"}
    except Exception as e:
        logger.error(f"Update Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update: {str(e)}")

# Optional: View by class/version
@router.get("/timetables/{class_id}/{version}")
async def get_timetable_by_class_version(class_id: str, version: int):
    try:
        doc = db.timetables.find_one({"classId": class_id, "version": version})
        if not doc:
            raise HTTPException(status_code=404, detail="Timetable not found")
        doc["_id"] = str(doc["_id"])
        return doc
    except Exception as e:
        logger.error(f"View Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to view: {str(e)}")

# ================= Timetable publishing APIs =================

@router.post("/timetables/publish")
def publish_timetable(data: dict):
    class_id = data["classId"]

    result = db.timetables.update_many(
        {"classId": class_id},
        {"$set": {"isPublished": True}}
    )

    return {
        "message": "Timetable published to students",
        "updated": result.modified_count
    }

