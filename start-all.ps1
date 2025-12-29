# InfoSky - 一键启动前后端服务
# 使用方法: 在项目根目录运行 .\start-all.ps1

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   InfoSky 开发服务器启动脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 启动后端服务 (FastAPI) - 从项目根目录以模块方式运行
Write-Host "[1/2] 启动后端服务 (FastAPI)..." -ForegroundColor Green
$backendJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot'; Write-Host 'Backend Server' -ForegroundColor Cyan; if (Test-Path 'server\.venv\Scripts\Activate.ps1') { & .\server\.venv\Scripts\Activate.ps1 } elseif (Test-Path 'server\venv\Scripts\Activate.ps1') { & .\server\venv\Scripts\Activate.ps1 }; python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000"
) -PassThru

Start-Sleep -Seconds 2

# 启动前端服务 (Next.js)
Write-Host "[2/2] 启动前端服务 (Next.js)..." -ForegroundColor Green
$frontendJob = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot\client'; Write-Host 'Frontend Server' -ForegroundColor Cyan; npm run dev"
) -PassThru

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   服务启动完成!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "后端 API:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "API 文档:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "前端页面: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "按任意键关闭此窗口 (服务将继续运行)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
