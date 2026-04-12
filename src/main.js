/**
 * main.js — DOM, events, rendering, timer loop.
 * Imports: pomodoro.js (logic), i18n.js (translations).
 */

import {
  DEFAULTS,
  CATEGORIES,
  createSession,
  startSession,
  tickSession,
  completeSession,
  abandonSession,
  getNextPhase,
  computeWeeklyStats,
} from './pomodoro.js';

import { t, getLang, setLang } from './i18n.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_SESSIONS = 'pomodoro-sessions';
const STORAGE_SETTINGS = 'pomodoro-settings';
const STORAGE_THEME    = 'pomodoro-theme';
const STORAGE_LANG     = 'pomodoro-lang';
const MAX_LOG_ENTRIES  = 50;
const SVG_R            = 54;   // circle radius (viewBox 120×120, cx=cy=60)
const SVG_CIRCUMFERENCE = 2 * Math.PI * SVG_R;

// ── App State ─────────────────────────────────────────────────────────────────

let settings = { ...DEFAULTS };
let currentPhase  = 'work';       // 'work' | 'break' | 'longBreak'
let completedWork = 0;            // # of completed work sessions in current set
let totalCompleted = 0;           // lifetime work sessions (for phase cycling)
let currentSession = null;
let sessions = [];                // session log (all time)
let timerInterval = null;
let lastTick = null;
let currentCategory = CATEGORIES[0];
let activeTab = 'timer';          // 'timer' | 'log' | 'stats'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n) { return String(Math.floor(n)).padStart(2, '0'); }

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function phaseDuration(phase) {
  if (phase === 'work')      return settings.workDuration;
  if (phase === 'break')     return settings.breakDuration;
  if (phase === 'longBreak') return settings.longBreakDuration;
  return settings.workDuration;
}

function phaseLabel(phase) {
  if (phase === 'work')      return t('work');
  if (phase === 'break')     return t('break');
  if (phase === 'longBreak') return t('longBreak');
  return t('work');
}

function isRunning() {
  return currentSession && currentSession.status === 'running';
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS);
    if (raw) sessions = JSON.parse(raw);
  } catch (_) {
    sessions = [];
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(sessions.slice(-MAX_LOG_ENTRIES)));
  } catch (_) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  } catch (_) {}
}

// ── Notifications & Audio ─────────────────────────────────────────────────────

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '' });
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

// ── Timer Control ─────────────────────────────────────────────────────────────

function startTimer() {
  if (!currentSession) {
    currentSession = createSession(currentCategory, phaseDuration(currentPhase));
  }
  currentSession = startSession(currentSession);
  lastTick = Date.now();
  timerInterval = setInterval(tick, 500);
  render();
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  render();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  if (currentSession && currentSession.status === 'running') {
    const abandoned = abandonSession(currentSession);
    sessions.push(abandoned);
    saveSessions();
  }
  currentSession = createSession(currentCategory, phaseDuration(currentPhase));
  render();
}

function skipPhase() {
  clearInterval(timerInterval);
  timerInterval = null;
  if (currentSession && currentSession.status === 'running') {
    const abandoned = abandonSession(currentSession);
    sessions.push(abandoned);
    saveSessions();
  }
  advancePhase();
  currentSession = createSession(currentCategory, phaseDuration(currentPhase));
  render();
}

function tick() {
  const now = Date.now();
  const elapsed = (now - lastTick) / 1000;
  lastTick = now;

  currentSession = tickSession(currentSession, elapsed);
  render();

  if (currentSession.remaining <= 0) {
    onTimerComplete();
  }
}

function onTimerComplete() {
  clearInterval(timerInterval);
  timerInterval = null;

  playBeep();

  const completed = completeSession(currentSession);
  sessions.push(completed);
  saveSessions();
  currentSession = null;

  if (currentPhase === 'work') {
    totalCompleted += 1;
    completedWork = totalCompleted % settings.cyclesBeforeLong;

    const notifyBody = t('workComplete');
    sendNotification(t('timerComplete'), notifyBody);
  } else {
    sendNotification(t('timerComplete'), t('breakComplete'));
  }

  advancePhase();
  currentSession = createSession(currentCategory, phaseDuration(currentPhase));
  render();
}

function advancePhase() {
  if (currentPhase === 'work') {
    const next = getNextPhase(totalCompleted);
    currentPhase = next === 'work' ? 'break' : next;
    // if getNextPhase returns 'work', we just finished a longBreak cycle — use break
    if (next === 'work') currentPhase = 'break'; // safety (shouldn't happen mid-flow)
  } else {
    currentPhase = 'work';
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderTimer();
  renderCategoryPills();
  renderCycleDots();
  renderControls();
  renderPhaseLabel();
  updateI18n();
}

function renderTimer() {
  const total     = currentSession ? currentSession.duration : phaseDuration(currentPhase);
  const remaining = currentSession ? Math.ceil(currentSession.remaining) : total;
  const progress  = total > 0 ? 1 - remaining / total : 0;

  // Digital time
  const timeEl = document.getElementById('time-display');
  if (timeEl) timeEl.textContent = formatTime(remaining);

  // SVG ring
  const ring = document.getElementById('progress-ring');
  if (ring) {
    const offset = SVG_CIRCUMFERENCE * (1 - progress);
    ring.style.strokeDashoffset = offset.toFixed(2);
  }

  // Document title
  document.title = `${formatTime(remaining)} — ${phaseLabel(currentPhase)}`;
}

function renderPhaseLabel() {
  const el = document.getElementById('phase-label');
  if (el) el.textContent = phaseLabel(currentPhase);
}

function renderCategoryPills() {
  CATEGORIES.forEach((cat, i) => {
    const btn = document.getElementById(`cat-${i}`);
    if (!btn) return;
    btn.textContent = t(cat);
    btn.classList.toggle('active', cat === currentCategory);
    btn.setAttribute('aria-pressed', cat === currentCategory ? 'true' : 'false');
  });
}

function renderCycleDots() {
  const container = document.getElementById('cycle-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < settings.cyclesBeforeLong; i++) {
    const dot = document.createElement('span');
    dot.className = 'cycle-dot';
    const filled = (totalCompleted % settings.cyclesBeforeLong);
    dot.classList.toggle('filled', i < filled);
    dot.setAttribute('aria-label', i < filled ? 'done' : 'pending');
    container.appendChild(dot);
  }
}

function renderControls() {
  const startBtn = document.getElementById('btn-start');
  const resetBtn = document.getElementById('btn-reset');
  if (!startBtn) return;

  if (isRunning()) {
    startBtn.textContent = t('pause');
    startBtn.setAttribute('aria-label', t('pause'));
  } else {
    startBtn.textContent = t('start');
    startBtn.setAttribute('aria-label', t('start'));
  }
}

function renderLog() {
  const tbody = document.getElementById('log-tbody');
  if (!tbody) return;
  const recent = sessions.slice(-20).reverse();
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="log-empty">${t('noSessions')}</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(s => {
    const date = s.startedAt ? new Date(s.startedAt).toLocaleString(getLang() === 'ja' ? 'ja-JP' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const dur  = `${Math.round(s.duration / 60)}${t('minutes')}`;
    const status = s.status === 'completed' ? `<span class="badge badge-done">${t('completed')}</span>` : `<span class="badge badge-abandon">${t('abandoned')}</span>`;
    return `<tr>
      <td>${date}</td>
      <td>${t(s.category)}</td>
      <td>${dur}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function renderStats() {
  const stats = computeWeeklyStats(sessions);

  // Total minutes
  const totalEl = document.getElementById('stats-total');
  if (totalEl) totalEl.textContent = `${Math.round(stats.totalMinutes)} ${t('minutes')}`;

  // Category breakdown
  const catList = document.getElementById('stats-by-category');
  if (catList) {
    const max = Math.max(...Object.values(stats.totalByCategory), 1);
    catList.innerHTML = CATEGORIES.map(cat => {
      const mins = Math.round(stats.totalByCategory[cat] ?? 0);
      const pct  = ((stats.totalByCategory[cat] ?? 0) / max * 100).toFixed(1);
      return `<li class="stat-row">
        <span class="stat-label">${t(cat)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="stat-value">${mins}${t('minutes')}</span>
      </li>`;
    }).join('');
  }

  // Daily counts (last 7 days)
  const dailyEl = document.getElementById('stats-daily');
  if (dailyEl) {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const maxCount = Math.max(...days.map(d => stats.dailyCounts[d.toISOString().slice(0, 10)] ?? 0), 1);
    dailyEl.innerHTML = days.map(d => {
      const key   = d.toISOString().slice(0, 10);
      const count = stats.dailyCounts[key] ?? 0;
      const pct   = (count / maxCount * 100).toFixed(1);
      const label = t(`day_${d.getDay()}`);
      return `<div class="day-col">
        <div class="day-bar-wrap"><div class="day-bar" style="height:${pct}%"></div></div>
        <span class="day-count">${count}</span>
        <span class="day-label">${label}</span>
      </div>`;
    }).join('');
  }
}

function updateI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  renderPhaseLabel();
}

// ── Settings Modal ─────────────────────────────────────────────────────────────

function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  document.getElementById('set-work').value       = Math.round(settings.workDuration / 60);
  document.getElementById('set-break').value      = Math.round(settings.breakDuration / 60);
  document.getElementById('set-long').value       = Math.round(settings.longBreakDuration / 60);
  document.getElementById('set-cycles').value     = settings.cyclesBeforeLong;

  modal.style.display = 'flex';
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.style.display = 'none';
}

function applySettings() {
  const work   = parseInt(document.getElementById('set-work').value, 10);
  const brk    = parseInt(document.getElementById('set-break').value, 10);
  const lng    = parseInt(document.getElementById('set-long').value, 10);
  const cycles = parseInt(document.getElementById('set-cycles').value, 10);

  if (isNaN(work) || work < 1 || work > 120) return;
  if (isNaN(brk)  || brk  < 1 || brk  > 60)  return;
  if (isNaN(lng)  || lng  < 1 || lng  > 60)   return;
  if (isNaN(cycles) || cycles < 1 || cycles > 10) return;

  // Stop any running timer
  if (isRunning()) pauseTimer();

  settings.workDuration      = work * 60;
  settings.breakDuration     = brk  * 60;
  settings.longBreakDuration = lng  * 60;
  settings.cyclesBeforeLong  = cycles;
  saveSettings();

  currentSession = createSession(currentCategory, phaseDuration(currentPhase));
  closeSettings();
  render();
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? t('lightMode') : t('darkMode');
  try { localStorage.setItem(STORAGE_THEME, theme); } catch (_) {}
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') ?? 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  ['timer', 'log', 'stats'].forEach(id => {
    const panel = document.getElementById(`panel-${id}`);
    const btn   = document.getElementById(`tab-${id}`);
    if (panel) panel.style.display = id === tab ? '' : 'none';
    if (btn)   btn.classList.toggle('active', id === tab);
  });
  if (tab === 'log')   renderLog();
  if (tab === 'stats') renderStats();
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function handleKeydown(e) {
  // Ignore when typing in inputs/textareas
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case ' ':
    case 'Space':
      e.preventDefault();
      if (isRunning()) pauseTimer(); else startTimer();
      break;
    case 'r':
    case 'R':
      e.preventDefault();
      resetTimer();
      break;
    case '1':
      e.preventDefault();
      setCategory(CATEGORIES[0]);
      break;
    case '2':
      e.preventDefault();
      setCategory(CATEGORIES[1]);
      break;
    case '3':
      e.preventDefault();
      setCategory(CATEGORIES[2]);
      break;
    case '4':
      e.preventDefault();
      setCategory(CATEGORIES[3]);
      break;
  }
}

function setCategory(cat) {
  currentCategory = cat;
  if (currentSession) {
    currentSession = { ...currentSession, category: cat };
  }
  renderCategoryPills();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
  // Load persisted data
  loadSessions();
  loadSettings();

  const savedTheme = localStorage.getItem(STORAGE_THEME) ?? 'light';
  applyTheme(savedTheme);

  const savedLang = localStorage.getItem(STORAGE_LANG) ?? 'ja';
  setLang(savedLang);

  // Initial session
  currentSession = createSession(currentCategory, phaseDuration(currentPhase));

  // SVG setup
  const ring = document.getElementById('progress-ring');
  if (ring) {
    ring.style.strokeDasharray = SVG_CIRCUMFERENCE.toFixed(2);
    ring.style.strokeDashoffset = '0';
  }

  // Wire buttons
  document.getElementById('btn-start')?.addEventListener('click', () => {
    if (isRunning()) pauseTimer(); else startTimer();
  });
  document.getElementById('btn-reset')?.addEventListener('click', resetTimer);
  document.getElementById('btn-skip')?.addEventListener('click', skipPhase);
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    const next = getLang() === 'ja' ? 'en' : 'ja';
    setLang(next);
    try { localStorage.setItem(STORAGE_LANG, next); } catch (_) {}
    document.getElementById('lang-toggle').textContent = next === 'ja' ? 'EN' : 'JA';
    render();
    if (activeTab === 'log')   renderLog();
    if (activeTab === 'stats') renderStats();
  });
  document.getElementById('btn-settings')?.addEventListener('click', openSettings);
  document.getElementById('settings-save')?.addEventListener('click', applySettings);
  document.getElementById('settings-cancel')?.addEventListener('click', closeSettings);
  document.getElementById('settings-overlay')?.addEventListener('click', closeSettings);

  // Category pills
  CATEGORIES.forEach((cat, i) => {
    document.getElementById(`cat-${i}`)?.addEventListener('click', () => setCategory(cat));
  });

  // Tabs
  ['timer', 'log', 'stats'].forEach(tab => {
    document.getElementById(`tab-${tab}`)?.addEventListener('click', () => switchTab(tab));
  });

  // Keyboard
  document.addEventListener('keydown', handleKeydown);

  // Request notification permission (user gesture happens on first interaction)
  requestNotificationPermission();

  // Initial render
  render();
  switchTab('timer');
}

document.addEventListener('DOMContentLoaded', init);
