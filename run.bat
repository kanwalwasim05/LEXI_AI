@echo off
echo Starting Lexi AI Agent...
echo.

:: Try to start a simple Python HTTP server if Python is installed
python --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo Python detected! Starting local server...
    echo Lexi will open in your browser at http://localhost:8000
    start http://localhost:8000
    python -m http.server 8000
    pause
    exit
)

:: Try Python 3 command just in case
python3 --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo Python 3 detected! Starting local server...
    echo Lexi will open in your browser at http://localhost:8000
    start http://localhost:8000
    python3 -m http.server 8000
    pause
    exit
)

:: If no python, just open the index.html file directly in the default browser
echo Opening Lexi directly in your default web browser...
start index.html
exit