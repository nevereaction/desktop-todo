import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:3000';

const QUALITY_OPTIONS = [
  { key: 'standard', label: '标准', level: 'standard' },
  { key: 'higher', label: '较高', level: 'higher' },
  { key: 'lossless', label: '无损', level: 'lossless' },
];

// ==================== helpers ====================
async function apiGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${sep}timestamp=${Date.now()}`;
  const res = await fetch(url);
  return res.json();
}

// ==================== component ====================
function MusicPanel() {
  // ---- state ----
  const [phase, setPhase] = useState('loading'); // loading | no_api | logged_out | qr | logged_in
  const [user, setUser] = useState(null);
  const [qrImg, setQrImg] = useState('');
  const [status, setStatus] = useState('');

  // music state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [quality, setQuality] = useState('higher');

  // content
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('daily'); // daily | likes | playlists | playlist_xxx | search
  const [activePid, setActivePid] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  const audioRef = useRef(null);
  const songsRef = useRef(songs);
  const curRef = useRef(currentTrack);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { curRef.current = currentTrack; }, [currentTrack]);

  // ---- init audio ----
  useEffect(() => {
    const a = new Audio();
    a.volume = volume / 100;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => {
      const list = songsRef.current;
      const cur = curRef.current;
      if (!list.length || !cur) return;
      const i = list.findIndex(t => t.id === cur.id);
      const next = list[(i + 1) % list.length];
      if (next) playTrack(next);
    };
    document.body.appendChild(a);
    audioRef.current = a;
    return () => { a.pause(); a.remove(); };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // ---- init: check API + login ----
  useEffect(() => {
    let off = false;
    (async () => {
      for (let i = 0; i < 10; i++) {
        if (off) return;
        try {
          const d = await apiGet('/login/status');
          if (d?.data?.account && d?.data?.profile) {
            setUser(d.data.profile);
            setPhase('logged_in');
            loadAll(d.data.profile.userId);
            return;
          }
          setPhase('logged_out');
          return;
        } catch (e) { /* retry */ }
        await sleep(1500);
      }
      if (!off) setPhase('no_api');
    })();
    return () => { off = true; };
  }, []);

  // ---- data loading ----
  async function loadAll(uid) {
    setLoading(true);
    // parallel load
    const [dailyR, likeR, plR] = await Promise.all([
      apiGet('/recommend/songs').catch(() => null),
      apiGet(`/likelist?uid=${uid}`).catch(() => null),
      apiGet(`/user/playlist?uid=${uid}`).catch(() => null),
    ]);

    // daily songs
    if (dailyR?.code === 200) {
      const list = dailyR.data?.dailySongs || dailyR.data?.recommend || dailyR?.recommend || [];
      if (list.length > 0) setSongs(list);
    }

    // liked songs - store ids, fetch details
    if (likeR?.code === 200 && likeR?.ids?.length) {
      const chunk = likeR.ids.slice(0, 100);
      const detailR = await apiGet(`/song/detail?ids=${chunk.join(',')}`).catch(() => null);
      if (detailR?.code === 200 && detailR?.songs) {
        window.__likedSongs = detailR.songs;
      }
    }

    // playlists
    if (plR?.code === 200 && plR?.playlist) {
      // 只保留自己创建的歌单（userId === uid）
      const mine = plR.playlist.filter(p => p.userId === uid);
      setPlaylists(mine);
      if (mine.length > 0) {
        setActiveTab('playlists');
      }
    }

    setLoading(false);
  }

  async function loadPlaylist(id) {
    setLoading(true);
    const d = await apiGet(`/playlist/track/all?id=${id}&limit=100`).catch(() => null);
    if (d?.code === 200 && d?.songs) {
      // flatten: each item is {id, name, ar, al, ...}
      const flat = d.songs.map(s => ({
        id: s.id,
        name: s.name,
        ar: s.ar,
        al: s.al,
        dt: s.dt,
      }));
      setSongs(flat);
    }
    setLoading(false);
  }

  // ---- playback ----
  async function getUrl(id) {
    const d = await apiGet(`/song/url/v1?id=${id}&level=${quality}`).catch(() => null);
    return d?.data?.[0]?.url || null;
  }

  async function playTrack(track) {
    const a = audioRef.current;
    if (!a) return;
    setStatus('');

    let url = await getUrl(track.id);
    // fallback to standard quality
    if (!url && quality !== 'standard') {
      const d = await apiGet(`/song/url/v1?id=${track.id}&level=standard`).catch(() => null);
      url = d?.data?.[0]?.url;
      if (url) setStatus('高音质不可用，已切换到标准');
    }

    if (!url) {
      setStatus('该歌曲暂无版权');
      return;
    }

    a.src = url;
    a.play().catch(() => {});

    setCurrentTrack({
      id: track.id,
      name: track.name,
      artist: track.ar?.map(x => x.name).join(' / ') || '',
      album: track.al?.name || '',
      pic: track.al?.picUrl || '',
    });
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !a.src) return;
    playing ? a.pause() : a.play().catch(() => {});
  }

  function next() {
    const list = songsRef.current;
    const cur = curRef.current;
    if (!list.length || !cur) return;
    const i = list.findIndex(t => t.id === cur.id);
    playTrack(list[(i + 1) % list.length]);
  }

  function prev() {
    const list = songsRef.current;
    const cur = curRef.current;
    if (!list.length || !cur) return;
    const i = list.findIndex(t => t.id === cur.id);
    playTrack(list[(i - 1 + list.length) % list.length]);
  }

  function changeQuality(q) {
    setQuality(q);
    setStatus(`音质: ${QUALITY_OPTIONS.find(o => o.key === q)?.label}`);
    const cur = curRef.current;
    if (cur && playing) {
      getUrl(cur.id).then(url => {
        if (url && audioRef.current) {
          const t = audioRef.current.currentTime;
          audioRef.current.src = url;
          audioRef.current.currentTime = t;
          audioRef.current.play().catch(() => {});
        }
      });
    }
  }

  // ---- login ----
  async function startLogin() {
    setStatus('获取二维码...');
    setPhase('qr');
    try {
      const keyR = await apiGet('/login/qr/key');
      const key = keyR?.data?.unikey;
      if (!key) { setStatus('获取密钥失败'); setPhase('logged_out'); return; }

      const qrR = await apiGet(`/login/qr/create?key=${key}&qrimg=true`);
      const img = qrR?.data?.qrimg;
      if (!img) { setStatus('生成二维码失败'); setPhase('logged_out'); return; }

      setQrImg(img);
      setStatus('请用网易云音乐APP扫码');

      // poll
      for (let i = 0; i < 120; i++) {
        await sleep(1500);
        const ck = await apiGet(`/login/qr/check?key=${key}`).catch(() => null);
        if (!ck) continue;
        if (ck.code === 800) { setStatus('二维码已过期'); setPhase('logged_out'); return; }
        if (ck.code === 803) {
          setStatus('登录成功');
          // get profile
          const st = await apiGet('/login/status').catch(() => null);
          if (st?.data?.profile) {
            setUser(st.data.profile);
            setPhase('logged_in');
            loadAll(st.data.profile.userId);
          }
          return;
        }
      }
      setStatus('登录超时');
      setPhase('logged_out');
    } catch (e) {
      setStatus('出错: ' + e.message);
      setPhase('logged_out');
    }
  }

  function logout() {
    apiGet('/logout').catch(() => {});
    setUser(null);
    setPhase('logged_out');
    setSongs([]);
    setPlaylists([]);
    setCurrentTrack(null);
    setPlaying(false);
    window.__likedSongs = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }

  // ---- search ----
  async function doSearch() {
    const q = searchText.trim();
    if (!q) return;
    setActiveTab('search');
    setLoading(true);
    const d = await apiGet(`/search?keywords=${encodeURIComponent(q)}&type=1&limit=30`).catch(() => null);
    if (d?.result?.songs) {
      const flat = d.result.songs.map(s => ({
        id: s.id, name: s.name, ar: s.artists || s.ar,
        al: s.album || s.al,
      }));
      setSongs(flat);
    }
    setLoading(false);
  }

  // ---- tab ----
  function switchTab(tab) {
    setActiveTab(tab);
    if (tab === 'daily') loadAll(user?.userId);
    else if (tab === 'likes' && window.__likedSongs) setSongs(window.__likedSongs);
    else if (tab === 'likes' && user) {
      // reload liked
      (async () => {
        const r = await apiGet(`/likelist?uid=${user.userId}`).catch(() => null);
        if (r?.ids?.length) {
          const d = await apiGet(`/song/detail?ids=${r.ids.slice(0, 100).join(',')}`).catch(() => null);
          if (d?.songs) {
            window.__likedSongs = d.songs;
            setSongs(d.songs);
          }
        }
      })();
    }
  }

  // ==================== RENDER ====================

  // ---- phase: checking API ----
  if (phase === 'loading') {
    return (
      <div>
        <div className="panel-header"><h1 className="panel-header__title">音乐</h1></div>
        <div className="music-login"><div className="empty-state__icon">⏳</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>连接网易云音乐服务中...</p>
        </div>
      </div>
    );
  }

  // ---- phase: no API ----
  if (phase === 'no_api') {
    return (
      <div>
        <div className="panel-header"><h1 className="panel-header__title">音乐</h1></div>
        <div className="music-login">
          <div className="empty-state__icon">🔌</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.8, textAlign: 'center' }}>
            无法连接网易云音乐API服务
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.8 }}>
            请先在终端运行：<br />
            <code style={{ background: 'var(--bg-glass)', padding: '6px 14px', borderRadius: 6, fontSize: 13, display: 'inline-block', marginTop: 6 }}>
              npx NeteaseCloudMusicApi
            </code>
          </p>
          <button className="btn btn--primary" onClick={() => { setPhase('loading'); window.location.reload(); }}>🔄 重试连接</button>
        </div>
      </div>
    );
  }

  // ---- phase: QR ----
  if (phase === 'qr') {
    return (
      <div>
        <div className="panel-header"><h1 className="panel-header__title">音乐</h1></div>
        <div className="music-login">
          <img className="music-login__qrcode" src={qrImg} alt="QR" />
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{status}</p>
          <button className="btn btn--sm" onClick={() => { setPhase('logged_out'); setStatus(''); }}>取消</button>
        </div>
      </div>
    );
  }

  // ---- phase: logged_out ----
  if (phase === 'logged_out') {
    return (
      <div>
        <div className="panel-header"><h1 className="panel-header__title">音乐</h1></div>
        <div className="music-login">
          <div className="empty-state__icon">🎵</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>尚未登录网易云音乐</p>
          {status && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{status}</p>}
          <button className="btn btn--primary btn--lg" onClick={startLogin}>🔑 扫码登录</button>
        </div>
      </div>
    );
  }

  // ---- phase: logged_in ----
  return (
    <div>
      {/* header */}
      <div className="panel-header">
        <h1 className="panel-header__title">音乐</h1>
        <div className="panel-header__actions" style={{ alignItems: 'center', gap: 14 }}>
          {/* quality */}
          <div className="music-player__quality">
            <span className="music-player__quality-label">音质</span>
            {QUALITY_OPTIONS.map(q => (
              <button
                key={q.key}
                className={`music-player__quality-btn ${quality === q.key ? 'music-player__quality-btn--active' : ''}`}
                onClick={() => changeQuality(q.key)}
              >{q.label}</button>
            ))}
          </div>
          {/* user */}
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} style={{ width: 22, height: 22, borderRadius: '50%' }} alt="" />
              : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>👤</span>
            }
            {user?.nickname}
          </span>
          {/* logout */}
          <button className="btn btn--danger btn--sm" onClick={logout}>🚪 登出</button>
        </div>
      </div>

      {/* status bar */}
      {status ? (
        <div style={{ padding: '6px 14px', marginBottom: 14, borderRadius: 8, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          {status} <span style={{ cursor: 'pointer', marginLeft: 8, color: 'var(--accent)' }} onClick={() => setStatus('')}>✕</span>
        </div>
      ) : null}

      {/* main layout */}
      <div className="music-layout">
        {/* left: player */}
        <div className="music-player glass-card">
          {currentTrack ? (
            <>
              {currentTrack.pic
                ? <img className="music-player__artwork" src={currentTrack.pic} alt="" />
                : <div className="music-player__artwork music-player__artwork--placeholder">🎵</div>
              }
              <div className="music-player__info">
                <div className="music-player__title">{currentTrack.name}</div>
                <div className="music-player__artist">{currentTrack.artist}</div>
                {currentTrack.album && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{currentTrack.album}</div>}
              </div>
              <div className="music-player__controls">
                <button className="music-player__ctrl-btn" onClick={prev}>⏮</button>
                <button className="music-player__ctrl-btn music-player__ctrl-btn--play" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'}
                </button>
                <button className="music-player__ctrl-btn" onClick={next}>⏭</button>
              </div>
              <div className="music-player__volume">
                <span className="music-player__volume-icon">🔈</span>
                <input className="music-player__volume-slider" type="range" min="0" max="100" value={volume} onChange={e => setVolume(+e.target.value)} />
                <span className="music-player__volume-icon">🔊</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">🎶</div>
              <div className="empty-state__text">从右侧列表选择歌曲开始播放</div>
            </div>
          )}
        </div>

        {/* right: content */}
        <div>
          {/* search */}
          <div className="music-search">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="text" placeholder="搜索歌曲..." value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
              <button className="btn btn--primary btn--sm" onClick={doSearch}>搜索</button>
            </div>
          </div>

          {/* tabs */}
          <div className="music-playlist__tabs">
            {[
              ['daily', '📅 每日推荐'],
              ['likes', '❤️ 我喜欢的'],
              ['playlists', '📋 我的歌单'],
            ].map(([k, label]) => (
              <button
                key={k}
                className={`music-playlist__tab ${activeTab === k || (k === 'playlists' && activeTab.startsWith('playlist_')) ? 'music-playlist__tab--active' : ''}`}
                onClick={() => switchTab(k)}
              >{label}</button>
            ))}
          </div>

          <div className="music-playlist">
            {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>⏳ 加载中...</div>}

            {/* playlist grid */}
            {(activeTab === 'playlists') && !loading && (
              <>
                <div className="music-playlist__title">我的歌单 {playlists.length > 0 && <span style={{ fontWeight: 400, fontSize: 12 }}>({playlists.length} 个)</span>}</div>
                {playlists.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}><div className="empty-state__text">暂无歌单</div></div>
                ) : (
                  playlists.map(pl => (
                    <div
                      key={pl.id}
                      className={`music-playlist-card ${activePid === pl.id ? 'music-playlist-card--active' : ''}`}
                      onClick={() => {
                        setActiveTab('playlist_' + pl.id);
                        setActivePid(pl.id);
                        loadPlaylist(pl.id);
                      }}
                    >
                      <img className="music-playlist-card__cover" src={pl.coverImgUrl || ''} alt="" />
                      <div className="music-playlist-card__info">
                        <div className="music-playlist-card__name">{pl.name}</div>
                        <div className="music-playlist-card__count">{pl.trackCount} 首</div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* song list */}
            {activeTab !== 'playlists' && !loading && (
              <>
                <div className="music-playlist__title">
                  {activeTab === 'daily' && '每日推荐歌曲'}
                  {activeTab === 'likes' && '我喜欢的音乐'}
                  {activeTab.startsWith('playlist_') && '歌单歌曲'}
                  {activeTab === 'search' && (searchText ? `搜索: "${searchText}"` : '搜索结果')}
                  {songs.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({songs.length} 首)</span>}
                </div>
                {songs.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}>
                    <div className="empty-state__icon" style={{ fontSize: 36 }}>📭</div>
                    <div className="empty-state__text">
                      {activeTab === 'daily' ? '每日推荐暂不可用，请多使用网易云后再试' :
                       activeTab === 'likes' ? '还没有喜欢的歌曲' :
                       activeTab === 'search' ? '搜索歌曲或歌手名' :
                       '暂无歌曲'}
                    </div>
                  </div>
                ) : (
                  songs.map((t, idx) => {
                    const isActive = currentTrack?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`}
                        onClick={() => playTrack(t)}
                        onDoubleClick={() => playTrack(t)}
                      >
                        {t.al?.picUrl
                          ? <img className="music-playlist__item-cover" src={t.al.picUrl} alt="" />
                          : <div className="music-playlist__item-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{isActive ? '🔊' : '♪'}</div>
                        }
                        <span className="music-playlist__item-index" style={{ color: isActive ? 'var(--accent)' : undefined, fontWeight: isActive ? 700 : undefined }}>
                          {isActive ? '▶' : idx + 1}
                        </span>
                        <div className="music-playlist__item-info">
                          <div className="music-playlist__item-title" style={{ color: isActive ? 'var(--accent-light)' : undefined }}>{t.name}</div>
                          <div className="music-playlist__item-artist">
                            {t.ar ? t.ar.map(a => a.name).join(' / ') : '未知'}
                            {t.al?.name ? ` · ${t.al.name}` : ''}
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default MusicPanel;
