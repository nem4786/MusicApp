@echo off
cd /d "%~dp0"
echo Ear Bench is running at http://localhost:8000
echo Keep this window open while you practise. Close it to stop.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
where py >nul 2>nul && (py -m http.server 8000 & goto :eof)
where python >nul 2>nul && (python -m http.server 8000 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8000 -c-1 & goto :eof)
echo Could not find Python or Node.js. Install Python from python.org, or just double-click index.html.
pause
