@echo off
title Push Minecraft Server Dashboard to GitHub
cd /d "%~dp0"

echo Removing conflicting Next.js route files if present...
if exist "src\app\api\proxy\route.js" del /f /q "src\app\api\proxy\route.js"

echo Setting up Git repository inside Website folder...

if not exist .git (
    git init
    git branch -M main
)

git remote remove origin >nul 2>&1
git remote add origin https://github.com/LOMoriartyVE/MinecraftServerDashboard.git

echo Adding files...
git add -A

echo Committing changes...
git commit -m "Deploy ObsidianNode optional catch-all API proxy route for BlueMap"

echo Pushing to GitHub (https://github.com/LOMoriartyVE/MinecraftServerDashboard)...
git push -u origin main --force

echo.
echo ===================================================
echo SUCCESS: Pushed to GitHub repository!
echo Vercel will automatically build and deploy your site.
echo ===================================================
pause
