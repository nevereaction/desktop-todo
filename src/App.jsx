import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TodoPanel from './components/TodoPanel';
import PomodoroPanel from './components/PomodoroPanel';
import NotesPanel from './components/NotesPanel';
import MusicPanel from './components/MusicPanel';

const PANELS = {
  todo: '待办清单',
  pomodoro: '番茄钟',
  notes: '便签',
  music: '媒体',
};

function App() {
  const [activePanel, setActivePanel] = useState('todo');
  const [theme, setTheme] = useState('dark');
  const [todoCount, setTodoCount] = useState(0);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    async function load() {
      if (window.electronAPI) {
        const saved = await window.electronAPI.store.get('theme');
        if (saved) setTheme(saved);
      }
    }
    load();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (window.electronAPI) window.electronAPI.store.set('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'todo':
        return <TodoPanel todos={todos} setTodos={setTodos} setTodoCount={setTodoCount} />;
      case 'pomodoro':
        return <PomodoroPanel />;
      case 'notes':
        return <NotesPanel />;
      case 'music':
        return <MusicPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <TitleBar />
      <Sidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        theme={theme}
        onToggleTheme={toggleTheme}
        todoCount={todoCount}
      />
      <main className="main-content">
        {renderPanel()}
      </main>
    </div>
  );
}

function TitleBar() {
  const [pinned, setPinned] = useState(false);

  const handleMinimize = () => window.electronAPI?.window.minimize();
  const handleMaximize = () => window.electronAPI?.window.maximize();
  const handleClose = () => window.electronAPI?.window.close();

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    window.electronAPI?.window.setAlwaysOnTop(next);
  };

  return (
    <div className="title-bar">
      <span className="title-bar__text">桌面待办</span>
      <div className="title-bar__actions">
        <button
          className={`title-bar__pin ${pinned ? 'title-bar__pin--active' : ''}`}
          onClick={togglePin}
          title={pinned ? '取消置顶' : '置顶窗口'}
        >
          📌
        </button>
        <button className="title-bar__btn title-bar__btn--minimize" onClick={handleMinimize} title="最小化" />
        <button className="title-bar__btn title-bar__btn--maximize" onClick={handleMaximize} title="最大化" />
        <button className="title-bar__btn title-bar__btn--close" onClick={handleClose} title="关闭" />
      </div>
    </div>
  );
}

export default App;
