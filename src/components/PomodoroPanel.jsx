import React, { useState, useEffect, useRef, useCallback } from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 120; // r = 120

function PomodoroPanel() {
  const [mode, setMode] = useState('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [settings, setSettings] = useState({ focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 });
  const [sessionCount, setSessionCount] = useState(0);

  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const modeRef = useRef(mode);
  const todayCountRef = useRef(todayCount);
  const sessionCountRef = useRef(sessionCount);
  const settingsRef = useRef(settings);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { todayCountRef.current = todayCount; }, [todayCount]);
  useEffect(() => { sessionCountRef.current = sessionCount; }, [sessionCount]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    async function load() {
      if (window.electronAPI) {
        const saved = await window.electronAPI.store.get('pomodoro');
        if (saved) {
          if (saved.focusMinutes) setSettings(saved);
          const today = new Date().toDateString();
          if (saved.date === today) {
            setTodayCount(saved.todayCount || 0);
          }
          if (saved.settings) setSettings(saved.settings);
        }
      }
    }
    load();
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const mins = mode === 'focus' ? settingsRef.current.focusMinutes
      : mode === 'longBreak' ? settingsRef.current.longBreakMinutes
      : settingsRef.current.breakMinutes;
    setTotalTime(mins * 60);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    clearInterval(intervalRef.current);
  }, [mode]);

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    playBeep();

    const m = modeRef.current;
    if (window.electronAPI) {
      window.electronAPI.notify({
        title: '🍅 番茄钟',
        body: m === 'focus' ? '专注时间结束！休息一下吧~' : '休息结束！继续加油~',
      });
    }

    if (m === 'focus') {
      const newCount = todayCountRef.current + 1;
      setTodayCount(newCount);
      const newSessionCount = sessionCountRef.current + 1;
      setSessionCount(newSessionCount);

      const today = new Date().toDateString();
      if (window.electronAPI) {
        window.electronAPI.store.set('pomodoro', {
          ...settingsRef.current,
          todayCount: newCount,
          date: today,
          settings: settingsRef.current,
        });
      }

      if (newSessionCount >= settingsRef.current.sessionsBeforeLongBreak) {
        setSessionCount(0);
        setMode('longBreak');
      } else {
        setMode('break');
      }
    } else {
      setMode('focus');
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const playBeep = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      [440, 554, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.3);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.3);
      });
    } catch (e) { /* ignore */ }
  };

  const toggleTimer = () => setIsRunning(r => !r);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(totalTime);
  };

  const progress = 1 - timeLeft / totalTime;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const formatTime = secs => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };


  return (
    <div>
      <div className="panel-header">
        <h1 className="panel-header__title">番茄钟</h1>
        <div className="panel-header__actions">
          <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🍅 今日: {todayCount} 个番茄
          </span>
        </div>
      </div>

      <div className="pomodoro-container">
        <div className={`pomodoro-timer ${mode !== 'focus' ? 'pomodoro-timer--break' : ''}`}>
          <svg className="pomodoro-timer__svg" viewBox="0 0 260 260">
            <circle className="pomodoro-timer__bg" cx="130" cy="130" r="120" />
            <circle
              className="pomodoro-timer__progress"
              cx="130" cy="130" r="120"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="pomodoro-timer__content">
            <span className="pomodoro-timer__time">{formatTime(timeLeft)}</span>
            <span className="pomodoro-timer__label">
              {isRunning ? (mode === 'focus' ? '专注中...' : '休息中...') : '准备开始'}
            </span>
          </div>
        </div>

        <div className="pomodoro-mode-switch">
          <button
            className={`pomodoro-mode-btn pomodoro-mode-btn--focus ${mode === 'focus' ? 'pomodoro-mode-btn--active' : ''}`}
            onClick={() => setMode('focus')}
          >
            🎯 专注
          </button>
          <button
            className={`pomodoro-mode-btn pomodoro-mode-btn--break ${mode === 'break' ? 'pomodoro-mode-btn--active' : ''}`}
            onClick={() => setMode('break')}
          >
            ☕ 短休
          </button>
          <button
            className={`pomodoro-mode-btn pomodoro-mode-btn--break ${mode === 'longBreak' ? 'pomodoro-mode-btn--active' : ''}`}
            onClick={() => setMode('longBreak')}
          >
            🌿 长休
          </button>
        </div>

        <div className="pomodoro-controls">
          <button className="btn btn--primary btn--lg" onClick={toggleTimer} style={{ minWidth: 120 }}>
            {isRunning ? '⏸ 暂停' : '▶ 开始'}
          </button>
          <button className="btn btn--lg" onClick={resetTimer}>↺ 重置</button>
        </div>

        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span>🎯 专注: {settings.focusMinutes} 分钟</span>
          <span>☕ 短休: {settings.breakMinutes} 分钟</span>
          <span>🌿 长休: {settings.longBreakMinutes} 分钟</span>
          <span>📊 {settings.sessionsBeforeLongBreak} 轮后长休</span>
        </div>
      </div>
    </div>
  );
}

export default PomodoroPanel;
