const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, globalShortcut, nativeImage, screen, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

let _storePath = null;
function getStorePath() {
  if (!_storePath) _storePath = path.join(app.getPath('userData'), 'store.json');
  return _storePath;
}

const defaults = {
  todos: [],
  notes: [],
  pomodoro: { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, todayCount: 0, date: '' },
  theme: 'dark',
  musicSettings: { apiPort: 3000, autoStart: false },
};

function readStore() {
  try {
    const p = getStorePath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { ...defaults, ...data };
    }
  } catch (e) { /* ignore */ }
  return { ...defaults };
}

function writeStore(data) {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { console.error('Write store error:', e); }
}

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    x: screenWidth - 1120,
    y: 60,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('桌面待办');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow.show() },
    { label: '置顶窗口', type: 'checkbox', checked: false, click: (item) => mainWindow.setAlwaysOnTop(item.checked) },
    { type: 'separator' },
    { label: '退出', click: () => { tray = null; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

app.whenReady().then(() => {
  // 注册自定义协议处理本地文件（解决 file:// 被 CORS 拦截的问题）
  protocol.handle('local-media', (request) => {
    // URL 格式: local-media:///C:/path/to/file.mp3
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    // Windows 下去掉路径开头的斜杠 (如 /C:/... → C:/...)
    const normalizedPath = process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath)
      ? filePath.slice(1)
      : filePath;
    return net.fetch(`file:///${normalizedPath.replace(/\\/g, '/')}`);
  });

  createWindow();
  createTray();

  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow.close());
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());
  ipcMain.handle('window:setAlwaysOnTop', (_, flag) => mainWindow.setAlwaysOnTop(flag));

  ipcMain.handle('notify', (_, { title, body }) => {
    new Notification({ title, body }).show();
  });

  // Media file selection
  ipcMain.handle('media:selectFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择媒体文件',
      filters: [
        { name: '媒体文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'weba', 'mp4', 'mkv', 'avi', 'webm', 'mov', 'wmv', 'flv', 'm4v', 'ogv'] },
        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'weba'] },
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'webm', 'mov', 'wmv', 'flv', 'm4v', 'ogv'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || !result.filePaths.length) return [];
    return result.filePaths.map((fp, i) => ({
      id: `file_${Date.now()}_${i}`,
      name: path.basename(fp, path.extname(fp)),
      path: fp,
      isFile: true,
    }));
  });

  ipcMain.handle('media:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择媒体文件夹',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return [];
    const dir = result.filePaths[0];
    const exts = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'weba', 'mp4', 'mkv', 'avi', 'webm', 'mov', 'wmv', 'flv', 'm4v', 'ogv']);
    const files = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).replace('.', '').toLowerCase();
          if (exts.has(ext)) {
            files.push({
              id: `file_${Date.now()}_${files.length}`,
              name: path.basename(entry.name, path.extname(entry.name)),
              path: path.join(dir, entry.name),
              isFile: true,
            });
          }
        }
      }
    } catch (e) { /* ignore */ }
    return files;
  });

  // Simple JSON file store
  ipcMain.handle('store:get', (_, key) => {
    const data = readStore();
    return data[key];
  });
  ipcMain.handle('store:set', (_, key, value) => {
    const data = readStore();
    data[key] = value;
    writeStore(data);
    return true;
  });
  ipcMain.handle('store:delete', (_, key) => {
    const data = readStore();
    delete data[key];
    writeStore(data);
    return true;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  tray = null;
});
