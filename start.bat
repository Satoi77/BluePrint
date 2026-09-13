@echo off
setlocal
cd /d "%~dp0"

echo [BluePrint] Starting backend on http://localhost:8000 ...
start "BluePrint Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --port 8000"

echo [BluePrint] Starting frontend on http://localhost:5173 ...
start "BluePrint Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [BluePrint] Waiting for services ...
ping -n 7 127.0.0.1 >nul

start "" http://localhost:5173/

echo.
echo [BluePrint] Browser opened. Close the two console windows to stop.
endlocal
