@echo off
title ObsidianNode Local API Daemon
cd /d "%~dp0"

if not exist node_modules (
    echo Installing Local Daemon Dependencies...
    call npm install
)

echo Starting Local Daemon Server...
call npm start
pause
