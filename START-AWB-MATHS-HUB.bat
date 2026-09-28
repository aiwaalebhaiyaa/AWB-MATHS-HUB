@echo off
title AWB MATHS HUB
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist .env (
  echo.
  echo ERROR: backend\.env is missing.
  echo Copy .env.example to .env and fill your PostgreSQL details.
  pause
  exit /b 1
)
echo.
echo Starting AWB MATHS HUB...
echo Open http://localhost:3000
echo.
npm start
pause
