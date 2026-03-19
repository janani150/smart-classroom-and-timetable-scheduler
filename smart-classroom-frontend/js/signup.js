const API_URL = "http://127.0.0.1:8000";

const roleSelect = document.getElementById("role");
const yearInput = document.getElementById("year");
const sectionSelect = document.getElementById("section"); // NEW

// Show / hide student-only fields
roleSelect.addEventListener("change", () => {
    if (roleSelect.value === "student") {
        yearInput.style.display = "block";
        sectionSelect.style.display = "block";
        yearInput.required = true;
        sectionSelect.required = true;
    } else {
        yearInput.style.display = "none";
        sectionSelect.style.display = "none";
        yearInput.required = false;
        sectionSelect.required = false;
        yearInput.value = "";
        sectionSelect.value = "";
    }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        role: roleSelect.value,
        department: document.getElementById("department").value
    };

    // Student-only fields
    if (data.role === "student") {
        data.year = yearInput.value;
        data.section = sectionSelect.value;
    }

    const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        alert("Signup failed");
        return;
    }

    alert("Signup successful! Please login.");
    window.location.href = "login.html";
});
