@echo off
rem One cycle of the scheduled refresh: ask USGS whether anything new has
rem happened and, only if it has, rewrite 3d\data\live and push it to GitHub.
rem Runs hidden every 30 minutes while auto_update_start.bat is active --
rem see auto_update_stop.bat to stop. Safe to double-click by hand as well.
rem The lock, the log rotation and the git work all live in
rem scripts\auto_update.py; everything lands in scripts\logs\auto_update.log.
setlocal
cd /d "%~dp0"

where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% scripts\auto_update.py
set RC=%ERRORLEVEL%

rem Double-clicked rather than launched by the scheduler: hold the window.
if "%1"=="" pause
exit /b %RC%
