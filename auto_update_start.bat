@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  World Earthquake Labs  -  auto update START
echo ============================================
echo.
echo This registers a Windows scheduled task that checks USGS every 45
echo minutes while this PC is on and you are logged in. When nothing new
echo has happened it stops there -- no download, no commit, no upload.
echo When there is a new earthquake it refreshes 3d\data\live and pushes
echo it to GitHub. It runs silently; progress goes to
echo scripts\logs\auto_update.log.
echo.

schtasks /Create /F /SC MINUTE /MO 45 /TN "WelEarthquakeAutoUpdate" ^
  /TR "wscript.exe \"%~dp0scripts\run_hidden.vbs\"" >nul
if %ERRORLEVEL% NEQ 0 (
  echo [!] could not register the scheduled task
  pause
  exit /b 1
)

echo [ok] scheduled task "WelEarthquakeAutoUpdate" registered (every 45 min).
echo [ok] kicking off the first cycle now...
schtasks /Run /TN "WelEarthquakeAutoUpdate" >nul

echo.
echo  - watch progress :  type scripts\logs\auto_update.log
echo  - run one cycle  :  auto_update_run.bat
echo  - stop           :  auto_update_stop.bat
echo.
pause
exit /b 0
