# 📚 Smart Classroom and Timetable Scheduler

A modular system designed to automate academic scheduling, manage classroom resources, and provide real-time updates to students and faculty.

This project consists of a Python-based backend, a web-based frontend, and a dedicated notification microservice.

---

## 📂 Project Structure

The repository is divided into three main components:

- **`backend/`**
  The core logic and API built with Python. Handles scheduling algorithms and database management.

- **`smart-classroom-frontend/`**
  The web-based dashboard for users to view schedules and manage profiles.

- **`notification-server/`**
  A specialized service for delivering real-time alerts and updates.

---

## 🛠️ Tech Stack

- **Language:** Python
- **Frontend:** HTML, CSS, JavaScript
- **Other:** PowerShell, C (for specialized low-level tasks)

---

## 🚀 Getting Started

### 🔹 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

---

### 🔹 2. Frontend Setup

```bash
cd smart-classroom-frontend
npm install
npm start
```

---

### 🔹 3. Notification Server

```bash
cd notification-server
# Follow internal setup guides for specific messaging protocols
```

---

## ✨ Features

- **Conflict-Free Scheduling**
  Automated timetable generation to prevent room or teacher overlaps.

- **Real-time Sync**
  Instant notifications via the dedicated server.

- **Resource Management**
  Track classroom availability and equipment usage.

---

## 🤝 Contributing

Contributions are welcome!
Feel free to open an issue or submit a pull request for improvements.

---

## 📌 Future Improvements

- AI-based timetable optimization
- Mobile app integration
- Advanced analytics dashboard

---

## how to run the backend

uvicorn app.main:app --reload
