@echo off
title Uruchamianie TeamSpend
chcp 65001 > nul


echo [1/2] Startowanie serwera FastAPI (Backend)...
start "TeamSpend - Backend API" cmd /k "cd backend && uvicorn auth_service:app --reload --port 8001"

timeout /t 3 /nobreak > nul

echo [2/2] Startowanie interfejsu (Frontend)...

start "" "frontend\login.html"

echo ===================================================
echo   PROJEKT URUCHOMIONY POMYŚLNIE!
echo   Pamiętaj, aby NIE zamykać czarnych okienek terminala.
echo ===================================================
pause