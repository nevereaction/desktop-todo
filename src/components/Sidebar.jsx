import React from 'react';

const NAV_ITEMS = [
  { key: 'todo', icon: '✅', label: '待办清单' },
  { key: 'pomodoro', icon: '🍅', label: '番茄钟' },
  { key: 'notes', icon: '📝', label: '便签' },
  { key: 'music', icon: '🎵', label: '音乐' },
];

function Sidebar({ activePanel, onPanelChange, theme, onToggleTheme, todoCount }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">✦</div>
        <span>桌面待办</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`sidebar__nav-item ${activePanel === item.key ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => onPanelChange(item.key)}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.key === 'todo' && todoCount > 0 && (
              <span className="sidebar__nav-badge">{todoCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <button className="sidebar__theme-btn" onClick={onToggleTheme}>
          <span className="sidebar__nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
