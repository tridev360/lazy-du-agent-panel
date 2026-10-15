@echo off
cd /d "%~dp0"
node abrir.cjs
if errorlevel 1 pause
