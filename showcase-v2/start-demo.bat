@echo off
REM Starts the Version 2 demo server on http://localhost:8810 (pages need a server, not a double-click)
cd /d "%~dp0"
start "" http://localhost:8810
python serve.py 8810
