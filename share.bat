@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%
echo ====================================================
echo Starting Application and Temporary Public Sharing URL
echo ====================================================
echo.
echo 1. Ensuring production build exists...
call npm run build
echo.
echo 2. Launching background preview server on port 4173...
start "Waveform App Preview" /min cmd /c "npm run preview -- --port 4173 --host"
timeout /t 3 /nobreak >nul
echo 3. Generating temporary public HTTPS URL via Cloudflare tunnel...
echo (Share the https://...trycloudflare.com URL below with other users)
echo Press Ctrl+C anytime to stop sharing.
echo.
call npx untun@latest tunnel http://localhost:4173
pause
