[中文](README.md)

<div align="center">
  <img src="extension/icons/icon128.png" alt="InfoSky Logo" width="128" height="128">
  <h1>InfoSky</h1>
  <p>
    <strong>Your AI-Powered Knowledge Sky</strong>
  </p>
  <p>
    Capture, Organize, and Visualize your knowledge with the power of AI and Graph Networks.
  </p>
</div>

---

## 📖 Overview

InfoSky is a comprehensive knowledge management system designed to help you organize information intuitively. It combines a browser extension for easy content capturing, a powerful Python backend for AI processing, and a Next.js frontend for stunning 3D knowledge graph visualizations.

## ✨ Features

- **🌐 Browser Extension**: Quickly clip articles and content from the web (supports specific parsing for sites like Zhihu).
- **🧠 AI Processing**: Automatically analyze, tag, and summarize ingested content using advanced AI models.
- **🕸️ Knowledge Graph**: Visualize connections between your notes and articles in an interactive 3D/2D force-directed graph.
- **⚡ Modern Tech Stack**: Built with Next.js 15, React 19, TailwindCSS 4, and Python.

## 🏗️ Architecture

The project consists of three main components:

1.  **Client (`/client`)**: A modern web application built with Next.js, featuring interactive graph visualizations (`react-force-graph`).
2.  **Server (`/server`)**: A Python-based backend that handles data ingestion, AI processing, and database management.
3.  **Extension (`/extension`)**: A browser extension to capture content directly from your browsing session.

## 🚀 Getting Started

### Prerequisites

-   **Node.js** (v18+ recommended)
-   **Python** (v3.10+ recommended)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/infosky.git
    cd infosky
    ```

2.  **Setup Server:**
    ```bash
    cd server
    pip install -r requirements.txt
    ```

3.  **Setup Client:**
    ```bash
    cd ../client
    npm install
    # or
    yarn install
    ```

### ▶️ Usage

You can start the entire stack using the provided helper scripts in the root directory:

-   **Windows (Batch):**
    ```bash
    .\start-all.bat
    ```

-   **Windows (PowerShell):**
    ```powershell
    .\start-all.ps1
    ```

### 🧩 Browser Extension Installation & Usage

1.  **Load the Extension:**
    -   Open Chrome or Edge browser.
    -   Navigate to `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
    -   Enable **"Developer mode"** in the top right corner.
    -   Click **"Load unpacked"**.
    -   Select the `extension` folder from this project.

2.  **Configuration & Usage:**
    -   Click the InfoSky icon in your browser toolbar.
    -   Click the settings icon (gear) in the bottom right to verify the server address (default is `http://localhost:8000`).
    -   When browsing, click the extension icon and select **"Clip Page"** to save the current page to InfoSky.

## 🛠️ Technology Stack

-   **Frontend:** Next.js, React, TailwindCSS, Lucide React, Three.js
-   **Backend:** Python
-   **Database:** SQLite (default)
-   **Visualization:** 3D Force-Directed Graph

## 📄 License

This project is licensed under the GPL-3.0 License.
