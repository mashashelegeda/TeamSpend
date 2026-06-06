const API_URL = "http://127.0.0.1:8001";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const userName = localStorage.getItem("name");
    if (userName && document.getElementById("welcome-title")) {
        document.getElementById("welcome-title").textContent = `Cześć, ${userName}!`;
    }

    fetchInvitations();

    const createBtn = document.getElementById("create-team-btn");
    if (createBtn) {
        createBtn.addEventListener("click", handleCreateTeam);
    }
});

async function handleCreateTeam() {
    const teamNameInput = document.getElementById("team-name");
    const teamName = teamNameInput ? teamNameInput.value.trim() : "";

    if (!teamName) {
        alert("Wpisz nazwę zespołu!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ name: teamName })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Błąd podczas tworzenia zespołu");
        }

        alert(`Zespół "${teamName}" został utworzony!`);
        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
    }
}

async function fetchInvitations() {
    const listContainer = document.getElementById("invitations-list");
    const statusText = document.getElementById("invitations-status");

    if (!listContainer || !statusText) return;

    try {
        const response = await fetch(`${API_URL}/teams/invitations`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Nie udało się pobrać zaproszeń");

        const invitations = await response.json();
        listContainer.innerHTML = "";

        if (invitations.length === 0) {
            statusText.textContent = "Masz oczekujące zaproszenia: brak";
            return;
        }

        statusText.textContent = "Masz oczekujące zaproszenia:";

        invitations.forEach(invite => {
            const li = document.createElement("li");
            li.className = "invite-item";
            li.style.marginBottom = "12px"; // Красивый отступ между плашками

            li.innerHTML = `
                <span>${invite.team_name} <span style="color: #a7afc4; font-weight: normal; font-size: 12px;">(od: ${invite.author})</span></span>
                <button class="btn-accept" onclick="joinTeam(${invite.id})">Dołącz</button>
            `;
            listContainer.appendChild(li);
        });

    } catch (error) {
        statusText.textContent = "Nie udało się załadować zaproszeń.";
        console.error(error);
    }
}

async function joinTeam(inviteId) {
    try {
        const response = await fetch(`${API_URL}/teams/join/${inviteId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Błąd podczas dołączania do zespołu");
        }

        alert("Dołączono do zespołu!");
        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
    }
}