@echo off
REM Starts the demo web server (3D pages need a server, not a double-click) and opens http://localhost:8800
cd /d "%~dp0"
start "" http://localhost:8800
python serve.py 8800
