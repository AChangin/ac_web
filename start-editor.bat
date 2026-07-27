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

echo   Starting Node.js server at http://localhost:8080...
echo.
start "AC Portfolio Server" /MIN node server.js 8080

:: Wait for server to be ready (up to 15 seconds)
echo   Waiting for server...
set RETRY=0
:wait
ping -n 2 127.0.0.1 >nul
curl -s -o nul http://localhost:8080/editor.html 2>nul
if not errorlevel 1 goto ready
set /a RETRY+=1
if %RETRY% LSS 10 goto wait

echo   WARNING: Server did not respond. Opening browser anyway...
:ready
echo   Opening editor in browser...
start http://localhost:8080/editor.html
echo   Press Ctrl+C in the server window to stop
echo.
pause
