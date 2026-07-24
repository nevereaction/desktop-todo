import React, { useState, useEffect, useCallback } from 'react';

let nextId = Date.now();

function TodoPanel({ todos, setTodos, setTodoCount }) {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | completed

  useEffect(() => {
    async function load() {
      if (window.electronAPI) {
        const saved = await window.electronAPI.store.get('todos');
        if (saved && saved.length > 0) setTodos(saved);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (window.electronAPI) window.electronAPI.store.set('todos', todos);
    setTodoCount(todos.filter(t => !t.completed).length);
  }, [todos]);

  const addTodo = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [...prev, {
      id: nextId++,
      text,
      completed: false,
      priority: 'medium',
      createdAt: Date.now(),
    }]);
    setInput('');
  }, [input]);

  const handleKeyDown = e => {
    if (e.key === 'Enter') addTodo();
  };

  const toggleTodo = useCallback(id => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }, []);

  const deleteTodo = useCallback(id => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const setPriority = useCallback((id, priority) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
  }, []);

  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const remaining = todos.filter(t => !t.completed).length;
  const completed = todos.filter(t => t.completed).length;

  return (
    <div>
      <div className="panel-header">
        <h1 className="panel-header__title">待办清单</h1>
        <div className="panel-header__actions">
          <button className={`btn btn--sm ${filter === 'all' ? 'btn--primary' : ''}`} onClick={() => setFilter('all')}>全部</button>
          <button className={`btn btn--sm ${filter === 'active' ? 'btn--primary' : ''}`} onClick={() => setFilter('active')}>未完成</button>
          <button className={`btn btn--sm ${filter === 'completed' ? 'btn--primary' : ''}`} onClick={() => setFilter('completed')}>已完成</button>
        </div>
      </div>

      <div className="todo-input-row">
        <input
          className="input"
          type="text"
          placeholder="添加新的待办事项..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn--primary" onClick={addTodo}>添加</button>
      </div>

      <div className="todo-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">
              {filter === 'all' ? '还没有待办事项，添加一个吧' : filter === 'active' ? '所有事项都完成了 🎉' : '还没有已完成的事项'}
            </div>
          </div>
        ) : (
          filtered.map(todo => (
            <div key={todo.id} className={`todo-item ${todo.completed ? 'todo-item--completed' : ''}`}>
              <button className="todo-item__checkbox" onClick={() => toggleTodo(todo.id)}>
                {todo.completed ? '✓' : ''}
              </button>
              <span className="todo-item__text">{todo.text}</span>
              <div
                className={`todo-item__priority todo-item__priority--${todo.priority}`}
                onClick={() => {
                  const next = todo.priority === 'high' ? 'low' : todo.priority === 'low' ? 'medium' : 'high';
                  setPriority(todo.id, next);
                }}
                title={`优先级: ${todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'} (点击切换)`}
              />
              <button className="todo-item__delete" onClick={() => deleteTodo(todo.id)}>✕</button>
            </div>
          ))
        )}
      </div>

      {todos.length > 0 && (
        <div className="todo-stats">
          <span>📌 {remaining} 项待完成</span>
          <span>✅ {completed} 项已完成</span>
          <span>📊 {todos.length} 项总计</span>
        </div>
      )}
    </div>
  );
}

export default TodoPanel;
