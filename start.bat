@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado no PATH.
  echo Instale o Node.js em https://nodejs.org/ e rode este arquivo novamente.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao foi encontrado no PATH.
  echo Reinstale o Node.js marcando a opcao de adicionar ao PATH.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Abrindo Conecta Rock em http://localhost:3000
start "" "http://localhost:3000"
call npm start
pause
