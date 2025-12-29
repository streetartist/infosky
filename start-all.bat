@echo off
chcp 65001 >nul
title InfoSky 开发服务器

echo.
echo =====================================
echo    InfoSky 开发服务器启动脚本
echo =====================================
echo.

REM 获取当前脚本目录
set "PROJECT_ROOT=%~dp0"

REM 启动后端服务 (新窗口) - 从项目根目录以模块方式运行
echo [1/2] 启动后端服务 (FastAPI)...
start "InfoSky Backend" cmd /k "cd /d %PROJECT_ROOT% && (if exist server\.venv\Scripts\activate.bat (call server\.venv\Scripts\activate.bat) else if exist server\venv\Scripts\activate.bat (call server\venv\Scripts\activate.bat)) && python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

REM 启动前端服务 (新窗口)
echo [2/2] 启动前端服务 (Next.js)...
start "InfoSky Frontend" cmd /k "cd /d %PROJECT_ROOT%client && npm run dev"

echo.
echo =====================================
echo    服务启动完成!
echo =====================================
echo.
echo 后端 API:  http://localhost:8000
echo API 文档:  http://localhost:8000/docs
echo 前端页面: http://localhost:3000
echo.
echo 按任意键关闭此窗口 (服务将继续运行)...
pause >nul
