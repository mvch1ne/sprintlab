#!/usr/bin/env bash
# Build the SprintLab Python backend into a standalone binary with PyInstaller.
# Run from the backend/ directory:  ./build_backend.sh
set -e

cd "$(dirname "$0")"

echo "Installing/upgrading PyInstaller..."
pip install --upgrade pyinstaller

echo "Building SprintLabBackend..."
pyinstaller SprintLabBackend.spec \
  --distpath dist \
  --workpath build_tmp \
  --noconfirm

echo ""
echo "✅ Binary at: backend/dist/SprintLabBackend/SprintLabBackend"
