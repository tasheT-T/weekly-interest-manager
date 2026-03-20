
/* ── Storage helpers ───────────────────────────── */
const KEYS = { interests: 'itr_interests', week: 'itr_week', today: 'itr_today' };

const load = key => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } };
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/* ── State ─────────────────────────────────────── */
let interests = load(KEYS.interests) || [];
let weekData = load(KEYS.week) || { weekKey: null, selected: [] };
let todayData = load(KEYS.today) || { date: null, energy: null };

/* ── Week key ──────────────────────────────────── */
function getWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekLabel(key) {
    // e.g. "2025-W14" → "Week 14, 2025"
    const [year, w] = key.split('-W');
    return `Week ${parseInt(w)}, ${year}`;
}

/* ── IDs ───────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ── Energy helpers ────────────────────────────── */
const ENERGY = {
    high: { icon: '🔥', label: 'High', cls: 'high' },
    medium: { icon: '⚡', label: 'Medium', cls: 'medium' },
    low: { icon: '🌿', label: 'Low', cls: 'low' },
};

/* ── Render: Interests ─────────────────────────── */
function renderInterests() {
    const list = document.getElementById('interests-list');
    document.getElementById('count-label').textContent = interests.length ? `(${interests.length})` : '';

    if (!interests.length) {
        list.innerHTML = `<div class="empty-state"><span class="emoji">(ˉ﹃ˉ)</span>No interests yet. Add something you love above.</div>`;
        return;
    }

    list.innerHTML = interests.map(it => {
        const e = ENERGY[it.energy];
        return `<div class="interest-card" data-id="${it.id}">
        <span class="name">${escHtml(it.name)}</span>
        <span class="energy-tag ${e.cls}">${e.icon} ${e.label}</span>
        <button class="delete-btn" title="Remove" onclick="removeInterest('${it.id}')">×</button>
      </div>`;
    }).join('');
}

/* ── Render: This Week ─────────────────────────── */
function renderWeek() {
    const currentWeek = getWeekKey();
    const isNewWeek = weekData.weekKey && weekData.weekKey !== currentWeek;
    const banner = document.getElementById('new-week-banner');
    banner.style.display = isNewWeek ? 'flex' : 'none';

    document.getElementById('week-badge').textContent = weekLabel(currentWeek);

    // Current focus display
    const focusDiv = document.getElementById('current-focus-display');
    const focusIds = weekData.weekKey === currentWeek ? weekData.selected : [];
    const focusItems = focusIds.map(id => interests.find(i => i.id === id)).filter(Boolean);

    if (focusItems.length) {
        focusDiv.innerHTML = `<div class="this-week-display">
        <h3>This week's focus</h3>
        <div class="focus-items">
          ${focusItems.map((it, idx) => {
            const e = ENERGY[it.energy];
            return `<div class="focus-item">
              <span class="focus-num">${idx + 1}.</span>
              <span class="focus-name">${escHtml(it.name)}</span>
              <span class="energy-tag ${e.cls}">${e.icon} ${e.label}</span>
            </div>`;
        }).join('')}
        </div>
      </div>`;
    } else {
        focusDiv.innerHTML = '';
    }

    // Pick list
    const pickList = document.getElementById('pick-list');
    if (!interests.length) {
        pickList.innerHTML = `<div class="empty-state"><span class="emoji">(ˉ﹃ˉ)</span>Add some interests first, then come back to pick your weekly focus.</div>`;
        return;
    }

    pickList.innerHTML = interests.map(it => {
        const e = ENERGY[it.energy];
        const sel = focusIds.includes(it.id);
        const limit = focusIds.length >= 2 && !sel;
        return `<div class="pick-card ${sel ? 'selected' : ''} ${limit ? 'disabled' : ''}"
                   onclick="togglePick('${it.id}')">
        <div class="pick-check">${sel ? '✓' : ''}</div>
        <span class="name">${escHtml(it.name)}</span>
        <span class="energy-tag ${e.cls}">${e.icon} ${e.label}</span>
      </div>`;
    }).join('');
}

/* ── Render: Today ─────────────────────────────── */
function renderToday() {
    const now = new Date();
    document.getElementById('today-date').textContent = now.toLocaleDateString('en-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // energy buttons
    document.querySelectorAll('.energy-set-btn').forEach(btn => {
        btn.className = 'energy-set-btn';
        if (btn.dataset.level === todayData.energy) {
            btn.classList.add(`active-${btn.dataset.level}`);
        }
    });

    const box = document.getElementById('today-suggestions');
    if (!todayData.energy) {
        box.innerHTML = `<div class="no-energy-msg">Set your energy level above to see what's a good match today.</div>`;
        return;
    }

    // Get this week's focus interests
    const currentWeek = getWeekKey();
    const focusIds = weekData.weekKey === currentWeek ? weekData.selected : [];
    const focusItems = focusIds.map(id => interests.find(i => i.id === id)).filter(Boolean);

    if (!focusItems.length) {
        box.innerHTML = `<div class="no-focus-msg">
        You haven't picked your weekly focus yet.<br>Head to <strong>This Week</strong> to choose up to 2 interests.
      </div>`;
        return;
    }

    const matching = focusItems.filter(it => it.energy === todayData.energy);
    const others = focusItems.filter(it => it.energy !== todayData.energy);
    const eInfo = ENERGY[todayData.energy];

    let html = `<h3>What to do today</h3>
      <p>Your energy is <strong>${eInfo.icon} ${eInfo.label}</strong> — here's how your focus interests align.</p>`;

    if (matching.length) {
        html += matching.map(it => {
            const e = ENERGY[it.energy];
            return `<div class="suggestion-item ${e.cls}">
          <span>${e.icon}</span>
          <span class="sug-name">${escHtml(it.name)}</span>
          <span style="font-size:.78rem;color:var(--ink-muted)">Perfect match</span>
        </div>`;
        }).join('');
    }

    if (others.length) {
        html += `<div style="margin-top:12px;font-size:.82rem;color:var(--ink-muted);font-weight:300;margin-bottom:8px">
        ${matching.length ? 'Other' : 'Your'} focus interest${others.length > 1 ? 's' : ''} this week:
      </div>`;
        html += others.map(it => {
            const e = ENERGY[it.energy];
            const note = it.energy === 'high' && todayData.energy !== 'high'
                ? 'Save for high energy' : it.energy === 'low' && todayData.energy !== 'low'
                    ? 'Good for low energy' : '';
            return `<div class="suggestion-item ${e.cls}" style="opacity:.65">
          <span>${e.icon}</span>
          <span class="sug-name">${escHtml(it.name)}</span>
          <span style="font-size:.78rem;color:var(--ink-muted)">${note}</span>
        </div>`;
        }).join('');
    }

    box.innerHTML = html;
}

/* ── Actions ───────────────────────────────────── */
function addInterest() {
    const input = document.getElementById('interest-input');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }

    const energy = document.querySelector('input[name="energy"]:checked').value;
    interests.push({ id: uid(), name, energy });
    save(KEYS.interests, interests);
    input.value = '';
    input.focus();
    renderInterests();
    renderWeek();
}

function removeInterest(id) {
    interests = interests.filter(i => i.id !== id);
    weekData.selected = weekData.selected.filter(sid => sid !== id);
    save(KEYS.interests, interests);
    save(KEYS.week, weekData);
    renderInterests();
    renderWeek();
    renderToday();
}

function togglePick(id) {
    const currentWeek = getWeekKey();
    // ensure weekKey is current
    if (weekData.weekKey !== currentWeek) {
        weekData = { weekKey: currentWeek, selected: [] };
    }

    if (weekData.selected.includes(id)) {
        weekData.selected = weekData.selected.filter(s => s !== id);
    } else {
        if (weekData.selected.length >= 2) return;
        weekData.selected.push(id);
        if (weekData.selected.length === 1 && !weekData.weekKey) weekData.weekKey = currentWeek;
    }
    weekData.weekKey = currentWeek;
    save(KEYS.week, weekData);
    renderWeek();
    renderToday();
}

function setTodayEnergy(level) {
    const today = new Date().toISOString().slice(0, 10);
    todayData = { date: today, energy: level };
    save(KEYS.today, todayData);
    renderToday();
}

/* ── Tabs ──────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
    });
});

/* ── Event listeners ───────────────────────────── */
document.getElementById('add-btn').addEventListener('click', addInterest);
document.getElementById('interest-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addInterest();
});

document.querySelectorAll('.energy-set-btn').forEach(btn => {
    btn.addEventListener('click', () => setTodayEnergy(btn.dataset.level));
});

/* ── Init ──────────────────────────────────────── */
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Reset today energy if it's a new day
const todayStr = new Date().toISOString().slice(0, 10);
if (todayData.date !== todayStr) {
    todayData = { date: todayStr, energy: null };
    save(KEYS.today, todayData);
}

renderInterests();
renderWeek();
renderToday();
