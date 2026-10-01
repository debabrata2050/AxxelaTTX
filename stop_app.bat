@echo off
title Stop Axxela TTX Platform
cls
echo.
echo   /$$$$$$                                /$$                 /$$$$$$$$ /$$$$$$$$ /$$   /$$
echo  /$$__  $$                              ^| $$                ^|__  $$__/^|__  $$__/^| $$  / $$
echo ^| $$  \ $$ /$$   /$$ /$$   /$$  /$$$$$$ ^| $$  /$$$$$$          ^| $$      ^| $$   ^|  $$/ $$/
echo ^| $$$$$$$$^|  $$ /$$/^|  $$ /$$/ /$$__  $$^| $$ ^|____  $$         ^| $$      ^| $$    \  $$$$/ 
echo ^| $$__  $$ \  $$$$/  \  $$$$/ ^| $$$$$$$$^| $$  /$$$$$$$         ^| $$      ^| $$     ^>$$  $$ 
echo ^| $$  ^| $$  ^>$$  $$   ^>$$  $$ ^| $$_____/^| $$ /$$__  $$         ^| $$      ^| $$    /$$/\  $$
echo ^| $$  ^| $$ /$$/\  $$ /$$/\  $$^|  $$$$$$$^| $$^|  $$$$$$$         ^| $$      ^| $$   ^| $$  \ $$
echo ^|__/  ^|__/^|__/  \__/^|__/  \__/ \_______/^|__/ \_______/         ^|__/      ^|__/   ^|__/  ^|__/
echo.
echo ==========================================================================================
echo                             STOPPING AXXELA TTX PLATFORM
echo ==========================================================================================
echo.

echo Terminating backend processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Terminating frontend processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All Axxela processes terminated successfully.
echo.
timeout /t 2 /nobreak >nul
