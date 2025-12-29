@echo off
echo Starting InfoSky Server...
echo.

REM 切换到项目根目录 (server 的父目录)
cd /d %~dp0..

REM Check if virtual environment exists
if exist "server\.venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call server\.venv\Scripts\activate.bat
) else if exist "server\venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call server\venv\Scripts\activate.bat
)

REM Install dependencies if needed
echo Checking dependencies...
pip install -r server\requirements.txt -q

echo.
echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
