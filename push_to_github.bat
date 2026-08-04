@echo off
title Push Minecraft Server Dashboard to GitHub
cd /d "%~dp0"

echo Setting up Git repository inside Website folder...

if not exist .git (
    git init
    git branch -M main
)

git remote remove origin >nul 2>&1
git remote add origin https://github.com/LOMoriartyVE/MinecraftServerDashboard.git

echo Adding files...
git add .

echo Committing changes...
git commit -m "Deploy ObsidianNode Minecraft Control Dashboard Next.js application"

echo Pushing to GitHub (https://github.com/LOMoriartyVE/MinecraftServerDashboard)...
git push -u origin main --force

echo.
echo ===================================================
echo SUCCESS: Pushed to GitHub repository!
echo Vercel will automatically build and deploy your site.
echo ===================================================
pause
