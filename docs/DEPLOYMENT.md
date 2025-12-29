# InfoSky 部署文档

本文档介绍如何在服务器上部署 InfoSky 应用。

## 目录

- [环境要求](#环境要求)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [常见问题](#常见问题)

---

## 环境要求

### 后端 (Python/FastAPI)
- Python 3.10+
- pip 或 pipenv

### 前端 (Next.js)
- Node.js 18+
- npm 或 yarn

### 系统要求
- Windows / Linux / macOS
- 至少 2GB 内存
- 至少 1GB 可用磁盘空间

---

## 开发环境部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd infosky
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="https://api.deepseek.com"
OPENAI_MODEL="deepseek-chat"
```

> **说明**: 支持 OpenAI 兼容的任何 API，包括 DeepSeek、Ollama 本地模型等。

### 3. 安装后端依赖

```bash
cd server
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. 安装前端依赖

```bash
cd client
npm install
```

### 5. 一键启动 (Windows)

项目提供了便捷启动脚本：

```powershell
# PowerShell
.\start-all.ps1

# 或使用 CMD
.\start-all.bat
```

启动后访问：
- 前端页面: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

---

## 生产环境部署

### 方式一：传统部署

#### 1. 构建前端

```bash
cd client
npm run build
```

构建产物位于 `client/.next/` 目录。

#### 2. 启动后端服务

使用 Gunicorn (Linux) 或 Uvicorn：

```bash
# 使用 Uvicorn (推荐)
cd /path/to/infosky
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --workers 4

# 使用 Gunicorn + Uvicorn workers (Linux)
gunicorn server.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

#### 3. 启动前端服务

```bash
cd client
npm run start
```

默认监听端口 3000。

#### 4. 配置反向代理 (Nginx 示例)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 5. 使用 PM2/Systemd 管理进程

**PM2 示例 (前端):**

```bash
npm install -g pm2
cd client
pm2 start npm --name "infosky-frontend" -- run start
```

**Systemd 示例 (后端):**

创建 `/etc/systemd/system/infosky-backend.service`:

```ini
[Unit]
Description=InfoSky Backend API
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/infosky
Environment="PATH=/path/to/infosky/server/.venv/bin"
ExecStart=/path/to/infosky/server/.venv/bin/python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable infosky-backend
sudo systemctl start infosky-backend
```

---

## Docker 部署

### 1. 创建后端 Dockerfile

创建 `server/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. 创建前端 Dockerfile

创建 `client/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start"]
```

### 3. 创建 docker-compose.yml

在项目根目录创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL}
      - OPENAI_MODEL=${OPENAI_MODEL}
    volumes:
      - ./database.db:/app/database.db
    restart: unless-stopped

  frontend:
    build: ./client
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped
```

### 4. 启动服务

```bash
docker-compose up -d
```

---

## 常见问题

### Q: 后端启动报错 "ModuleNotFoundError"

**A:** 确保从项目根目录启动，而不是 server 目录：

```bash
cd /path/to/infosky
python -m uvicorn server.main:app --port 8000
```

### Q: CORS 跨域错误

**A:** 修改 `server/main.py` 中的 `allow_origins` 配置：

```python
allow_origins=["http://your-domain.com", "http://localhost:3000"]
```

### Q: 数据库文件位置

**A:** SQLite 数据库默认存储在项目根目录的 `database.db`。生产环境建议使用绝对路径或挂载卷。

### Q: 如何更换 AI 模型

**A:** 修改 `.env` 文件中的配置即可，支持任何 OpenAI 兼容 API：

```env
# 使用 Ollama 本地模型
OPENAI_BASE_URL="http://localhost:11434/v1"
OPENAI_MODEL="llama2"
OPENAI_API_KEY=""

# 使用 OpenAI 官方
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4"
OPENAI_API_KEY="sk-xxx"
```
