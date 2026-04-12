/**
 * pomodoro.test.js — Unit tests for pomodoro.js pure logic.
 * Run with: node --test tests/pomodoro.test.js
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

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
} from '../src/pomodoro.js';

// ── createSession ──────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with correct fields', () => {
    const s = createSession('Work', 1500);
    assert.equal(s.category, 'Work');
    assert.equal(s.duration, 1500);
    assert.equal(s.remaining, 1500);
    assert.equal(s.status, 'idle');
    assert.equal(s.startedAt, null);
    assert.equal(s.completedAt, null);
    assert.ok(typeof s.id === 'string' && s.id.length > 0);
  });

  it('each session gets a unique id', () => {
    const s1 = createSession('Work', 1500);
    const s2 = createSession('Work', 1500);
    assert.notEqual(s1.id, s2.id);
  });
});

// ── startSession ───────────────────────────────────────────────────────────

describe('startSession', () => {
  it('sets status to running and records startedAt', () => {
    const before = Date.now();
    const s = startSession(createSession('Study', 300));
    const after = Date.now();
    assert.equal(s.status, 'running');
    assert.ok(s.startedAt >= before && s.startedAt <= after);
  });

  it('does not mutate original session', () => {
    const orig = createSession('Work', 1500);
    startSession(orig);
    assert.equal(orig.status, 'idle');
    assert.equal(orig.startedAt, null);
  });
});

// ── tickSession ────────────────────────────────────────────────────────────

describe('tickSession', () => {
  it('decrements remaining by elapsed', () => {
    const s = tickSession({ ...createSession('Work', 1500), status: 'running' }, 10);
    assert.equal(s.remaining, 1490);
  });

  it('does not mutate original session', () => {
    const orig = { ...createSession('Work', 1500), status: 'running' };
    tickSession(orig, 5);
    assert.equal(orig.remaining, 1500);
  });

  it('remaining never goes below 0', () => {
    const s = tickSession({ ...createSession('Work', 5), status: 'running' }, 100);
    assert.equal(s.remaining, 0);
  });

  it('remaining stays 0 when already 0', () => {
    const s = tickSession({ ...createSession('Work', 0), remaining: 0 }, 10);
    assert.equal(s.remaining, 0);
  });
});

// ── completeSession ────────────────────────────────────────────────────────

describe('completeSession', () => {
  it('sets status to completed and records completedAt', () => {
    const before = Date.now();
    const s = completeSession(createSession('Work', 1500));
    const after = Date.now();
    assert.equal(s.status, 'completed');
    assert.ok(s.completedAt >= before && s.completedAt <= after);
  });
});

// ── abandonSession ─────────────────────────────────────────────────────────

describe('abandonSession', () => {
  it('sets status to abandoned and records completedAt', () => {
    const before = Date.now();
    const s = abandonSession(createSession('Work', 1500));
    const after = Date.now();
    assert.equal(s.status, 'abandoned');
    assert.ok(s.completedAt >= before && s.completedAt <= after);
  });
});

// ── getNextPhase ───────────────────────────────────────────────────────────

describe('getNextPhase', () => {
  it('returns work when completedCount is 0', () => {
    assert.equal(getNextPhase(0), 'work');
  });

  it('returns break after 1 completed work session', () => {
    assert.equal(getNextPhase(1), 'break');
  });

  it('returns break after 2 completed work sessions', () => {
    assert.equal(getNextPhase(2), 'break');
  });

  it('returns break after 3 completed work sessions', () => {
    assert.equal(getNextPhase(3), 'break');
  });

  it('returns longBreak after 4 completed work sessions', () => {
    assert.equal(getNextPhase(4), 'longBreak');
  });

  it('returns break after 5 completed work sessions (new cycle)', () => {
    assert.equal(getNextPhase(5), 'break');
  });

  it('returns longBreak after 8 completed work sessions (second long break)', () => {
    assert.equal(getNextPhase(8), 'longBreak');
  });

  it('returns break after 9 (new cycle continues)', () => {
    assert.equal(getNextPhase(9), 'break');
  });
});

// ── computeWeeklyStats ─────────────────────────────────────────────────────

describe('computeWeeklyStats', () => {
  it('returns zeros for empty sessions array', () => {
    const stats = computeWeeklyStats([]);
    assert.deepEqual(stats.totalByCategory, {});
    assert.deepEqual(stats.dailyCounts, {});
    assert.equal(stats.totalMinutes, 0);
  });

  it('ignores abandoned sessions', () => {
    const s = {
      ...createSession('Work', 1500),
      status: 'abandoned',
      startedAt: Date.now(),
    };
    const stats = computeWeeklyStats([s]);
    assert.equal(stats.totalMinutes, 0);
  });

  it('ignores sessions older than 7 days', () => {
    const s = {
      ...createSession('Work', 1500),
      status: 'completed',
      startedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    };
    const stats = computeWeeklyStats([s]);
    assert.equal(stats.totalMinutes, 0);
  });

  it('counts completed sessions from the last 7 days', () => {
    const s = {
      ...createSession('Work', 1500),
      status: 'completed',
      startedAt: Date.now(),
    };
    const stats = computeWeeklyStats([s]);
    assert.equal(stats.totalMinutes, 25);   // 1500s / 60 = 25 min
    assert.equal(stats.totalByCategory['Work'], 25);
  });

  it('accumulates multiple categories', () => {
    const now = Date.now();
    const s1 = { ...createSession('Work',    1500), status: 'completed', startedAt: now };
    const s2 = { ...createSession('Study',   3000), status: 'completed', startedAt: now };
    const s3 = { ...createSession('Study',   1500), status: 'completed', startedAt: now };
    const stats = computeWeeklyStats([s1, s2, s3]);
    assert.equal(stats.totalByCategory['Work'],  25);
    assert.equal(stats.totalByCategory['Study'], 75);
    assert.equal(stats.totalMinutes, 100);
  });

  it('counts daily session counts', () => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const s1 = { ...createSession('Work', 1500), status: 'completed', startedAt: now };
    const s2 = { ...createSession('Work', 1500), status: 'completed', startedAt: now };
    const stats = computeWeeklyStats([s1, s2]);
    assert.equal(stats.dailyCounts[today], 2);
  });
});

// ── DEFAULTS and CATEGORIES exports ───────────────────────────────────────

describe('DEFAULTS', () => {
  it('exposes workDuration of 25 minutes', () => {
    assert.equal(DEFAULTS.workDuration, 25 * 60);
  });
  it('exposes breakDuration of 5 minutes', () => {
    assert.equal(DEFAULTS.breakDuration, 5 * 60);
  });
  it('exposes longBreakDuration of 15 minutes', () => {
    assert.equal(DEFAULTS.longBreakDuration, 15 * 60);
  });
  it('exposes cyclesBeforeLong of 4', () => {
    assert.equal(DEFAULTS.cyclesBeforeLong, 4);
  });
});

describe('CATEGORIES', () => {
  it('contains exactly Work, Study, Exercise, Other', () => {
    assert.deepEqual(CATEGORIES, ['Work', 'Study', 'Exercise', 'Other']);
  });
});
