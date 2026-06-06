const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const showRegister = document.getElementById("show-register");
const showLogin = document.getElementById("show-login");

const title = document.getElementById("form-title");

const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");

const API_URL = "http://127.0.0.1:8001";

showRegister.addEventListener("click", (e) => {
    e.preventDefault();

    loginForm.style.display = "none";
    registerForm.style.display = "block";
    title.textContent = "Rejestracja";
});

showLogin.addEventListener("click", (e) => {
    e.preventDefault();

    registerForm.style.display = "none";
    loginForm.style.display = "block";
    title.textContent = "Logowanie";
});


registerButton.addEventListener("click", async () => {
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const repeatPassword = document.getElementById("register-repeat-password").value;

    if (!name || !email || !password || !repeatPassword) {
        alert("Wypełnij wszystkie pola");
        return;
    }

    if (password !== repeatPassword) {
        alert("Hasła nie są takie same");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail);
            return;
        }

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("email", data.email);
        localStorage.setItem("name", data.name);

        alert(data.message);
        window.location.href = "onboarding.html";

    } catch (error) {
        alert("Błąd połączenia z serwerem");
        console.error(error);
    }
});


loginButton.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        alert("Wypełnij wszystkie pola");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail);
            return;
        }

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("email", data.email);
        localStorage.setItem("name", data.name);

        alert("Zalogowano pomyślnie");
        window.location.href = "onboarding.html";

    } catch (error) {
        alert("Błąd połączenia z serwerem");
        console.error(error);
    }
});