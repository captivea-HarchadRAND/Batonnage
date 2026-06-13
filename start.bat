@echo off
echo [1/3] Arret des anciens processus Node...
taskkill /f /im node.exe >nul 2>&1

echo [2/3] Build du frontend...
cd frontend
call npm run build
if errorlevel 1 (
  echo ERREUR: build frontend echoue
  pause
  exit /b 1
)
cd ..

echo [3/3] Demarrage du serveur...
cd backend
node server.js
