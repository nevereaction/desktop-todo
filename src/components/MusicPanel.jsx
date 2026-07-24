import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:3000';
const QUALITY_LEVELS = [
  { key: 'standard', label: '标准', level: 'standard' },
  { key: 'higher', label: '较高', level: 'higher' },
  { key: 'lossless', label: '无损', level: 'lossless' },
];

function MusicPanel() {
  const [apiConnected, setApiConnected] = useState(false);
  const [loginChecked, setLoginChecked] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [quality, setQuality] = useState('higher');
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('daily'); // daily | likes | playlists | playlist_{id} | search
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [statusMsg, setStatusMsg] = useState('正在连接网易云音乐服务...');

  const audioRef = useRef(null);

  // ---- Init: check API + login status ----
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function tryConnect() {
      try {
        const res = await fetch(`${API_BASE}/login/status?timestamp=${Date.now()}`);
        if (!res.ok) throw new Error('not ready');
        const data = await res.json();
        if (cancelled) return;

        setApiConnected(true);

        if (data.data && data.data.account && data.data.profile) {
          const profile = data.data.profile;
          setUserProfile(profile);
          setStatusMsg(`已登录: ${profile.nickname}`);
          // Load data
          fetchDailySongs();
          fetchLikedSongs(profile.userId);
          fetchUserPlaylists(profile.userId);
        } else {
          setStatusMsg('未登录，请扫码登录');
        }
        setLoginChecked(true);
      } catch (e) {
        if (cancelled) return;
        attempts++;
        if (attempts < 3) {
          setTimeout(tryConnect, 2000);
        } else {
          setApiConnected(false);
          setLoginChecked(true);
          setStatusMsg('网易云音乐服务未启动，请先运行: npx NeteaseCloudMusicApi');
        }
      }
    }

    tryConnect();
    return () => { cancelled = true; };
  }, []);

  // ---- Create persistent audio element ----
  useEffect(() => {
    const audio = new Audio();
    audio.id = 'music-audio';
    audio.style.display = 'none';
    audio.volume = volume / 100;
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => nextTrack();
    document.body.appendChild(audio);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.remove();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // ---- API helpers ----
  const apiFetch = useCallback(async (endpoint) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}&timestamp=${Date.now()}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }, []);

  // ---- Fetch data ----
  const fetchDailySongs = async () => {
    const data = await apiFetch('/recommend/songs?');
    if (data?.code === 200 && data.data?.dailySongs) {
      setSongs(data.data.dailySongs.slice(0, 30));
    }
  };

  const fetchLikedSongs = async (uid) => {
    const data = await apiFetch(`/likelist?uid=${uid}`);
    if (data?.code === 200 && data.ids) {
      // Fetch song details for liked ids
      const ids = data.ids.slice(0, 50);
      if (ids.length > 0) {
        const detail = await apiFetch(`/song/detail?ids=${ids.join(',')}`);
        if (detail?.code === 200 && detail.songs) {
          // Store liked songs separately for the likes tab
          window._likedSongs = detail.songs;
        }
      }
    }
  };

  const fetchUserPlaylists = async (uid) => {
    const data = await apiFetch(`/user/playlist?uid=${uid}`);
    if (data?.code === 200 && data.playlist) {
      setPlaylists(data.playlist.filter(p => !p.subscribed || p.creator?.userId === uid).slice(0, 30));
    }
  };

  const fetchPlaylistSongs = async (playlistId) => {
    const data = await apiFetch(`/playlist/track/all?id=${playlistId}&limit=50`);
    if (data?.code === 200 && data.songs) {
      setSongs(data.songs);
    }
  };

  // ---- Playback ----
  const getSongUrl = async (songId) => {
    const data = await apiFetch(`/song/url/v1?id=${songId}&level=${quality}`);
    return data?.data?.[0]?.url || null;
  };

  const playTrack = async (track) => {
    if (!audioRef.current) return;
    const songId = track.id;
    const url = await getSongUrl(songId);

    if (url) {
      audioRef.current.src = url;
      audioRef.current.play().catch(e => console.error('Play error:', e));

      // Get full song detail
      const detail = await apiFetch(`/song/detail?ids=${songId}`);
      const song = detail?.songs?.[0];

      setCurrentTrack({
        id: songId,
        name: track.name || song?.name || '未知歌曲',
        artist: track.ar
          ? track.ar.map(a => a.name).join(', ')
          : (song?.ar ? song.ar.map(a => a.name).join(', ') : '未知歌手'),
        albumPic: track.al?.picUrl || song?.al?.picUrl || '',
        album: track.al?.name || song?.al?.name || '',
      });
      setStatusMsg('');
    } else {
      // Try higher quality fallback
      if (quality !== 'standard') {
        const fallbackUrl = await apiFetch(`/song/url/v1?id=${songId}&level=standard`);
        const fbUrl = fallbackUrl?.data?.[0]?.url;
        if (fbUrl) {
          audioRef.current.src = fbUrl;
          audioRef.current.play().catch(e => console.error('Play error:', e));
          setCurrentTrack({
            id: songId,
            name: track.name || '未知歌曲',
            artist: track.ar ? track.ar.map(a => a.name).join(', ') : '未知歌手',
            albumPic: track.al?.picUrl || '',
            album: track.al?.name || '',
          });
          setStatusMsg('无损音质不可用，已切换到标准音质');
        } else {
          setStatusMsg('该歌曲暂无版权或无法播放');
        }
      } else {
        setStatusMsg('该歌曲暂无版权或无法播放');
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !audioRef.current.src) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const nextTrack = () => {
    if (songs.length === 0 || !currentTrack) return;
    const idx = songs.findIndex(t => t.id === currentTrack.id);
    const nextIdx = idx >= 0 ? (idx + 1) % songs.length : 0;
    playTrack(songs[nextIdx]);
  };

  const prevTrack = () => {
    if (songs.length === 0 || !currentTrack) return;
    const idx = songs.findIndex(t => t.id === currentTrack.id);
    const prevIdx = idx >= 0 ? (idx - 1 + songs.length) % songs.length : songs.length - 1;
    playTrack(songs[prevIdx]);
  };

  // ---- Login ----
  const startLogin = async () => {
    try {
      setStatusMsg('正在生成登录二维码...');
      setShowQr(true);

      const keyRes = await fetch(`${API_BASE}/login/qr/key?timestamp=${Date.now()}`);
      const keyData = await keyRes.json();
      const unikey = keyData?.data?.unikey;
      if (!unikey) {
        setStatusMsg('获取登录密钥失败，请确保API服务已启动');
        setShowQr(false);
        return;
      }

      const qrRes = await fetch(`${API_BASE}/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}`);
      const qrData = await qrRes.json();
      if (qrData?.data?.qrimg) {
        setQrUrl(qrData.data.qrimg);
        setStatusMsg('请使用网易云音乐 APP 扫码登录');

        // Poll login status
        for (let i = 0; i < 90; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const checkRes = await fetch(`${API_BASE}/login/qr/check?key=${unikey}&timestamp=${Date.now()}`);
            const checkData = await checkRes.json();
            if (checkData.code === 800) {
              setStatusMsg('二维码已过期，请重新获取');
              setShowQr(false);
              return;
            }
            if (checkData.code === 803) {
              setShowQr(false);
              setStatusMsg('登录成功！');
              // Reload user info
              const statusRes = await fetch(`${API_BASE}/login/status?timestamp=${Date.now()}`);
              const statusData = await statusRes.json();
              if (statusData.data?.profile) {
                const profile = statusData.data.profile;
                setUserProfile(profile);
                setLoginChecked(true);
                fetchDailySongs();
                fetchLikedSongs(profile.userId);
                fetchUserPlaylists(profile.userId);
              }
              return;
            }
          } catch (e) { /* retry */ }
        }
        setStatusMsg('登录超时，请重新获取二维码');
        setShowQr(false);
      }
    } catch (e) {
      setStatusMsg('连接失败：' + e.message);
      setShowQr(false);
    }
  };

  // ---- Search ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setActiveTab('search');
    const data = await apiFetch(`/search?keywords=${encodeURIComponent(searchQuery)}&type=1&limit=30`);
    if (data?.result?.songs) {
      setSongs(data.result.songs);
    }
  };

  const handleSearchKeyDown = e => {
    if (e.key === 'Enter') handleSearch();
  };

  // ---- Tab switching ----
  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'daily') fetchDailySongs();
    else if (tab === 'likes' && window._likedSongs) setSongs(window._likedSongs);
  };

  const openPlaylist = (playlist) => {
    setActiveTab('playlist_' + playlist.id);
    setActivePlaylistId(playlist.id);
    fetchPlaylistSongs(playlist.id);
  };

  const handleQualityChange = (q) => {
    setQuality(q);
    setStatusMsg(`音质已切换为: ${QUALITY_LEVELS.find(l => l.key === q)?.label}`);
    // If currently playing, restart with new quality
    if (currentTrack && isPlaying && audioRef.current) {
      const wasPlaying = true;
      getSongUrl(currentTrack.id).then(url => {
        if (url && audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          audioRef.current.src = url;
          audioRef.current.currentTime = currentTime;
          if (wasPlaying) audioRef.current.play().catch(() => {});
        }
      });
    }
  };

  // ---- Not connected ----
  if (!apiConnected) {
    return (
      <div>
        <div className="panel-header">
          <h1 className="panel-header__title">音乐</h1>
        </div>
        <div className="music-login">
          <div className="empty-state__icon">🎵</div>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, fontSize: 16 }}>
            {statusMsg}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', lineHeight: 1.8 }}>
            请先在终端中启动网易云音乐 API 服务：<br />
            <code style={{ background: 'var(--bg-glass)', padding: '6px 14px', borderRadius: 6, fontSize: 14, marginTop: 8, display: 'inline-block' }}>
              npx NeteaseCloudMusicApi
            </code>
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => window.location.reload()}>🔄 重新连接</button>
        </div>
      </div>
    );
  }

  // ---- Not logged in or QR showing ----
  if (!userProfile) {
    return (
      <div>
        <div className="panel-header">
          <h1 className="panel-header__title">音乐</h1>
        </div>
        <div className="music-login">
          {showQr ? (
            <>
              <img className="music-login__qrcode" src={qrUrl} alt="登录二维码" />
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{statusMsg}</p>
              <button className="btn btn--sm" onClick={() => { setShowQr(false); setStatusMsg('已取消登录'); }}>取消</button>
            </>
          ) : (
            <>
              <div className="empty-state__icon">🔐</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>{statusMsg}</p>
              <button className="btn btn--primary btn--lg" onClick={startLogin}>🔑 扫码登录网易云音乐</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Logged in ----
  return (
    <div>
      <div className="panel-header">
        <h1 className="panel-header__title">音乐</h1>
        <div className="panel-header__actions" style={{ alignItems: 'center', gap: 16 }}>
          <div className="music-player__quality">
            <span className="music-player__quality-label">音质</span>
            {QUALITY_LEVELS.map(q => (
              <button
                key={q.key}
                className={`music-player__quality-btn ${quality === q.key ? 'music-player__quality-btn--active' : ''}`}
                onClick={() => handleQualityChange(q.key)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-glass)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              overflow: 'hidden'
            }}>
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} style={{ width: 24, height: 24, borderRadius: '50%' }} alt="" />
              ) : '👤'}
            </span>
            {userProfile.nickname}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '8px 16px', marginBottom: 16, borderRadius: 8,
          background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
          fontSize: 13, color: 'var(--text-muted)', textAlign: 'center'
        }}>
          {statusMsg}
        </div>
      )}

      <div className="music-layout">
        {/* Left: Player */}
        <div className="music-player glass-card">
          {currentTrack ? (
            <>
              {currentTrack.albumPic ? (
                <img className="music-player__artwork" src={currentTrack.albumPic} alt={currentTrack.name} />
              ) : (
                <div className="music-player__artwork music-player__artwork--placeholder">🎵</div>
              )}

              <div className="music-player__info">
                <div className="music-player__title">{currentTrack.name}</div>
                <div className="music-player__artist">{currentTrack.artist}</div>
                {currentTrack.album && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{currentTrack.album}</div>
                )}
              </div>

              <div className="music-player__controls">
                <button className="music-player__ctrl-btn" onClick={prevTrack} title="上一首">⏮</button>
                <button className="music-player__ctrl-btn music-player__ctrl-btn--play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button className="music-player__ctrl-btn" onClick={nextTrack} title="下一首">⏭</button>
              </div>

              <div className="music-player__volume">
                <span className="music-player__volume-icon">🔈</span>
                <input
                  className="music-player__volume-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={e => setVolume(parseInt(e.target.value))}
                />
                <span className="music-player__volume-icon">🔊</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">🎶</div>
              <div className="empty-state__text">从右侧选择歌曲开始播放</div>
            </div>
          )}
        </div>

        {/* Right: Playlists & Songs */}
        <div>
          {/* Search */}
          <div className="music-search">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="text"
                placeholder="搜索歌曲..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button className="btn btn--primary btn--sm" onClick={handleSearch}>搜索</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="music-playlist__tabs">
            <button
              className={`music-playlist__tab ${activeTab === 'daily' ? 'music-playlist__tab--active' : ''}`}
              onClick={() => switchTab('daily')}
            >
              📅 每日推荐
            </button>
            <button
              className={`music-playlist__tab ${activeTab === 'likes' ? 'music-playlist__tab--active' : ''}`}
              onClick={() => switchTab('likes')}
            >
              ❤️ 我喜欢的
            </button>
            <button
              className={`music-playlist__tab ${activeTab === 'playlists' ? 'music-playlist__tab--active' : ''}`}
              onClick={() => setActiveTab('playlists')}
            >
              📋 歌单
            </button>
          </div>

          <div className="music-playlist">
            {/* Playlists view */}
            {activeTab === 'playlists' && (
              <>
                <div className="music-playlist__title">我的歌单</div>
                {playlists.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div className="empty-state__text">暂无歌单</div>
                  </div>
                ) : (
                  playlists.map(pl => (
                    <div
                      key={pl.id}
                      className={`music-playlist-card ${activePlaylistId === pl.id ? 'music-playlist-card--active' : ''}`}
                      onClick={() => openPlaylist(pl)}
                    >
                      <img className="music-playlist-card__cover" src={pl.coverImgUrl || ''} alt="" />
                      <div className="music-playlist-card__info">
                        <div className="music-playlist-card__name">{pl.name}</div>
                        <div className="music-playlist-card__count">{pl.trackCount} 首歌曲</div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Song list (daily / likes / playlist / search) */}
            {activeTab !== 'playlists' && (
              <>
                <div className="music-playlist__title">
                  {activeTab === 'daily' && '每日推荐歌曲'}
                  {activeTab === 'likes' && '我喜欢的音乐'}
                  {activeTab.startsWith('playlist_') && '歌单歌曲'}
                  {activeTab === 'search' && (searchQuery ? `搜索: "${searchQuery}"` : '搜索结果')}
                  {songs.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({songs.length} 首)</span>}
                </div>

                {songs.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div className="empty-state__text">
                      {activeTab === 'daily' && '加载中...'}
                      {activeTab === 'likes' && '暂无喜欢的音乐'}
                      {activeTab === 'search' && '搜索你喜欢的歌曲'}
                    </div>
                  </div>
                ) : (
                  songs.map((track, idx) => {
                    const isActive = currentTrack?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`}
                        onClick={() => playTrack(track)}
                      >
                        {track.al?.picUrl ? (
                          <img className="music-playlist__item-cover" src={track.al.picUrl} alt="" />
                        ) : (
                          <div className="music-playlist__item-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                            {isActive ? '🔊' : '♪'}
                          </div>
                        )}
                        <span className="music-playlist__item-index" style={{ color: isActive ? 'var(--accent)' : undefined }}>
                          {isActive ? '▶' : idx + 1}
                        </span>
                        <div className="music-playlist__item-info">
                          <div className="music-playlist__item-title" style={{ color: isActive ? 'var(--accent-light)' : undefined }}>
                            {track.name}
                          </div>
                          <div className="music-playlist__item-artist">
                            {track.ar ? track.ar.map(a => a.name).join(' / ') : '未知'}
                            {track.al?.name ? ` · ${track.al.name}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MusicPanel;
