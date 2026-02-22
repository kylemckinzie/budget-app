// Global o'zgaruvchilar
let budget = {
    baytul_mol: 0,
    oila_uchun: 0,
    talim_uchun: 0,
    biznes_rivoj: 0,
    total_income: 0,
    total_spent: 0
};

let expenses = [];
let notes = [];
let expenseChart, budgetChart;

// API sozlamalari
const API_BASE = '/api';
let currentUser = null;
let authToken = null;

// Sahifa yuklanganda
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// ==================== OY YANGILANISHI FUNCTIONS ====================

// Oylik budjetni yangilash
function checkMonthlyReset() {
    const lastReset = localStorage.getItem('lastBudgetReset');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    if (!lastReset) {
        // Birinchi marta ishga tushganda
        localStorage.setItem('lastBudgetReset', JSON.stringify({
            month: currentMonth,
            year: currentYear
        }));
        return false;
    }
    
    try {
        const lastResetData = JSON.parse(lastReset);
        const lastMonth = lastResetData.month;
        const lastYear = lastResetData.year;
        
        // Agar oy yoki yil o'zgarganda
        if (currentMonth !== lastMonth || currentYear !== lastYear) {
            resetMonthlyBudget();
            
            // Yangi oy ma'lumotlarini saqlash
            localStorage.setItem('lastBudgetReset', JSON.stringify({
                month: currentMonth,
                year: currentYear
            }));
            return true;
        }
    } catch (error) {
        console.error('Monthly reset check error:', error);
    }
    
    return false;
}

// Oylik budjetni nolga tushirish (YANGILANGAN)
function resetMonthlyBudget() {
    // Joriy oy statistikasini saqlash
    const monthlyStats = {
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        baytul_mol_start: budget.baytul_mol,
        oila_uchun_start: budget.oila_uchun,
        talim_uchun_start: budget.talim_uchun,
        biznes_rivoj_start: budget.biznes_rivoj,
        total_income: budget.total_income,
        total_spent: budget.total_spent,
        final_balance: budget.total_income - budget.total_spent,
        date: new Date().toISOString(),
        expenses_count: expenses.length
    };
    
    // Oylik statistikani saqlash
    saveMonthlyStats(monthlyStats);
    
    // 🔄 MABLAG'LARNI SAQLAB QOLISH - NOLGA TUSHIRMASLIK
    budget.total_income = 0;
    budget.total_spent = 0;
    
    // Eski xarajatlarni arxivga o'tkazish
    archiveOldExpenses();
    
    // UI ni yangilash
    updateDashboard();
    saveDataToLocalStorage();
    
    // Foydalanuvchiga xabar berish
    showMonthlyResetNotification(monthlyStats);
}

// Oylik statistikani saqlash
function saveMonthlyStats(stats) {
    try {
        let monthlyStats = JSON.parse(localStorage.getItem('monthlyStats') || '[]');
        monthlyStats.push(stats);
        
        // Faqat oxirgi 12 oyni saqlash
        if (monthlyStats.length > 12) {
            monthlyStats = monthlyStats.slice(-12);
        }
        
        localStorage.setItem('monthlyStats', JSON.stringify(monthlyStats));
    } catch (error) {
        console.error('Save monthly stats error:', error);
    }
}

// Eski xarajatlarni arxivlash
function archiveOldExpenses() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Xarajatlarni oylar bo'yicha guruhlash
    const expensesByMonth = {};
    
    expenses.forEach(expense => {
        try {
            const expenseDate = new Date(expense.date);
            const expenseMonth = expenseDate.getMonth();
            const expenseYear = expenseDate.getFullYear();
            
            // Agar joriy oy bo'lsa, o'tkazib yuborish
            if (expenseYear === currentYear && expenseMonth === currentMonth) {
                return;
            }
            
            // Oylar bo'yicha guruhlash
            const key = `${expenseYear}-${expenseMonth}`;
            if (!expensesByMonth[key]) {
                expensesByMonth[key] = {
                    month: expenseMonth,
                    year: expenseYear,
                    expenses: []
                };
            }
            expensesByMonth[key].expenses.push(expense);
            
        } catch (error) {
            console.error('Date parse error in archive:', error);
        }
    });
    
    // Arxivni yuklash yoki yangi yaratish
    let archivedExpenses = JSON.parse(localStorage.getItem('archivedExpenses') || '[]');
    
    // Har bir oy uchun arxiv yaratish yoki yangilash
    Object.values(expensesByMonth).forEach(monthData => {
        // Bu oy uchun mavjud arxivni topish
        const existingArchiveIndex = archivedExpenses.findIndex(archive => 
            archive.month === monthData.month && archive.year === monthData.year
        );
        
        if (existingArchiveIndex !== -1) {
            // Mavjud arxivni yangilash
            archivedExpenses[existingArchiveIndex].expenses.push(...monthData.expenses);
        } else {
            // Yangi arxiv yaratish
            archivedExpenses.push({
                month: monthData.month,
                year: monthData.year,
                expenses: monthData.expenses,
                archived_date: new Date().toISOString()
            });
        }
    });
    
    // Faqat oxirgi 12 oy arxivini saqlash
    if (archivedExpenses.length > 12) {
        // Tartiblash: eng yangisi birinchi
        archivedExpenses.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
        
        // Faqat oxirgi 12 tasini saqlash
        archivedExpenses = archivedExpenses.slice(0, 12);
    }
    
    // Arxivni saqlash
    localStorage.setItem('archivedExpenses', JSON.stringify(archivedExpenses));
    
    // Faqat joriy oy xarajatlarini saqlash
    expenses = expenses.filter(expense => {
        try {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && 
                   expenseDate.getFullYear() === currentYear;
        } catch (error) {
            return false;
        }
    });
    
    console.log(`📊 Arxiv saqlandi: ${Object.keys(expensesByMonth).length} oy`);
    console.log(`📊 Joriy oy xarajatlari: ${expenses.length} ta`);
}

// Oy yangilanishi haqida xabar
function showMonthlyResetNotification(monthlyStats) {
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                       'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    const currentMonth = new Date().getMonth();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    
    const message = `
        🎉 <strong>${monthNames[currentMonth]} oyi boshlandi!</strong><br><br>
        📊 <strong>O'tgan oy (${monthNames[previousMonth]}) statistikasi:</strong><br>
        • Umumiy kirim: <strong>${formatMoney(monthlyStats.total_income)}</strong><br>
        • Xarajatlar: <strong>${formatMoney(monthlyStats.total_spent)}</strong><br>
        • Qolgan mablag': <strong>${formatMoney(monthlyStats.final_balance)}</strong><br>
        • Xarajatlar soni: <strong>${monthlyStats.expenses_count || 0}</strong><br><br>
        💰 <strong>Qolgan mablag'lar saqlandi:</strong><br>
        • Baytul mol: <strong>${formatMoney(monthlyStats.baytul_mol_start)}</strong><br>
        • Oila uchun: <strong>${formatMoney(monthlyStats.oila_uchun_start)}</strong><br>
        • Talim uchun: <strong>${formatMoney(monthlyStats.talim_uchun_start)}</strong><br>
        • Biznes rivoji: <strong>${formatMoney(monthlyStats.biznes_rivoj_start)}</strong><br><br>
        ✅ <strong>Yangi oy budjeti tayyor!</strong>
    `;
    
    showAlert(message, 'info');
}

// Kunlik tekshirish
function checkDailyReset() {
    const lastDailyCheck = localStorage.getItem('lastDailyCheck');
    const today = new Date().toDateString();
    
    if (lastDailyCheck !== today) {
        // Kun yangilanganini tekshirish
        const wasReset = checkMonthlyReset();
        
        if (!wasReset) {
            // Agar oy yangilanmagan bo'lsa, kunlik tekshiruv
            checkMonthStartNotification();
        }
        
        // Kunlik tekshiruv sanasini yangilash
        localStorage.setItem('lastDailyCheck', today);
    }
}

// Oy boshini bildirishnoma
function checkMonthStartNotification() {
    const today = new Date();
    const isFirstDayOfMonth = today.getDate() === 1;
    
    if (isFirstDayOfMonth) {
        const lastFirstDayCheck = localStorage.getItem('lastFirstDayCheck');
        const currentMonth = today.getMonth() + '-' + today.getFullYear();
        
        if (lastFirstDayCheck !== currentMonth) {
            const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                               'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
            
            showAlert(`📅 <strong>${monthNames[today.getMonth()]} oyining 1-kuni!</strong> Yangi oy rejalaringizni kiritishingiz mumkin.`, 'info');
            localStorage.setItem('lastFirstDayCheck', currentMonth);
        }
    }
}

// ==================== ASOSIY APP FUNCTIONS ====================

// Dasturni ishga tushirish - YANGILANGAN
async function initializeApp() {
    console.log('🚀 Dastur ishga tushmoqda...');

    // The login form is displayed by default from HTML.
    // We will wait for the user to click the login button.
    // Event listeners can be set up early.
    setupEventListeners();
}

// Avtomatik login (test user)
async function autoLogin() {
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'test',
                password: 'test123'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = {
                id: result.data.user_id,
                username: result.data.username
            };
            authToken = result.data.token;
            hideLoginForm(); // Hide only on success
            console.log('✅ Login successful:', currentUser);
        } else {
            await createTestUser();
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        // Fallback to offline mode
        currentUser = { id: 0, username: 'Offline' };
        hideLoginForm();
        loadDataFromLocalStorage();
        showAlert('⚠️ Server bilan aloqa yo\'q. Offline rejim ishga tushdi.', 'warning');
    }
}

// Test user yaratish
async function createTestUser() {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'test',
                password: 'test123',
                email: 'test@example.com'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = {
                id: result.data.user_id,
                username: result.data.username
            };
            authToken = `token-${result.data.user_id}`;
            console.log('✅ User created:', currentUser);
            hideLoginForm();
            await autoLogin();
        }
    } catch (error) {
        console.error('❌ User creation error:', error);
    }
}

// Backend dan budjet ma'lumotlarini olish
async function loadBudgetData() {
    if (!currentUser) return;
    
    try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const response = await fetch(`${API_BASE}/budget?user_id=${currentUser.id}&month=${month}&year=${year}`);
        const result = await response.json();
        
        if (result.success) {
            budget = result.data;
            console.log('✅ Budget loaded:', budget);
        }
    } catch (error) {
        console.error('❌ Budget load error:', error);
        loadDataFromLocalStorage();
    }
}

async function loadBudgetByDate() {
    const dateInput = document.getElementById('budgetViewDate').value;
    if (!dateInput) return;

    const [year, month] = dateInput.split('-').map(Number);
    
    try {
        const response = await fetch(`${API_BASE}/budget?user_id=${currentUser.id}&month=${month}&year=${year}`);
        const result = await response.json();
        if (result.success) {
            budget = result.data;
            updateDashboard(); // Updates the money cards
            showAlert(`📅 ${month}-${year} budjeti ko'rsatilmoqda`, 'info');
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadBudgetFilter() {
    const dateInput = document.getElementById('budgetFilterDate').value;
    let query = `user_id=${currentUser.id}`;
    
    if (dateInput) {
        const [year, month] = dateInput.split('-').map(Number);
        query += `&month=${month}&year=${year}`;
    }

    const response = await fetch(`${API_BASE}/budget?${query}`);
    const result = await response.json();
    if (result.success) {
        budget = result.data;
        updateDashboard(); // Updates the budget cards
    }
}

async function loadIncomeLog() {
    const filterVal = document.getElementById('incomeFilterDate') ? document.getElementById('incomeFilterDate').value : '';
    let query = `user_id=${currentUser.id}`;
    
    if (filterVal) {
        const [y, m] = filterVal.split('-');
        query += `&month=${parseInt(m)}&year=${y}`;
    }

    const response = await fetch(`${API_BASE}/incomes?${query}`);
    const result = await response.json();
    const listDiv = document.getElementById('incomeLogList');
    
    if (result.success) {
        listDiv.innerHTML = result.data.map(inc => `
            <div class="expense-item" style="border-left: 5px solid #27ae60">
                <div class="expense-info">
                    <div class="expense-category">${inc.type === 'monthly' ? 'Oylik' : 'Kunlik'} Tushum</div>
                    <div class="expense-date">Sana: ${new Date(inc.date).toLocaleDateString()} (${inc.month}-${inc.year} uchun)</div>
                </div>
                <div class="expense-amount" style="color: #27ae60">+${formatMoney(inc.amount)}</div>
            </div>
        `).join('');
    }
}

// Backend dan xarajatlarni olish
async function loadExpensesData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/expenses?user_id=${currentUser.id}`);
        const result = await response.json();
        
        if (result.success) {
            expenses = result.data;
            console.log('✅ Expenses loaded:', expenses.length, 'items');
        }
    } catch (error) {
        console.error('❌ Expenses load error:', error);
        loadDataFromLocalStorage();
    }
}

// Backend dan eslatmalarni olish
async function loadNotesData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/notes?user_id=${currentUser.id}`);
        const result = await response.json();
        
        if (result.success) {
            notes = result.data;
            displayNotes();
            console.log('✅ Notes loaded:', notes.length, 'items');
        }
    } catch (error) {
        console.error('❌ Notes load error:', error);
        loadNotesFromLocalStorage();
    }
}

// Event listener'lar
function setupEventListeners() {
    const incomeAmountInput = document.getElementById('incomeAmount');
    if (incomeAmountInput) {
        incomeAmountInput.addEventListener('input', calculateBudgetPreview);
    }
    
    const expenseDescriptionInput = document.getElementById('expenseDescription');
    if (expenseDescriptionInput) {
        expenseDescriptionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addExpense();
            }
        });
    }
}

// Login form ni yashirish
function hideLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.style.display = 'none';
    }
}

async function initializePostLogin() {
    console.log('✅ Login muvaffaqiyatli. Ma\'lumotlar yuklanmoqda...');

    // Ma'lumotlarni yuklash
    await loadBudgetData();
    await loadExpensesData();
    await loadNotesData();

    // UI ni yangilash
    updateDashboard();
    updateCharts();

    // Oylik statistika bo'limini qo'shish (agar yo'q bo'lsa)
    const statsSection = document.getElementById('statistics');
    if (statsSection && !statsSection.querySelector('.month-filter-section')) {
        addMonthlyStatsSection();
        addMonthFilterToStatistics();
    }

    // Dastlabki ma'lumotlarni ko'rsatish
    setTimeout(() => {
        updateFilteredData();
    }, 500);

    console.log('✅ Dastur to\'liq yuklandi!');
}

async function performLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAlert('Iltimos, barcha maydonlarni to\'ldiring!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = { id: result.data.user_id, username: result.data.username };
            authToken = result.data.token;
            hideLoginForm();
            await initializePostLogin(); // Load data and setup UI after login
            showAlert(`✅ Xush kelibsiz, ${currentUser.username}!`, 'success');
        } else {
            showAlert('❌ Login yoki parol xato!', 'error');
        }
    } catch (error) {
        showAlert('❌ Server bilan bog\'lanishda xatolik', 'error');
    }
}

// Bo'limlarni ko'rsatish - YANGILANGAN
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    if (sectionId === 'incomeLog') loadIncomeLog();
    
    if (sectionId === 'expenses') {
        displayExpenses();
    } else if (sectionId === 'budgets') {
        loadBudgetFilter();
    } else if (sectionId === 'statistics') {
        updateCharts();
        updateStatistics();
        
        // 🆕 YANGI: Filter ma'lumotlarini yangilash
        setTimeout(() => {
            updateFilteredData();
        }, 100);
    }
}

// ==================== BACKEND SOROVLARI ====================

async function addIncome() {
    const amountInput = document.getElementById('incomeAmount');
    const typeSelect = document.getElementById('incomeType');
    const dateVal = document.getElementById('incomeDate').value;

    if (!currentUser) {
        showAlert('Iltimos, avval tizimga kiring!', 'error');
        return;
    }

    let month = 0, year = 0;
    if (dateVal) {
        const parts = dateVal.split('-');
        year = parseInt(parts[0]);
        month = parseInt(parts[1]);
    }

    if (!amountInput.value) {
        showAlert('Miqdorni kiriting!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/income`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: parseFloat(amountInput.value),
                type: typeSelect.value,
                user_id: currentUser.id,
                month: month,
                year: year,
                date: dateVal
            })
        });

        const result = await response.json();
        if (result.success) {
            budget = result.data;
            updateDashboard();
            amountInput.value = '';
            showAlert('✅ Tushum muvaffaqiyatli saqlandi va logga qo\'shildi!', 'success');
        } else {
            showAlert(`❌ Xatolik: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Add income error:', error);
        addIncomeToLocalStorage(parseFloat(amountInput.value), typeSelect.value);
    }
}

async function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const desc = document.getElementById('expenseDescription').value;
    const dateVal = document.getElementById('expenseDate') ? document.getElementById('expenseDate').value : '';

    if (!currentUser) {
        showAlert('Iltimos, avval tizimga kiring!', 'error');
        return;
    }

    let month = 0, year = 0;
    if (dateVal) {
        const parts = dateVal.split('-');
        year = parseInt(parts[0]);
        month = parseInt(parts[1]);
    }

    if (!amount || amount <= 0) { showAlert('To\'g\'ri miqdor kiriting', 'error'); return; }

    try {
        const response = await fetch(`${API_BASE}/expense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: category,
                amount: amount,
                description: desc,
                user_id: currentUser.id,
                month: month,
                year: year,
                date: dateVal
            })
        });
        const result = await response.json();
        if (result.success) {
            budget = result.data.budget;
            updateDashboard();
            showAlert('✅ Xarajat saqlandi!', 'success');
        } else {
            showAlert(result.message, 'error');
        }
    } catch (e) { 
        console.error('Add expense error:', e);
        addExpenseToLocalStorage(category, amount, desc);
    }
}

async function addNote() {
    const noteTextarea = document.getElementById('noteText');
    
    if (!noteTextarea) {
        showAlert('Eslatma maydoni topilmadi!', 'error');
        return;
    }
    
    const noteText = noteTextarea.value.trim();
    
    if (!noteText) {
        showAlert('Iltimos, eslatma matnini kiriting!', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken || '',
                'User-ID': currentUser ? currentUser.id.toString() : ''
            },
            body: JSON.stringify({
                content: noteText,
                user_id: currentUser ? currentUser.id : 1
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            notes.unshift(result.data);
            displayNotes();
            noteTextarea.value = '';
            showAlert('✅ Eslatma muvaffaqiyatli saqlandi!', 'success');
        } else {
            showAlert(`❌ Xatolik: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('❌ Note add error:', error);
        showAlert('❌ Server bilan bog\'lanishda xatolik!', 'error');
        addNoteToLocalStorage(noteText);
    }
}

async function deleteNote(noteId) {
    try {
        const response = await fetch(`${API_BASE}/notes/${noteId}?user_id=${currentUser ? currentUser.id : 1}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authToken || '',
                'User-ID': currentUser ? currentUser.id.toString() : ''
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            notes = notes.filter(note => note.id !== noteId);
            displayNotes();
            showAlert('✅ Eslatma muvaffaqiyatli o\'chirildi!', 'success');
        } else {
            showAlert(`❌ Xatolik: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('❌ Note delete error:', error);
        showAlert('❌ Server bilan bog\'lanishda xatolik!', 'error');
        deleteNoteFromLocalStorage(noteId);
    }
}

async function resetDatabase() {
    if (!confirm("⚠️ DIQQAT!\n\nBarcha kiritilgan ma'lumotlar (xarajatlar, tushumlar, eslatmalar) butunlay o'chiriladi.\n\nDavom etishni xohlaysizmi?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/reset-db`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken || ''
            }
        });
        
        // Even if backend fails (e.g. offline), we clear local storage
        localStorage.clear();
        
        alert("✅ Barcha ma'lumotlar muvaffaqiyatli tozalandi.\nDastur qayta ishga tushmoqda...");
        location.reload();
        
    } catch (error) {
        console.error('Reset error:', error);
        localStorage.clear();
        alert("✅ Local ma'lumotlar tozalandi (Server bilan aloqa yo'q).");
        location.reload();
    }
}

function openChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
    }
}

async function performChangePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;

    if (!oldPass || !newPass) {
        showAlert('Barcha maydonlarni to\'ldiring', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                old_password: oldPass,
                new_password: newPass
            })
        });

        const result = await response.json();
        if (result.success) {
            showAlert('✅ Parol muvaffaqiyatli yangilandi', 'success');
            document.getElementById('changePasswordModal').style.display = 'none';
        } else {
            showAlert('❌ ' + result.message, 'error');
        }
    } catch (e) {
        showAlert('Server xatosi', 'error');
    }
}

// ==================== LOCALSTORAGE FALLBACK ====================

function loadDataFromLocalStorage() {
    try {
        const saved = localStorage.getItem('budgetData');
        if (saved) {
            const data = JSON.parse(saved);
            budget = data.budget || budget;
            expenses = data.expenses || expenses;
        }
    } catch (error) {
        console.error('LocalStorage load error:', error);
    }
}

function loadNotesFromLocalStorage() {
    try {
        const saved = localStorage.getItem('budgetNotes');
        if (saved) {
            notes = JSON.parse(saved);
            displayNotes();
        }
    } catch (error) {
        console.error('LocalStorage notes load error:', error);
    }
}

function addIncomeToLocalStorage(amount, type) {
    budget.total_income += amount;
    budget.baytul_mol += amount * 0.1;
    budget.oila_uchun += amount * 0.3;
    budget.talim_uchun += amount * 0.2;
    budget.biznes_rivoj += amount * 0.4;
    
    updateDashboard();
    saveDataToLocalStorage();
    
    showAlert(`✅ ${type === 'monthly' ? 'Oylik' : 'Kunlik'} tushum qo'shildi! (Local)`, 'success');
}

function addExpenseToLocalStorage(category, amount, description) {
    let selectedBudget = 0;
    switch(category) {
        case 'Baytul mol': selectedBudget = budget.baytul_mol; break;
        case 'Oila uchun': selectedBudget = budget.oila_uchun; break;
        case 'Talim uchun': selectedBudget = budget.talim_uchun; break;
        case 'Biznes rivoji uchun': selectedBudget = budget.biznes_rivoj; break;
    }
    
    if (amount > selectedBudget) {
        showAlert(`❌ Budjet yetarli emas! Qolgan miqdor: ${formatMoney(selectedBudget)}`, 'error');
        return;
    }
    
    const expense = {
        id: Date.now(),
        date: new Date().toLocaleString('uz-UZ'),
        category: category,
        amount: amount,
        description: description
    };
    
    expenses.push(expense);
    
    switch(category) {
        case 'Baytul mol': budget.baytul_mol -= amount; break;
        case 'Oila uchun': budget.oila_uchun -= amount; break;
        case 'Talim uchun': budget.talim_uchun -= amount; break;
        case 'Biznes rivoji uchun': budget.biznes_rivoj -= amount; break;
    }
    
    budget.total_spent += amount;
    
    updateDashboard();
    saveDataToLocalStorage();
    
    showAlert('✅ Xarajat qo\'shildi! (Local)', 'success');
}

function addNoteToLocalStorage(content) {
    const note = {
        id: Date.now(),
        date: new Date().toLocaleString('uz-UZ'),
        content: content
    };
    
    notes.push(note);
    saveNotesToLocalStorage();
    displayNotes();
    
    showAlert('✅ Eslatma saqlandi! (Local)', 'success');
}

function deleteNoteFromLocalStorage(noteId) {
    notes = notes.filter(note => note.id !== noteId);
    saveNotesToLocalStorage();
    displayNotes();
    
    showAlert('✅ Eslatma o\'chirildi! (Local)', 'success');
}

function saveDataToLocalStorage() {
    try {
        const data = {
            budget: budget,
            expenses: expenses
        };
        localStorage.setItem('budgetData', JSON.stringify(data));
    } catch (error) {
        console.error('LocalStorage save error:', error);
    }
}

function saveNotesToLocalStorage() {
    try {
        localStorage.setItem('budgetNotes', JSON.stringify(notes));
    } catch (error) {
        console.error('LocalStorage notes save error:', error);
    }
}

// ==================== UI FUNCTIONS ====================

function calculateBudgetPreview() {
    const amountInput = document.getElementById('incomeAmount');
    if (!amountInput) return;
    
    const amount = parseFloat(amountInput.value) || 0;
    
    const previewBaytul = document.getElementById('previewBaytul');
    const previewOila = document.getElementById('previewOila');
    const previewTalim = document.getElementById('previewTalim');
    const previewBiznes = document.getElementById('previewBiznes');
    
    if (previewBaytul) previewBaytul.textContent = formatMoney(amount * 0.1);
    if (previewOila) previewOila.textContent = formatMoney(amount * 0.3);
    if (previewTalim) previewTalim.textContent = formatMoney(amount * 0.2);
    if (previewBiznes) previewBiznes.textContent = formatMoney(amount * 0.4);
}

function updateDashboard() {
    const totalIncomeElem = document.getElementById('totalIncome');
    const totalSpentElem = document.getElementById('totalSpent');
    const remainingBalanceElem = document.getElementById('remainingBalance');
    
    if (totalIncomeElem) totalIncomeElem.textContent = formatMoney(budget.total_income);
    if (totalSpentElem) totalSpentElem.textContent = formatMoney(budget.total_spent);
    if (remainingBalanceElem) remainingBalanceElem.textContent = formatMoney(budget.total_income - budget.total_spent);
    
    const budgetBaytul = document.getElementById('budgetBaytul');
    const budgetOila = document.getElementById('budgetOila');
    const budgetTalim = document.getElementById('budgetTalim');
    const budgetBiznes = document.getElementById('budgetBiznes');
    
    if (budgetBaytul) budgetBaytul.textContent = formatMoney(budget.baytul_mol);
    if (budgetOila) budgetOila.textContent = formatMoney(budget.oila_uchun);
    if (budgetTalim) budgetTalim.textContent = formatMoney(budget.talim_uchun);
    if (budgetBiznes) budgetBiznes.textContent = formatMoney(budget.biznes_rivoj);
}

async function displayExpenses() {
    const filterVal = document.getElementById('expenseFilterDate').value;
    let query = `user_id=${currentUser.id}`;
    
    if (filterVal) {
        const [y, m] = filterVal.split('-');
        query += `&month=${parseInt(m)}&year=${y}`;
    }

    const response = await fetch(`${API_BASE}/expenses?${query}`);
    const result = await response.json();
    const listDiv = document.getElementById('expensesList');

    if (result.success) {
        listDiv.innerHTML = result.data.map(exp => `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="expense-category">${exp.category}</div>
                    <div class="expense-description">${exp.description}</div>
                    <div class="expense-date">${new Date(exp.date).toLocaleDateString()}</div>
                </div>
                <div class="expense-amount">-${formatMoney(exp.amount)}</div>
            </div>
        `).join('');
    }
}
function displayNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    if (notes.length === 0) {
        notesList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Hozircha eslatmalar mavjud emas</p>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-item">
            <div class="note-header">
                <span class="note-date">${new Date(note.date).toLocaleString('uz-UZ')}</span>
                <button class="btn-delete" onclick="deleteNote(${note.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="note-content">${note.content}</div>
        </div>
    `).join('');
}

// Oylik statistika bo'limini qo'shish
function addMonthlyStatsSection() {
    const statsSection = document.getElementById('statistics');
    if (statsSection && !document.getElementById('monthlyStatsContent')) {
        const monthlyStatsHTML = `
            <div class="monthly-stats">
                <h3><i class="fas fa-calendar-alt"></i> Oylik Statistika</h3>
                <div id="monthlyStatsContent"></div>
            </div>
        `;
        statsSection.innerHTML += monthlyStatsHTML;
    }
}

// Oylik statistika ko'rsatish
function showMonthlyStats() {
    const monthlyStats = JSON.parse(localStorage.getItem('monthlyStats') || '[]');
    
    if (monthlyStats.length === 0) {
        return '<p style="text-align: center; color: #6c757d; padding: 20px;">Hozircha oylik statistika mavjud emas</p>';
    }
    
    let html = `
        <div class="stats-table">
            <table>
                <thead>
                    <tr>
                        <th>Oy/Yil</th>
                        <th>Kirim</th>
                        <th>Xarajat</th>
                        <th>Qolgan</th>
                        <th>Xarajatlar soni</th>
                        <th>Harakat</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    monthlyStats.reverse().forEach((stat, index) => {
        const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                           'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
        
        html += `
            <tr>
                <td>${monthNames[stat.month]} ${stat.year}</td>
                <td>${formatMoney(stat.total_income)}</td>
                <td>${formatMoney(stat.total_spent)}</td>
                <td class="${(stat.final_balance >= 0) ? 'positive' : 'negative'}">
                    ${formatMoney(stat.final_balance)}
                </td>
                <td>${stat.expenses_count || 0}</td>
                <td>
                    <button class="btn-view" onclick="viewMonthDetails('${stat.month}', '${stat.year}')">
                        <i class="fas fa-eye"></i> Ko'rish
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function updateCharts() {
    const expenseCanvas = document.getElementById('expenseChart');
    const budgetCanvas = document.getElementById('budgetChart');
    
    if (!expenseCanvas || !budgetCanvas) return;
    
    const expenseCtx = expenseCanvas.getContext('2d');
    const budgetCtx = budgetCanvas.getContext('2d');
    
    if (expenseChart) expenseChart.destroy();
    if (budgetChart) budgetChart.destroy();
    
    // Xarajatlar diagrammasi
    const expenseData = {
        labels: ['Baytul mol', 'Oila uchun', 'Talim uchun', 'Biznes rivoji'],
        datasets: [{
            data: [
                expenses.filter(e => e.category === 'Baytul mol').reduce((sum, e) => sum + e.amount, 0),
                expenses.filter(e => e.category === 'Oila uchun').reduce((sum, e) => sum + e.amount, 0),
                expenses.filter(e => e.category === 'Talim uchun').reduce((sum, e) => sum + e.amount, 0),
                expenses.filter(e => e.category === 'Biznes rivoji uchun').reduce((sum, e) => sum + e.amount, 0)
            ],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    
    expenseChart = new Chart(expenseCtx, {
        type: 'doughnut',
        data: expenseData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
    
    // Budjet diagrammasi
    const budgetData = {
        labels: ['Baytul mol', 'Oila uchun', 'Talim uchun', 'Biznes rivoji'],
        datasets: [{
            label: 'Qolgan Budjet',
            data: [budget.baytul_mol, budget.oila_uchun, budget.talim_uchun, budget.biznes_rivoj],
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2
        }]
    };
    
    budgetChart = new Chart(budgetCtx, {
        type: 'bar',
        data: budgetData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatMoney(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatMoney(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// Statistika yangilash
function updateStatistics() {
    const statsTotalIncome = document.getElementById('statsTotalIncome');
    const statsTotalSpent = document.getElementById('statsTotalSpent');
    const statsRemaining = document.getElementById('statsRemaining');
    const statsExpensePercent = document.getElementById('statsExpensePercent');
    
    if (statsTotalIncome) statsTotalIncome.textContent = formatMoney(budget.total_income);
    if (statsTotalSpent) statsTotalSpent.textContent = formatMoney(budget.total_spent);
    if (statsRemaining) statsRemaining.textContent = formatMoney(budget.total_income - budget.total_spent);
    
    const expensePercent = budget.total_income > 0 ? (budget.total_spent / budget.total_income * 100) : 0;
    if (statsExpensePercent) statsExpensePercent.textContent = expensePercent.toFixed(1) + '%';
    
    // Oylik statistika ko'rsatish
    const monthlyStatsContent = document.getElementById('monthlyStatsContent');
    if (monthlyStatsContent) {
        monthlyStatsContent.innerHTML = showMonthlyStats();
    }
}

// Format money
function formatMoney(amount) {
    return Math.round(amount).toLocaleString('uz-UZ') + ' soʻm';
}

// Alert ko'rsatish
function showAlert(message, type) {
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <div class="alert-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 8000);
}

// ==================== YANGI QO'SHIMCHA FUNKSIYALAR ====================

// 1. STATISTIKA SAHIFASIGA FILTER QO'SHISH
function addMonthFilterToStatistics() {
    const statsSection = document.getElementById('statistics');
    if (!statsSection) {
        console.error('❌ Statistika sahifasi topilmadi');
        return;
    }
    
    console.log('✅ Statistika sahifasi topildi, filter qo\'shilmoqda...');
    
    // Filter HTML yaratish
    const filterHTML = `
        <div class="month-filter-section">
            <div class="filter-header">
                <h3><i class="fas fa-filter"></i> Oylik Xarajatlarni Filtrlash</h3>
                <p>Yil, oy va kategoriya bo'yicha xarajatlarni ko'ring</p>
            </div>
            
            <div class="filter-controls">
                <div class="filter-group">
                    <label for="yearFilter"><i class="fas fa-calendar-alt"></i> Yil:</label>
                    <select id="yearFilter" class="form-control">
                        <option value="all">Barcha yillar</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="monthFilter"><i class="fas fa-calendar"></i> Oy:</label>
                    <select id="monthFilter" class="form-control">
                        <option value="all">Barcha oylar</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="categoryFilter"><i class="fas fa-tags"></i> Kategoriya:</label>
                    <select id="categoryFilter" class="form-control">
                        <option value="all">Barcha kategoriyalar</option>
                        <option value="Baytul mol">Baytul mol</option>
                        <option value="Oila uchun">Oila uchun</option>
                        <option value="Talim uchun">Talim uchun</option>
                        <option value="Biznes rivoji uchun">Biznes rivoji uchun</option>
                    </select>
                </div>
                
                <div class="filter-buttons">
                    <button class="btn-apply" onclick="updateFilteredData()">
                        <i class="fas fa-search"></i> Filtrlash
                    </button>
                    <button class="btn-reset" onclick="resetFilters()">
                        <i class="fas fa-redo"></i> Tozalash
                    </button>
                </div>
            </div>
            
            <div id="filteredResults" class="filtered-results">
                <!-- Filtrlangan natijalar shu yerda ko'rinadi -->
            </div>
            
            <div id="filteredStats" class="filtered-stats">
                <!-- Filtrlangan statistika shu yerda ko'rinadi -->
            </div>
        </div>
    `;
    
    // Statistika sahifasiga qo'shish
    statsSection.insertAdjacentHTML('afterbegin', filterHTML);
    
    // Yillar va oylar ro'yxatini to'ldirish
    populateYearMonthFilters();
    
    console.log('✅ Filter paneli qo\'shildi');
}

// 2. YILLAR VA OYLAR RO'YXATINI TO'LDIRISH
function populateYearMonthFilters() {
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (!yearFilter || !monthFilter) {
        console.error('❌ Filter elementlari topilmadi');
        return;
    }
    
    // Yillar ro'yxati
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Oylar ro'yxati
    const monthNames = [
        'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
        'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    
    monthNames.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthFilter.appendChild(option);
    });
    
    // Event listener'lar qo'shish
    yearFilter.addEventListener('change', updateMonthFilter);
    monthFilter.addEventListener('change', updateFilteredData);
    document.getElementById('categoryFilter').addEventListener('change', updateFilteredData);
}

// 3. OYLARNI FILTR QILISH
function updateMonthFilter() {
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (!yearFilter || !monthFilter) return;
    
    const selectedYear = yearFilter.value;
    
    // Always show all months, do not hide them based on local storage
    monthFilter.querySelectorAll('option').forEach(option => {
        option.style.display = '';
    });
}

// 4. FILTRLANGAN MA'LUMOTLARNI YANGILASH
async function updateFilteredData() {
    console.log('🔄 Filtrlangan ma\'lumotlar yangilanmoqda...');
    
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (!yearFilter || !monthFilter || !categoryFilter) {
        console.error('❌ Filter elementlari topilmadi');
        return;
    }
    
    const selectedYear = yearFilter.value;
    const selectedMonth = monthFilter.value;
    const selectedCategory = categoryFilter.value;
    
    let query = `user_id=${currentUser.id}`;
    
    // If specific year and month are selected, fetch from backend
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        // Backend expects month 1-12, JS gives 0-11
        query += `&year=${selectedYear}&month=${parseInt(selectedMonth) + 1}`;
        
        try {
            const response = await fetch(`${API_BASE}/expenses?${query}`);
            const result = await response.json();
            if (result.success) {
                let data = result.data;
                if (selectedCategory !== 'all') {
                    data = data.filter(e => e.category === selectedCategory);
                }
                displayFilteredExpenses(data);
            }
        } catch (e) {
            console.error("Filter fetch error:", e);
        }
    } else {
        // If filters are not specific, use the currently loaded expenses (current month)
        let data = expenses;
        if (selectedCategory !== 'all') {
            data = data.filter(e => e.category === selectedCategory);
        }
        displayFilteredExpenses(data);
    }
}

// 5. FILTRLANGAN XARAJATLARNI KO'RSATISH
function displayFilteredExpenses(filteredExpenses) {
    const filteredResultsDiv = document.getElementById('filteredResults');
    if (!filteredResultsDiv) {
        console.error('❌ filteredResults div topilmadi');
        return;
    }
    
    if (filteredExpenses.length === 0) {
        filteredResultsDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search" style="font-size: 4em; color: #6c757d; margin-bottom: 20px;"></i>
                <h3>Xarajatlar topilmadi</h3>
                <p>Tanlangan filter bo'yicha xarajatlar mavjud emas</p>
                <p style="font-size: 0.9em; margin-top: 10px;">Iltimos, boshqa filter tanlang yoki test ma'lumot yarating</p>
            </div>
        `;
        return;
    }
    
    // Xarajatlarni sanasi bo'yicha saralash (eng yangisi birinchi)
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Statistikani hisoblash
    let totalAmount = 0;
    const categories = {};
    const monthlyTotals = {};
    
    filteredExpenses.forEach(expense => {
        totalAmount += expense.amount;
        
        // Kategoriyalar statistikasi
        if (!categories[expense.category]) {
            categories[expense.category] = {
                count: 0,
                total: 0
            };
        }
        categories[expense.category].count++;
        categories[expense.category].total += expense.amount;
        
        // Oylar statistikasi
        const date = new Date(expense.date);
        const monthKey = `${date.getMonth()}-${date.getFullYear()}`;
        if (!monthlyTotals[monthKey]) {
            monthlyTotals[monthKey] = {
                month: date.getMonth(),
                year: date.getFullYear(),
                total: 0,
                count: 0
            };
        }
        monthlyTotals[monthKey].total += expense.amount;
        monthlyTotals[monthKey].count++;
    });
    
    // HTML yaratish
    let html = `
        <div class="results-header">
            <h3>Natijalar: <span class="result-count">${filteredExpenses.length} ta xarajat</span></h3>
            <div class="total-summary">
                <span>Umumiy summa:</span>
                <strong>${formatMoney(totalAmount)}</strong>
            </div>
        </div>
        
        <div class="category-summary">
            <h4><i class="fas fa-chart-pie"></i> Kategoriyalar Bo'yicha</h4>
    `;
    
    // Kategoriyalar bo'yicha summary
    Object.keys(categories).forEach(category => {
        const catData = categories[category];
        const percentage = totalAmount > 0 ? (catData.total / totalAmount * 100).toFixed(1) : 0;
        
        html += `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-name">
                        <span class="category-badge">${category}</span>
                    </div>
                    <div class="category-stats">
                        <span class="category-count">${catData.count} ta</span>
                        <span class="category-percent">${percentage}%</span>
                        <strong class="category-total">${formatMoney(catData.total)}</strong>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Xarajatlar ro'yxati
    html += `
        <div class="expenses-table-container">
            <h4><i class="fas fa-list"></i> Xarajatlar Ro'yxati</h4>
            <div class="expenses-table">
                <table>
                    <thead>
                        <tr>
                            <th>Sana</th>
                            <th>Kategoriya</th>
                            <th>Tavsif</th>
                            <th>Miqdor</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Faqat oxirgi 50 ta xarajatni ko'rsatish
    const displayExpenses = filteredExpenses.slice(0, 50);
    displayExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const formattedDate = date.toLocaleDateString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Kategoriya ranglari
        const categoryClass = expense.category.replace(/\s+/g, '-').toLowerCase();
        
        html += `
            <tr>
                <td class="expense-date">${formattedDate}</td>
                <td><span class="category-tag ${categoryClass}">${expense.category}</span></td>
                <td class="expense-description">${expense.description || '-'}</td>
                <td class="expense-amount">-${formatMoney(expense.amount)}</td>
            </tr>
        `;
    });
    
    if (filteredExpenses.length > 50) {
        html += `
            <tr>
                <td colspan="4" style="text-align: center; padding: 15px; color: #6c757d;">
                    <i class="fas fa-info-circle"></i> Va yana ${filteredExpenses.length - 50} ta xarajat...
                </td>
            </tr>
        `;
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    filteredResultsDiv.innerHTML = html;
    
    // Statistika ko'rsatish
    displayFilteredStats(filteredExpenses, totalAmount, categories, monthlyTotals);
}

// 6. FILTRLANGAN STATISTIKANI KO'RSATISH
function displayFilteredStats(filteredExpenses, totalAmount, categories, monthlyTotals) {
    const statsContainer = document.getElementById('filteredStats');
    if (!statsContainer) return;
    
    if (filteredExpenses.length === 0) {
        statsContainer.innerHTML = '';
        return;
    }
    
    // Statistikani hisoblash
    const avgExpense = totalAmount / filteredExpenses.length;
    
    // Eng ko'p xarajat kategoriyasi
    let topCategory = '';
    let topCategoryAmount = 0;
    Object.keys(categories).forEach(category => {
        if (categories[category].total > topCategoryAmount) {
            topCategory = category;
            topCategoryAmount = categories[category].total;
        }
    });
    
    // Eng ko'p xarajat qilgan oy
    let topMonth = '';
    let topMonthAmount = 0;
    Object.values(monthlyTotals).forEach(monthData => {
        if (monthData.total > topMonthAmount) {
            const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                               'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
            topMonth = `${monthNames[monthData.month]} ${monthData.year}`;
            topMonthAmount = monthData.total;
        }
    });
    
    let html = `
        <div class="stats-container">
            <h3><i class="fas fa-chart-bar"></i> Filtrlangan Statistika</h3>
            
            <div class="stats-grid">
                <div class="stat-card total-expenses">
                    <div class="stat-icon">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${formatMoney(totalAmount)}</div>
                        <div class="stat-label">Umumiy xarajat</div>
                    </div>
                </div>
                
                <div class="stat-card expense-count">
                    <div class="stat-icon">
                        <i class="fas fa-list-ol"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${filteredExpenses.length}</div>
                        <div class="stat-label">Xarajatlar soni</div>
                    </div>
                </div>
                
                <div class="stat-card avg-expense">
                    <div class="stat-icon">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${formatMoney(avgExpense)}</div>
                        <div class="stat-label">O'rtacha xarajat</div>
                    </div>
                </div>
                
                <div class="stat-card top-category">
                    <div class="stat-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${topCategory}</div>
                        <div class="stat-label">Eng ko'p xarajat</div>
                    </div>
                </div>
            </div>
            
            <div class="monthly-chart">
                <h4><i class="fas fa-chart-line"></i> Oylar Bo'yicha Xarajatlar</h4>
                <canvas id="monthlyChart"></canvas>
            </div>
        </div>
    `;
    
    statsContainer.innerHTML = html;
    
    // Diagrammani yaratish
    createMonthlyChart(monthlyTotals);
}

// 7. OYLIK DIAGRAMMA YARATISH
function createMonthlyChart(monthlyTotals) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Oylar ma'lumotlarini tartiblash
    const sortedMonths = Object.values(monthlyTotals).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    
    const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    
    const labels = sortedMonths.map(month => {
        return `${monthNames[month.month]} ${month.year}`;
    });
    
    const data = sortedMonths.map(month => month.total);
    
    // Diagrammani yaratish
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Xarajatlar',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatMoney(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatMoney(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// 8. FILTRLARNI TOZALASH
function resetFilters() {
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (yearFilter) yearFilter.value = 'all';
    if (monthFilter) monthFilter.value = 'all';
    if (categoryFilter) categoryFilter.value = 'all';
    
    // Barcha oylarni ko'rsatish
    monthFilter.querySelectorAll('option').forEach(option => {
        option.style.display = '';
    });
    
    // Ma'lumotlarni yangilash
    updateFilteredData();
}

// 9. TEST MA'LUMOTLAR YARATISH (faqat kerak bo'lsa)
function createTestData() {
    console.log('🧪 Test ma\'lumotlari yaratilmoqda...');
    
    // Arxiv ma'lumotlari
    const archivedExpenses = [];
    const currentDate = new Date();
    
    // Oxirgi 3 oy uchun test ma'lumotlari
    for (let i = 0; i < 3; i++) {
        const month = (currentDate.getMonth() - i + 12) % 12;
        const year = currentDate.getFullYear() - (currentDate.getMonth() - i < 0 ? 1 : 0);
        
        const expenses = [];
        const categories = ['Baytul mol', 'Oila uchun', 'Talim uchun', 'Biznes rivoji uchun'];
        
        // Har bir oy uchun 5-10 ta test xarajat
        const expenseCount = Math.floor(Math.random() * 6) + 5;
        
        for (let j = 0; j < expenseCount; j++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const amount = Math.floor(Math.random() * 500000) + 50000;
            const descriptions = [
                'Oziq-ovqat', 'Transport', 'Kommunal to\'lov', 
                'Kitoblar', 'Kurs', 'Savdo materiallari',
                'Sog\'liqni saqlash', 'Kiyim-kechak'
            ];
            
            expenses.push({
                id: Date.now() + j + i * 1000,
                date: new Date(year, month, Math.floor(Math.random() * 28) + 1).toISOString(),
                category: category,
                amount: amount,
                description: descriptions[Math.floor(Math.random() * descriptions.length)]
            });
        }
        
        archivedExpenses.push({
            month: month,
            year: year,
            expenses: expenses,
            archived_date: new Date().toISOString()
        });
    }
    
    localStorage.setItem('archivedExpenses', JSON.stringify(archivedExpenses));
    
    // Oylik statistika
    const monthlyStats = [];
    for (let i = 0; i < 3; i++) {
        const month = (currentDate.getMonth() - i + 12) % 12;
        const year = currentDate.getFullYear() - (currentDate.getMonth() - i < 0 ? 1 : 0);
        
        monthlyStats.push({
            month: month,
            year: year,
            total_income: Math.floor(Math.random() * 10000000) + 5000000,
            total_spent: Math.floor(Math.random() * 7000000) + 3000000,
            expenses_count: Math.floor(Math.random() * 10) + 5
        });
    }
    
    localStorage.setItem('monthlyStats', JSON.stringify(monthlyStats));
    
    console.log('✅ Test ma\'lumotlar yaratildi');
    showAlert('Test ma\'lumotlar yaratildi! Endi Statistika bo\'limiga o\'ting.', 'success');
}

// 10. OY TAFSILOTLARINI KO'RISH
function viewMonthDetails(month, year) {
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                       'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    
    // Arxivdan oy xarajatlarini olish
    const archivedExpenses = JSON.parse(localStorage.getItem('archivedExpenses') || '[]');
    const monthExpenses = archivedExpenses.find(archive => 
        archive.month == month && archive.year == year
    );
    
    // Oylik statistikani olish
    const monthlyStats = JSON.parse(localStorage.getItem('monthlyStats') || '[]');
    const monthStats = monthlyStats.find(stat => 
        stat.month == month && stat.year == year
    );
    
    let detailsHtml = `
        <div class="month-details-modal">
            <div class="modal-header">
                <h3>${monthNames[month]} ${year} - Tafsilotlar</h3>
                <button class="close-modal" onclick="closeMonthDetails()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-content">
                <div class="month-stats">
                    <h4><i class="fas fa-chart-bar"></i> Umumiy Statistika</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Umumiy Kirim:</span>
                            <span class="stat-value">${formatMoney(monthStats?.total_income || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Umumiy Xarajat:</span>
                            <span class="stat-value">${formatMoney(monthStats?.total_spent || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Qolgan Mablag':</span>
                            <span class="stat-value ${((monthStats?.final_balance || 0) >= 0) ? 'positive' : 'negative'}">
                                ${formatMoney(monthStats?.final_balance || 0)}
                            </span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Xarajatlar Soni:</span>
                            <span class="stat-value">${monthStats?.expenses_count || 0}</span>
                        </div>
                    </div>
                </div>
    `;
    
    if (monthExpenses && monthExpenses.expenses.length > 0) {
        detailsHtml += `
            <div class="month-expenses">
                <h4><i class="fas fa-list"></i> Oy Xarajatlari (${monthExpenses.expenses.length} ta)</h4>
                <div class="expenses-list">
        `;
        
        monthExpenses.expenses.forEach(expense => {
            detailsHtml += `
                <div class="expense-item">
                    <div class="expense-info">
                        <span class="expense-category">${expense.category}</span>
                        <span class="expense-description">${expense.description}</span>
                        <span class="expense-date">${new Date(expense.date).toLocaleDateString('uz-UZ')}</span>
                    </div>
                    <div class="expense-amount">-${formatMoney(expense.amount)}</div>
                </div>
            `;
        });
        
        detailsHtml += `
                </div>
            </div>
        `;
    } else {
        detailsHtml += `
            <div class="no-expenses">
                <p><i class="fas fa-info-circle"></i> Bu oy uchun xarajatlar topilmadi.</p>
            </div>
        `;
    }
    
    detailsHtml += `
            </div>
        </div>
    `;
    
    // Modal yaratish
    showMonthDetailsModal(detailsHtml);
}

function showMonthDetailsModal(content) {
    // Oldingi modalni o'chirish
    const oldModal = document.getElementById('monthDetailsModal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'monthDetailsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = content;
    
    document.body.appendChild(modal);
}

function closeMonthDetails() {
    const modal = document.getElementById('monthDetailsModal');
    if (modal) modal.remove();
}

// ==================== CSS STILLARI ====================

// Asosiy CSS stillari
const mainStyle = document.createElement('style');
mainStyle.textContent = `
    .alert {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        min-width: 300px;
        max-width: 500px;
    }
    
    .alert-success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 15px;
    }
    
    .alert-error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 8px;
        padding: 15px;
    }
    
    .alert-info {
        background: #d1ecf1;
        color: #0c5460;
        border: 1px solid #bee5eb;
        border-radius: 8px;
        padding: 15px;
    }
    
    .alert-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .alert-content button {
        background: none;
        border: none;
        font-size: 1.2em;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6c757d;
    }
    
    .empty-state h3 {
        margin-bottom: 10px;
        font-size: 1.5em;
    }
    
    .note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .btn-delete {
        background: #e74c3c;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
    }
    
    .btn-delete:hover {
        background: #c0392b;
    }
    
    #loginForm {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        margin: 20px auto;
        max-width: 400px;
    }
    
    .login-card {
        background: white;
        padding: 30px;
        border-radius: 15px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .login-header {
        text-align: center;
        margin-bottom: 25px;
    }
    .login-header i {
        font-size: 4em;
        color: #3498db;
        margin-bottom: 15px;
    }
    
    /* Oylik statistika stillari */
    .monthly-stats {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        margin-top: 30px;
    }
    
    .monthly-stats h3 {
        color: #2c3e50;
        margin-bottom: 20px;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
        font-size: 1.4em;
    }
    
    .stats-table {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e9ecef;
    }
    
    .stats-table table {
        width: 100%;
        border-collapse: collapse;
        min-width: 500px;
    }
    
    .stats-table th {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        text-align: left;
        font-weight: 600;
        border: none;
    }
    
    .stats-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #e9ecef;
        background: white;
    }
    
    .stats-table tr:hover td {
        background: #f8f9fa;
    }
    
    .stats-table .positive {
        color: #27ae60;
        font-weight: 600;
    }
    
    .stats-table .negative {
        color: #e74c3c;
        font-weight: 600;
    }
    
    .stats-table th:first-child {
        border-radius: 8px 0 0 0;
    }
    
    .stats-table th:last-child {
        border-radius: 0 8px 0 0;
    }
    
    .btn-view {
        background: #3498db;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    
    .btn-view:hover {
        background: #2980b9;
    }
    
    /* Modal stillari */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
    }
    
    .month-details-modal {
        background: white;
        border-radius: 15px;
        width: 100%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 15px 15px 0 0;
    }
    
    .modal-header h3 {
        margin: 0;
    }
    
    .close-modal {
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.2em;
    }
    
    .modal-content {
        padding: 20px;
    }
    
    .month-stats {
        margin-bottom: 30px;
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .stat-item {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        border-left: 4px solid #3498db;
    }
    
    .stat-label {
        display: block;
        color: #6c757d;
        font-size: 0.9em;
        margin-bottom: 5px;
    }
    
    .stat-value {
        font-size: 1.2em;
        font-weight: 600;
        color: #2c3e50;
    }
    
    .month-expenses {
        margin-top: 30px;
    }
    
    .expenses-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 10px;
        padding: 10px;
    }
    
    .expense-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #e9ecef;
    }
    
    .expense-item:last-child {
        border-bottom: none;
    }
    
    .expense-info {
        display: flex;
        gap: 15px;
        align-items: center;
    }
    
    .expense-category {
        background: #e3f2fd;
        color: #3498db;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 600;
    }
    
    .expense-description {
        color: #495057;
    }
    
    .expense-date {
        color: #6c757d;
        font-size: 0.9em;
    }
    
    .expense-amount {
        font-weight: 600;
        color: #e74c3c;
    }
    
    .no-expenses {
        text-align: center;
        padding: 30px;
        color: #6c757d;
        font-style: italic;
    }
`;

// Filter CSS stillari
const filterStyle = document.createElement('style');
filterStyle.textContent = `
    /* Filter Section Styles */
    .month-filter-section {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        margin-bottom: 25px;
    }
    
    .filter-header h3 {
        color: #2c3e50;
        margin-bottom: 10px;
        font-size: 1.5em;
    }
    
    .filter-header p {
        color: #6c757d;
        margin-bottom: 20px;
    }
    
    .filter-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .filter-group {
        display: flex;
        flex-direction: column;
    }
    
    .filter-group label {
        margin-bottom: 8px;
        color: #495057;
        font-weight: 600;
        font-size: 0.9em;
    }
    
    .filter-group label i {
        color: #3498db;
        margin-right: 8px;
    }
    
    .filter-group .form-control {
        padding: 12px 15px;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.3s ease;
        background: #f8f9fa;
    }
    
    .filter-group .form-control:focus {
        border-color: #3498db;
        background: white;
        box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
        outline: none;
    }
    
    .filter-buttons {
        display: flex;
        gap: 10px;
        align-items: flex-end;
    }
    
    .btn-apply, .btn-reset {
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    
    .btn-apply {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }
    
    .btn-apply:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
    }
    
    .btn-reset {
        background: #6c757d;
        color: white;
    }
    
    .btn-reset:hover {
        background: #5a6268;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(108, 117, 125, 0.3);
    }
    
    /* Filtered Results Styles */
    .filtered-results {
        background: white;
        padding: 25px;
        border-radius: 15px;
        border: 2px solid #e9ecef;
        margin: 25px 0;
    }
    
    .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 2px solid #f8f9fa;
    }
    
    .results-header h3 {
        color: #2c3e50;
        font-size: 1.3em;
        margin: 0;
    }
    
    .result-count {
        background: #e3f2fd;
        color: #3498db;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.9em;
        margin-left: 10px;
    }
    
    .total-summary {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: 600;
    }
    
    /* Category Summary */
    .category-summary {
        margin: 25px 0;
    }
    
    .category-summary h4 {
        color: #2c3e50;
        margin-bottom: 15px;
        font-size: 1.2em;
    }
    
    .category-item {
        margin-bottom: 15px;
    }
    
    .category-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .category-badge {
        background: #3498db;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 600;
    }
    
    .category-stats {
        display: flex;
        gap: 10px;
        align-items: center;
    }
    
    .category-count {
        color: #6c757d;
        font-size: 0.9em;
    }
    
    .category-percent {
        background: #e3f2fd;
        color: #3498db;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.8em;
        font-weight: 600;
    }
    
    .category-total {
        color: #2c3e50;
        font-weight: 600;
    }
    
    .progress-bar {
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3498db, #2ecc71);
        border-radius: 4px;
        transition: width 1s ease;
    }
    
    /* Expenses Table */
    .expenses-table-container {
        margin-top: 30px;
    }
    
    .expenses-table-container h4 {
        color: #2c3e50;
        margin-bottom: 15px;
        font-size: 1.2em;
    }
    
    .expenses-table {
        overflow-x: auto;
        border-radius: 10px;
        border: 1px solid #e9ecef;
    }
    
    .expenses-table table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px;
    }
    
    .expenses-table th {
        background: #f8f9fa;
        padding: 15px;
        text-align: left;
        font-weight: 600;
        color: #495057;
        border-bottom: 2px solid #e9ecef;
    }
    
    .expenses-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #e9ecef;
    }
    
    .expenses-table tr:hover td {
        background: #f8f9fa;
    }
    
    .category-tag {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 600;
        display: inline-block;
    }
    
    .baytul-mol {
        background: #e3f2fd;
        color: #3498db;
    }
    
    .oila-uchun {
        background: #d4edda;
        color: #155724;
    }
    
    .talim-uchun {
        background: #fff3cd;
        color: #856404;
    }
    
    .biznes-rivoji-uchun {
        background: #f8d7da;
        color: #721c24;
    }
    
    .expense-date {
        color: #6c757d;
        font-size: 0.9em;
    }
    
    .expense-description {
        color: #495057;
    }
    
    .expense-amount {
        font-weight: 600;
        color: #e74c3c;
    }
    
    /* Filtered Stats */
    .filtered-stats {
        margin: 25px 0;
    }
    
    .stats-container {
        background: white;
        padding: 25px;
        border-radius: 15px;
        border: 2px solid #e9ecef;
    }
    
    .stats-container h3 {
        color: #2c3e50;
        margin-bottom: 20px;
        font-size: 1.3em;
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .stat-card {
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        border: 1px solid #e9ecef;
        display: flex;
        align-items: center;
        gap: 15px;
        transition: all 0.3s ease;
    }
    
    .stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 20px rgba(0,0,0,0.12);
    }
    
    .stat-icon {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5em;
        color: white;
    }
    
    .total-expenses .stat-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .expense-count .stat-icon {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    .avg-expense .stat-icon {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    .top-category .stat-icon {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    
    .stat-content {
        flex: 1;
    }
    
    .stat-value {
        font-size: 1.3em;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 5px;
    }
    
    .stat-label {
        font-size: 0.9em;
        color: #6c757d;
    }
    
    /* Monthly Chart */
    .monthly-chart {
        margin-top: 30px;
    }
    
    .monthly-chart h4 {
        color: #2c3e50;
        margin-bottom: 15px;
        font-size: 1.2em;
    }
    
    .monthly-chart canvas {
        width: 100% !important;
        height: 300px !important;
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
        .filter-controls {
            grid-template-columns: 1fr;
        }
        
        .filter-buttons {
            flex-direction: column;
        }
        
        .results-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
        }
        
        .stats-grid {
            grid-template-columns: 1fr;
        }
        
        .expenses-table {
            font-size: 0.9em;
        }
    }
`;

// CSS larni document ga qo'shish
document.head.appendChild(mainStyle);
document.head.appendChild(filterStyle);

// Test ma'lumotlar yaratish tugmasi (faqat kerak bo'lsa)
document.addEventListener('DOMContentLoaded', function() {
    // Dashboard sahifasiga test tugmasini qo'shish
    setTimeout(() => {
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            const testButton = document.createElement('button');
            testButton.innerHTML = '<i class="fas fa-flask"></i> Test Ma\'lumot Yaratish';
            testButton.style.cssText = `
                background: #9b59b6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                margin: 10px;
                font-size: 14px;
            `;
            testButton.onclick = createTestData;
            dashboard.insertBefore(testButton, dashboard.firstChild);
        }
    }, 1000);
});

console.log('✅ Budjet App yuklandi - Oylik Filtrlash tizimi qo\'shildi!');