@echo off
title LexDominio Ecuador - Lanzador
chcp 65001 >nul

echo ======================================================================
echo   Iniciando LexDominio Ecuador (Servidor y Navegador Web)
echo ======================================================================

set "PATH=C:\Program Files\nodejs;%PATH%"

:: Verificar si el servidor ya está respondiendo en el puerto 3000
curl.exe -s -o nul http://localhost:3000/
if %errorlevel% neq 0 (
    echo Iniciando el servidor Node.js en segundo plano...
    start "" /b node server.js
    timeout /t 2 /nobreak >nul
) else (
    echo El servidor ya se encuentra activo en el puerto 3000.
)

echo Abriendo la aplicación en su navegador web...
start "" "http://localhost:3000"

echo.
echo ======================================================================
echo   LexDominio Ecuador listo:
echo   - Local:    http://localhost:3000
echo   - Red WiFi: http://192.168.110.171:3000
echo ======================================================================
timeout /t 5
