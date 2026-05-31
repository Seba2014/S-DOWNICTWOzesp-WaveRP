// ============================================================
// STATE PANEL ERP — SCRIPT.JS
// Complete business logic for Roleplay ERP system
// ============================================================

// === 1. BAZA DANYCH (localStorage) ===
const DB_KEY = 'state_panel_db';

const defaultDB = {
    users: [
        {
            ssn: '000000001',
            login: 'admin',
            pass: 'admin123',
            email: 'admin@statemail.sa',
            name: 'System',
            surname: 'Administrator',
            dob: '1985-01-01',
            gender: 'Mężczyzna',
            nat: 'Amerykanin',
            height: 180,
            bank: 50000,
            crypto: { BTC: 0, ETH: 0, LTC: 0, DOGE: 0 },
            jobs: ['Obywatel', 'ADMIN'],
            licenses: { driveB: true, driveC: true, weapon: true },
            penaltyPoints: 0
        }
    ],
    records: [],
    mails: [
        {
            id: 1,
            to: '000000001',
            from: 'SYSTEM',
            subject: 'Witamy w State Panel ERP',
            body: 'Witaj Administratorze!\n\nTwoje konto zostało utworzone z pełnymi uprawnieniami.\nMożesz zarządzać użytkownikami, rolami i całym systemem z poziomu ZPA.\n\nPozdrawiamy,\nState Panel ERP',
            date: new Date().toISOString(),
            read: false
        }
    ],
    applications: [],
    wanted: [],
    nextMailId: 2,
    nextRecordId: 1,
    nextAppId: 1
};

function loadDB() {
    const stored = localStorage.getItem(DB_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return JSON.parse(JSON.stringify(defaultDB));
        }
    }
    return JSON.parse(JSON.stringify(defaultDB));
}

function saveDB(database) {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
}

let db = loadDB();
let currentUser = null;
let cryptoPrices = { BTC: 42150, ETH: 2280, LTC: 72, DOGE: 0.082 };
let cryptoHistory = { BTC: [], ETH: [], LTC: [], DOGE: [] };
let cryptoChart = null;
let cryptoInterval = null;
let jobCooldown = false;
let selectedAppId = null;
let adminEditSSN = null;

// === 2. SYSTEM POWIADOMIEŃ (Toast) ===
function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;

    let icon = '';
    if (type === 'success') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    else if (type === 'error') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    else if (type === 'warning') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    else icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    toast.innerHTML = icon + '<span>' + msg + '</span>';
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// === 3. UTILSY ===
function generateSSN() {
    let ssn;
    do {
        ssn = String(Math.floor(100000000 + Math.random() * 900000000));
    } while (db.users.some(u => u.ssn === ssn));
    return ssn;
}

function findUserBySSN(ssn) {
    return db.users.find(u => u.ssn === ssn);
}

function findUserByLogin(login) {
    return db.users.find(u => u.login === login);
}

function calculateAge(dob) {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}.${mm}.${yy}`;
}

function hasRole(user, role) {
    return user.jobs.includes(role);
}

function hasAnyRole(user, roles) {
    return roles.some(r => user.jobs.includes(r));
}

function sendSystemMail(toSSN, subject, body) {
    db.mails.push({
        id: db.nextMailId++,
        to: toSSN,
        from: 'SYSTEM',
        subject: subject,
        body: body,
        date: new Date().toISOString(),
        read: false
    });
    saveDB(db);
}

function getHCFactions(user) {
    const hcRoles = ['LSPD_HC', 'EMS_HC', 'LSC_HC', 'DOJ_HC'];
    const factions = [];
    hcRoles.forEach(r => {
        if (user.jobs.includes(r)) {
            factions.push(r.replace('_HC', ''));
        }
    });
    return factions;
}

// === 4. MODUŁ AUTH (Logowanie & Rejestracja) ===
function handleLogin() {
    const login = document.getElementById('auth-login').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorEl = document.getElementById('auth-error');

    if (!login || !pass) {
        errorEl.textContent = 'Wypełnij oba pola!';
        errorEl.classList.remove('shake');
        void errorEl.offsetWidth;
        errorEl.classList.add('shake');
        return;
    }

    const user = db.users.find(u => u.login === login && u.pass === pass);
    if (!user) {
        errorEl.textContent = 'Nieprawidłowy login lub hasło!';
        errorEl.classList.remove('shake');
        void errorEl.offsetWidth;
        errorEl.classList.add('shake');
        return;
    }

    currentUser = user;
    errorEl.textContent = '';

    const overlay = document.getElementById('auth-overlay');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        initApp();
    }, 600);

    showToast(`Zalogowano jako ${user.name} ${user.surname}`, 'success');
}

function handleLogout() {
    currentUser = null;
    if (cryptoInterval) clearInterval(cryptoInterval);

    document.getElementById('app').style.display = 'none';
    const overlay = document.getElementById('auth-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    document.getElementById('auth-login').value = '';
    document.getElementById('auth-pass').value = '';

    showToast('Wylogowano z systemu', 'info');
}

function showRegisterModal() {
    document.getElementById('modal-register').style.display = 'flex';
}

function verifyOOCPin() {
    const pin = document.getElementById('reg-pin').value.trim();
    if (pin === '1234') {
        document.getElementById('reg-form').style.display = 'block';
        showToast('PIN poprawny. Wypełnij formularz.', 'success');
    } else {
        showToast('Nieprawidłowy PIN OOC!', 'error');
    }
}

function handleCreateCharacter() {
    const login = document.getElementById('reg-login').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const surname = document.getElementById('reg-surname').value.trim();
    const dob = document.getElementById('reg-dob').value;
    const gender = document.getElementById('reg-gender').value;
    const nat = document.getElementById('reg-nat').value.trim();
    const height = parseInt(document.getElementById('reg-height').value) || 170;

    if (!login || !pass || !email || !name || !surname || !dob || !gender || !nat) {
        showToast('Wypełnij wszystkie pola formularza!', 'error');
        return;
    }

    if (db.users.some(u => u.login === login)) {
        showToast('Login jest już zajęty!', 'error');
        return;
    }

    const ssn = generateSSN();
    const newUser = {
        ssn: ssn,
        login: login,
        pass: pass,
        email: email,
        name: name,
        surname: surname,
        dob: dob,
        gender: gender,
        nat: nat,
        height: height,
        bank: 1000,
        crypto: { BTC: 0, ETH: 0, LTC: 0, DOGE: 0 },
        jobs: ['Obywatel'],
        licenses: { driveB: false, driveC: false, weapon: false },
        penaltyPoints: 0
    };

    db.users.push(newUser);
    sendSystemMail(ssn, 'Witamy w San Andreas!', `Witaj ${name} ${surname}!\n\nTwój SSN: ${ssn}\nTwoje konto zostało utworzone.\nDomyślne saldo: $1,000\n\nZaloguj się używając swojego loginu i hasła.\n\nPozdrawiamy,\nState Panel ERP`);
    saveDB(db);

    showToast(`Postać utworzona! SSN: ${ssn}`, 'success');
    closeModal('modal-register');

    document.getElementById('reg-pin').value = '';
    document.getElementById('reg-form').style.display = 'none';
    document.querySelectorAll('#reg-form input, #reg-form select').forEach(el => el.value = '');
}

// === 5. INICJALIZACJA APLIKACJI ===
function initApp() {
    updateSidebar();
    renderIDCard(currentUser);
    updateMailBadge();
    startClock();
    initCrypto();
    switchView('view-id');
}

function updateSidebar() {
    document.getElementById('sidebar-user').textContent = currentUser.name + ' ' + currentUser.surname;
    document.getElementById('sidebar-ssn').textContent = 'SSN: ' + currentUser.ssn;

    const menuItems = document.querySelectorAll('.sidebar-menu .role-required');
    menuItems.forEach(item => {
        const requiredRoles = item.getAttribute('data-roles').split(',');
        if (hasAnyRole(currentUser, requiredRoles)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.classList.toggle('active', li.getAttribute('data-view') === viewId);
    });

    const titles = {
        'view-id': 'Dowód Osobisty',
        'view-economy': 'Ekonomia & Krypto',
        'view-mail': 'StateMail',
        'view-recruitment': 'Rekrutacja',
        'view-registry': 'Rejestr Centralny',
        'view-mdt': 'LSPD MDT',
        'view-invoices': 'Księgowość',
        'view-hc': 'Zarządzanie HC',
        'view-doj': 'Nadzór DOJ',
        'view-admin': 'ZPA (Admin Panel)'
    };
    document.getElementById('view-title').textContent = titles[viewId] || '';

    if (viewId === 'view-id') renderIDCard(currentUser);
    if (viewId === 'view-economy') renderEconomy();
    if (viewId === 'view-mail') renderMail();
    if (viewId === 'view-recruitment') renderRecruitment();
    if (viewId === 'view-registry') renderRegistry();
    if (viewId === 'view-mdt') renderMDT();
    if (viewId === 'view-invoices') renderInvoices();
    if (viewId === 'view-hc') renderHC();
    if (viewId === 'view-doj') renderDOJ();
    if (viewId === 'view-admin') { /* admin search is manual */ }

    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
}

// === 6. ZEGAR SYSTEMOWY ===
function startClock() {
    const update = () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = now.getFullYear();
        const el = document.getElementById('system-clock');
        if (el) el.textContent = `${h}:${m} | ${dd}.${mm}.${yy}`;
    };
    update();
    setInterval(update, 1000);
}

// === 7. RENDEROWANIE DOWODU OSOBISTEGO (MODULE 1) ===
function renderIDCard(user) {
    if (!user) return;
    db = loadDB();
    const fresh = findUserBySSN(user.ssn);
    if (fresh) {
        currentUser = fresh;
    }
    const u = currentUser;

    document.getElementById('id-name').textContent = u.name;
    document.getElementById('id-surname').textContent = u.surname;
    document.getElementById('id-ssn').textContent = u.ssn;
    document.getElementById('id-age').textContent = calculateAge(u.dob) + ' lat';
    document.getElementById('id-gender').textContent = u.gender;
    document.getElementById('id-nat').textContent = u.nat;
    document.getElementById('id-height').textContent = u.height + ' cm';

    renderLicenseStatus('lic-driveB', u.licenses.driveB);
    renderLicenseStatus('lic-driveC', u.licenses.driveC);
    renderLicenseStatus('lic-weapon', u.licenses.weapon);

    const penaltyEl = document.getElementById('lic-penalty');
    penaltyEl.textContent = u.penaltyPoints + ' / 24';
    penaltyEl.className = 'lic-status';
    if (u.penaltyPoints >= 24) {
        penaltyEl.classList.add('lic-no');
    }
}

function renderLicenseStatus(elementId, hasLicense) {
    const el = document.getElementById(elementId);
    if (hasLicense) {
        el.textContent = 'Posiada';
        el.className = 'lic-status lic-yes';
    } else {
        el.textContent = 'Brak';
        el.className = 'lic-status lic-no';
    }
}

// === 8. EKONOMIA (MODULE 2) ===
function renderEconomy() {
    db = loadDB();
    const u = findUserBySSN(currentUser.ssn);
    if (u) currentUser = u;
    document.getElementById('bank-balance').textContent = '$' + currentUser.bank.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    updateCryptoDisplay();
}

function handleQuickJob() {
    if (jobCooldown) {
        showToast('Musisz poczekać na cooldown!', 'warning');
        return;
    }
    const earnings = Math.floor(Math.random() * 300) + 100;
    db = loadDB();
    const u = findUserBySSN(currentUser.ssn);
    u.bank += earnings;
    currentUser = u;
    saveDB(db);
    document.getElementById('bank-balance').textContent = '$' + u.bank.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    showToast(`Zarobiłeś $${earnings} za pracę dorywczą!`, 'success');

    jobCooldown = true;
    let seconds = 30;
    document.getElementById('job-cooldown').style.display = 'inline';
    document.getElementById('job-timer').textContent = seconds;
    const timer = setInterval(() => {
        seconds--;
        document.getElementById('job-timer').textContent = seconds;
        if (seconds <= 0) {
            clearInterval(timer);
            jobCooldown = false;
            document.getElementById('job-cooldown').style.display = 'none';
        }
    }, 1000);
}

function handleTransfer() {
    const targetSSN = document.getElementById('transfer-ssn').value.trim();
    const amount = parseInt(document.getElementById('transfer-amount').value);

    if (!targetSSN || targetSSN.length !== 9) {
        showToast('Wpisz prawidłowy 9-cyfrowy SSN!', 'error');
        return;
    }
    if (!amount || amount <= 0) {
        showToast('Wpisz prawidłową kwotę!', 'error');
        return;
    }

    db = loadDB();
    const sender = findUserBySSN(currentUser.ssn);
    const receiver = findUserBySSN(targetSSN);

    if (!receiver) {
        showToast('Nie znaleziono użytkownika o tym SSN!', 'error');
        return;
    }
    if (sender.ssn === receiver.ssn) {
        showToast('Nie możesz przelać pieniędzy samemu sobie!', 'error');
        return;
    }
    if (sender.bank < amount) {
        showToast('Brak wystarczających środków!', 'error');
        return;
    }

    sender.bank -= amount;
    receiver.bank += amount;
    currentUser = sender;
    saveDB(db);

    sendSystemMail(targetSSN, 'Otrzymano przelew', `Otrzymano przelew w wysokości $${amount} od ${sender.name} ${sender.surname} (SSN: ${sender.ssn}).`);

    document.getElementById('bank-balance').textContent = '$' + sender.bank.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('transfer-ssn').value = '';
    document.getElementById('transfer-amount').value = '';
    showToast(`Przelano $${amount} do ${receiver.name} ${receiver.surname}`, 'success');
}

// === 9. TERMINAL KRYPTO ===
function initCrypto() {
    for (const coin in cryptoPrices) {
        cryptoHistory[coin] = [];
        for (let i = 0; i < 10; i++) {
            cryptoHistory[coin].push(cryptoPrices[coin] * (0.95 + Math.random() * 0.1));
        }
    }
    updateCryptoDisplay();
    createCryptoChart();

    if (cryptoInterval) clearInterval(cryptoInterval);
    cryptoInterval = setInterval(() => {
        updateCryptoPrices();
    }, 60000);
}

function updateCryptoPrices() {
    for (const coin in cryptoPrices) {
        const trend = (Math.random() - 0.48) * 0.06;
        cryptoPrices[coin] = Math.max(0.001, cryptoPrices[coin] * (1 + trend));
        cryptoHistory[coin].push(cryptoPrices[coin]);
        if (cryptoHistory[coin].length > 20) cryptoHistory[coin].shift();
    }
    updateCryptoDisplay();
    updateCryptoChart();
}

function updateCryptoDisplay() {
    for (const coin in cryptoPrices) {
        const priceEl = document.getElementById('price-' + coin);
        if (priceEl) priceEl.textContent = '$' + cryptoPrices[coin].toFixed(coin === 'DOGE' ? 4 : 2);
        const ownedEl = document.getElementById('owned-' + coin);
        if (ownedEl && currentUser) {
            db = loadDB();
            const u = findUserBySSN(currentUser.ssn);
            if (u) ownedEl.textContent = 'Posiadasz: ' + (u.crypto[coin] || 0).toFixed(coin === 'DOGE' ? 1 : 4);
        }
    }
}

function createCryptoChart() {
    const ctx = document.getElementById('crypto-chart');
    if (!ctx) return;
    if (cryptoChart) cryptoChart.destroy();

    const labels = Array.from({ length: 10 }, (_, i) => `${i + 1}`);
    cryptoChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'BTC', data: cryptoHistory.BTC.slice(), borderColor: '#f7931a', backgroundColor: 'rgba(247,147,26,0.1)', tension: 0.3, fill: true, pointRadius: 2 },
                { label: 'ETH', data: cryptoHistory.ETH.slice(), borderColor: '#627eea', backgroundColor: 'rgba(98,126,234,0.1)', tension: 0.3, fill: true, pointRadius: 2 },
                { label: 'LTC', data: cryptoHistory.LTC.slice(), borderColor: '#bfbbbb', backgroundColor: 'rgba(191,187,187,0.1)', tension: 0.3, fill: true, pointRadius: 2 },
                { label: 'DOGE', data: cryptoHistory.DOGE.slice(), borderColor: '#c2a633', backgroundColor: 'rgba(194,166,51,0.1)', tension: 0.3, fill: true, pointRadius: 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
            },
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function updateCryptoChart() {
    if (!cryptoChart) return;
    const maxLen = Math.max(...Object.values(cryptoHistory).map(h => h.length));
    cryptoChart.data.labels = Array.from({ length: maxLen }, (_, i) => `${i + 1}`);
    cryptoChart.data.datasets[0].data = cryptoHistory.BTC.slice();
    cryptoChart.data.datasets[1].data = cryptoHistory.ETH.slice();
    cryptoChart.data.datasets[2].data = cryptoHistory.LTC.slice();
    cryptoChart.data.datasets[3].data = cryptoHistory.DOGE.slice();
    cryptoChart.update();
}

function handleBuyCrypto(coin) {
    const qty = parseFloat(document.getElementById('qty-' + coin).value);
    if (!qty || qty <= 0) {
        showToast('Wpisz prawidłową ilość!', 'error');
        return;
    }
    const cost = qty * cryptoPrices[coin];
    db = loadDB();
    const u = findUserBySSN(currentUser.ssn);
    if (u.bank < cost) {
        showToast('Brak wystarczających środków!', 'error');
        return;
    }
    u.bank -= cost;
    u.crypto[coin] = (u.crypto[coin] || 0) + qty;
    currentUser = u;
    saveDB(db);
    renderEconomy();
    document.getElementById('qty-' + coin).value = '';
    showToast(`Kupiono ${qty} ${coin} za $${cost.toFixed(2)}`, 'success');
}

function handleSellCrypto(coin) {
    const qty = parseFloat(document.getElementById('qty-' + coin).value);
    if (!qty || qty <= 0) {
        showToast('Wpisz prawidłową ilość!', 'error');
        return;
    }
    db = loadDB();
    const u = findUserBySSN(currentUser.ssn);
    if ((u.crypto[coin] || 0) < qty) {
        showToast('Nie masz tyle ' + coin + '!', 'error');
        return;
    }
    const revenue = qty * cryptoPrices[coin];
    u.bank += revenue;
    u.crypto[coin] -= qty;
    currentUser = u;
    saveDB(db);
    renderEconomy();
    document.getElementById('qty-' + coin).value = '';
    showToast(`Sprzedano ${qty} ${coin} za $${revenue.toFixed(2)}`, 'success');
}

// === 10. STATEMAIL (MODULE 3) ===
function renderMail() {
    db = loadDB();
    const myMails = db.mails.filter(m => m.to === currentUser.ssn).sort((a, b) => new Date(b.date) - new Date(a.date));
    const listEl = document.getElementById('mail-list');
    const countEl = document.getElementById('mail-count');

    countEl.textContent = myMails.length + ' wiadomości';

    if (myMails.length === 0) {
        listEl.innerHTML = '<p class="empty-state">Brak wiadomości</p>';
        return;
    }

    listEl.innerHTML = myMails.map(m => `
        <div class="mail-item ${m.read ? '' : 'unread'}" data-mail-id="${m.id}">
            <span class="mail-dot ${m.read ? 'read' : ''}"></span>
            <span class="mail-subject">${m.subject}</span>
            <span class="mail-from">${m.from}</span>
            <span class="mail-date">${formatDate(m.date)}</span>
        </div>
    `).join('');

    listEl.querySelectorAll('.mail-item').forEach(item => {
        item.addEventListener('click', () => {
            const mailId = parseInt(item.getAttribute('data-mail-id'));
            openMail(mailId);
        });
    });
}

function openMail(mailId) {
    db = loadDB();
    const mail = db.mails.find(m => m.id === mailId);
    if (!mail) return;

    mail.read = true;
    saveDB(db);
    updateMailBadge();

    document.getElementById('mail-modal-subject').textContent = mail.subject;
    document.getElementById('mail-modal-from').textContent = mail.from;
    document.getElementById('mail-modal-date').textContent = formatDate(mail.date);
    document.getElementById('mail-modal-body').textContent = mail.body;
    document.getElementById('modal-mail').style.display = 'flex';
}

function updateMailBadge() {
    if (!currentUser) return;
    db = loadDB();
    const unread = db.mails.filter(m => m.to === currentUser.ssn && !m.read).length;
    const badge = document.getElementById('mail-badge');
    if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// === 11. REKRUTACJA (MODULE 4) ===
const IC_QUESTIONS = {
    LSPD: [
        'Dlaczego chcesz dołączyć do Los Santos Police Department?',
        'Opisz sytuację, w której musiałeś podjąć szybką decyzję pod presją.',
        'Jak zachowasz się podczas kontroli drogowej, gdy kierowca odmówi współpracy?',
        'Jakie są Twoje priorytety podczas interwencji z udziałem broni palnej?'
    ],
    EMS: [
        'Dlaczego chcesz zostać ratownikiem medycznym?',
        'Opisz procedurę udzielania pierwszej pomocy osobie nieprzytomnej.',
        'Jak zachowasz się na miejscu wypadku z wieloma poszkodowanymi?',
        'Czy potrafisz pracować w warunkach silnego stresu? Podaj przykład.'
    ],
    LSC: [
        'Dlaczego chcesz dołączyć do Los Santos Customs?',
        'Jakie masz doświadczenie z naprawami i modyfikacjami pojazdów?',
        'Jak wycenisz naprawę pojazdu po poważnym wypadku?',
        'Opisz proces tuningu samochodu od A do Z.'
    ],
    DOJ: [
        'Dlaczego interesujesz się pracą w Departamencie Sprawiedliwości?',
        'Jak rozumiesz pojęcie „sprawiedliwość" w kontekście prawa stanowego?',
        'Jak postąpisz gdy wykryjesz korupcję wśród funkcjonariuszy?',
        'Opisz proces prowadzenia śledztwa od zawiadomienia do aktu oskarżenia.'
    ],
    FIRMA: [
        'Jaką firmę chcesz prowadzić i jaki jest jej profil działalności?',
        'Opisz swój plan biznesowy na pierwsze 30 dni działalności.',
        'Jak zamierzasz pozyskiwać klientów w Los Santos?',
        'Jakie usługi lub produkty będzie oferowała Twoja firma?'
    ]
};

function renderRecruitment() {
    db = loadDB();
    const hcPanel = document.getElementById('hc-applications-panel');

    if (hasAnyRole(currentUser, ['LSPD_HC', 'EMS_HC', 'LSC_HC', 'DOJ_HC', 'ADMIN'])) {
        hcPanel.style.display = 'block';
        renderHCApplications();
    } else {
        hcPanel.style.display = 'none';
    }
}

function onFactionChange() {
    const faction = document.getElementById('app-faction').value;
    const section = document.getElementById('ic-questions-section');
    const container = document.getElementById('ic-questions-container');

    if (!faction || !IC_QUESTIONS[faction]) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = IC_QUESTIONS[faction].map((q, i) => `
        <div class="input-group">
            <label>${i + 1}. ${q}</label>
            <textarea class="ic-answer" rows="3" placeholder="Twoja odpowiedź..."></textarea>
        </div>
    `).join('');
}

function handleSendApplication() {
    const discord = document.getElementById('app-discord').value.trim();
    const mic = document.getElementById('app-mic').value;
    const faction = document.getElementById('app-faction').value;

    if (!discord || !mic || !faction) {
        showToast('Wypełnij wszystkie pola OOC i wybierz frakcję!', 'error');
        return;
    }

    const answers = [];
    document.querySelectorAll('.ic-answer').forEach(ta => {
        answers.push(ta.value.trim());
    });

    if (answers.some(a => !a)) {
        showToast('Odpowiedz na wszystkie pytania IC!', 'error');
        return;
    }

    db = loadDB();
    const app = {
        id: db.nextAppId++,
        ssn: currentUser.ssn,
        name: currentUser.name + ' ' + currentUser.surname,
        faction: faction,
        discord: discord,
        mic: mic,
        answers: answers,
        questions: IC_QUESTIONS[faction],
        status: 'pending',
        date: new Date().toISOString(),
        reason: ''
    };
    db.applications.push(app);
    saveDB(db);

    showToast('Podanie zostało wysłane!', 'success');
    document.getElementById('app-discord').value = '';
    document.getElementById('app-mic').value = '';
    document.getElementById('app-faction').value = '';
    document.getElementById('ic-questions-section').style.display = 'none';
    document.getElementById('ic-questions-container').innerHTML = '';
}

function renderHCApplications() {
    db = loadDB();
    const hcFactions = hasRole(currentUser, 'ADMIN')
        ? ['LSPD', 'EMS', 'LSC', 'DOJ', 'FIRMA']
        : getHCFactions(currentUser);

    const apps = db.applications.filter(a => hcFactions.includes(a.faction) && a.status === 'pending');
    const listEl = document.getElementById('hc-applications-list');

    if (apps.length === 0) {
        listEl.innerHTML = '<p class="empty-state">Brak podań do rozpatrzenia</p>';
        return;
    }

    listEl.innerHTML = apps.map(a => `
        <div class="app-item" data-app-id="${a.id}">
            <div class="app-item-info">
                <strong>${a.name}</strong> — ${a.faction} (${formatDate(a.date)})
            </div>
            <span class="app-status pending">Oczekuje</span>
        </div>
    `).join('');

    listEl.querySelectorAll('.app-item').forEach(item => {
        item.addEventListener('click', () => {
            const appId = parseInt(item.getAttribute('data-app-id'));
            openApplicationDetail(appId);
        });
    });
}

function openApplicationDetail(appId) {
    db = loadDB();
    const app = db.applications.find(a => a.id === appId);
    if (!app) return;

    selectedAppId = appId;
    const body = document.getElementById('app-detail-body');

    let html = `<p><strong>Aplikant:</strong> ${app.name} (SSN: ${app.ssn})</p>`;
    html += `<p><strong>Frakcja:</strong> ${app.faction}</p>`;
    html += `<p><strong>Discord:</strong> ${app.discord}</p>`;
    html += `<p><strong>Mikrofon:</strong> ${app.mic}</p>`;
    html += '<hr class="divider"><h4>Odpowiedzi IC:</h4>';
    app.questions.forEach((q, i) => {
        html += `<div style="margin-bottom:12px;"><p class="text-muted" style="font-size:0.75rem;">${i + 1}. ${q}</p><p style="font-size:0.85rem;">${app.answers[i]}</p></div>`;
    });
    body.innerHTML = html;
    document.getElementById('app-reason').value = '';
    document.getElementById('modal-app-detail').style.display = 'flex';
}

function handleApplicationDecision(accept) {
    const reason = document.getElementById('app-reason').value.trim();
    if (!reason) {
        showToast('Musisz wpisać powód decyzji!', 'error');
        return;
    }

    db = loadDB();
    const app = db.applications.find(a => a.id === selectedAppId);
    if (!app) return;

    app.status = accept ? 'accepted' : 'rejected';
    app.reason = reason;

    if (accept) {
        const user = findUserBySSN(app.ssn);
        if (user && !user.jobs.includes(app.faction)) {
            user.jobs.push(app.faction);
        }
        sendSystemMail(app.ssn, `Podanie ZAAKCEPTOWANE — ${app.faction}`, `Gratulacje!\n\nTwoje podanie do ${app.faction} zostało zaakceptowane.\nPowód: ${reason}\n\nRola ${app.faction} została przyznana do Twojego konta.`);
        showToast(`Podanie zaakceptowane — rola ${app.faction} nadana`, 'success');
    } else {
        sendSystemMail(app.ssn, `Podanie ODRZUCONE — ${app.faction}`, `Niestety Twoje podanie do ${app.faction} zostało odrzucone.\nPowód: ${reason}\n\nMożesz złożyć podanie ponownie w przyszłości.`);
        showToast('Podanie odrzucone', 'warning');
    }

    saveDB(db);
    closeModal('modal-app-detail');
    renderHCApplications();
}

// === 12. REJESTR CENTRALNY (MODULE 5) ===
function renderRegistry() {
    db = loadDB();
    const myRecords = db.records.filter(r => r.targetSSN === currentUser.ssn);
    const container = document.getElementById('my-records-list');

    if (myRecords.length === 0) {
        container.innerHTML = '<p class="empty-state">Brak wpisów w kartotece</p>';
        return;
    }

    let html = '<table class="records-table"><thead><tr><th>Typ</th><th>Kwota</th><th>Powód</th><th>Data</th><th>Wystawca</th></tr></thead><tbody>';
    myRecords.forEach(r => {
        html += `<tr><td>${r.type}</td><td>$${r.amount}</td><td>${r.reason}</td><td>${formatDate(r.date)}</td><td>${r.issuedBy}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// === 13. LSPD MDT (MODULE 6) ===
function renderMDT() {
    renderWantedList();
}

function handleIssueFine() {
    const ssn = document.getElementById('fine-ssn').value.trim();
    const amount = parseInt(document.getElementById('fine-amount').value);
    const reason = document.getElementById('fine-reason').value.trim();

    if (!ssn || ssn.length !== 9) { showToast('Wpisz prawidłowy SSN!', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Wpisz prawidłową kwotę!', 'error'); return; }
    if (!reason) { showToast('Wpisz powód mandatu!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono obywatela!', 'error'); return; }

    target.bank -= amount;
    db.records.push({
        id: db.nextRecordId++,
        type: 'Mandat',
        targetSSN: ssn,
        targetName: target.name + ' ' + target.surname,
        amount: amount,
        reason: reason,
        issuedBy: currentUser.name + ' ' + currentUser.surname,
        issuedBySSN: currentUser.ssn,
        faction: 'LSPD',
        date: new Date().toISOString()
    });
    saveDB(db);

    sendSystemMail(ssn, 'Otrzymano mandat', `Otrzymałeś mandat na kwotę $${amount}.\nPowód: ${reason}\nWystawca: ${currentUser.name} ${currentUser.surname} (LSPD)`);

    document.getElementById('fine-ssn').value = '';
    document.getElementById('fine-amount').value = '';
    document.getElementById('fine-reason').value = '';
    showToast(`Mandat $${amount} wystawiony dla ${target.name} ${target.surname}`, 'success');
}

function handleIssueSentence() {
    const ssn = document.getElementById('sentence-ssn').value.trim();
    const amount = parseInt(document.getElementById('sentence-amount').value) || 0;
    const months = parseInt(document.getElementById('sentence-months').value) || 0;
    const reason = document.getElementById('sentence-reason').value.trim();

    if (!ssn || ssn.length !== 9) { showToast('Wpisz prawidłowy SSN!', 'error'); return; }
    if (!reason) { showToast('Wpisz powód wyroku!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono obywatela!', 'error'); return; }

    if (amount > 0) target.bank -= amount;

    db.records.push({
        id: db.nextRecordId++,
        type: 'Wyrok',
        targetSSN: ssn,
        targetName: target.name + ' ' + target.surname,
        amount: amount,
        months: months,
        reason: reason,
        issuedBy: currentUser.name + ' ' + currentUser.surname,
        issuedBySSN: currentUser.ssn,
        faction: 'LSPD',
        date: new Date().toISOString()
    });
    saveDB(db);

    sendSystemMail(ssn, 'Wydano wyrok', `Wydano wyrok:\nGrzywna: $${amount}\nOdsiadka: ${months} mies.\nPowód: ${reason}\nWystawca: ${currentUser.name} ${currentUser.surname}`);

    document.getElementById('sentence-ssn').value = '';
    document.getElementById('sentence-amount').value = '';
    document.getElementById('sentence-months').value = '';
    document.getElementById('sentence-reason').value = '';
    showToast(`Wyrok wydany dla ${target.name} ${target.surname}`, 'success');
}

function handleCheckLicense() {
    const ssn = document.getElementById('traffic-ssn').value.trim();
    if (!ssn || ssn.length !== 9) { showToast('Wpisz prawidłowy SSN!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono obywatela!', 'error'); return; }

    const resultEl = document.getElementById('traffic-result');
    resultEl.style.display = 'block';

    const suspended = target.penaltyPoints >= 24;
    let html = `<p><strong>${target.name} ${target.surname}</strong> (SSN: ${target.ssn})</p>`;
    html += `<p>Prawo Jazdy Kat. B: <span class="${target.licenses.driveB ? 'text-success' : 'text-danger'}">${target.licenses.driveB ? 'Posiada' : 'Brak'}</span></p>`;
    html += `<p>Prawo Jazdy Kat. C: <span class="${target.licenses.driveC ? 'text-success' : 'text-danger'}">${target.licenses.driveC ? 'Posiada' : 'Brak'}</span></p>`;
    html += `<p>Licencja na Broń: <span class="${target.licenses.weapon ? 'text-success' : 'text-danger'}">${target.licenses.weapon ? 'Posiada' : 'Brak'}</span></p>`;
    html += `<p>Punkty Karne: <span class="${suspended ? 'text-danger' : ''}">${target.penaltyPoints} / 24</span></p>`;
    if (suspended) html += '<p class="text-danger"><strong>PRAWO JAZDY ZAWIESZONE!</strong></p>';
    resultEl.innerHTML = html;
}

function handleAddPenalty() {
    const ssn = document.getElementById('traffic-ssn').value.trim();
    const points = parseInt(document.getElementById('penalty-points').value);

    if (!ssn || ssn.length !== 9) { showToast('Najpierw wpisz SSN!', 'error'); return; }
    if (!points || points <= 0) { showToast('Wpisz liczbę punktów!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono obywatela!', 'error'); return; }

    target.penaltyPoints += points;
    if (target.penaltyPoints >= 24) {
        target.licenses.driveB = false;
        sendSystemMail(ssn, 'KONFISKATA PRAWA JAZDY', `Twoje prawo jazdy Kat. B zostało skonfiskowane z powodu przekroczenia 24 punktów karnych (aktualne: ${target.penaltyPoints}).`);
        showToast(`UWAGA: ${target.name} ${target.surname} ma ${target.penaltyPoints} punktów — prawo jazdy SKONFISKOWANE!`, 'error');
    } else {
        showToast(`Dodano ${points} punktów karnych (${target.penaltyPoints}/24)`, 'warning');
    }

    saveDB(db);
    document.getElementById('penalty-points').value = '';
    handleCheckLicense();
}

function handleAddWanted() {
    const ssn = document.getElementById('wanted-ssn').value.trim();
    const name = document.getElementById('wanted-name').value.trim();
    const reason = document.getElementById('wanted-reason').value.trim();

    if (!ssn || !name || !reason) { showToast('Wypełnij wszystkie pola!', 'error'); return; }

    db = loadDB();
    db.wanted.push({ ssn, name, reason, date: new Date().toISOString(), addedBy: currentUser.name + ' ' + currentUser.surname });
    saveDB(db);

    document.getElementById('wanted-ssn').value = '';
    document.getElementById('wanted-name').value = '';
    document.getElementById('wanted-reason').value = '';
    renderWantedList();
    showToast(`${name} dodany do listy poszukiwanych`, 'warning');
}

function renderWantedList() {
    db = loadDB();
    const container = document.getElementById('wanted-list');
    if (!container) return;

    if (db.wanted.length === 0) {
        container.innerHTML = '<p class="empty-state">Lista pusta</p>';
        return;
    }

    container.innerHTML = db.wanted.map((w, i) => `
        <div class="wanted-item">
            <span><strong>${w.name}</strong> (SSN: ${w.ssn}) — ${w.reason}</span>
            <button class="wanted-remove" data-index="${i}">&times;</button>
        </div>
    `).join('');

    container.querySelectorAll('.wanted-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            db = loadDB();
            db.wanted.splice(idx, 1);
            saveDB(db);
            renderWantedList();
            showToast('Usunięto z listy poszukiwanych', 'info');
        });
    });
}

// === 14. KSIĘGOWOŚĆ — FAKTURY (MODULE 7) ===
function renderInvoices() {
    db = loadDB();
    const myInvoices = db.records.filter(r => r.type === 'Faktura' && r.issuedBySSN === currentUser.ssn);
    const container = document.getElementById('invoices-list');

    if (myInvoices.length === 0) {
        container.innerHTML = '<p class="empty-state">Brak wystawionych faktur</p>';
        return;
    }

    let html = '<table class="records-table"><thead><tr><th>Odbiorca</th><th>Kwota</th><th>Opis</th><th>Data</th></tr></thead><tbody>';
    myInvoices.forEach(r => {
        html += `<tr><td>${r.targetName}</td><td>$${r.amount}</td><td>${r.reason}</td><td>${formatDate(r.date)}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function handleIssueInvoice() {
    if (hasAnyRole(currentUser, ['LSPD', 'LSPD_HC']) && !hasAnyRole(currentUser, ['EMS', 'EMS_HC', 'LSC', 'LSC_HC', 'FIRMA', 'ADMIN'])) {
        showToast('LSPD nie może wystawiać faktur!', 'error');
        return;
    }

    const ssn = document.getElementById('inv-ssn').value.trim();
    const amount = parseInt(document.getElementById('inv-amount').value);
    const desc = document.getElementById('inv-desc').value.trim();

    if (!ssn || ssn.length !== 9) { showToast('Wpisz prawidłowy SSN!', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Wpisz prawidłową kwotę!', 'error'); return; }
    if (!desc) { showToast('Wpisz opis usługi!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono odbiorcy!', 'error'); return; }

    target.bank -= amount;
    const factionName = currentUser.jobs.find(j => ['EMS', 'EMS_HC', 'LSC', 'LSC_HC', 'FIRMA'].includes(j)) || 'Firma';

    db.records.push({
        id: db.nextRecordId++,
        type: 'Faktura',
        targetSSN: ssn,
        targetName: target.name + ' ' + target.surname,
        amount: amount,
        reason: desc,
        issuedBy: currentUser.name + ' ' + currentUser.surname,
        issuedBySSN: currentUser.ssn,
        faction: factionName,
        date: new Date().toISOString()
    });
    saveDB(db);

    sendSystemMail(ssn, `Faktura od ${factionName}`, `Otrzymano fakturę na kwotę $${amount}.\nOpis: ${desc}\nWystawca: ${currentUser.name} ${currentUser.surname}`);

    document.getElementById('inv-ssn').value = '';
    document.getElementById('inv-amount').value = '';
    document.getElementById('inv-desc').value = '';
    renderInvoices();
    showToast(`Faktura $${amount} wystawiona dla ${target.name} ${target.surname}`, 'success');
}

// === 15. ZARZĄDZANIE HC (MODULE 8) ===
function renderHC() {
    db = loadDB();
    const container = document.getElementById('hc-employees-list');
    const hcFactions = hasRole(currentUser, 'ADMIN')
        ? ['LSPD', 'EMS', 'LSC', 'DOJ', 'FIRMA']
        : getHCFactions(currentUser);

    const employees = db.users.filter(u =>
        u.ssn !== currentUser.ssn &&
        u.jobs.some(j => hcFactions.includes(j))
    );

    if (employees.length === 0) {
        container.innerHTML = '<p class="empty-state">Brak pracowników w Twojej frakcji</p>';
        return;
    }

    let html = '<table class="records-table"><thead><tr><th>Imię Nazwisko</th><th>SSN</th><th>Role</th></tr></thead><tbody>';
    employees.forEach(e => {
        const roles = e.jobs.filter(j => hcFactions.includes(j) || hcFactions.some(f => j === f + '_HC')).join(', ');
        html += `<tr><td>${e.name} ${e.surname}</td><td>${e.ssn}</td><td>${roles}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function handleFireEmployee() {
    const ssn = document.getElementById('hc-fire-ssn').value.trim();
    if (!ssn || ssn.length !== 9) { showToast('Wpisz prawidłowy SSN!', 'error'); return; }

    db = loadDB();
    const target = findUserBySSN(ssn);
    if (!target) { showToast('Nie znaleziono pracownika!', 'error'); return; }

    const hcFactions = hasRole(currentUser, 'ADMIN')
        ? ['LSPD', 'EMS', 'LSC', 'DOJ', 'FIRMA', 'LSPD_HC', 'EMS_HC', 'LSC_HC', 'DOJ_HC']
        : getHCFactions(currentUser);

    const removable = target.jobs.filter(j => hcFactions.includes(j) || hcFactions.some(f => j === f + '_HC'));
    if (removable.length === 0) {
        showToast('Ten pracownik nie należy do Twojej frakcji!', 'error');
        return;
    }

    target.jobs = target.jobs.filter(j => !removable.includes(j));
    if (!target.jobs.includes('Obywatel')) target.jobs.push('Obywatel');
    saveDB(db);

    sendSystemMail(ssn, 'Zwolnienie z pracy', `Zostałeś zwolniony z ról: ${removable.join(', ')}.\nDecyzja podjęta przez: ${currentUser.name} ${currentUser.surname}`);

    document.getElementById('hc-fire-ssn').value = '';
    renderHC();
    showToast(`Zwolniono ${target.name} ${target.surname} z: ${removable.join(', ')}`, 'warning');
}

// === 16. NADZÓR DOJ (MODULE 8 part 2) ===
function renderDOJ() {
    db = loadDB();

    const sentencesContainer = document.getElementById('doj-sentences-list');
    const sentences = db.records.filter(r => r.type === 'Wyrok');

    if (sentences.length === 0) {
        sentencesContainer.innerHTML = '<p class="empty-state">Brak wyroków w systemie</p>';
    } else {
        let html = '<table class="records-table"><thead><tr><th>Oskarżony</th><th>Grzywna</th><th>Odsiadka</th><th>Powód</th><th>Wystawca</th><th>Data</th></tr></thead><tbody>';
        sentences.forEach(r => {
            html += `<tr><td>${r.targetName}</td><td>$${r.amount}</td><td>${r.months || 0} mies.</td><td>${r.reason}</td><td>${r.issuedBy}</td><td>${formatDate(r.date)}</td></tr>`;
        });
        html += '</tbody></table>';
        sentencesContainer.innerHTML = html;
    }

    const invoicesContainer = document.getElementById('doj-invoices-list');
    const invoices = db.records.filter(r => r.type === 'Faktura');

    if (invoices.length === 0) {
        invoicesContainer.innerHTML = '<p class="empty-state">Brak faktur w systemie</p>';
    } else {
        let html = '<table class="records-table"><thead><tr><th>Odbiorca</th><th>Kwota</th><th>Opis</th><th>Frakcja</th><th>Wystawca</th><th>Data</th></tr></thead><tbody>';
        invoices.forEach(r => {
            html += `<tr><td>${r.targetName}</td><td>$${r.amount}</td><td>${r.reason}</td><td>${r.faction}</td><td>${r.issuedBy}</td><td>${formatDate(r.date)}</td></tr>`;
        });
        html += '</tbody></table>';
        invoicesContainer.innerHTML = html;
    }
}

// === 17. ZPA — PANEL ADMINISTRACYJNY (MODULE 9) ===
function handleAdminSearch() {
    const login = document.getElementById('admin-search').value.trim();
    if (!login) { showToast('Wpisz login gracza!', 'error'); return; }

    db = loadDB();
    const user = findUserByLogin(login);
    if (!user) {
        showToast('Nie znaleziono gracza o tym loginie!', 'error');
        document.getElementById('admin-edit-panel').style.display = 'none';
        return;
    }

    adminEditSSN = user.ssn;
    document.getElementById('admin-edit-panel').style.display = 'block';
    document.getElementById('admin-edit-name').textContent = user.name + ' ' + user.surname + ' (SSN: ' + user.ssn + ')';
    document.getElementById('admin-edit-login').value = user.login;
    document.getElementById('admin-edit-pass').value = '';
    document.getElementById('admin-edit-bank').value = user.bank;

    const allRoles = ['LSPD', 'LSPD_HC', 'EMS', 'EMS_HC', 'LSC', 'LSC_HC', 'DOJ', 'DOJ_HC', 'FIRMA', 'ADMIN'];
    allRoles.forEach(role => {
        const cb = document.querySelector(`#admin-roles-grid input[data-role="${role}"]`);
        if (cb) cb.checked = user.jobs.includes(role);
    });

    document.getElementById('admin-lic-driveB').checked = user.licenses.driveB;
    document.getElementById('admin-lic-driveC').checked = user.licenses.driveC;
    document.getElementById('admin-lic-weapon').checked = user.licenses.weapon;

    showToast(`Załadowano dane: ${user.name} ${user.surname}`, 'info');
}

function handleAdminSave() {
    if (!adminEditSSN) return;

    db = loadDB();
    const user = findUserBySSN(adminEditSSN);
    if (!user) { showToast('Użytkownik nie istnieje!', 'error'); return; }

    const newLogin = document.getElementById('admin-edit-login').value.trim();
    const newPass = document.getElementById('admin-edit-pass').value.trim();
    const newBank = parseFloat(document.getElementById('admin-edit-bank').value);

    if (newLogin && newLogin !== user.login) {
        if (db.users.some(u => u.login === newLogin && u.ssn !== user.ssn)) {
            showToast('Ten login jest już zajęty!', 'error');
            return;
        }
        user.login = newLogin;
    }
    if (newPass) user.pass = newPass;
    if (!isNaN(newBank)) user.bank = newBank;

    const roles = ['Obywatel'];
    const allRoles = ['LSPD', 'LSPD_HC', 'EMS', 'EMS_HC', 'LSC', 'LSC_HC', 'DOJ', 'DOJ_HC', 'FIRMA', 'ADMIN'];
    allRoles.forEach(role => {
        const cb = document.querySelector(`#admin-roles-grid input[data-role="${role}"]`);
        if (cb && cb.checked) roles.push(role);
    });
    user.jobs = roles;

    user.licenses.driveB = document.getElementById('admin-lic-driveB').checked;
    user.licenses.driveC = document.getElementById('admin-lic-driveC').checked;
    user.licenses.weapon = document.getElementById('admin-lic-weapon').checked;

    saveDB(db);
    if (currentUser.ssn === user.ssn) {
        currentUser = user;
        updateSidebar();
    }
    showToast('Zmiany zapisane pomyślnie!', 'success');
}

function handleAdminResetPenalty() {
    if (!adminEditSSN) return;
    db = loadDB();
    const user = findUserBySSN(adminEditSSN);
    if (!user) return;
    user.penaltyPoints = 0;
    saveDB(db);
    showToast('Punkty karne wyzerowane!', 'success');
}

function handleAdminClearRecords() {
    if (!adminEditSSN) return;
    if (!confirm('Czy na pewno chcesz wyczyścić kartotekę tego gracza? Operacja jest nieodwracalna!')) return;
    db = loadDB();
    db.records = db.records.filter(r => r.targetSSN !== adminEditSSN);
    saveDB(db);
    showToast('Kartoteka wyczyszczona!', 'warning');
}

function handleAdminWipe() {
    if (!adminEditSSN) return;
    if (!confirm('UWAGA! Czy na pewno chcesz USUNĄĆ tę postać ze storage? Tej operacji NIE MOŻNA cofnąć!')) return;
    if (!confirm('OSTATNIE OSTRZEŻENIE: Postać zostanie trwale usunięta. Kontynuować?')) return;

    db = loadDB();
    db.users = db.users.filter(u => u.ssn !== adminEditSSN);
    db.records = db.records.filter(r => r.targetSSN !== adminEditSSN);
    db.mails = db.mails.filter(m => m.to !== adminEditSSN);
    db.applications = db.applications.filter(a => a.ssn !== adminEditSSN);
    db.wanted = db.wanted.filter(w => w.ssn !== adminEditSSN);
    saveDB(db);

    adminEditSSN = null;
    document.getElementById('admin-edit-panel').style.display = 'none';
    showToast('Postać została trwale usunięta!', 'error');
}

// === 18. MODAL HELPERS ===
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// === 19. EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
    // Auth
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('auth-pass').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('auth-login').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Password toggle
    document.getElementById('toggle-pass').addEventListener('click', () => {
        const input = document.getElementById('auth-pass');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Registration
    document.getElementById('btn-show-register').addEventListener('click', showRegisterModal);
    document.getElementById('btn-verify-pin').addEventListener('click', verifyOOCPin);
    document.getElementById('btn-create-char').addEventListener('click', handleCreateCharacter);

    // Logout
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.addEventListener('click', () => {
            const viewId = li.getAttribute('data-view');
            if (viewId) switchView(viewId);
        });
    });

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Economy
    document.getElementById('btn-quick-job').addEventListener('click', handleQuickJob);
    document.getElementById('btn-transfer').addEventListener('click', handleTransfer);

    // Crypto buy/sell
    document.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', () => handleBuyCrypto(btn.getAttribute('data-coin')));
    });
    document.querySelectorAll('.btn-sell').forEach(btn => {
        btn.addEventListener('click', () => handleSellCrypto(btn.getAttribute('data-coin')));
    });

    // Recruitment
    document.getElementById('app-faction').addEventListener('change', onFactionChange);
    document.getElementById('btn-send-app').addEventListener('click', handleSendApplication);

    // Application decisions
    document.getElementById('btn-accept-app').addEventListener('click', () => handleApplicationDecision(true));
    document.getElementById('btn-reject-app').addEventListener('click', () => handleApplicationDecision(false));

    // MDT
    document.getElementById('btn-issue-fine').addEventListener('click', handleIssueFine);
    document.getElementById('btn-issue-sentence').addEventListener('click', handleIssueSentence);
    document.getElementById('btn-check-license').addEventListener('click', handleCheckLicense);
    document.getElementById('btn-add-penalty').addEventListener('click', handleAddPenalty);
    document.getElementById('btn-add-wanted').addEventListener('click', handleAddWanted);

    // Invoices
    document.getElementById('btn-issue-invoice').addEventListener('click', handleIssueInvoice);

    // HC
    document.getElementById('btn-fire-employee').addEventListener('click', handleFireEmployee);

    // Admin (ZPA)
    document.getElementById('btn-admin-search').addEventListener('click', handleAdminSearch);
    document.getElementById('admin-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAdminSearch();
    });
    document.getElementById('btn-admin-save').addEventListener('click', handleAdminSave);
    document.getElementById('btn-admin-reset-penalty').addEventListener('click', handleAdminResetPenalty);
    document.getElementById('btn-admin-clear-records').addEventListener('click', handleAdminClearRecords);
    document.getElementById('btn-admin-wipe').addEventListener('click', handleAdminWipe);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            if (modalId) closeModal(modalId);
        });
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });
    });
});
