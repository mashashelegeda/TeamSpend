const API_URL = "http://127.0.0.1:8001";
const token = localStorage.getItem("token");
let myChart = null;


if (!token) {
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const userFields = document.querySelectorAll(".user-name-field");
    const storedName = localStorage.getItem("userName") || "Użytkownik";
    userFields.forEach(field => {
        field.textContent = storedName;
    });

    fetchExpenses();

    const expenseForm = document.getElementById("expense-form");
    if (expenseForm) {
        expenseForm.addEventListener("submit", handleAddExpense);
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "login.html";
        });
    }
});

// READ
async function fetchExpenses() {
    try {
        const response = await fetch(`${API_URL}/expenses`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Nie udało się pobrać wydatków.");
        }

        const expenses = await response.json();
        
        renderTable(expenses);
        renderStatsAndChart(expenses);

    } catch (error) {
        console.error("Błąd pobierania danych:", error);
    }
}

// CREATE
async function handleAddExpense(e) {
    e.preventDefault();

    const nameInput = document.getElementById("expense-name");
    const amountInput = document.getElementById("expense-amount");
    const categoryInput = document.getElementById("expense-category");
    const dateInput = document.getElementById("expense-date");

    let rawDate = dateInput.value;
    if (rawDate.includes('.')) {
        const parts = rawDate.split('.');
        if (parts[0].length === 2 && parts[2].length === 4) {
            rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    const payload = {
        name: nameInput.value.trim(),
        amount: parseFloat(amountInput.value),
        category: categoryInput.value,
        date: rawDate
    };

    try {
        const response = await fetch(`${API_URL}/expenses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detail = errorData.detail ? JSON.stringify(errorData.detail) : "Błąd walidacji serwera.";
            throw new Error(detail);
        }

        document.getElementById("expense-form").reset();
        fetchExpenses();

    } catch (error) {
        alert("Błąd: " + error.message);
    }
}

// DELETE
async function deleteExpense(id) {
    if (!confirm("Czy na pewno chcesz usunąć ten wydatek?")) return;

    try {
        const response = await fetch(`${API_URL}/expenses/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Błąd podczas usuwania.");

        fetchExpenses();

    } catch (error) {
        alert(error.message);
    }
}

// RENDEROWANIE TABELI GŁÓWNEJ
function renderTable(expenses) {
    const tbody = document.getElementById("expenses-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Brak dodanych wydatków we wspólnym zespole.</td></tr>`;
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
                <button class="btn-delete" onclick="deleteExpense(${item.id})">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// STATYSTYKI, RANKING I WYKRES 
function renderStatsAndChart(expenses) {
    let totalSum = 0;
    const categoryTotals = {};
    const userTotals = {}; 

    expenses.forEach(item => {
        totalSum += item.amount;
        categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
        
        const userName = item.user_name || "Nieznany";
        userTotals[userName] = (userTotals[userName] || 0) + item.amount;
    });

    const totalAmountElement = document.getElementById("total-amount");
    if (totalAmountElement) {
        totalAmountElement.textContent = `${totalSum.toFixed(2)} PLN`;
    }

    const leaderboardContainer = document.getElementById("leaderboard-list");
    if (leaderboardContainer) {
        leaderboardContainer.innerHTML = ""; 

        const sortedUsers = Object.entries(userTotals).sort((a, b) => b[1] - a[1]);

        if (sortedUsers.length === 0) {
            leaderboardContainer.innerHTML = `<p style="color: #a0aec0; text-align: center; padding: 10px;">Brak danych</p>`;
        } else {
            const maxExpense = sortedUsers[0][1];
            const barColors = ['#6b7cb5', '#8e9cc8', '#b0bcdd', '#ffd166'];

            sortedUsers.forEach((user, index) => {
                const name = user[0];
                const amount = user[1];
                const percentage = maxExpense > 0 ? (amount / maxExpense) * 100 : 0;
                const barColor = barColors[index % barColors.length];

                const userItem = document.createElement("div");
                userItem.className = "leaderboard-item";
                userItem.innerHTML = `
                    <div class="lb-info">
                        <span class="lb-name">${name}</span>
                        <span class="lb-amount">${amount.toFixed(2)} PLN</span>
                    </div>
                    <div class="lb-bar-bg">
                        <div class="lb-bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                    </div>
                `;
                leaderboardContainer.appendChild(userItem);
            });
        }
    }

    const chartContainer = document.querySelector(".chart-container");
    if (!chartContainer) return;

    chartContainer.innerHTML = '<canvas id="expense-pie-chart"></canvas>';
    
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
                backgroundColor: ['#6b7cb5', '#8e9cc8', '#b0bcdd', '#ffd166'],
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