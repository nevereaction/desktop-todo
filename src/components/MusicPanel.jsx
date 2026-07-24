import React, { useState, useEffect, useRef, useCallback } from 'react';
import MediaControlCard from './MediaControlCard';

// ========== helpers ==========
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'avi', 'webm', 'mov', 'wmv', 'flv', 'm4v', 'ogv']);

function isVideoFile(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  return VIDEO_EXTS.has(ext);
}

// ========== component ==========
export default function MusicPanel() {
  // ---- state ----
  const [playlist, setPlaylist] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(70);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [msg, setMsg] = useState('');

  // refs
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const playlistRef = useRef([]);
  const indexRef = useRef(-1);
  const seekRef = useRef(false);
  const activeTypeRef = useRef(null); // 'audio' | 'video' | null

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { indexRef.current = index; }, [index]);

  // ---- init audio + video elements ----
  useEffect(() => {
    const a = new Audio();
    const v = document.createElement('video');
    v.className = 'media-video-el';
    v.crossOrigin = 'anonymous';

    function setupElement(el, type) {
      el.volume = vol / 100;
      el.onplay = () => { if (activeTypeRef.current === type) setPlaying(true); };
      el.onpause = () => { if (activeTypeRef.current === type) setPlaying(false); };
      el.onended = playNext;
      el.ontimeupdate = () => {
        if (!seekRef.current && activeTypeRef.current === type) {
          setCur(el.currentTime);
          setDur(el.duration || 0);
        }
      };
      el.onloadedmetadata = () => {
        if (activeTypeRef.current === type) setDur(el.duration || 0);
      };
    }
    setupElement(a, 'audio');
    setupElement(v, 'video');

    document.body.appendChild(a);
    document.body.appendChild(v);
    audioRef.current = a;
    videoRef.current = v;
    return () => { a.pause(); a.remove(); v.pause(); v.remove(); };
  }, []);

  // sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol / 100;
    if (videoRef.current) videoRef.current.volume = vol / 100;
  }, [vol]);

  // ---- Media Session API (system media controls) ----
  const track = index >= 0 ? playlist[index] : null;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const vid = isVideoFile(track.name);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: vid ? '视频' : '音频',
      album: '本地媒体',
    });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }, [track]);

  // sync system progress
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    const iv = setInterval(() => {
      const el = activeTypeRef.current === 'video' ? videoRef.current : audioRef.current;
      if (el && el.duration && !el.paused) {
        navigator.mediaSession.setPositionState?.({ duration: el.duration, playbackRate: 1, position: el.currentTime });
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [track]);

  // ---- playback ----
  function stopBoth() {
    ['audio', 'video'].forEach(t => {
      const el = t === 'audio' ? audioRef.current : videoRef.current;
      if (el) { el.pause(); el.src = ''; }
    });
  }

  function loadAndPlay(i) {
    if (!audioRef.current || !videoRef.current || i < 0 || i >= playlist.length) return;
    const t = playlist[i];
    const vid = isVideoFile(t.name);
    const src = `local-media:///${t.path.replace(/\\/g, '/')}`;

    stopBoth();
    activeTypeRef.current = vid ? 'video' : 'audio';
    const el = vid ? videoRef.current : audioRef.current;
    el.src = src;
    el.play().catch(() => setMsg('无法播放此文件'));
    setCur(0);
    setDur(0);
    setIndex(i);
    setMsg('');
  }

  const toggle = useCallback(() => {
    const el = activeTypeRef.current === 'video' ? videoRef.current : audioRef.current;
    if (!el || !el.src) return;
    playing ? el.pause() : el.play().catch(() => {});
  }, [playing]);

  const playNext = useCallback(() => {
    const list = playlistRef.current;
    const i = indexRef.current;
    if (!list.length) return;
    const next = i < list.length - 1 ? i + 1 : 0;
    loadAndPlay(next);
  }, []);

  const playPrev = useCallback(() => {
    const list = playlistRef.current;
    const i = indexRef.current;
    if (!list.length) return;
    const prev = i > 0 ? i - 1 : list.length - 1;
    loadAndPlay(prev);
  }, []);

  // ---- seek ----
  function onSeekStart() { seekRef.current = true; }
  function onSeekChange(e) { setCur(+e.target.value); }
  function onSeekEnd(e) {
    seekRef.current = false;
    const v = +e.target.value;
    const el = activeTypeRef.current === 'video' ? videoRef.current : audioRef.current;
    if (el && isFinite(v)) { el.currentTime = v; setCur(v); }
  }

  // ---- file selection ----
  async function selectFiles() {
    if (!window.electronAPI?.media) return;
    const files = await window.electronAPI.media.selectFiles();
    if (files.length) {
      setPlaylist(files);
      setIndex(-1);
      activeTypeRef.current = null;
      stopBoth();
    }
  }

  async function selectFolder() {
    if (!window.electronAPI?.media) return;
    const files = await window.electronAPI.media.selectFolder();
    if (files.length) {
      setPlaylist(files);
      setIndex(-1);
      activeTypeRef.current = null;
      stopBoth();
    }
  }

  // ========== RENDER ==========
  const hasTracks = playlist.length > 0;
  const isVideo = track ? isVideoFile(track.name) : false;

  return (
    <div>
      {/* === header === */}
      <div className="panel-header">
        <h1 className="panel-header__title">媒体</h1>
        <div className="panel-header__actions">
          <button className="btn btn--sm" onClick={selectFiles}>📁 选择文件</button>
          <button className="btn btn--sm" onClick={selectFolder}>📂 选择文件夹</button>
        </div>
      </div>

      {msg ? (
        <div className="media-msg">
          {msg} <span className="media-msg__close" onClick={() => setMsg('')}>✕</span>
        </div>
      ) : null}

      {hasTracks ? (
        <div className="music-layout">
          {/* left: SMTC Card + seek + volume */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            {/* SMTC-style card */}
            <MediaControlCard
              appName="桌面待办"
              title={track ? track.name : '未在播放'}
              artist={track ? (isVideo ? '视频播放' : '音频播放') : ''}
              coverUrl={track && !isVideo ? getCoverForTrack(track) : ''}
              isPlaying={playing}
              progress={cur}
              duration={dur}
              onPlayPause={(nextState) => toggle()}
              onPrev={playPrev}
              onNext={playNext}
              onSeek={(time) => {
                const el = activeTypeRef.current === 'video' ? videoRef.current : audioRef.current;
                if (el) { el.currentTime = time; setCur(time); }
              }}
            />

            {/* Seek bar (for video, also show below card) */}
            <div style={{ width: 360, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="smtc-card__time">{fmt(cur)}</span>
              <input
                type="range"
                className="music-seek"
                min="0"
                max={dur || 1}
                step="0.5"
                value={cur}
                onMouseDown={onSeekStart}
                onTouchStart={onSeekStart}
                onChange={onSeekChange}
                onMouseUp={onSeekEnd}
                onTouchEnd={onSeekEnd}
              />
              <span className="smtc-card__time">{fmt(dur)}</span>
            </div>

            {/* Volume */}
            <div className="music-player__volume">
              <span className="music-player__volume-icon">🔈</span>
              <input className="music-player__volume-slider" type="range" min="0" max="100" value={vol} onChange={e => setVol(+e.target.value)} />
              <span className="music-player__volume-icon">🔊</span>
            </div>
          </div>

          {/* right: playlist */}
          <div className="music-playlist">
            <div className="music-playlist__title">
              播放列表 <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({playlist.length} 个)</span>
            </div>
            {playlist.map((t, i) => {
              const isActive = i === index;
              const vid = isVideoFile(t.name);
              return (
                <div key={t.id || i} className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`} onClick={() => loadAndPlay(i)}>
                  <div className="music-playlist__item-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'var(--bg-glass)' }}>
                    {vid ? '🎬' : isActive ? '🔊' : '🎵'}
                  </div>
                  <span className="music-playlist__item-index" style={{ color: isActive ? 'var(--accent)' : undefined, fontWeight: isActive ? 700 : undefined }}>
                    {isActive ? '▶' : i + 1}
                  </span>
                  <div className="music-playlist__item-info">
                    <div className="music-playlist__item-title" style={{ color: isActive ? 'var(--accent-light)' : undefined }}>
                      {t.name}
                      {vid && <span className="playlist-vid-badge">🎬</span>}
                    </div>
                    <div className="music-playlist__item-artist">{vid ? '视频' : '音频'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* empty state */
        <div className="music-player glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 48 }}>
          <div className="music-player__artwork music-player__artwork--placeholder" style={{ width: 160, height: 160, fontSize: 56 }}>🎬</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>添加本地媒体</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              支持 MP3, WAV, FLAC, OGG, AAC 等音频格式<br />
              支持 MP4, MKV, AVI, WebM 等视频格式<br />
              通过系统媒体控制可直接用键盘/耳机控制播放
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn--primary btn--lg" onClick={selectFiles}>📁 选择文件</button>
              <button className="btn btn--lg" onClick={selectFolder}>📂 选择文件夹</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== helpers ==========
function fmt(s) {
  if (!isFinite(s) || s < 0) return '00:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Convert local file path to a cover-compatible URL for the SMTC card.
 *  Audio files get a music-note placeholder; video files get no cover (use built-in default).
 *  Album art extraction from audio metadata could be added later. */
function getCoverForTrack(track) {
  // For now return empty — SMTC card will show the music-note placeholder
  // If you have embedded album art, you could return it here
  return '';
}
