@echo off
echo ==========================================
echo Starting auto-sync to GitHub...
echo ==========================================

:: Stage all changes
"C:\Program Files\Git\cmd\git.exe" add .

:: Commit with a generic timestamp message
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD% %HH%:%Min%:%Sec%"

"C:\Program Files\Git\cmd\git.exe" commit -m "Auto-sync: %timestamp%"

:: Push to remote main branch
"C:\Program Files\Git\cmd\git.exe" push origin main

echo ==========================================
echo Sync Complete!
echo ==========================================
