@echo off

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"

%CHROME% ^
  --disable-web-security ^
  --allow-file-access-from-files ^
  --user-data-dir="%~dp0chrome-dev-profile" ^
  "%~dp0index.html"