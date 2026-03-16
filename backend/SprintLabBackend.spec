# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for SprintLab backend.
# Build with: pyinstaller SprintLabBackend.spec --noconfirm
#
# Notes:
#  - onnxruntime has tricky hidden imports — listed explicitly below.
#  - rtmlib downloads ONNX model weights to ~/.cache on first run (internet required).
#  - OpenCV (cv2) binary libs are collected automatically by collect_dynamic_libs.

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

# Collect onnxruntime DLLs / .so files
binaries = collect_dynamic_libs('onnxruntime')

# Collect rtmlib package data (configs, etc.)
datas = collect_data_files('rtmlib')

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=[
        # onnxruntime internals
        'onnxruntime',
        'onnxruntime.capi',
        'onnxruntime.capi.onnxruntime_pybind11_state',
        # uvicorn
        'uvicorn',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.logging',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        # fastapi / starlette
        'fastapi',
        'starlette',
        'anyio',
        'anyio._backends._asyncio',
        # data / cv
        'cv2',
        'numpy',
        'numpy.core._methods',
        'numpy.lib.format',
        'pandas',
        'rtmlib',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SprintLabBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,        # UPX can corrupt onnxruntime DLLs — keep off
    console=True,     # Keep console for debugging; set False for silent prod
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
