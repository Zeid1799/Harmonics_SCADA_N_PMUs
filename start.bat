@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%
echo ====================================================
echo Starting Waveform Analysis Suite (Tab 1: Wave Generator)...
echo ====================================================
call npm run dev
pause
