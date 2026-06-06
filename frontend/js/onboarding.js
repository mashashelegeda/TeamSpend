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

    fetchMyTeams();
    fetchInvitations();

    const createBtn = document.getElementById("create-team-btn");
    if (createBtn) {
        createBtn.addEventListener("click", handleCreateTeam);
    }
});

async function checkMyTeam() {
    try {
        const response = await fetch(`${API_URL}/teams/my`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return;
        }

        if (data.has_team) {
            localStorage.setItem("team_id", data.team_id);
            localStorage.setItem("team_name", data.team_name);

            window.location.href = "dashboard.html";
        }

    } catch (error) {
        console.error(error);
    }
}

async function handleCreateTeam() {
    const teamNameInput = document.getElementById("team-name");
    const teamName = teamNameInput ? teamNameInput.value.trim() : "";

    if (!teamName) {
        alert("Wpisz nazwę zespołu!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams`, {
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
        
        localStorage.setItem("team_id", data.team_id);
        localStorage.setItem("team_name", data.team_name);

        alert(`Zespół "${teamName}" został utworzony!`);
        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
    }
}

async function fetchMyTeams() {
    const listContainer = document.getElementById("my-teams-list");

    if (!listContainer) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const teams = await response.json();

        if (!response.ok) {
            throw new Error("Nie udało się pobrać zespołów");
        }

        listContainer.innerHTML = "";

        if (teams.length === 0) {
            listContainer.innerHTML = "<li>Nie należysz jeszcze do żadnego zespołu.</li>";
            return;
        }

        teams.forEach(team => {
            const li = document.createElement("li");
            li.className = "invite-item";

            li.innerHTML = `
                <span>${team.name} <span style="color: #a7afc4; font-weight: normal; font-size: 12px;">(${team.role})</span></span>
                <button class="btn-accept" onclick="selectTeam(${team.id}, '${team.name}')">Wejdź</button>
            `;

            listContainer.appendChild(li);
        });

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = "<li>Nie udało się załadować zespołów.</li>";
    }
}

function selectTeam(teamId, teamName) {
    localStorage.setItem("team_id", teamId);
    localStorage.setItem("team_name", teamName);

    window.location.href = "dashboard.html";
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
        const response = await fetch(`${API_URL}/teams/invitations/${inviteId}/accept`, {
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