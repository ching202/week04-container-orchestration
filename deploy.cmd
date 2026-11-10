@echo off
setlocal
echo Building and deploying the Week 04 application...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1"
set "deploy_exit=%ERRORLEVEL%"
echo.
if "%deploy_exit%"=="0" (
  echo Deployment succeeded. Open http://127.0.0.1:8080 in your browser.
) else (
  echo Deployment did not finish. See the error above and the evidence folder.
)
pause
exit /b %deploy_exit%
