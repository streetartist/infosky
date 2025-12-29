[English](README_EN.md)

<div align="center">
  <img src="extension/icons/icon128.png" alt="InfoSky Logo" width="128" height="128">
  <h1>InfoSky</h1>
  <p>
    <strong>您的 AI 驱动知识星空</strong>
  </p>
  <p>
    利用 AI 和图网络的力量，捕捉、整理并将您的知识可视化。
  </p>
</div>

---

## 📖 简介

InfoSky 是一个全面的知识管理系统，旨在帮助您直观地组织信息。它结合了便于内容捕捉的浏览器扩展、用于 AI 处理的强大 Python 后端，以及用于展示令人惊叹的 3D 知识图谱的 Next.js 前端。

## ✨ 特性

- **🌐 浏览器扩展**：快速从网络上剪藏文章和内容（支持知乎等站点的特定解析）。
- **🧠 AI 处理**：使用先进的 AI 模型自动分析、打标签并总结摄入的内容。
- **🕸️ 知识图谱**：在交互式的 3D/2D 力导向图中可视化您的笔记和文章之间的联系。
- **⚡ 现代技术栈**：基于 Next.js 15, React 19, TailwindCSS 4 和 Python 构建。

## 🏗️ 架构

该项目由三个主要部分组成：

1.  **客户端 (`/client`)**：一个使用 Next.js 构建的现代 Web 应用程序，具有交互式图表可视化功能 (`react-force-graph`)。
2.  **服务端 (`/server`)**：一个基于 Python 的后端，处理数据摄入、AI 处理和数据库管理。
3.  **扩展 (`/extension`)**：一个浏览器扩展，用于直接从您的浏览会话中捕捉内容。

## 🚀 快速开始

### 前置要求

-   **Node.js** (推荐 v18+)
-   **Python** (推荐 v3.10+)

### 安装

1.  **克隆仓库：**
    ```bash
    git clone https://github.com/yourusername/infosky.git
    cd infosky
    ```

2.  **设置服务端：**
    ```bash
    cd server
    pip install -r requirements.txt
    ```

3.  **设置客户端：**
    ```bash
    cd ../client
    npm install
    # 或者
    yarn install
    ```

### ▶️ 使用方法

您可以使用根目录中提供的辅助脚本启动整个技术栈：

-   **Windows (Batch):**
    ```bash
    .\start-all.bat
    ```

-   **Windows (PowerShell):**
    ```powershell
    .\start-all.ps1
    ```

### 🧩 浏览器扩展安装与使用

1.  **加载扩展：**
    -   打开 Chrome 或 Edge 浏览器。
    -   在地址栏输入 `chrome://extensions` (Chrome) 或 `edge://extensions` (Edge) 并回车。
    -   打开右上角的 **“开发者模式” (Developer mode)** 开关。
    -   点击 **“加载已解压的扩展程序” (Load unpacked)** 按钮。
    -   选择本项目中的 `extension` 文件夹。

2.  **配置与使用：**
    -   点击浏览器工具栏中的 InfoSky 图标。
    -   点击右下角的设置图标（齿轮），确保服务器地址配置正确（默认为 `http://localhost:8000`）。
    -   浏览网页时，点击插件图标并选择 **"Clip Page"** 即可将当前页面保存到 InfoSky。

或者，分别运行每个组件：

-   **服务端：** `cd server && python main.py`
-   **客户端：** `cd client && npm run dev`

## 🛠️ 技术栈

-   **前端：** Next.js, React, TailwindCSS, Lucide React, Three.js
-   **后端：** Python
-   **数据库：** SQLite (默认)
-   **可视化：** 3D Force-Directed Graph

## 📄 许可证

本项目采用 GPL-3.0 许可证。
