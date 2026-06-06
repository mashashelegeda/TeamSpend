const API_URL = "http://127.0.0.1:8001";
const token = localStorage.getItem("token");
let myChart = null;
let globalExpenses = []; 
let editingExpenseId = null; 

if (!token) {
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    setupLogout();
    setupInvite();
    setupUserGreeting();
    setupTeamName();
    
    const addCategoryBtn = document.getElementById("btn-add-category");
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener("click", (e) => {
            e.preventDefault(); 

            const newCategory = prompt("Wpisz nazwę nowej kategorii:");

            if (newCategory && newCategory.trim() !== "") {
                const trimmedCategory = newCategory.trim();
                const selectElement = document.getElementById("expense-category");

                if (!selectElement) {
                    console.error("Błąd: Nie znaleziono listy wyboru 'expense-category'!");
                    return;
                }

                let exists = false;
                for (let i = 0; i < selectElement.options.length; i++) {
                    if (selectElement.options[i].value.toLowerCase() === trimmedCategory.toLowerCase()) {
                        exists = true;
                        selectElement.selectedIndex = i; 
                        break;
                    }
                }

                if (!exists) {
                    const newOption = document.createElement("option");
                    newOption.value = trimmedCategory;
                    newOption.textContent = trimmedCategory;
                    selectElement.appendChild(newOption);
                    selectElement.value = trimmedCategory; 
                }
            }
        });
    } else {
        console.error("Błąd: Nie znaleziono przycisku '+' o id 'btn-add-category'!");
    }

    fetchExpenses();

    const expenseForm = document.getElementById("expense-form");
    if (expenseForm) {
        expenseForm.addEventListener("submit", handleFormSubmit);
    }

    const cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", cancelEditMode);
    }

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }
});

function setupTeamName() {
    const teamName = localStorage.getItem("team_name");
    const teamNameElement = document.getElementById("dashboard-team-name");

    if (teamName && teamNameElement) {
        teamNameElement.innerHTML = `<i class="fa-solid fa-users"></i> Zespół: ${teamName}`;
    }
}

function setupUserGreeting() {
    const userName = localStorage.getItem("name");
    const userNameElement = document.getElementById("dashboard-user-name");

    if (userName && userNameElement) {
        userNameElement.textContent = `Cześć, ${userName}!`;
    }
}

function setupLogout() {
    const logoutButton = document.getElementById("logout-button");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", (e) => {
        e.preventDefault();

        localStorage.removeItem("token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("email");
        localStorage.removeItem("name");
        localStorage.removeItem("team_id");
        localStorage.removeItem("team_name");

        window.location.href = "login.html";
    });
}

function setupInvite() {
    const inviteButton = document.getElementById("invite-button");

    if (!inviteButton) {
        return;
    }

    inviteButton.addEventListener("click", async () => {
        const emailInput = document.getElementById("invite-email");
        const email = emailInput.value.trim();

        const token = localStorage.getItem("token");
        const teamId = localStorage.getItem("team_id");

        if (!email) {
            alert("Wpisz email użytkownika");
            return;
        }

        if (!teamId) {
            alert("Najpierw wybierz zespół");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/teams/${teamId}/invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail);
                return;
            }

            alert(data.message);
            emailInput.value = "";

        } catch (error) {
            console.error(error);
            alert("Błąd połączenia z serwerem");
        }
    });
}

function applyFilters() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const filtered = globalExpenses.filter(item => {
        return item.name.toLowerCase().includes(searchTerm) || 
               item.category.toLowerCase().includes(searchTerm);
    });

    renderTable(filtered);
    renderStatsAndChart(filtered); 
}

async function fetchExpenses() {
    try {
        const teamId = localStorage.getItem("team_id");

        if (!teamId) {
            alert("Najpierw wybierz zespół");
            window.location.href = "onboarding.html";
            return;
        }

        const response = await fetch(`${API_URL}/expenses?team_id=${teamId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user_id");
            localStorage.removeItem("email");
            localStorage.removeItem("name");
            localStorage.removeItem("team_id");
            localStorage.removeItem("team_name");

            window.location.href = "login.html";
            return;
        }

        if (!response.ok) throw new Error("Nie udało się pobrać wydatków.");

        const expenses = await response.json();
        globalExpenses = expenses;

        renderTable(expenses);
        renderStatsAndChart(expenses);

    } catch (error) {
        console.error("Błąd pobierania danych:", error);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById("expense-name");
    const amountInput = document.getElementById("expense-amount");
    const categoryInput = document.getElementById("expense-category");
    const dateInput = document.getElementById("expense-date");

    const teamId = localStorage.getItem("team_id");

    if (!teamId) {
        alert("Najpierw wybierz zespół");
        window.location.href = "onboarding.html";
        return;
    }

    let rawDate = dateInput.value;

    if (rawDate.includes(".")) {
        const parts = rawDate.split(".");
        if (parts[0].length === 2 && parts[2].length === 4) {
            rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    const payload = {
        name: nameInput.value.trim(),
        amount: parseFloat(amountInput.value),
        category: categoryInput.value,
        date: rawDate,
        team_id: Number(teamId)
    };

    try {
        let response;

        if (editingExpenseId === null) {
            response = await fetch(`${API_URL}/expenses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${API_URL}/expenses/${editingExpenseId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detail = errorData.detail ? JSON.stringify(errorData.detail) : "Błąd serwera.";
            throw new Error(detail);
        }

        cancelEditMode();
        fetchExpenses();

    } catch (error) {
        alert("Błąd: " + error.message);
    }
}

function startEditExpense(id, name, amount, category, date) {
    editingExpenseId = id;

    document.getElementById("expense-name").value = name;
    document.getElementById("expense-amount").value = amount;
    
    const selectElement = document.getElementById("expense-category");
    let categoryExists = false;
    for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].value === category) {
            categoryExists = true;
            break;
        }
    }
    if (!categoryExists) {
        const opt = document.createElement("option");
        opt.value = category;
        opt.textContent = category;
        selectElement.appendChild(opt);
    }
    selectElement.value = category;
    document.getElementById("expense-date").value = date;

    const submitBtn = document.getElementById("submit-expense-btn");
    if (submitBtn) {
        submitBtn.textContent = "Zapisz zmiany";
    }

    const cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) {
        cancelBtn.classList.remove("hidden");
    }
}

function cancelEditMode() {
    editingExpenseId = null;
    document.getElementById("expense-form").reset();

    const submitBtn = document.getElementById("submit-expense-btn");
    if (submitBtn) {
        submitBtn.textContent = "Dodaj do wspólnych wydatków";
    }

    const cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) {
        cancelBtn.classList.add("hidden");
    }
}

async function deleteExpense(id) {
    if (!confirm("Czy na pewno chcesz usunąć ten wydatek?")) {
        return;
    }

    const teamId = localStorage.getItem("team_id");

    if (!teamId) {
        alert("Najpierw wybierz zespół");
        window.location.href = "onboarding.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/expenses/${id}?team_id=${teamId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detail = errorData.detail || "Błąd podczas usuwania.";
            throw new Error(detail);
        }

        fetchExpenses();

    } catch (error) {
        alert(error.message);
    }
}

function renderTable(expenses) {
    const tbody = document.getElementById("expenses-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0; padding: 20px;">Brak pasujących wydatków.</td></tr>`;
        return;
    }

    expenses.forEach(item => {
        const tr = document.createElement("tr");
        
        tr.innerHTML = `
            <td>${item.name}</td>
            <td><strong>${item.amount.toFixed(2)} PLN</strong></td>
            <td><span class="badge badge-${item.category.toLowerCase()}">${item.category}</span></td>
            <td><i class="fa-regular fa-user"></i> ${item.user_name || "Nieznany"}</td>
            <td>${item.date}</td>
            <td>
                <button class="btn-action-edit" onclick="startEditExpense(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.amount}, '${item.category}', '${item.date}')">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-delete" onclick="deleteExpense(${item.id})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderStatsAndChart(expenses) {
    let totalSum = 0;
    const categoryTotals = {};
    let topCategoryName = "Brak";
    let maxCategoryVolume = 0;

    expenses.forEach(item => {
        totalSum += item.amount;
        categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
        
        if (categoryTotals[item.category] > maxCategoryVolume) {
            maxCategoryVolume = categoryTotals[item.category];
            topCategoryName = item.category;
        }
    });

    const totalAmountElement = document.getElementById("total-amount");
    if (totalAmountElement) {
        totalAmountElement.textContent = `${totalSum.toFixed(2)} PLN`;
    }

    const topCategoryElement = document.getElementById("top-category");
    if (topCategoryElement) {
        topCategoryElement.textContent = topCategoryName;
    }

    const chartContainer = document.querySelector(".chart-container");
    if (!chartContainer) return;

    chartContainer.innerHTML = '<canvas id=\"expense-pie-chart\"></canvas>';
    
    const ctx = document.getElementById("expense-pie-chart");
    if (!ctx || Object.keys(categoryTotals).length === 0) return;

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#6b7cb5', '#8e9cc8', '#b0bcdd', '#ffd166', '#a7afc4', '#ff6b6b', '#4ecdc4'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}