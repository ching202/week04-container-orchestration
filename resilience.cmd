@echo off
setlocal
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%NODE_EXE%" "%~dp0scripts\resilience.mjs"
set "test_exit=%ERRORLEVEL%"
echo.
echo Results are saved under the project's evidence folder.
pause
exit /b %test_exit%
