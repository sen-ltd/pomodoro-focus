/**
 * i18n.js — Japanese / English translations.
 */

const translations = {
  ja: {
    title: 'ポモドーロ集中タイマー',
    work: '集中',
    break: '休憩',
    longBreak: '長休憩',
    start: '開始',
    pause: '一時停止',
    reset: 'リセット',
    skip: 'スキップ',
    category: 'カテゴリ',
    Work: '仕事',
    Study: '学習',
    Exercise: '運動',
    Other: 'その他',
    sessionLog: 'セッション履歴',
    weeklyStats: '週次集計',
    noSessions: '履歴なし',
    totalFocus: '総集中時間',
    minutes: '分',
    completed: '完了',
    abandoned: '中断',
    phase: 'フェーズ',
    cycle: 'サイクル',
    settings: '設定',
    workDuration: '集中時間（分）',
    breakDuration: '休憩時間（分）',
    longBreakDuration: '長休憩時間（分）',
    cyclesBeforeLong: '長休憩までのサイクル数',
    save: '保存',
    cancel: 'キャンセル',
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    notifyPermission: '通知を許可すると、タイマー終了をお知らせします',
    timerComplete: 'タイマー終了！',
    workComplete: '集中セッションが完了しました',
    breakComplete: '休憩終了。集中を再開しましょう',
    day_0: '日',
    day_1: '月',
    day_2: '火',
    day_3: '水',
    day_4: '木',
    day_5: '金',
    day_6: '土',
    sessionCount: 'セッション数',
    keyboardHelp: 'Space: 開始/一時停止　R: リセット　1-4: カテゴリ切替',
  },
  en: {
    title: 'Pomodoro Focus Timer',
    work: 'Work',
    break: 'Break',
    longBreak: 'Long Break',
    start: 'Start',
    pause: 'Pause',
    reset: 'Reset',
    skip: 'Skip',
    category: 'Category',
    Work: 'Work',
    Study: 'Study',
    Exercise: 'Exercise',
    Other: 'Other',
    sessionLog: 'Session Log',
    weeklyStats: 'Weekly Stats',
    noSessions: 'No sessions yet',
    totalFocus: 'Total Focus',
    minutes: 'min',
    completed: 'Completed',
    abandoned: 'Abandoned',
    phase: 'Phase',
    cycle: 'Cycle',
    settings: 'Settings',
    workDuration: 'Work Duration (min)',
    breakDuration: 'Break Duration (min)',
    longBreakDuration: 'Long Break Duration (min)',
    cyclesBeforeLong: 'Cycles Before Long Break',
    save: 'Save',
    cancel: 'Cancel',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    notifyPermission: 'Allow notifications to get alerted when the timer ends',
    timerComplete: 'Timer Complete!',
    workComplete: 'Work session complete',
    breakComplete: 'Break over. Time to focus!',
    day_0: 'Sun',
    day_1: 'Mon',
    day_2: 'Tue',
    day_3: 'Wed',
    day_4: 'Thu',
    day_5: 'Fri',
    day_6: 'Sat',
    sessionCount: 'Sessions',
    keyboardHelp: 'Space: Start/Pause  R: Reset  1-4: Switch category',
  },
};

let currentLang = 'ja';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (translations[lang]) currentLang = lang;
}

export function t(key) {
  return translations[currentLang][key] ?? translations['en'][key] ?? key;
}
