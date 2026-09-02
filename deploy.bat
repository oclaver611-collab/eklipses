@echo off
setlocal
cd /d D:\BUSINESS\executables\love\eklipses\EK7

rem Accept message quoted or unquoted; %* joins all tokens, then strip any
rem surrounding quotes so git commit -m "..." always gets a clean string.
set MSG=%*
if not defined MSG goto :noargs
set "MSG=%MSG:"=%"
if not defined MSG goto :noargs
goto :deploy

:noargs
echo.
echo ERROR: No commit message provided.
echo Usage: deploy.bat "your commit message"
echo.
exit /b 1

:deploy
echo.
echo === EKLIPSES DEPLOY ===
echo Committing: %MSG%
echo.

rem Stamp current HEAD hash into ?v=... on all local script tags in index.html
for /f %%H in ('git rev-parse --short HEAD') do set VHASH=%%H
echo Stamping JS cache version: %VHASH%
powershell -Command "$v='%VHASH%'; $f='index.html'; $c=(Get-Content $f -Raw) -replace '\.js\?v=[a-f0-9]+', \".js?v=$v\"; [System.IO.File]::WriteAllText((Resolve-Path $f).Path, $c)"
if errorlevel 1 ( echo ERROR: version stamp update failed & exit /b 1 )

git add -A
if errorlevel 1 ( echo ERROR: git add failed & exit /b 1 )

git commit -m "%MSG%"
if errorlevel 1 ( echo ERROR: git commit failed & exit /b 1 )

git push origin main
if errorlevel 1 ( echo ERROR: git push failed & exit /b 1 )

curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_l6CBJ6apO3R4vIkcoaXzZO89zXFH/dzoXAksvJp?buildCache=false"
if errorlevel 1 ( echo ERROR: Vercel deploy trigger failed & exit /b 1 )

echo.
echo === DONE. Vercel deploy triggered. ===
echo Wait 60 seconds then test at https://eklipses.vercel.app?dev=ek_dev_2026
echo.
pause
endlocal
