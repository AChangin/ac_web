@echo off
cd /d "%~dp0"
echo.
echo   AC Portfolio Editor
echo   -------------------

:: Kill any process on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| find ":8080" ^| find "LISTENING" 2^>nul') do (
  echo   Stopping process on port 8080 (PID %%a^)...
  taskkill /F /PID %%a >nul 2>&1
)

echo   Starting Node.js server at http://localhost:8080
echo   Opening editor in browser...
echo   Press Ctrl+C to stop
echo.
start http://localhost:8080/editor.html
node server.js 8080
pause
