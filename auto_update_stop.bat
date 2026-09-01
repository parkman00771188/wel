@echo off
setlocal

echo ============================================
echo  World Earthquake Labs  -  auto update STOP
echo ============================================
echo.

schtasks /Query /TN "WelEarthquakeAutoUpdate" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ok] auto update is not registered -- nothing to stop.
  pause
  exit /b 0
)

rem Stop a cycle that is mid-run, then remove the schedule.
schtasks /End /TN "WelEarthquakeAutoUpdate" >nul 2>nul
schtasks /Delete /F /TN "WelEarthquakeAutoUpdate" >nul
if %ERRORLEVEL% NEQ 0 (
  echo [!] could not remove the scheduled task
  pause
  exit /b 1
)

del "%TEMP%\wel_auto_update.lock" 2>nul
echo [ok] auto update stopped and unregistered.
echo     Commits that were already made stay in the repository.
pause
exit /b 0
