/**
 * pomodoro.js — Pure logic: timer state, session management, stats.
 * No DOM, no side effects.
 */

export const DEFAULTS = {
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  cyclesBeforeLong: 4,
};

export const CATEGORIES = ['Work', 'Study', 'Exercise', 'Other'];

/**
 * Create a new session object.
 * @param {string} category
 * @param {number} duration  seconds
 * @returns {object}
 */
export function createSession(category, duration) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category,
    duration,
    remaining: duration,
    status: 'idle',       // idle | running | completed | abandoned
    startedAt: null,
    completedAt: null,
  };
}

/**
 * Transition a session to running.
 * @param {object} session
 * @returns {object} new session
 */
export function startSession(session) {
  return { ...session, status: 'running', startedAt: Date.now() };
}

/**
 * Advance the remaining time by elapsed seconds.
 * Does not mutate. Remaining never goes below 0.
 * @param {object} session
 * @param {number} elapsed  seconds (positive)
 * @returns {object} new session
 */
export function tickSession(session, elapsed) {
  const remaining = Math.max(0, session.remaining - elapsed);
  return { ...session, remaining };
}

/**
 * Mark session as completed.
 * @param {object} session
 * @returns {object} new session
 */
export function completeSession(session) {
  return { ...session, status: 'completed', completedAt: Date.now() };
}

/**
 * Mark session as abandoned.
 * @param {object} session
 * @returns {object} new session
 */
export function abandonSession(session) {
  return { ...session, status: 'abandoned', completedAt: Date.now() };
}

/**
 * Determine next phase after completedCount work sessions.
 * Pattern: work(0) → break → work(1) → break → work(2) → break → work(3) → longBreak → repeat
 * completedCount is the number of work sessions completed so far (before next phase starts).
 * @param {number} completedCount
 * @returns {'work'|'break'|'longBreak'}
 */
export function getNextPhase(completedCount) {
  if (completedCount === 0) return 'work';
  if (completedCount % DEFAULTS.cyclesBeforeLong === 0) return 'longBreak';
  return 'break';
}

/**
 * Compute weekly stats from a session log.
 * Only counts sessions with status 'completed' that started within the last 7 days.
 * @param {object[]} sessions
 * @returns {{ totalByCategory: object, dailyCounts: object, totalMinutes: number }}
 */
export function computeWeeklyStats(sessions) {
  const totalByCategory = {};
  const dailyCounts = {};
  let totalMinutes = 0;

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    if (!s.startedAt) continue;
    if (now - s.startedAt > weekMs) continue;

    const minutes = s.duration / 60;
    totalMinutes += minutes;

    const cat = s.category ?? 'Other';
    totalByCategory[cat] = (totalByCategory[cat] ?? 0) + minutes;

    const day = new Date(s.startedAt).toISOString().slice(0, 10); // YYYY-MM-DD
    dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
  }

  return { totalByCategory, dailyCounts, totalMinutes };
}
