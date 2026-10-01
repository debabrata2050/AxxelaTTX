@echo off
start "" "%~dp0backend\start_backend.bat"
start "" "%~dp0frontend\start_frontend.bat"
start http://localhost:3000
exit
