@echo off
setlocal
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%NODE_EXE%" "%~dp0scripts\recording-demo.mjs"
set "demo_exit=%ERRORLEVEL%"
echo.
pause
exit /b %demo_exit%
