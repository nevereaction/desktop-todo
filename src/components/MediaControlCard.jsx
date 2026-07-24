import React from 'react';

// ========== Inline SVG Icons ==========
const PlayIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.52-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PrevIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);

const NextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
  </svg>
);

const DefaultAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

// ========== Media Control Card ==========
function MediaControlCard({
  appIcon,
  appName = '媒体播放器',
  title = '未在播放',
  artist = '',
  coverUrl = '',
  isPlaying = false,
  progress = 0,
  duration = 0,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  className = '',
}) {
  const handlePlayPause = () => {
    onPlayPause?.(!isPlaying);
  };

  const handlePrev = () => onPrev?.();
  const handleNext = () => onNext?.();

  const handleSeek = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * (duration || 0);
    onSeek?.(Math.max(0, Math.min(time, duration || 0)));
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const formatTime = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className={`smtc-card ${className}`}>
      {/* ===== Header: App Icon + App Name ===== */}
      <div className="smtc-card__header">
        <div className="smtc-card__app-icon">
          {appIcon || <DefaultAppIcon />}
        </div>
        <span className="smtc-card__app-name">{appName}</span>
      </div>

      {/* ===== Body: Title + Cover ===== */}
      <div className="smtc-card__body">
        <div className="smtc-card__info">
          <div className="smtc-card__title" title={title}>
            {title}
          </div>
          {artist && (
            <div className="smtc-card__artist" title={artist}>
              {artist}
            </div>
          )}
        </div>

        <div className="smtc-card__cover-wrap">
          {coverUrl ? (
            <img
              className="smtc-card__cover"
              src={coverUrl}
              alt={title}
            />
          ) : (
            <div className="smtc-card__cover smtc-card__cover--placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ===== Progress Bar ===== */}
      {duration > 0 && (
        <div className="smtc-card__progress-row">
          <span className="smtc-card__time">{formatTime(progress)}</span>
          <div
            className="smtc-card__progress-bar"
            onClick={handleSeek}
          >
            <div
              className="smtc-card__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="smtc-card__time">{formatTime(duration)}</span>
        </div>
      )}

      {/* ===== Controls: Prev | Play/Pause | Next ===== */}
      <div className="smtc-card__controls">
        <button
          className="smtc-card__btn smtc-card__btn--secondary"
          onClick={handlePrev}
          title="上一曲"
          aria-label="上一曲"
        >
          <PrevIcon />
        </button>

        <button
          className={`smtc-card__btn smtc-card__btn--primary ${isPlaying ? 'smtc-card__btn--playing' : ''}`}
          onClick={handlePlayPause}
          title={isPlaying ? '暂停' : '播放'}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          className="smtc-card__btn smtc-card__btn--secondary"
          onClick={handleNext}
          title="下一曲"
          aria-label="下一曲"
        >
          <NextIcon />
        </button>
      </div>
    </div>
  );
}

export { PlayIcon, PauseIcon, PrevIcon, NextIcon };
export default MediaControlCard;
