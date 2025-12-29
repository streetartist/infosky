# InfoSky 离线桌面应用打包指南

本文档介绍如何将 InfoSky 打包成独立的离线桌面应用 (Electron)。

## 目录

- [方案概述](#方案概述)
- [准备工作](#准备工作)
- [方案一：Electron 打包](#方案一electron-打包)
- [方案二：Tauri 打包](#方案二tauri-打包)
- [自动化构建脚本](#自动化构建脚本)
- [常见问题](#常见问题)

---

## 方案概述

InfoSky 可以打包成离线桌面应用，实现以下效果：

- ✅ 双击即可运行，无需安装 Python/Node.js
- ✅ 前后端一体，无需分别启动
- ✅ 支持 Windows / macOS / Linux
- ✅ 可选集成本地 AI 模型 (Ollama)

### 技术方案对比

| 特性 | Electron | Tauri |
|------|----------|-------|
| 打包体积 | ~150MB+ | ~10MB+ |
| 内存占用 | 较高 | 较低 |
| 开发复杂度 | 简单 | 中等 |
| Python 后端支持 | 需要打包 | 需要打包 |

> **推荐**: 使用 Electron + PyInstaller 方案，生态成熟、文档丰富。

---

## 准备工作

### 1. 安装打包工具

```bash
# 全局安装 electron-builder
npm install -g electron-builder

# 安装 PyInstaller (打包 Python 后端)
pip install pyinstaller
```

### 2. 项目结构调整

创建以下目录结构：

```
infosky/
├── desktop/                 # Electron 主进程
│   ├── main.js
│   ├── preload.js
│   └── package.json
├── client/                  # Next.js 前端 (已有)
├── server/                  # FastAPI 后端 (已有)
└── dist/                    # 打包输出
```

---

## 方案一：Electron 打包

### Step 1: 创建 Electron 主进程

创建 `desktop/package.json`:

```json
{
  "name": "infosky-desktop",
  "version": "1.0.0",
  "description": "InfoSky 知识星图 - 桌面版",
  "main": "main.js",
  "author": "Your Name",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "dependencies": {
    "electron-is-dev": "^2.0.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  },
  "build": {
    "appId": "com.infosky.desktop",
    "productName": "InfoSky",
    "directories": {
      "output": "../dist"
    },
    "files": [
      "**/*",
      "../client/.next/**/*",
      "../backend-dist/**/*"
    ],
    "extraResources": [
      {
        "from": "../backend-dist",
        "to": "backend",
        "filter": ["**/*"]
      },
      {
        "from": "../database.db",
        "to": "database.db"
      }
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "icon.ico",
      "uninstallerIcon": "icon.ico"
    }
  }
}
```

创建 `desktop/main.js`:

```javascript
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow;
let backendProcess;

// 启动后端服务
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'server')
    : path.join(process.resourcesPath, 'backend');
  
  const backendExe = process.platform === 'win32' 
    ? 'infosky-backend.exe' 
    : 'infosky-backend';
  
  const exePath = path.join(backendPath, backendExe);
  
  console.log('Starting backend from:', exePath);
  
  backendProcess = spawn(exePath, [], {
    cwd: backendPath,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
  
  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
    dialog.showErrorBox('启动失败', '后端服务启动失败，请检查日志。');
  });
}

// 等待后端启动
async function waitForBackend(maxRetries = 30) {
  const http = require('http');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8000/', (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error('Backend not ready'));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log('Backend is ready!');
      return true;
    } catch (e) {
      console.log(`Waiting for backend... (${i + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'InfoSky - 知识星图'
  });

  // 开发模式连接 Next.js dev server，生产模式加载本地文件
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '..', 'client', 'out', 'index.html')}`;
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // 先启动后端
  startBackend();
  
  // 等待后端就绪
  const backendReady = await waitForBackend();
  if (!backendReady) {
    dialog.showErrorBox('启动失败', '后端服务启动超时，请重试。');
    app.quit();
    return;
  }
  
  // 创建窗口
  createWindow();
});

app.on('window-all-closed', () => {
  // 关闭后端进程
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

创建 `desktop/preload.js`:

```javascript
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
```

### Step 2: 打包 Python 后端

创建 `server/build-backend.spec` (PyInstaller 配置):

```python
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('.env', '.'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'api',
        'api.ingest',
        'api.graph',
        'api.config',
        'api.search',
        'api.chat',
        'api.library',
        'core',
        'database',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='infosky-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # 设置为 False 可隐藏控制台
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

运行打包命令：

```bash
cd server
pyinstaller build-backend.spec --distpath ../backend-dist
```

### Step 3: 配置 Next.js 静态导出

修改 `client/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // 启用静态导出
  trailingSlash: true,
  images: {
    unoptimized: true,  // 静态导出需要禁用图片优化
  },
};

export default nextConfig;
```

构建前端：

```bash
cd client
npm run build
```

静态文件将输出到 `client/out/` 目录。

### Step 4: 打包 Electron 应用

```bash
cd desktop
npm install
npm run build
```

打包产物位于 `dist/` 目录：
- Windows: `InfoSky Setup x.x.x.exe` (安装包) 或 `InfoSky x.x.x.exe` (便携版)
- macOS: `InfoSky-x.x.x.dmg`
- Linux: `InfoSky-x.x.x.AppImage`

---

## 方案二：Tauri 打包

Tauri 是一个更轻量的替代方案，但需要 Rust 环境。

### 安装 Tauri

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli
```

### 初始化 Tauri

```bash
cd client
npm add -D @tauri-apps/cli
npx tauri init
```

后续配置与 Electron 类似，参考 [Tauri 官方文档](https://tauri.app/v1/guides/)。

---

## 自动化构建脚本

创建 `build-desktop.ps1`:

```powershell
# InfoSky 桌面版打包脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  InfoSky Desktop Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Step 1: 打包后端
Write-Host "`n[1/4] Building Python backend..." -ForegroundColor Green
Set-Location "$projectRoot\server"
if (Test-Path ".venv\Scripts\Activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
}
pyinstaller build-backend.spec --distpath "$projectRoot\backend-dist" --clean -y

# Step 2: 构建前端
Write-Host "`n[2/4] Building Next.js frontend..." -ForegroundColor Green
Set-Location "$projectRoot\client"
npm run build

# Step 3: 安装 Electron 依赖
Write-Host "`n[3/4] Installing Electron dependencies..." -ForegroundColor Green
Set-Location "$projectRoot\desktop"
npm install

# Step 4: 打包 Electron 应用
Write-Host "`n[4/4] Building Electron app..." -ForegroundColor Green
npm run build

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Output: $projectRoot\dist\" -ForegroundColor Yellow
```

---

## 常见问题

### Q: 打包后体积太大怎么办？

**A:** 
- 使用 `--onefile` 而非 `--onedir` 减少文件数量
- 排除不必要的 Python 包
- 使用 UPX 压缩

### Q: 后端启动失败？

**A:** 检查以下几点：
1. PyInstaller 是否正确打包了所有依赖
2. 工作目录是否正确
3. 端口 8000 是否被占用

### Q: macOS 上无法运行？

**A:** 需要进行代码签名：
```bash
codesign --force --deep --sign - "InfoSky.app"
```

### Q: 如何集成本地 AI 模型？

**A:** 可以将 Ollama 一起打包：
1. 下载 Ollama 发行版
2. 在 Electron 启动时先启动 Ollama
3. 配置 `OPENAI_BASE_URL=http://localhost:11434/v1`

### Q: 如何更新应用？

**A:** electron-builder 支持自动更新：
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "infosky"
    }
  }
}
```

然后在 main.js 中添加 electron-updater 逻辑。
