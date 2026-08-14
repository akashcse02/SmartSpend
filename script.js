/**
 * SmartSpend - App Logic with Multi-Account Support
 */

// --- Global State ---
// usersDB stores { "email@test.com": { password: "123" } }
let usersDB = JSON.parse(localStorage.getItem('smartspend_users_db')) || {};
let currentUser = JSON.parse(localStorage.getItem('smartspend_active_user')) || null;

let transactions = [];
let profileSettings = {};
let charts = { category: null, trend: null };

// --- DOM Elements ---
const authPanel = document.getElementById('auth-panel');
const dashboard = document.getElementById('dashboard');
const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');
const signupFields = document.querySelectorAll('.signup-only');

const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view-section');
const viewTitle = document.getElementById('view-title');
const sidebar = document.getElementById('sidebar');

let isLoginMode = true;

// --- Initialization ---
window.onload = () => {
    loadThemePreference();
    if (currentUser) {
        loadUserData();
        showDashboard();
    }
};

// ==========================================
// 1. DATA MANAGEMENT (Multi-Account)
// ==========================================
function loadUserData() {
    if (!currentUser) return;
    const emailKey = currentUser.email;
    
    // Load this specific user's transactions
    transactions = JSON.parse(localStorage.getItem(`smartspend_txs_${emailKey}`)) || [];
    
    // Load this specific user's profile
    const defaultProfile = { name: '', phone: '', email: emailKey, currency: '৳', budget: 50000 };
    profileSettings = JSON.parse(localStorage.getItem(`smartspend_profile_${emailKey}`)) || defaultProfile;
}

function saveTransactions() {
    if (!currentUser) return;
    localStorage.setItem(`smartspend_txs_${currentUser.email}`, JSON.stringify(transactions));
}

function saveProfileSettings() {
    if (!currentUser) return;
    localStorage.setItem(`smartspend_profile_${currentUser.email}`, JSON.stringify(profileSettings));
}

// ==========================================
// 2. AUTHENTICATION LOGIC
// ==========================================
toggleAuthBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authError.classList.add('hidden');
    
    if (isLoginMode) {
        authTitle.innerText = "SmartSpend";
        authSubtitle.innerText = "Welcome back! Please login.";
        authSubmitBtn.innerText = "Login to Dashboard";
        toggleAuthBtn.innerText = "Don't have an account? Sign up";
        signupFields.forEach(f => f.classList.add('hidden'));
        document.getElementById('auth-name').removeAttribute('required');
    } else {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Start tracking your expenses today.";
        authSubmitBtn.innerText = "Create Account";
        toggleAuthBtn.innerText = "Already have an account? Login";
        signupFields.forEach(f => f.classList.remove('hidden'));
        document.getElementById('auth-name').setAttribute('required', 'true');
    }
});

authForm.addEventListener('submit', () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    
    if (!email.includes('@') || password.length < 6) {
        showError("Please enter a valid email and password (min 6 chars).");
        return;
    }

    if (!isLoginMode) {
        // SIGN UP
        if (usersDB[email]) {
            showError("An account with this email already exists! Please login.");
            return;
        }
        
        usersDB[email] = { password: password };
        localStorage.setItem('smartspend_users_db', JSON.stringify(usersDB));
        
        currentUser = { email: email };
        
        // Initialize profile for new user
        profileSettings = {
            name: document.getElementById('auth-name').value.trim(),
            phone: document.getElementById('auth-phone').value.trim(),
            email: email,
            currency: '৳',
            budget: 50000
        };
        saveProfileSettings();
        
    } else {
        // LOGIN
        if (!usersDB[email] || usersDB[email].password !== password) {
            showError("Invalid email or password!");
            return;
        }
        currentUser = { email: email };
    }

    localStorage.setItem('smartspend_active_user', JSON.stringify(currentUser));
    loadUserData();
    showDashboard();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    transactions = [];
    profileSettings = {};
    localStorage.removeItem('smartspend_active_user');
    
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
    
    const now = new Date();
    const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('analytics-month').value = monthStr;

    updateDashboardStats();
    renderTransactions();
    populateProfileForm();
}

// ==========================================
// 3. NAVIGATION
// ==========================================
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        navLinks.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        const targetId = e.target.getAttribute('data-target');
        views.forEach(view => view.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
        
        viewTitle.innerText = e.target.innerText.replace(/[^\w\s]/gi, '').trim();
        sidebar.classList.remove('open');

        if (targetId === 'view-analytics') renderCharts();
        if (targetId === 'view-dashboard') updateDashboardStats();
    });
});

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// ==========================================
// 4. TRANSACTIONS & DASHBOARD
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
    navLinks[0].click(); // Go back to dashboard
});

function deleteTransaction(id) {
    transactions = transactions.filter(tx => tx.id !== id);
    saveTransactions();
    renderTransactions();
    updateDashboardStats();
    if(!document.getElementById('view-analytics').classList.contains('hidden')) renderCharts();
}

function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = '';

    if (transactions.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-secondary); margin-top: 10px;">No recent transactions.</p>';
        return;
    }

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

function updateDashboardStats() {
    let totalBalance = 0;
    let monthlyExpenses = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Update the label so the user knows WHICH month is being calculated
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('monthly-title').innerText = `Expenses (${monthNames[currentMonth]})`;

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

    // Budget Progress
    const budget = profileSettings.budget;
    const progressEl = document.getElementById('budget-progress-bar');
    const budgetText = document.getElementById('budget-text');
    
    if (budget > 0) {
        let percent = (monthlyExpenses / budget) * 100;
        if (percent > 100) percent = 100;
        
        progressEl.style.width = `${percent}%`;
        budgetText.innerText = `${curr}${monthlyExpenses.toFixed(2)} / ${curr}${budget} spent`;
        
        if (percent >= 90) progressEl.classList.add('danger');
        else progressEl.classList.remove('danger');
    }
}

// ==========================================
// 5. ANALYTICS (Instant Render Design)
// ==========================================
document.getElementById('analytics-month').addEventListener('change', renderCharts);

function renderCharts() {
    if (charts.category) charts.category.destroy();
    if (charts.trend) charts.trend.destroy();

    const selectedMonthStr = document.getElementById('analytics-month').value;
    if(!selectedMonthStr) return;

    const [selYear, selMonth] = selectedMonthStr.split('-').map(Number);
    const expensesOnly = transactions.filter(t => t.type === 'expense');

    // -- Doughnut Chart --
    const catData = {};
    expensesOnly.forEach(tx => {
        const txDate = new Date(tx.date);
        if(txDate.getFullYear() === selYear && (txDate.getMonth() + 1) === selMonth) {
            catData[tx.category] = (catData[tx.category] || 0) + tx.amount;
        }
    });

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    charts.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData).length > 0 ? Object.keys(catData) : ['No Data'],
            datasets: [{
                data: Object.keys(catData).length > 0 ? Object.values(catData) : [1],
                backgroundColor: Object.keys(catData).length > 0 ? ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'] : ['#333'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            animation: false // Disabled animation for instant load
        }
    });

    // -- Bar Chart --
    let currentTotal = 0;
    let prevTotal = 0;
    let prevYear = selYear;
    let prevMonth = selMonth - 1;
    
    if(prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }

    expensesOnly.forEach(tx => {
        const d = new Date(tx.date);
        if(d.getFullYear() === selYear && (d.getMonth() + 1) === selMonth) currentTotal += tx.amount;
        if(d.getFullYear() === prevYear && (d.getMonth() + 1) === prevMonth) prevTotal += tx.amount;
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#aaaaaa' : '#777777';
    const gridColor = isDark ? '#333333' : '#e0e0e0';

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    charts.trend = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: ['Previous Month', 'Selected Month'],
            datasets: [{
                label: `Expenses (${profileSettings.currency})`,
                data: [prevTotal, currentTotal],
                backgroundColor: ['#ff9f40', '#4CAF50'],
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disabled animation for instant load
            scales: {
                y: { 
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                x: { 
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// 6. PROFILE & EXPORT
// ==========================================
function populateProfileForm() {
    document.getElementById('prof-name').value = profileSettings.name || '';
    document.getElementById('prof-phone').value = profileSettings.phone || '';
    document.getElementById('prof-email').value = profileSettings.email || '';
    document.getElementById('prof-currency').value = profileSettings.currency || '৳';
    document.getElementById('prof-budget').value = profileSettings.budget || 0;
}

document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    profileSettings.name = document.getElementById('prof-name').value;
    profileSettings.phone = document.getElementById('prof-phone').value;
    profileSettings.currency = document.getElementById('prof-currency').value;
    profileSettings.budget = parseFloat(document.getElementById('prof-budget').value);
    
    saveProfileSettings();
    updateDashboardStats();
    renderTransactions();
    alert('Profile saved successfully!');
});

document.getElementById('export-data-btn').addEventListener('click', () => {
    const dataToExport = {
        userEmail: currentUser.email,
        profile: profileSettings,
        transactions: transactions
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartSpend_${currentUser.email}_Data.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// ==========================================
// 7. THEME
// ==========================================
document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const body = document.documentElement;
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('smartspend_theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('smartspend_theme', 'dark');
    }
    if (!document.getElementById('view-analytics').classList.contains('hidden')) renderCharts();
});

function loadThemePreference() {
    if (localStorage.getItem('smartspend_theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}