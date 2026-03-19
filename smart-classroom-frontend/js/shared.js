// js/shared.js
// Common JS for navigation, animations, etc.
const role = localStorage.getItem("userRole");

if (!role && !window.location.pathname.includes("login.html")) {
    window.location.href = "../login.html";
}


// Smooth scrolling for anchors
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe cards and features
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card, .feature-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Mock localStorage for role in login
    if (window.location.pathname.includes('signup.html')) {
        document.getElementById('role').addEventListener('change', (e) => {
            localStorage.setItem('userRole', e.target.value);
        });
    }
});

const API_URL = "http://localhost:8000";

// STUDENT
async function loadStudentProfile() {
    const res = await fetch(`${API_URL}/students`);
    const data = await res.json();
    if (!data.length) return;

    const s = data[0];
    document.getElementById("profileName").innerText = s.name;
    document.getElementById("profileRole").innerText = "Student • " + s.department;
    document.getElementById("profileExtra").innerText = "Year: " + s.year;
}

// TEACHER
async function loadTeacherProfile() {
    const res = await fetch(`${API_URL}/teachers`);
    const data = await res.json();
    if (!data.length) return;

    const t = data[0];
    document.getElementById("profileName").innerText = t.name;
    document.getElementById("profileRole").innerText = "Teacher • " + t.department;
    document.getElementById("profileExtra").innerText =
        "Subjects: " + t.subjects.join(", ");
}

// ADMIN
async function loadAdminProfile() {
    const res = await fetch(`${API_URL}/admins`);
    const data = await res.json();
    if (!data.length) return;

    const a = data[0];
    document.getElementById("profileName").innerText = a.name;
    document.getElementById("profileRole").innerText = "Admin";
    document.getElementById("profileExtra").innerText = a.role;
}
