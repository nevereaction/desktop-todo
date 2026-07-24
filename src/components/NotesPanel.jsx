import React, { useState, useEffect, useCallback } from 'react';

const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'white'];

let nextNoteId = Date.now();

function NotesPanel() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    async function load() {
      if (window.electronAPI) {
        const saved = await window.electronAPI.store.get('notes');
        if (saved && saved.length > 0) setNotes(saved);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (window.electronAPI) window.electronAPI.store.set('notes', notes);
  }, [notes]);

  const addNote = useCallback(() => {
    setNotes(prev => [...prev, {
      id: nextNoteId++,
      content: '',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: Date.now(),
    }]);
  }, []);

  const updateNote = useCallback((id, content) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  }, []);

  const changeColor = useCallback((id, color) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
  }, []);

  const deleteNote = useCallback(id => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <div>
      <div className="panel-header">
        <h1 className="panel-header__title">便签</h1>
        <div className="panel-header__actions">
          <button className="btn btn--primary" onClick={addNote}>+ 新建便签</button>
        </div>
      </div>

      <div className="notes-grid">
        {notes.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state__icon">📝</div>
            <div className="empty-state__text">还没有便签，点击上方按钮创建一个</div>
          </div>
        )}

        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={updateNote}
            onChangeColor={changeColor}
            onDelete={deleteNote}
          />
        ))}

        {notes.length > 0 && (
          <button className="note-add-btn" onClick={addNote}>
            +
          </button>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onUpdate, onChangeColor, onDelete }) {
  return (
    <div className={`note-card note-card__color--${note.color}`}>
      <textarea
        className="note-card__textarea"
        value={note.content}
        onChange={e => onUpdate(note.id, e.target.value)}
        placeholder="写点什么..."
        rows={4}
      />
      <div className="note-card__footer">
        <div className="note-card__color-picker">
          {COLORS.map(color => (
            <button
              key={color}
              className={`note-card__color-dot ${note.color === color ? 'note-card__color-dot--active' : ''}`}
              style={{ background: color === 'yellow' ? '#f9e54b' : color === 'pink' ? '#ff9a9e' : color === 'blue' ? '#a1c4fd' : color === 'green' ? '#a8e6cf' : color === 'purple' ? '#c3aed6' : '#f0f0f0' }}
              onClick={() => onChangeColor(note.id, color)}
              title={color}
            />
          ))}
        </div>
        <button className="note-card__delete" onClick={() => onDelete(note.id)}>🗑</button>
      </div>
    </div>
  );
}

export default NotesPanel;
