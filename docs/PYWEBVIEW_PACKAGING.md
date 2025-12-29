# InfoSky 离线桌面应用打包指南 - PyWebview 方案

本文档介绍使用 Python 原生方案 (pywebview) 将 InfoSky 打包成独立桌面应用。

## 目录

- [方案优势](#方案优势)
- [环境准备](#环境准备)
- [快速开始](#快速开始)
- [完整实现](#完整实现)
- [打包发布](#打包发布)
- [常见问题](#常见问题)

---

## 方案优势

相比 Electron，pywebview 方案具有以下优点：

| 特性 | pywebview | Electron |
|------|-----------|----------|
| 打包体积 | ~30-50MB | ~150MB+ |
| 技术栈 | 纯 Python | Node.js + Python |
| 复杂度 | ⭐ 简单 | ⭐⭐⭐ 复杂 |
| 内存占用 | 较低 | 较高 |
| 系统 WebView | ✅ 使用系统自带 | ❌ 自带 Chromium |

> **推荐场景**: 如果你的项目已经是 Python 后端，使用 pywebview 是最简单的打包方案。

---

## 环境准备

### 安装依赖

```bash
pip install pywebview
pip install pyinstaller
```

### Windows 额外依赖

pywebview 在 Windows 上默认使用 EdgeChromium (WebView2)，需要确保系统已安装：
- Windows 10/11 通常已自带
- 或从 [Microsoft 下载](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

---

## 快速开始

### 最简示例

创建 `desktop_app.py`:

```python
import webview
import threading
import uvicorn
from server.main import app

def start_server():
    """在后台线程启动 FastAPI 服务器"""
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

if __name__ == '__main__':
    # 启动后端服务器 (后台线程)
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # 等待服务器启动
    import time
    time.sleep(2)
    
    # 创建桌面窗口
    webview.create_window(
        title='InfoSky - 知识星图',
        url='http://127.0.0.1:3000',  # 前端地址
        width=1400,
        height=900,
        min_size=(1024, 768)
    )
    webview.start()
```

运行：
```bash
python desktop_app.py
```

---

## 完整实现

### 项目结构

```
infosky/
├── desktop_app.py          # 桌面应用入口
├── client/                  # Next.js 前端
│   └── out/                 # 静态导出目录
├── server/                  # FastAPI 后端
└── dist/                    # 打包输出
```

### 完整代码

创建 `desktop_app.py`:

```python
"""
InfoSky Desktop Application
使用 pywebview 创建桌面应用
"""

import webview
import threading
import time
import socket
import sys
import os

# 确保可以从任意目录运行
if getattr(sys, 'frozen', False):
    # 打包后的路径
    BASE_DIR = sys._MEIPASS
    os.chdir(BASE_DIR)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 添加到 Python 路径
sys.path.insert(0, BASE_DIR)


class InfoSkyApp:
    def __init__(self):
        self.backend_port = 8000
        self.frontend_port = 8000  # 使用后端提供静态文件
        self.server_thread = None
        
    def is_port_available(self, port):
        """检查端口是否可用"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('127.0.0.1', port)) != 0
    
    def find_available_port(self, start_port=8000):
        """找到可用端口"""
        port = start_port
        while not self.is_port_available(port):
            port += 1
            if port > start_port + 100:
                raise RuntimeError("无法找到可用端口")
        return port
    
    def start_backend(self):
        """启动 FastAPI 后端"""
        import uvicorn
        from server.main import app as fastapi_app
        from fastapi.staticfiles import StaticFiles
        
        # 挂载前端静态文件
        static_path = os.path.join(BASE_DIR, 'client', 'out')
        if os.path.exists(static_path):
            fastapi_app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
        
        config = uvicorn.Config(
            fastapi_app,
            host="127.0.0.1",
            port=self.backend_port,
            log_level="warning",
            access_log=False
        )
        server = uvicorn.Server(config)
        server.run()
    
    def wait_for_server(self, timeout=30):
        """等待服务器启动"""
        import urllib.request
        import urllib.error
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{self.backend_port}/')
                return True
            except urllib.error.URLError:
                time.sleep(0.5)
        return False
    
    def run(self):
        """运行应用"""
        # 检查端口
        if not self.is_port_available(self.backend_port):
            self.backend_port = self.find_available_port(self.backend_port)
            print(f"使用备用端口: {self.backend_port}")
        
        # 启动后端服务器
        self.server_thread = threading.Thread(target=self.start_backend, daemon=True)
        self.server_thread.start()
        
        # 等待服务器就绪
        print("正在启动服务器...")
        if not self.wait_for_server():
            print("错误: 服务器启动超时")
            return
        
        print(f"服务器已启动: http://127.0.0.1:{self.backend_port}")
        
        # 创建窗口
        window = webview.create_window(
            title='InfoSky - 知识星图',
            url=f'http://127.0.0.1:{self.backend_port}',
            width=1400,
            height=900,
            min_size=(1024, 768),
            confirm_close=True,
            text_select=True
        )
        
        # 启动 GUI
        webview.start(
            debug=False,  # 设为 True 可开启开发者工具
            private_mode=False  # 允许存储 localStorage
        )


# 暴露给 JavaScript 的 API (可选)
class JsApi:
    def __init__(self, window):
        self.window = window
    
    def get_app_version(self):
        return "1.0.0"
    
    def minimize(self):
        self.window.minimize()
    
    def maximize(self):
        self.window.toggle_fullscreen()
    
    def close(self):
        self.window.destroy()


if __name__ == '__main__':
    app = InfoSkyApp()
    app.run()
```

### 配置 Next.js 静态导出

修改 `client/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 确保 API 调用指向正确地址
  env: {
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000',
  },
};

export default nextConfig;
```

构建前端：

```bash
cd client
npm run build
```

### 修改 FastAPI 支持静态文件

更新 `server/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import ingest, graph, config, search, chat, library
from contextlib import asynccontextmanager
from .database.database import create_db_and_tables
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="InfoSky API", version="0.1.0", lifespan=lifespan)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 桌面应用允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingestion"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(library.router, prefix="/api/library", tags=["library"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# 注意: 静态文件挂载在 desktop_app.py 中动态处理
# 如果需要在开发时测试，可以取消下面的注释
# static_path = os.path.join(os.path.dirname(__file__), '..', 'client', 'out')
# if os.path.exists(static_path):
#     app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
```

---

## 打包发布

### 创建 PyInstaller 配置

创建 `desktop_app.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# 收集所有需要的模块
hidden_imports = [
    'uvicorn.logging',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    # FastAPI & Pydantic
    'pydantic',
    'pydantic_settings',
    'email_validator',
    # Server modules
    'server',
    'server.main',
    'server.api',
    'server.api.ingest',
    'server.api.graph',
    'server.api.config',
    'server.api.search',
    'server.api.chat',
    'server.api.library',
    'server.core',
    'server.database',
    # pywebview backends
    'webview',
    'clr',  # Windows .NET
]

# 数据文件
datas = [
    ('client/out', 'client/out'),          # 前端静态文件
    ('server/.env', 'server'),              # 环境变量
    ('.env', '.'),                          # 根目录环境变量
    ('database.db', '.'),                   # 数据库 (如果需要初始数据)
]

# 排除不需要的模块以减小体积
excludes = [
    'tkinter',
    'matplotlib',
    'PIL',
    'numpy',
    'pandas',
]

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='InfoSky',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # 设为 True 可以看到调试输出
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',  # 应用图标
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='InfoSky',
)
```

### 打包命令

```bash
# 构建前端
cd client
npm run build
cd ..

# 打包应用
pyinstaller desktop_app.spec --clean -y
```

打包产物位于 `dist/InfoSky/` 目录。

### 创建安装包 (可选)

使用 NSIS 或 Inno Setup 创建 Windows 安装包：

**Inno Setup 脚本示例** (`setup.iss`):

```iss
[Setup]
AppName=InfoSky
AppVersion=1.0.0
DefaultDirName={autopf}\InfoSky
DefaultGroupName=InfoSky
OutputDir=installer
OutputBaseFilename=InfoSky-Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "dist\InfoSky\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\InfoSky"; Filename: "{app}\InfoSky.exe"
Name: "{commondesktop}\InfoSky"; Filename: "{app}\InfoSky.exe"

[Run]
Filename: "{app}\InfoSky.exe"; Description: "启动 InfoSky"; Flags: nowait postinstall skipifsilent
```

---

## 自动化构建脚本

创建 `build-pywebview.ps1`:

```powershell
# InfoSky PyWebview 打包脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  InfoSky PyWebview Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Step 1: 激活虚拟环境并安装依赖
Write-Host "`n[1/3] Installing Python dependencies..." -ForegroundColor Green
Set-Location "$projectRoot\server"
if (Test-Path ".venv\Scripts\Activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
}
pip install pywebview pyinstaller

# Step 2: 构建前端
Write-Host "`n[2/3] Building Next.js frontend..." -ForegroundColor Green
Set-Location "$projectRoot\client"
npm run build

# Step 3: 打包应用
Write-Host "`n[3/3] Building desktop app with PyInstaller..." -ForegroundColor Green
Set-Location $projectRoot
pyinstaller desktop_app.spec --clean -y

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Output: $projectRoot\dist\InfoSky\" -ForegroundColor Yellow
Write-Host "Run: .\dist\InfoSky\InfoSky.exe" -ForegroundColor Yellow
```

---

## 高级功能

### 添加系统托盘

```python
import webview

def on_tray_click():
    for window in webview.windows:
        window.show()

if __name__ == '__main__':
    window = webview.create_window('InfoSky', 'http://127.0.0.1:8000')
    webview.start(
        tray=True,
        tray_icon='icon.png',
        tray_menu_items={
            '显示窗口': on_tray_click,
            '退出': lambda: webview.windows[0].destroy()
        }
    )
```

### JavaScript 与 Python 交互

```python
class Api:
    def save_file(self, content, filename):
        """从前端保存文件到本地"""
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".md",
            initialfile=filename
        )
        
        if file_path:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return file_path
        return None

window = webview.create_window('InfoSky', 'http://127.0.0.1:8000', js_api=Api())
```

前端调用：

```javascript
// 在前端 JavaScript 中
const filePath = await window.pywebview.api.save_file(content, 'notes.md');
```

---

## 常见问题

### Q: 窗口显示空白？

**A:** 
1. 确保前端已正确构建到 `client/out/` 目录
2. 检查后端服务是否正常启动（设置 `console=True` 查看日志）

### Q: WebView2 未安装？

**A:** 提示用户安装 WebView2 运行时，或在应用启动时自动下载：

```python
import subprocess
# 自动安装 WebView2
subprocess.run([
    'powershell', '-Command',
    'Start-Process "https://go.microsoft.com/fwlink/p/?LinkId=2124703"'
])
```

### Q: 打包后找不到模块？

**A:** 在 `.spec` 文件的 `hiddenimports` 中添加缺失的模块。

### Q: 如何减小打包体积？

**A:** 
1. 使用 `--onefile` 选项 (会增加启动时间)
2. 添加更多 `excludes` 排除不需要的库
3. 使用 UPX 压缩

### Q: macOS/Linux 支持？

**A:** pywebview 跨平台支持：
- macOS: 使用 WebKit
- Linux: 使用 GTK + WebKit2

只需在对应系统上运行 PyInstaller 即可打包。
