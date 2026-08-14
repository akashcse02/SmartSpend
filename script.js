
let currentUser = JSON.parse(localStorage.getItem('smartspend_user')) || null;
let transactions = JSON.parse(localStorage.getItem('smartspend_txs')) || [];
let profileSettings = JSON.parse(localStorage.getItem('smartspend_profile')) || {
    name: 'User', email: '', currency: '$', budget: 1000
};
let charts = { category: null, trend: null };


const authPanel = document.getElementById('auth-panel');
const dashboard = document.getElementById('dashboard');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const toggleAuthBtn = document.getElementById('toggle-auth-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');
let isLoginMode = true;

// Navigation & Layout
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view-section');
const viewTitle = document.getElementById('view-title');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');

// --- Initialization ---
window.onload = () => {
    loadThemePreference();
    if (currentUser) {
        showDashboard();
    }
};

toggleAuthBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authError.classList.add('hidden');
    if (isLoginMode) {
        authTitle.innerText = "SmartSpend";
        authSubtitle.innerText = "Welcome back! Please login.";
        authSubmitBtn.innerText = "Login to Dashboard";
        toggleAuthBtn.innerText = "Don't have an account? Sign up";
    } else {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Start tracking your expenses today.";
        authSubmitBtn.innerText = "Sign Up";
        toggleAuthBtn.innerText = "Already have an account? Login";
    }
});

authForm.addEventListener('submit', () => {
    const email = authEmail.value.trim();
    const password = authPass.value;

    if (!email.includes('@') || password.length < 6) {
        showError("Please enter a valid email and password (min 6 chars).");
        return;
    }

    // Mock Login/Signupgit
    currentUser = { email };
    localStorage.setItem('smartspend_user', JSON.stringify(currentUser));
    
    // Set default profile email if empty
    if(!profileSettings.email) {
        profileSettings.email = email;
        saveProfileSettings();
    }

    showDashboard();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('smartspend_user');
    dashboard.classList.add('hidden');
    authPanel.classList.remove('hidden');
    authForm.reset();
});

function showError(msg) {
    authError.innerText = msg;
    authError.classList.remove('hidden');
}

function showDashboard() {
    authPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
    updateDashboardStats();
    renderTransactions();
    populateProfileForm();
}

// ==========================================
// 2. NAVIGATION & RESPONSIVE DESIGN
// ==========================================

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        // Update Active Link
        navLinks.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        // Switch Views
        const targetId = e.target.getAttribute('data-target');
        views.forEach(view => view.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
        
        // Update Title
        viewTitle.innerText = e.target.innerText.replace(/[^\w\s]/gi, '').trim(); // Remove emojis

        // Close mobile sidebar if open
        sidebar.classList.remove('open');

        // Trigger view-specific logic
        if (targetId === 'view-analytics') renderCharts();
        if (targetId === 'view-dashboard') updateDashboardStats();
    });
});

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// ==========================================
// 3. EXPENSES & TRANSACTIONS LOGIC
// ==========================================

document.getElementById('expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newTx = {
        id: Date.now().toString(),
        type: document.getElementById('exp-type').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        category: document.getElementById('exp-category').value,
        date: document.getElementById('exp-date').value,
        note: document.getElementById('exp-note').value.trim()
    };

    transactions.push(newTx);
    saveTransactions();
    e.target.reset();
    
    // Automatically navigate back to dashboard
    navLinks[0].click(); 
});

function saveTransactions() {
    localStorage.setItem('smartspend_txs', JSON.stringify(transactions));
    renderTransactions();
    updateDashboardStats();
}

function deleteTransaction(id) {
    transactions = transactions.filter(tx => tx.id !== id);
    saveTransactions();
    if(!document.getElementById('view-analytics').classList.contains('hidden')){
        renderCharts(); // Re-render charts if on analytics page
    }
}

function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = '';

    if (transactions.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-secondary); margin-top: 10px;">No recent transactions.</p>';
        return;
    }

    // Sort newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(tx => {
        const isIncome = tx.type === 'income';
        const sign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';
        const formattedAmount = `${profileSettings.currency}${tx.amount.toFixed(2)}`;

        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="tx-info">
                <h4>${tx.category}</h4>
                <p>${tx.date} ${tx.note ? '| ' + tx.note : ''}</p>
            </div>
            <div class="tx-actions">
                <span class="tx-amount ${amountClass}">${sign}${formattedAmount}</span>
                <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">✕</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// ==========================================
// 4. DASHBOARD STATS & BUDGET
// ==========================================

function updateDashboardStats() {
    let totalBalance = 0;
    let monthlyExpenses = 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;

        if (tx.type === 'income') {
            totalBalance += tx.amount;
        } else {
            totalBalance -= tx.amount;
            if (isCurrentMonth) monthlyExpenses += tx.amount;
        }
    });

    const curr = profileSettings.currency;
    document.getElementById('stat-balance').innerText = `${curr}${totalBalance.toFixed(2)}`;
    document.getElementById('stat-monthly').innerText = `${curr}${monthlyExpenses.toFixed(2)}`;

    // Budget Progress Update
    const budget = profileSettings.budget;
    const progressEl = document.getElementById('budget-progress-bar');
    const budgetText = document.getElementById('budget-text');
    
    if (budget > 0) {
        let percent = (monthlyExpenses / budget) * 100;
        if (percent > 100) percent = 100;
        
        progressEl.style.width = `${percent}%`;
        budgetText.innerText = `${curr}${monthlyExpenses.toFixed(2)} / ${curr}${budget} spent`;
        
        if (percent >= 90) {
            progressEl.classList.add('danger');
        } else {
            progressEl.classList.remove('danger');
        }
    } else {
        progressEl.style.width = '0%';
        budgetText.innerText = "Budget not set.";
    }
}

// ==========================================
// 5. ANALYTICS (Chart.js)
// ==========================================

function renderCharts() {
    // 1. Destroy existing charts to prevent canvas reuse bugs
    if (charts.category) charts.category.destroy();
    if (charts.trend) charts.trend.destroy();

    const expensesOnly = transactions.filter(t => t.type === 'expense');

    // -- Category Pie Chart --
    const catData = {};
    expensesOnly.forEach(tx => {
        catData[tx.category] = (catData[tx.category] || 0) + tx.amount;
    });

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    charts.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // -- 6-Month Trend Bar Chart --
    const trendData = getLast6MonthsData(expensesOnly);
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    
    // Get text color based on theme for chart labels
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#aaaaaa' : '#777777';

    charts.trend = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: 'Monthly Expenses',
                data: trendData.values,
                backgroundColor: 'rgba(76, 175, 80, 0.7)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor } },
                x: { ticks: { color: textColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

function getLast6MonthsData(expenses) {
    const labels = [];
    const values = [0, 0, 0, 0, 0, 0];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleString('default', { month: 'short' }));
    }

    expenses.forEach(tx => {
        const d = new Date(tx.date);
        const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diffMonths >= 0 && diffMonths < 6) {
            // Index goes from 0 (5 months ago) to 5 (current month)
            values[5 - diffMonths] += tx.amount;
        }
    });

    return { labels, values };
}

// ==========================================
// 6. PROFILE LOGIC
// ==========================================

function populateProfileForm() {
    document.getElementById('prof-name').value = profileSettings.name;
    document.getElementById('prof-email').value = profileSettings.email;
    document.getElementById('prof-currency').value = profileSettings.currency;
    document.getElementById('prof-budget').value = profileSettings.budget;
}

document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    profileSettings = {
        name: document.getElementById('prof-name').value,
        email: document.getElementById('prof-email').value,
        currency: document.getElementById('prof-currency').value,
        budget: parseFloat(document.getElementById('prof-budget').value)
    };
    saveProfileSettings();
    updateDashboardStats(); // Refresh currency symbols
    renderTransactions();   // Refresh currency symbols in list
    alert('Profile saved successfully!');
});

function saveProfileSettings() {
    localStorage.setItem('smartspend_profile', JSON.stringify(profileSettings));
}

// ==========================================
// 7. THEME LOGIC (Dark Mode)
// ==========================================

document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

function toggleTheme() {
    const body = document.documentElement;
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('smartspend_theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('smartspend_theme', 'dark');
    }
    
    // Re-render charts if they exist to update text colors
    if (!document.getElementById('view-analytics').classList.contains('hidden')) {
        renderCharts();
    }
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('smartspend_theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}