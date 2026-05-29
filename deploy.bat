@echo off
cd /d D:\BUSINESS\executables\love\eklipses\EK7

if "%1"=="" (
    echo Usage: deploy.bat "your commit message"
    pause
    exit /b
)

echo.
echo === EKLIPSES DEPLOY ===
echo Committing: %1
echo.

git add -A
git commit -m "%1"
git push origin HEAD
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_l6CBJ6apO3R4vIkcoaXzZO89zXFH/dzoXAksvJp?buildCache=false"

echo.
echo === DONE. Vercel deploy triggered. ===
echo Wait 60 seconds then test at https://eklipses.vercel.app?dev=ek_dev_2026
echo.
pause
