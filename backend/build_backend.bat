@echo off
REM Build the SprintLab Python backend into a standalone binary with PyInstaller.
REM Run from the backend\ directory:  build_backend.bat

cd /d "%~dp0"

echo Installing/upgrading PyInstaller...
pip install --upgrade pyinstaller

echo Building SprintLabBackend...
pyinstaller SprintLabBackend.spec ^
  --distpath dist ^
  --workpath build_tmp ^
  --noconfirm

echo.
echo Build complete: backend\dist\SprintLabBackend\SprintLabBackend.exe
