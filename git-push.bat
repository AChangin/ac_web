@echo off
cd /d "%~dp0"

echo.
echo   === Changed files ===
git status --short

echo.
echo   === Detailed changes ===
git diff --stat

echo.
echo   --------------------------------------
set /p MSG="  Commit message: "
if "%MSG%"=="" (echo Cancelled. & pause & exit /b)

git add -A
git commit -m "%MSG%"
git push
echo.
echo   Done! Pushed to GitHub.
pause
