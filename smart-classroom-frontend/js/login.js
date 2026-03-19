const API_URL = "http://127.0.0.1:8000";



document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        role: document.getElementById("role").value
    };

    const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        alert("Invalid login");
        return;
    }

    const data = await res.json();

    localStorage.setItem("userRole", data.role);
    localStorage.setItem("userName", data.name);

    if (data.role === "admin") {
        window.location.href = "admin/dashboard.html";
    } else if (data.role === "teacher") {
        window.location.href = "teacher/dashboard.html";
    } else {
        window.location.href = "student/dashboard.html";
    }
});
