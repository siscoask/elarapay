// ============================================================
// STATE
// ============================================================
const S = {
  user: null, balance: 0, savings: 0, cashback: 0,
  totalTx: 0, monthSpend: 0, monthSave: 0,
  goals: [], transactions: [], notifications: [],
  streak: 0, balVis: true, theme: 'ivory-light',
  selectedBank: null, resolvedRecipient: null,
  pendingTransfer: null, pinCb: null, curPin: '',
  avatarTaps: 0, avatarTimer: null,
  installEvent: null, starRating: 0,
};

// ============================================================
// PERSIST
// ============================================================
function persist() { try { localStorage.setItem('ep_v3', JSON.stringify(S)); } catch(e) {} }
function hydrate() {
  try {
    const d = JSON.parse(localStorage.getItem('ep_v3') || 'null');
    if (d) Object.assign(S, d);
  } catch(e) {}
}

// ============================================================
// FORMAT HELPERS
// ============================================================
const fmt = (n) => new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtC = (n) => { if(n >= 1e6) return (n/1e6).toFixed(1)+'M'; if(n >= 1000) return (n/1000).toFixed(0)+'K'; return Math.round(n).toLocaleString(); };
function animNum(elId, target, prefix='', compact=false, dur=1200) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = performance.now();
  const from = 0;
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = from + (target - from) * eased;
    if (S.balVis) el.textContent = prefix + (compact ? fmtC(val) : fmt(val));
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

// ============================================================
// THEME
// ============================================================
const THEMES = [
  { id: 'ivory-light', name: 'Ivory', mode: 'Light', swatch: 'linear-gradient(135deg,#FAF8F3,#F2EDE5)', accent: '#8B6F3A', unique: 'serif-elegant' },
  { id: 'ivory-dark', name: 'Ivory', mode: 'Dark', swatch: 'linear-gradient(135deg,#0E0B08,#1E1710)', accent: '#C4923A', unique: 'serif-luxury' },
  { id: 'slate-light', name: 'Slate', mode: 'Light', swatch: 'linear-gradient(135deg,#F4F4F6,#ECEDF0)', accent: '#8B607A', unique: 'modern-soft' },
  { id: 'slate-dark', name: 'Slate', mode: 'Dark', swatch: 'linear-gradient(135deg,#0C0B10,#1A1824)', accent: '#B88098', unique: 'modern-bold' },
  { id: 'obsidian-light', name: 'Obsidian', mode: 'Light', swatch: 'linear-gradient(135deg,#F2F4F0,#E8EDE6)', accent: '#3D6B52', unique: 'nature-fresh' },
  { id: 'obsidian-dark', name: 'Obsidian', mode: 'Dark', swatch: 'linear-gradient(135deg,#090C08,#151A12)', accent: '#5A9470', unique: 'nature-deep' },
];

function applyTheme(t) {
  S.theme = t || S.theme;
  document.documentElement.setAttribute('data-theme', S.theme);
  const th = THEMES.find(x => x.id === S.theme);
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc && th) mc.setAttribute('content', S.theme.includes('dark') ? '#0E0B08' : '#FAF8F3');
  buildThemeGallery();
  persist();
}

function buildThemeGallery() {
  const g = document.getElementById('theme-gallery');
  if (!g) return;
  g.innerHTML = THEMES.map(t => `
    <div class="theme-card ${t.id === S.theme ? 'active-theme' : ''}" onclick="applyTheme('${t.id}')">
      <div class="theme-swatch" style="background:${t.swatch};"></div>
      <div class="theme-card-name">${t.name}</div>
      <div class="theme-card-mode">${t.mode}</div>
      <div class="theme-active-dot"></div>
    </div>`).join('');
}

// ============================================================
// MODAL SYSTEM (prevents stacking)
// ============================================================
let openModalId = null;
function openModal(id) {
  if (openModalId && openModalId !== id) closeModal(openModalId);
  openModalId = id;
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (openModalId === id) openModalId = null;
}
function modalBgClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

// ============================================================
// TOAST
// ============================================================
let toastT;
function showToast(msg, type='info') {
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  el.className = `toast ${type} show`;
  msgEl.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3200);
}

// ============================================================
// AUTH
// ============================================================
let gender = 'other', suPin = '', suPinConfirm = '';

function showAuthForm(form) {
  ['form-login','form-signup-1','form-signup-2','form-signup-3'].forEach(f => {
    document.getElementById(f).style.display = 'none';
  });
  if (form === 'login') document.getElementById('form-login').style.display = 'block';
  else if (form === 'signup') document.getElementById('form-signup-1').style.display = 'block';
  // Prefill last email
  const last = localStorage.getItem('ep_last_email');
  if (last && form === 'login') document.getElementById('login-email').value = last;
}

function pickGender(g, btn) {
  gender = g;
  document.querySelectorAll('.gender-opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

function goToSignupStep2() {
  const name = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pass = document.getElementById('su-pass').value;
  if (!name || !email || !pass) return showToast('Please fill all fields', 'error');
  if (pass.length < 6) return showToast('Password must be at least 6 characters', 'error');
  suPin = '';
  document.getElementById('form-signup-1').style.display = 'none';
  document.getElementById('form-signup-2').style.display = 'block';
  buildPinPad('pin-pad-setup', (d) => {
    suPin = d;
    document.getElementById('form-signup-2').style.display = 'none';
    document.getElementById('form-signup-3').style.display = 'block';
    suPinConfirm = '';
    buildPinPad('pin-pad-confirm', (d2) => {
      if (d2 !== suPin) {
        showToast('PINs do not match. Try again.', 'error');
        suPinConfirm = '';
        suPin = '';
        document.getElementById('form-signup-3').style.display = 'none';
        document.getElementById('form-signup-1').style.display = 'block';
        return;
      }
      // Create account
      createAccount(suPin);
    }, 'form-signup-3');
  }, 'form-signup-2');
}

function buildPinPad(padId, onComplete, formId) {
  let pin = '';
  const keys = [1,2,3,4,5,6,7,8,9,'',0,'⌫'];
  const pad = document.getElementById(padId);
  if (!pad) return;
  pad.innerHTML = keys.map(k => `<div class="pin-key${k===''?' invisible':''}" data-key="${k}">${k}</div>`).join('');
  // Update dots helper
  const updateDots = () => {
    const dots = formId
      ? document.querySelector(`#${formId} .pin-setup-dot`) && document.querySelectorAll(`#${formId} .pin-setup-dot`)
      : document.querySelectorAll(`#modal-pin .pin-setup-dot`);
    if (dots) dots.forEach((d, i) => d.classList.toggle('filled', i < pin.length));
  };
  pad.querySelectorAll('.pin-key:not(.invisible)').forEach(key => {
    key.addEventListener('click', () => {
      const k = key.dataset.key;
      if (k === '⌫') pin = pin.slice(0,-1);
      else if (pin.length < 4) pin += k;
      key.classList.add('pressed');
      setTimeout(() => key.classList.remove('pressed'), 120);
      updateDots();
      if (pin.length === 4) setTimeout(() => { const p = pin; pin = ''; updateDots(); onComplete(p); }, 200);
    });
  });
}

function createAccount(pin) {
  const name = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pass = document.getElementById('su-pass').value;
  // Set initial theme by gender
  if (gender === 'female') S.theme = 'slate-light';
  else if (gender === 'male') S.theme = 'ivory-light';
  else S.theme = 'obsidian-light';
  try {
    S.user = { name, email, pass: btoa(pass), pin, gender, id: 'ELP-' + Date.now().toString().slice(-6), since: new Date().toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }) };
  } catch(e) {
    return showToast('Account creation error', 'error');
  }
  S.balance = 85000 + Math.random() * 250000;
  S.savings = 15000 + Math.random() * 80000;
  S.cashback = Math.round(S.balance * 0.012);
  S.totalTx = Math.floor(Math.random() * 40) + 8;
  S.monthSpend = Math.round(S.balance * 0.28);
  S.monthSave = Math.round(S.savings * 0.18);
  S.goals = [
    { name: 'Emergency Fund', target: 500000, saved: 145000 },
    { name: 'Dream Vacation', target: 300000, saved: 210000 },
    { name: 'New MacBook', target: 200000, saved: 80000 },
  ];
  S.streak = Math.floor(Math.random() * 9) + 1;
  S.transactions = genTxs(12);
  S.notifications = genNotifs();
  localStorage.setItem('ep_last_email', email);
  persist();
  applyTheme();
  launchApp();
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) return showToast('Please fill all fields', 'error');
  if (!S.user) return showToast('No account found. Please sign up.', 'error');
  if (S.user.email !== email) return showToast('Account not found', 'error');
  try {
    if (S.user.pass !== btoa(pass)) return showToast('Incorrect password', 'error');
  } catch(e) {
    return showToast('Authentication error', 'error');
  }
  localStorage.setItem('ep_last_email', email);
  launchApp();
}

function launchApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('main-app').classList.add('active');
  applyTheme();
  renderAll();
  setTimeout(() => initPTR(), 400);
}

// ============================================================
// NAVIGATION
// ============================================================
let curPage = 'home';
function goPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item, .side-nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === p);
  });
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('page-' + p).scrollTop = 0;
  curPage = p;
  if (p === 'home') renderHome();
  if (p === 'account') renderAccount();
  if (p === 'wealth') renderWealth();
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderHome();
  buildQuickGrid();
  buildPayGrid();
  buildInsights();
  buildPayFavs();
  buildSmartSuggestions();
  buildPayRecent();
  renderAccount();
  renderWealth();
  buildThemeGallery();
  buildHowItWorks();
  buildSettings();
  buildStars();
  buildRecentRecipients();
  initLoanSlider();
  buildNotifs();
}

function renderHome() {
  if (!S.user) return;
  const h = new Date().getHours();
  const greet = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const el = document.getElementById('greet-time');
  if (el) el.textContent = greet;
  const hn = document.getElementById('home-name');
  if (hn) hn.textContent = S.user.name.split(' ')[0];
  animNum('bal-display', S.balance);
  updateBalPills();
  buildStreak();
  buildTxList();
  buildSpendChart();
  drawSparkline();
}

function updateBalPills() {
  const sd = document.getElementById('sav-display');
  const cd = document.getElementById('cb-display');
  const td = document.getElementById('tier-display');
  if (sd) sd.textContent = S.balVis ? '₦' + fmtC(S.savings) : '•••';
  if (cd) cd.textContent = S.balVis ? '₦' + fmtC(S.cashback) : '•••';
  const tier = S.balance > 500000 ? 'Platinum' : S.balance > 200000 ? 'Gold' : 'Silver';
  if (td) td.textContent = tier;
}

function toggleBal() {
  S.balVis = !S.balVis;
  const bd = document.getElementById('bal-display');
  if (bd) bd.textContent = S.balVis ? fmt(S.balance) : '••••••';
  updateBalPills();
}

function buildStreak() {
  const days = ['M','T','W','T','F','S','S'];
  const el = document.getElementById('streak-dots');
  if (el) el.innerHTML = days.map((d,i) => `<div class="streak-dot ${i < S.streak ? 'lit' : ''}">${d}</div>`).join('');
  const sn = document.getElementById('streak-num');
  if (sn) sn.textContent = S.streak;
}

function buildTxList() {
  const el = document.getElementById('tx-list');
  if (!el || !S.transactions) return;
  el.innerHTML = S.transactions.slice(0,6).map(tx => `
    <div class="tx-row" onclick="showTxReceipt(${tx.id})">
      <div class="tx-icon-wrap ${tx.type}">
        ${tx.type === 'credit'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 17 17 7"/><polyline points="7 7 17 7 17 17"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 7 7 17"/><polyline points="17 17 7 17 7 7"/></svg>'}
      </div>
      <div class="tx-row-info">
        <div class="tx-row-name">${tx.name}</div>
        <div class="tx-row-meta">${tx.date} · ${tx.time}</div>
      </div>
      <div class="tx-row-amount ${tx.type}">${tx.type === 'credit' ? '+' : '-'}₦${fmtC(tx.amount)}</div>
    </div>`).join('');
}

function buildSpendChart() {
  const el = document.getElementById('spend-bars');
  if (!el) return;
  const cats = ['Food','Bills','Trans.','Shopping','Health','Data','Others'];
  const vals = cats.map(() => Math.random() * 100);
  const max = Math.max(...vals);
  el.innerHTML = cats.map((c, i) => `
    <div class="spend-bar-wrap">
      <div class="spend-bar ${vals[i] === max ? 'highest' : ''}" style="height:${Math.max(vals[i]/max*100, 12)}%;">
        <div class="spend-bar-shine"></div>
      </div>
      <div class="spend-bar-label">${c}</div>
    </div>`).join('');
}

function buildInsights() {
  const el = document.getElementById('insight-strip');
  if (!el || !S.user) return;
  el.innerHTML = [
    { val: '₦' + fmtC(S.monthSpend), label: 'Total spent this month across all categories' },
    { val: '₦' + fmtC(S.monthSave), label: 'Saved this month — building wealth steadily' },
    { val: S.totalTx + '', label: 'Transactions completed this month' },
    { val: '₦' + fmtC(S.cashback), label: 'Total cashback earned on your wallet' },
  ].map(i => `<div class="insight-card"><div class="insight-val">${i.val}</div><div class="insight-label">${i.label}</div></div>`).join('');
}

function drawSparkline() {
  const wrap = document.getElementById('sparkline-wrap');
  if (!wrap) return;
  const pts = Array.from({length:7}, () => Math.random() * 60 + 20);
  const min = Math.min(...pts), max = Math.max(...pts);
  const norm = pts.map(p => ((p - min) / (max - min || 1)) * 34);
  const w = 100, h = 36, step = w / (pts.length - 1);
  const d = norm.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${36 - y}`).join(' ');
  wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;">
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  </svg>`;
}

// Quick Actions
function buildQuickGrid() {
  const el = document.getElementById('quick-grid');
  if (!el) return;
  const acts = [
    { label: 'Add Money',    color: 'var(--success-bg)',    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',  action: "openModal('modal-add-money')" },
    { label: 'Send Money',   color: 'var(--accent-light)',  icon: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',                                              action: "goPage('transfer')" },
    { label: 'Request',      color: 'var(--surface-2)',     icon: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>', action: "switchTransTabDirect('request')" },
    { label: 'Pay Bills',    color: 'var(--surface-2)',     icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',                                          action: "goPage('pay')" },
    { label: 'Virtual Card', color: 'var(--accent-light)',  icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', action: "goPage('wealth')" },
    { label: 'Savings',      color: 'var(--success-bg)',    icon: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', action: "openModal('modal-add-savings')" },
    { label: 'Loan',         color: 'var(--surface-2)',     icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',                            action: "openLoanModal()" },
    { label: 'Profile',      color: 'var(--surface-2)',     icon: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',                                                            action: "goPage('account')" },
  ];
  el.innerHTML = acts.map(a => `
    <div class="quick-act" onclick="${a.action}">
      <div class="quick-act-icon" style="background:${a.color};">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${a.icon}</svg>
      </div>
      <div class="quick-act-label">${a.label}</div>
    </div>`).join('');
}

function switchTransTabDirect(tab) {
  goPage('transfer');
  setTimeout(() => {
    document.querySelectorAll('.transfer-tab-btn').forEach((b,i) => b.classList.toggle('active', i === (tab==='send'?0:1)));
    document.getElementById('tab-send').style.display = tab === 'send' ? 'block' : 'none';
    document.getElementById('tab-request').style.display = tab === 'request' ? 'block' : 'none';
  }, 100);
}

// ============================================================
// PAY PAGE
// ============================================================
const PAY_CATS = [
  { name: 'Airtime', color: '#C4703A', icon: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.41 2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.09-1.09a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>' },
  { name: 'Data', color: '#3A70C4', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
  { name: 'Cable TV', color: '#7A3AC4', icon: '<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>' },
  { name: 'Electricity', color: '#C4A83A', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { name: 'Betting', color: '#3AC470', icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
  { name: 'Gift Cards', color: '#C43A5E', icon: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
  { name: 'Internet', color: '#3AB8C4', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
  { name: 'Education', color: '#8AC43A', icon: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>' },
];

const BILL_PLANS = {
  Airtime: [{ name:'MTN',desc:'Instant top-up',price:100},{ name:'Airtel',desc:'Instant top-up',price:100},{ name:'Glo',desc:'Instant top-up',price:100},{ name:'9Mobile',desc:'Instant top-up',price:100}],
  Data: [{ name:'MTN 1GB',desc:'30 days',price:1000},{ name:'MTN 2GB',desc:'30 days',price:1500},{ name:'Airtel 5GB',desc:'30 days',price:2000},{ name:'Glo 10GB',desc:'30 days',price:3500}],
  'Cable TV': [{ name:'DSTV Compact',desc:'Monthly',price:9000},{ name:'DSTV Premium',desc:'Monthly',price:24500},{ name:'GoTV Supa',desc:'Monthly',price:4850},{ name:'StarTimes Classic',desc:'Monthly',price:2100}],
  Electricity: [{ name:'Eko Electric',desc:'Prepaid token',price:2000},{ name:'IKEDC',desc:'Prepaid token',price:2000},{ name:'Abuja AEDC',desc:'Prepaid token',price:2000},{ name:'Enugu EEDC',desc:'Prepaid token',price:2000}],
  Betting: [{ name:'Bet9ja',desc:'Wallet funding',price:1000},{ name:'SportyBet',desc:'Wallet funding',price:500},{ name:'1xBet',desc:'Wallet funding',price:500},{ name:'NairaBet',desc:'Wallet funding',price:1000}],
  'Gift Cards': [{ name:'Amazon $10',desc:'Digital code',price:8500},{ name:'iTunes $25',desc:'Digital code',price:21000},{ name:'Steam $20',desc:'Digital code',price:17000},{ name:'Google Play $10',desc:'Digital code',price:8500}],
  Internet: [{ name:'Smile 10GB',desc:'30 days',price:3500},{ name:'Spectranet 20GB',desc:'30 days',price:5000},{ name:'ipNX 5Mbps',desc:'Monthly',price:12000},{ name:'Swift 10Mbps',desc:'Monthly',price:15000}],
  Education: [{ name:'WAEC e-Pin',desc:'Result checker',price:3700},{ name:'NECO e-Pin',desc:'Result checker',price:3500},{ name:'JAMB e-Pin',desc:'Registration',price:3500},{ name:'NYSC e-Pin',desc:'Mobilisation',price:6000}],
};

function buildPayGrid() {
  const el = document.getElementById('pay-grid');
  if (!el) return;
  el.innerHTML = PAY_CATS.map(c => `
    <div class="pay-cat-item" data-cat="${c.name}" onclick="openBillModal('${c.name}')">
      <div class="pay-cat-icon" style="background:${c.color}18;">
        <svg viewBox="0 0 24 24" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg>
      </div>
      <div class="pay-cat-name">${c.name}</div>
    </div>`).join('');
}

function filterPay(q) {
  document.querySelectorAll('.pay-cat-item').forEach(el => {
    el.style.display = el.dataset.cat.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function buildPayFavs() {
  const el = document.getElementById('pay-favs');
  if (!el) return;
  const favs = [{n:'MTN Data',i:'MT'},{n:'DSTV',i:'DV'},{n:'Eko Electric',i:'EE'},{n:'Bet9ja',i:'B9'}];
  el.innerHTML = favs.map(f => `
    <div class="recip-card-btn" onclick="openBillModal('${f.n === 'MTN Data' ? 'Data' : f.n === 'DSTV' ? 'Cable TV' : f.n === 'Eko Electric' ? 'Electricity' : 'Betting'}')">
      <div class="recip-avi" style="font-size:15px;">${f.i}</div>
      <div class="recip-card-name">${f.n}</div>
    </div>`).join('');
}

function buildSmartSuggestions() {
  const el = document.getElementById('smart-suggs');
  if (!el) return;
  const suggs = [
    { left: 'Your MTN data likely runs out soon', right: 'Quick Renew' },
    { left: 'DSTV renewal due in ~3 days', right: 'Pay Now' },
    { left: 'Electricity token getting low', right: 'Buy Token' },
  ];
  el.innerHTML = `<div class="smart-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Smart Suggestions</div>` +
    suggs.map(s => `<div class="smart-item"><div class="smart-item-left">${s.left}</div><div class="smart-item-right">${s.right}</div></div>`).join('');
}

function buildPayRecent() {
  const el = document.getElementById('pay-recent-list');
  if (!el) return;
  const items = [{n:'MTN 2GB Data',a:1500,d:'Today'},{n:'DSTV Compact',a:9000,d:'Yesterday'},{n:'Eko Electric Token',a:5000,d:'3 days ago'}];
  el.innerHTML = items.map(i => `
    <div class="tx-row" onclick="openBillModal('Data')">
      <div class="tx-icon-wrap debit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
      <div class="tx-row-info"><div class="tx-row-name">${i.n}</div><div class="tx-row-meta">${i.d}</div></div>
      <div class="tx-row-amount debit">₦${fmt(i.a)}</div>
    </div>`).join('');
}

let selectedBillPlan = null;
function openBillModal(cat) {
  selectedBillPlan = null;
  document.getElementById('bill-title').textContent = cat;
  document.getElementById('bill-sub').textContent = 'Select a plan to continue';
  const plans = BILL_PLANS[cat] || [{name:cat+' Basic',desc:'Standard',price:500},{name:cat+' Plus',desc:'Better value',price:1500}];
  document.getElementById('bill-body').innerHTML = `
    <div class="bill-input-row">
      <input type="text" class="field-input" placeholder="Phone / Meter / Account No." style="flex:1;">
    </div>
    <div class="bill-plans-list">
      ${plans.map((p,i) => `
        <div class="bill-plan" onclick="selectBillPlan(this,${p.price})" data-price="${p.price}">
          <div><div class="bill-plan-name">${p.name}</div><div class="bill-plan-desc">${p.desc}</div></div>
          <div class="bill-plan-price">₦${fmt(p.price)}</div>
        </div>`).join('')}
    </div>
    <div style="height:16px;"></div>
    <button class="btn-primary" onclick="payBill('${cat}')">Pay Now</button>`;
  openModal('modal-bill');
}

function selectBillPlan(el, price) {
  document.querySelectorAll('.bill-plan').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  selectedBillPlan = price;
}

function payBill(cat) {
  const amt = selectedBillPlan || 1000;
  if (amt > S.balance) return showToast('Insufficient balance', 'error');
  closeModal('modal-bill');
  requirePIN(() => {
    S.balance -= amt;
    S.totalTx++;
    S.monthSpend += amt;
    const tx = mkTx(cat + ' Payment', amt, 'debit');
    S.transactions.unshift(tx);
    persist();
    renderHome();
    showToast(cat + ' payment successful', 'success');
  });
}

// ============================================================
// BANKS
// ============================================================
const BANKS = [
  { name:'Access Bank', code:'044', color:'#E03C3C' },
  { name:'GTBank', code:'058', color:'#F04E0F' },
  { name:'First Bank', code:'011', color:'#1A6BAA' },
  { name:'UBA', code:'033', color:'#E02020' },
  { name:'Zenith Bank', code:'057', color:'#8B1A1A' },
  { name:'Kuda Bank', code:'090267', color:'#4040D0' },
  { name:'OPay', code:'100004', color:'#00A859' },
  { name:'Wema Bank', code:'035', color:'#702070' },
  { name:'Stanbic IBTC', code:'039', color:'#0061AA' },
  { name:'Fidelity Bank', code:'070', color:'#004B8D' },
  { name:'Sterling Bank', code:'232', color:'#C8102E' },
  { name:'Polaris Bank', code:'076', color:'#E87722' },
  { name:'Union Bank', code:'032', color:'#3D5BA9' },
  { name:'Heritage Bank', code:'030', color:'#00703C' },
  { name:'Ecobank', code:'050', color:'#2A5F9E' },
  { name:'FCMB', code:'214', color:'#6B2A8A' },
  { name:'Moniepoint', code:'50515', color:'#2D9EDF' },
  { name:'PalmPay', code:'999991', color:'#1AC073' },
];
const FAKE_NAMES = ['Emeka Chukwu','Ngozi Adeleke','Femi Balogun','Kemi Adesanya','Tunde Bakare','Amaka Obi','Uche Nwosu','Sola Ibrahim','Dayo Ojo','Chiamaka Eze','Biodun Adeyemi','Fatima Aliyu'];

function openBankModal() {
  buildBankList('');
  openModal('modal-bank');
}

function buildBankList(q) {
  const el = document.getElementById('bank-list');
  if (!el) return;
  const filtered = BANKS.filter(b => b.name.toLowerCase().includes(q.toLowerCase()));
  el.innerHTML = filtered.map(b => `
    <div class="bank-item" onclick="selectBank('${b.name}','${b.color}')">
      <div class="bank-item-logo" style="background:${b.color};">${b.name.slice(0,2).toUpperCase()}</div>
      <div><div class="bank-item-name">${b.name}</div><div class="bank-item-code">Code: ${b.code}</div></div>
    </div>`).join('');
}

function filterBanks(q) { buildBankList(q); }

function selectBank(name, color) {
  S.selectedBank = { name, color };
  closeModal('modal-bank');
  // Update button
  const txt = document.getElementById('bank-select-txt');
  const namEl = document.getElementById('bank-select-name');
  const logo = document.getElementById('bank-logo-preview');
  if (txt) txt.style.display = 'none';
  if (namEl) { namEl.style.display = 'block'; namEl.textContent = name; }
  if (logo) { logo.style.display = 'flex'; logo.style.background = color; logo.textContent = name.slice(0,2).toUpperCase(); }
  // Clear resolve
  document.getElementById('resolve-area').innerHTML = '';
  document.getElementById('acct-num').value = '';
}

let resolveTimer;
function onAcctInput(el) {
  const v = el.value;
  const area = document.getElementById('resolve-area');
  if (v.length < 10) { area.innerHTML = ''; return; }
  if (!S.selectedBank) { showToast('Please select a bank first', 'error'); return; }
  area.innerHTML = `<div class="resolving-state"><div class="resolve-spinner"></div>Resolving account name...</div>`;
  clearTimeout(resolveTimer);
  resolveTimer = setTimeout(() => {
    const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    S.resolvedRecipient = { name, bank: S.selectedBank.name, acct: v };
    area.innerHTML = `
      <div class="resolve-box">
        <div class="resolve-avi">${name[0]}</div>
        <div>
          <div contenteditable="true" class="resolve-name" id="resolved-name" spellcheck="false">${name}</div>
          <div class="resolve-bank">${S.selectedBank.name} · ${v}</div>
        </div>
      </div>`;
    // Keep name in sync
    document.getElementById('resolved-name').addEventListener('input', (e) => {
      if (S.resolvedRecipient) S.resolvedRecipient.name = e.target.textContent.trim();
    });
  }, 800);
}

function buildRecentRecipients() {
  const el = document.getElementById('recent-recips');
  if (!el) return;
  const recips = [{n:'Emeka C.',i:'EC'},{n:'Ngozi A.',i:'NA'},{n:'Femi B.',i:'FB'},{n:'Kemi A.',i:'KA'},{n:'Tunde B.',i:'TB'}];
  el.innerHTML = recips.map(r => `
    <div class="recip-card-btn" onclick="prefillRecipient('${r.n}','${r.i}')">
      <div class="recip-avi">${r.i}</div>
      <div class="recip-card-name">${r.n}</div>
    </div>`).join('');
}

function prefillRecipient(name, initials) {
  showToast('Tap bank to change recipient', 'info');
}

function switchTransTab(t, btn) {
  document.querySelectorAll('.transfer-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-send').style.display = t === 'send' ? 'block' : 'none';
  document.getElementById('tab-request').style.display = t === 'request' ? 'block' : 'none';
}

function doTransfer() {
  if (!S.resolvedRecipient) return showToast('Resolve a recipient account first', 'error');
  const amt = parseFloat(document.getElementById('trans-amount').value);
  if (!amt || amt < 10) return showToast('Enter a valid amount', 'error');
  if (amt > S.balance) return showToast('Insufficient balance', 'error');
  const narr = document.getElementById('trans-narration').value || 'Transfer';
  S.pendingTransfer = { ...S.resolvedRecipient, amount: amt, narration: narr };
  document.getElementById('confirm-rows').innerHTML = `
    <div class="confirm-row"><div class="confirm-label">To</div><div class="confirm-val">${S.pendingTransfer.name}</div></div>
    <div class="confirm-row"><div class="confirm-label">Bank</div><div class="confirm-val">${S.pendingTransfer.bank}</div></div>
    <div class="confirm-row"><div class="confirm-label">Account</div><div class="confirm-val">${S.pendingTransfer.acct}</div></div>
    <div class="confirm-row"><div class="confirm-label">Amount</div><div class="confirm-val large">₦${fmt(amt)}</div></div>
    <div class="confirm-row"><div class="confirm-label">Fee</div><div class="confirm-val">₦10.75</div></div>
    <div class="confirm-row"><div class="confirm-label">Narration</div><div class="confirm-val">${narr}</div></div>`;
  openModal('modal-confirm');
}

function executeTransfer() {
  closeModal('modal-confirm');
  requirePIN(() => {
    const t = S.pendingTransfer;
    S.balance -= (t.amount + 10.75);
    S.totalTx++;
    S.monthSpend += t.amount;
    const tx = mkTx(t.name, t.amount, 'debit');
    S.transactions.unshift(tx);
    persist();
    renderHome();
    const ref = 'ELP' + Date.now();
    showReceiptModal(t.amount, t.name, t.bank, t.acct, ref, 'Sent');
  });
}

function genReqLink() {
  const amt = parseFloat(document.getElementById('req-amount').value);
  const desc = document.getElementById('req-desc').value || 'Payment Request';
  if (!amt) return showToast('Enter an amount', 'error');
  const link = `https://pay.elarapay.ng/r/${S.user?.id}/${Math.round(amt)}`;
  document.getElementById('req-link-body').innerHTML = `
    <div style="margin-bottom:16px;font-size:13px;color:var(--text-3);">Share this link to receive ₦${fmt(amt)} for "${desc}"</div>
    <div class="req-link-display">${link}</div>
    <button class="btn-primary" onclick="navigator.clipboard.writeText('${link}').then(()=>showToast('Link copied','success'))">Copy Link</button>`;
  openModal('modal-req-link');
}

// ============================================================
// PIN SYSTEM
// ============================================================
function requirePIN(cb) {
  S.pinCb = cb;
  S.curPin = '';
  updatePINDots();
  openModal('modal-pin');
  buildPinPad('pin-pad-verify', (pin) => {
    if (pin === S.user?.pin) {
      closeModal('modal-pin');
      if (S.pinCb) { S.pinCb(); S.pinCb = null; }
    } else {
      S.curPin = '';
      updatePINDots();
      shakeDots();
      showToast('Incorrect PIN', 'error');
    }
  });
}

function updatePINDots() {
  document.querySelectorAll('#modal-pin .pin-setup-dot').forEach((d,i) => d.classList.toggle('filled', i < S.curPin.length));
}

function shakeDots() {
  const disp = document.querySelector('#modal-pin .pin-setup-display');
  if (!disp) return;
  disp.style.animation = 'shake 0.4s ease';
  setTimeout(() => disp.style.animation = '', 400);
}

function simulateBio() {
  closeModal('modal-pin');
  if (S.pinCb) { setTimeout(() => { S.pinCb(); S.pinCb = null; }, 200); }
  showToast('Biometric verified', 'success');
}

// ============================================================
// ADD MONEY
// ============================================================
function buildAddChips() {
  const el = document.getElementById('add-chips');
  if (!el) return;
  const amts = [1000,2000,5000,10000,20000,50000];
  el.innerHTML = amts.map(a => `<div class="amount-chip" onclick="selectAddChip(this,${a})">₦${fmtC(a)}</div>`).join('');
}

function selectAddChip(el, val) {
  document.querySelectorAll('.amount-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('add-custom').value = val;
}

function processAdd() {
  const amt = parseFloat(document.getElementById('add-custom').value);
  if (!amt || amt < 100) return showToast('Minimum top-up is ₦100', 'error');
  closeModal('modal-add-money');
  requirePIN(() => {
    const cb = Math.round(amt * 0.01);
    S.balance += amt;
    S.cashback += cb;
    S.totalTx++;
    const tx = mkTx('Wallet Top-Up', amt, 'credit');
    S.transactions.unshift(tx);
    persist();
    renderHome();
    showToast(`+₦${fmtC(cb)} cashback earned!`, 'success');
  });
}

// ============================================================
// LOAN
// ============================================================
function initLoanSlider() {
  updateLoanPreview(50000);
}

function updateLoanPreview(val) {
  const el = document.getElementById('loan-slider-val');
  if (el) el.textContent = '₦' + fmtC(Number(val));
}

function calcLoan() {
  const amt = parseFloat(document.getElementById('loan-amt-input')?.value);
  const dur = parseInt(document.getElementById('loan-dur')?.value);
  const el = document.getElementById('loan-calc-result');
  if (!el) return;
  if (!amt) { el.textContent = 'Enter amount and duration to see summary'; return; }
  const interest = amt * 0.015 * dur;
  const total = amt + interest;
  const monthly = total / dur;
  el.innerHTML = `<strong>₦${fmt(amt)}</strong> over ${dur} month${dur>1?'s':''} at 1.5%/mo — repay <strong>₦${fmt(monthly)}/mo</strong>, total <strong>₦${fmt(total)}</strong>`;
}

function openLoanModal() { openModal('modal-loan'); }

function confirmLoan() {
  const amt = parseFloat(document.getElementById('loan-amt-input')?.value);
  if (!amt || amt < 1000) return showToast('Minimum loan is ₦1,000', 'error');
  if (amt > 500000) return showToast('Maximum limit is ₦500,000', 'error');
  closeModal('modal-loan');
  requirePIN(() => {
    S.balance += amt;
    S.totalTx++;
    const tx = mkTx('Quick Loan', amt, 'credit');
    S.transactions.unshift(tx);
    persist();
    renderHome();
    showToast(`₦${fmtC(amt)} loan disbursed instantly`, 'success');
  });
}

function applyLoan() { openLoanModal(); }

// ============================================================
// SAVINGS
// ============================================================
function doAddSavings() {
  const amt = parseFloat(document.getElementById('sav-add-amt').value);
  if (!amt || amt < 100) return showToast('Minimum is ₦100', 'error');
  if (amt > S.balance) return showToast('Insufficient balance', 'error');
  closeModal('modal-add-savings');
  requirePIN(() => {
    S.balance -= amt;
    S.savings += amt;
    S.monthSave += amt;
    persist();
    renderHome();
    renderWealth();
    showToast('Moved to savings', 'success');
  });
}

// ============================================================
// GOALS
// ============================================================
function createGoal() {
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  if (!name || !target) return showToast('Please fill all fields', 'error');
  S.goals.push({ name, target, saved: 0 });
  persist();
  closeModal('modal-new-goal');
  renderWealth();
  showToast('Goal created', 'success');
}

function buildGoals() {
  const el = document.getElementById('goals-row');
  if (!el) return;
  el.innerHTML = S.goals.map(g => {
    const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
    const C = 2 * Math.PI * 30;
    const dash = `${(pct/100)*C} ${C}`;
    const mths = Math.ceil((g.target - g.saved) / (S.monthSave || 5000));
    const proj = mths <= 1 ? 'Almost there!' : `~${mths} months away`;
    return `<div class="goal-card">
      <div class="goal-ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72" class="goal-ring-svg">
          <circle class="goal-ring-track" cx="36" cy="36" r="30"/>
          <circle class="goal-ring-fill" cx="36" cy="36" r="30" stroke-dasharray="${dash}"/>
        </svg>
        <div class="goal-ring-pct">${pct}%</div>
      </div>
      <div class="goal-name">${g.name}</div>
      <div class="goal-amount">₦${fmtC(g.saved)} / ₦${fmtC(g.target)}</div>
      <div class="goal-projected">${proj}</div>
    </div>`;
  }).join('') + `<div class="goal-card" style="border-style:dashed;cursor:pointer;" onclick="openModal('modal-new-goal')">
    <div style="font-size:32px;color:var(--border-strong);margin-bottom:8px;">+</div>
    <div class="goal-name" style="color:var(--text-4);">New Goal</div>
  </div>`;
}

// ============================================================
// WEALTH PAGE
// ============================================================
function renderWealth() {
  const el = document.getElementById('wealth-total');
  if (el) animNum('wealth-total', S.balance + S.savings);
  buildGoals();
  // Virtual card
  const vh = document.getElementById('vcard-holder');
  if (vh && S.user) vh.textContent = S.user.name.toUpperCase();
}

function copyCardDetails() {
  const num = document.getElementById('vcard-number').textContent.replace(/[\s*]/g, '');
  const cvv = document.getElementById('vcard-cvv')?.textContent || '842';
  const holder = document.getElementById('vcard-holder').textContent;
  const txt = `Card: ${num}\nCVV: ${cvv}\nExpiry: 08/28\nHolder: ${holder}\nNetwork: Mastercard`;
  navigator.clipboard.writeText(txt).then(() => showToast('Card details copied!', 'success')).catch(() => showToast('Copied!', 'success'));
}

function toggleCardNumber() {
  const el = document.getElementById('vcard-number');
  const full = document.getElementById('vcard-full-details');
  if (el.textContent.includes('*')) {
    el.textContent = '5043 2901 1042 4291';
    if (full) full.style.display = 'block';
  } else {
    el.textContent = '**** **** **** 4291';
    if (full) full.style.display = 'none';
  }
}

function regenerateCard() {
  const num = '5' + Math.floor(Math.random() * 900000000000000 + 100000000000000);
  const cvv = Math.floor(Math.random() * 900 + 100);
  document.getElementById('vcard-number').textContent = num.replace(/(\d{4})/g, '$1 ').trim();
  document.getElementById('vcard-number').dataset.full = num;
  if (document.getElementById('vcard-cvv')) document.getElementById('vcard-cvv').textContent = cvv;
  showToast('New card generated!', 'success');
}

// ============================================================
// RECEIPTS
// ============================================================
function showReceiptModal(amount, to, bank, acct, ref, action='Sent', dt='') {
  const date = dt || new Date().toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' });
  document.getElementById('receipt-body').innerHTML = `
    <div class="receipt-header-block">
      <div class="receipt-stamp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="receipt-amount"><span>₦</span>${fmt(amount)}</div>
      <div class="receipt-status">Transfer ${action} Successfully</div>
    </div>
    <div class="receipt-row"><div class="receipt-row-label">${action === 'Sent' ? 'Recipient' : 'From'}</div><div class="receipt-row-val">${to}</div></div>
    ${bank ? `<div class="receipt-row"><div class="receipt-row-label">Bank</div><div class="receipt-row-val">${bank}</div></div>` : ''}
    ${acct ? `<div class="receipt-row"><div class="receipt-row-label">Account</div><div class="receipt-row-val">${acct}</div></div>` : ''}
    <div class="receipt-row"><div class="receipt-row-label">Date &amp; Time</div><div class="receipt-row-val">${date}</div></div>
    <div class="receipt-row"><div class="receipt-row-label">Reference</div><div class="receipt-row-val" style="font-size:11px;word-break:break-all;">${ref}</div></div>
    <div class="receipt-row"><div class="receipt-row-label">Status</div><div class="receipt-row-val" style="color:var(--success);font-weight:600;">Successful</div></div>
    <div class="receipt-actions-row">
      <button class="receipt-action-btn" onclick="shareReceipt(${amount},'${to}','${ref}')">Share</button>
      <button class="receipt-action-btn primary" onclick="downloadReceipt(${amount},'${to}','${ref}')">Download</button>
    </div>`;
  openModal('modal-receipt');
}

function showTxReceipt(id) {
  const tx = S.transactions.find(t => t.id === id);
  if (!tx) return;
  showReceiptModal(tx.amount, tx.name, '', '', tx.ref, tx.type === 'credit' ? 'Received' : 'Sent', tx.date + ' · ' + tx.time);
}

function shareReceipt(amount, to, ref) {
  const txt = `ElaraPay Receipt\n\nAmount: ₦${fmt(amount)}\nTo: ${to}\nRef: ${ref}\nStatus: Successful\n\nWealth, Elevated. — ElaraPay`;
  navigator.clipboard.writeText(txt).then(() => showToast('Receipt copied to clipboard', 'success')).catch(() => showToast('Copied', 'success'));
}

function downloadReceipt(amount, to, ref) {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 700;
  const ctx = c.getContext('2d');
  // Background
  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, 600, 700);
  // Gold top bar
  ctx.fillStyle = '#8B6F3A';
  ctx.fillRect(0, 0, 600, 8);
  // Title
  ctx.fillStyle = '#1C1410';
  ctx.font = '600 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('ElaraPay Receipt', 300, 70);
  // Amount
  ctx.fillStyle = '#8B6F3A';
  ctx.font = '300 52px Georgia, serif';
  ctx.fillText('₦' + fmt(amount), 300, 160);
  // Details
  ctx.fillStyle = '#4A3F35';
  ctx.font = '400 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  const rows = [['To', to], ['Reference', ref], ['Status', 'Successful'], ['Powered by', 'ElaraPay']];
  rows.forEach(([l, v], i) => {
    ctx.fillStyle = '#9A8C78';
    ctx.fillText(l, 80, 240 + i * 56);
    ctx.fillStyle = '#1C1410';
    ctx.font = '500 16px Arial, sans-serif';
    ctx.fillText(v, 80, 266 + i * 56);
    ctx.fillStyle = '#EDE7DC';
    ctx.fillRect(80, 278 + i * 56, 440, 1);
    ctx.font = '400 16px Arial, sans-serif';
  });
  // Footer
  ctx.fillStyle = '#9A8C78';
  ctx.font = '300 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Wealth, Elevated.', 300, 660);
  const link = document.createElement('a');
  link.download = `ElaraPay-Receipt-${ref}.png`;
  link.href = c.toDataURL();
  link.click();
  showToast('Receipt downloaded', 'success');
}

// ============================================================
// ACCOUNT PAGE
// ============================================================
function renderAccount() {
  if (!S.user) return;
  const initials = S.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  ['acc-initials','side-avatar'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = initials; });
  const sn = document.getElementById('side-nav-name');
  if (sn) sn.textContent = S.user.name.split(' ')[0];
  const an = document.getElementById('acc-name'); if (an) an.textContent = S.user.name;
  const ai = document.getElementById('acc-id'); if (ai) ai.textContent = 'ID: ' + S.user.id;
  const tier = S.balance > 500000 ? 'Platinum' : S.balance > 200000 ? 'Gold' : 'Silver';
  const at = document.getElementById('acc-tier'); if (at) at.textContent = tier;
  const td = document.getElementById('tier-display'); if (td) td.textContent = tier;
  const tag = S.monthSave > S.monthSpend * 0.5 ? 'The Planner' : S.monthSpend > S.balance * 0.5 ? 'The Spender' : 'The Saver';
  const atg = document.getElementById('acc-tag'); if (atg) atg.textContent = tag;
  ['acc-stat-bal','stat-bal-2'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '₦' + fmtC(S.balance); });
  const sb = document.getElementById('acc-stat-tx'); if (sb) sb.textContent = S.totalTx;
  const sc = document.getElementById('acc-stat-cb'); if (sc) sc.textContent = '₦' + fmtC(S.cashback);
  // Tier progress
  const pct = tier === 'Silver' ? (S.balance/200000)*100 : tier === 'Gold' ? ((S.balance-200000)/300000)*100 : 100;
  const tf = document.getElementById('tier-bar-fill'); if (tf) tf.style.width = Math.min(pct,100) + '%';
  const tcl = document.getElementById('tier-curr-label'); if (tcl) tcl.textContent = tier + ' Tier';
  const tnl = document.getElementById('tier-next-label');
  if (tnl) tnl.textContent = tier === 'Platinum' ? 'Highest tier reached' : `₦${fmtC(tier==='Silver'?200000-S.balance:500000-S.balance)} more to ${tier==='Silver'?'Gold':'Platinum'}`;
  const tnh = document.getElementById('tier-bar-hint'); if (tnh) tnh.textContent = `Member since ${S.user.since || 'recently'}`;
  buildAddChips();
}

let avatarTaps = 0, avatarTimer;
function avatarTap() {
  avatarTaps++;
  clearTimeout(avatarTimer);
  if (avatarTaps >= 5) {
    avatarTaps = 0;
    const vf = document.getElementById('vip-field');
    if (vf) { vf.classList.add('visible'); showToast('Privileged access revealed', 'info'); }
  } else {
    avatarTimer = setTimeout(() => { avatarTaps = 0; }, 2000);
  }
}

function submitVIP() {
  const code = document.getElementById('vip-input')?.value?.trim();
  const vf = document.getElementById('vip-field');
  const themes = ['ivory-light', 'ivory-dark', 'slate-light', 'slate-dark', 'obsidian-light', 'obsidian-dark'];
  if (themes.includes(code)) {
    applyTheme(code);
    vf?.classList.remove('visible');
    showToast(`Theme: ${code.replace('-', ' ')} activated`, 'success');
  } else {
    showToast('Invalid access code', 'error');
  }
  if (document.getElementById('vip-input')) document.getElementById('vip-input').value = '';
}

function buildHowItWorks() {
  const el = document.getElementById('how-list');
  if (!el) return;
  const items = [
    { title: 'Wallet Balance', text: 'Your main wallet holds funds for everyday spending. Add money via top-up and earn 1% cashback credited instantly. Your balance persists securely across all sessions.' },
    { title: 'Sending Money', text: 'Select your recipient\'s bank, enter their 10-digit account number and ElaraPay instantly resolves the account holder\'s full name. You can edit the name before proceeding. Authenticate with your personal 4-digit PIN.' },
    { title: 'Paying Bills', text: 'The Pay tab covers Airtime, Data, Cable TV, Electricity, Betting, Gift Cards, Internet and Education PINs. Save frequent services to Favourites for one-tap access anytime.' },
    { title: 'Wealth Tools', text: 'Set savings goals with circular progress tracking. Use the Quick Loan slider to instantly see repayment calculations. Your virtual card works for online payments and can be frozen anytime.' },
    { title: 'Themes', text: 'Choose from 6 visual themes across 3 palettes in Light and Dark mode. Your theme persists across all sessions. Gender selected during signup sets your initial theme.' },
    { title: 'Security', text: 'Every sensitive action requires your 4-digit transaction PIN set during signup. Biometric authentication is also available. All data lives only in your browser\'s local storage — never on any server.' },
  ];
  el.innerHTML = items.map(i => `<div class="how-item"><div class="how-item-title">${i.title}</div><div class="how-item-text">${i.text}</div></div>`).join('');
}

function buildSettings() {
  const el = document.getElementById('settings-group');
  if (!el) return;
  el.innerHTML = `
    <div class="settings-row" onclick="openModal('modal-support')">
      <div class="settings-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <div class="settings-row-content"><div class="settings-row-name">Support &amp; Help</div><div class="settings-row-desc">24/7 premium concierge support</div></div>
      <div class="settings-row-right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>
    <div class="settings-row" onclick="openModal('modal-privacy')">
      <div class="settings-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="settings-row-content"><div class="settings-row-name">Privacy &amp; Security</div><div class="settings-row-desc">PIN, biometrics, login activity</div></div>
      <div class="settings-row-right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>
    <div class="settings-row">
      <div class="settings-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg></div>
      <div class="settings-row-content"><div class="settings-row-name">Push Notifications</div><div class="settings-row-desc">Transaction and security alerts</div></div>
      <div class="toggle-switch on" onclick="this.classList.toggle('on')"></div>
    </div>
    <div class="settings-row" style="cursor:pointer;" onclick="doLogout()">
      <div class="settings-row-icon" style="color:var(--danger);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
      <div class="settings-row-content"><div class="settings-row-name" style="color:var(--danger);">Sign Out</div><div class="settings-row-desc">Log out of your account</div></div>
      <div class="settings-row-right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>`;
}

function doLogout() {
  if (!confirm('Sign out of ElaraPay?')) return;
  persist();
  document.getElementById('main-app').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  showAuthForm('login');
}

// Feedback
function buildStars() {
  const el = document.getElementById('star-row');
  if (!el) return;
  el.innerHTML = [1,2,3,4,5].map(i => `<button class="star-btn" onclick="setStar(${i})" data-star="${i}">★</button>`).join('');
}

function setStar(n) {
  S.starRating = n;
  document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('lit', i < n));
}

function submitFeedback() {
  const text = document.getElementById('feedback-text')?.value?.trim();
  if (!S.starRating) return showToast('Please select a star rating', 'error');
  const stars = '★'.repeat(S.starRating) + '☆'.repeat(5 - S.starRating);
  const msg = `ElaraPay Feedback\n\nRating: ${stars} (${S.starRating}/5)\n\n${text || 'No additional comments.'}\n\nSent from ElaraPay App`;
  const confirm_msg = 'This will open WhatsApp to send your feedback to our team.';
  if (window.confirm(confirm_msg)) {
    const url = `https://wa.me/2349074935326?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function buildNotifs() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  el.innerHTML = (S.notifications || []).map(n => `
    <div class="notif-item">
      <div class="notif-item-title">${n.title}</div>
      <div class="notif-item-body">${n.body}</div>
      <div class="notif-item-time">${n.time}</div>
    </div>`).join('') || '<div style="text-align:center;padding:40px;color:var(--text-4);font-size:13px;">No notifications yet</div>';
}

function openNotifPanel() {
  buildNotifs();
  document.getElementById('notif-panel').classList.add('open');
}
function closeNotifPanel() {
  document.getElementById('notif-panel').classList.remove('open');
}

// ============================================================
// PULL TO REFRESH
// ============================================================
function initPTR() {
  const page = document.getElementById('page-home');
  if (!page) return;
  let startY = 0, pulling = false;
  page.addEventListener('touchstart', e => {
    if (page.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
  page.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 60) {
      document.getElementById('ptr-zone').classList.add('pulling');
    }
  }, { passive: true });
  page.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const zone = document.getElementById('ptr-zone');
    if (zone.classList.contains('pulling')) {
      zone.classList.remove('pulling');
      renderHome();
      showToast('Refreshed', 'success');
    }
    startY = 0;
  });
}

// ============================================================
// DATA GENERATORS
// ============================================================
function mkTx(name, amount, type) {
  return {
    id: Date.now() + Math.random(),
    name, amount, type,
    date: new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    time: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    ref: 'ELP' + Date.now()
  };
}

function genTxs(count) {
  const names = ['Emeka Chukwu','DSTV Subscription','MTN Airtime','Ngozi Adeleke','Kuda Transfer','Jumia Order','GoTV','Shoprite','UBA Transfer','Femi Balogun','Wallet Top-Up','Quick Loan'];
  const types = ['credit','debit','debit','debit','credit','debit','debit','debit','credit','debit','credit','credit'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i % names.length],
    amount: Math.round((2000 + Math.random() * 60000) / 100) * 100,
    type: types[i % types.length],
    date: new Date(Date.now() - i * 86400000 * (Math.random() * 2 + 0.3)).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    time: `${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
    ref: 'ELP' + String(Date.now() - i * 1000).slice(-10)
  }));
}

function genNotifs() {
  return [
    { title: 'Transfer Successful', body: 'Your transfer of ₦5,000 to Emeka Chukwu was completed successfully.', time: '2 mins ago' },
    { title: 'Cashback Earned', body: 'You earned ₦850 cashback on your last top-up. Keep going!', time: '1 hour ago' },
    { title: 'Login Alert', body: 'A new sign-in to your ElaraPay account was detected from Lagos, NG.', time: '3 hours ago' },
    { title: 'Bill Payment', body: 'Your DSTV Compact subscription has been renewed successfully.', time: 'Yesterday' },
    { title: 'Savings Goal Update', body: 'You are 70% towards your Emergency Fund goal. Great progress!', time: '2 days ago' },
  ];
}

// ============================================================
// SERVICE WORKER (real offline caching)
// ============================================================
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ============================================================
// PWA INSTALL
// ============================================================
function initInstall() {
  // Handled by global beforeinstallprompt listener
  const cta = document.getElementById('install-cta');
  if (cta) cta.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('install-banner').classList.remove('show');
    if (outcome === 'accepted') showToast('ElaraPay installed!', 'success');
  });
}

// ============================================================
// SHAKE KEYFRAME (injected)
// ============================================================
const shakeCSS = document.createElement('style');
shakeCSS.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-7px); }
  80% { transform: translateX(7px); }
}`;
document.head.appendChild(shakeCSS);

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  hydrate();
  applyTheme();
  registerSW();
  initInstall();

  // Splash → route
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.classList.add('out');
    setTimeout(() => {
      splash.style.display = 'none';
      if (S.user) {
        launchApp();
      } else {
        document.getElementById('auth-screen').classList.add('active');
        showAuthForm('login');
      }
    }, 700);
  }, 2000);
});

// SW registered via registerSW() above

// PWA: Dynamic Favicon (updates with theme)
function updateFavicon() {
  const isDark = S.theme && S.theme.includes('dark');
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute('content', isDark ? '#0E0B08' : '#FAF8F3');
}

// PWA: Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show install banner after 3 seconds
  setTimeout(() => {
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('show');
  }, 3000);
});

const installCta = document.getElementById('install-cta');
if (installCta) {
  installCta.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('App installed successfully!', 'success');
    }
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
  showToast('ElaraPay installed as app', 'success');
});
