@echo off
setlocal enabledelayedexpansion

:: GameMechanicLLM Quick Windows Build (Skip Prisma if already generated)
title GameMechanicLLM Quick Build

echo.
echo ========================================================
echo    GameMechanicLLM Quick Windows Build
echo    (Skips Prisma generation if already done)
echo ========================================================
echo.

:: Check if Bun is installed
where bun >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Bun is not installed!
    pause
    exit /b 1
)

echo [OK] Bun is installed
echo.

:: Check if Prisma is already generated
if exist "server\node_modules\.prisma\client" (
    echo [OK] Prisma client already exists - SKIPPING generation
    set SKIP_PRISMA=1
) else (
    echo [INFO] Prisma client not found - will generate
    set SKIP_PRISMA=0
)
echo.

:: Step 1: Clean dist directory
echo ========================================================
echo Step 1/6: Preparing build directory
echo ========================================================
if exist "dist" (
    rmdir /s /q dist 2>nul
    timeout /t 1 /nobreak >nul
)
mkdir dist
echo [OK] Dist directory ready
echo.

:: Step 2: Build frontend
echo ========================================================
echo Step 2/6: Building frontend
echo ========================================================
cd frontend
call bun install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend dependency installation failed
    cd ..
    pause
    exit /b 1
)
call bun run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend built
echo.

:: Step 3: Copy frontend
echo ========================================================
echo Step 3/6: Copying frontend to server
echo ========================================================
if exist "server\public" (
    rmdir /s /q server\public
)
xcopy /E /I /Y frontend\dist server\public >nul
echo [OK] Frontend copied
echo.

:: Step 4: Build server
echo ========================================================
echo Step 4/6: Building server executable with icon
echo ========================================================
cd server

:: Install dependencies
if not exist "node_modules" (
    echo Installing server dependencies...
    call bun install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Server dependency installation failed
        cd ..
        pause
        exit /b 1
    )
)

:: Generate Prisma client only if needed
if %SKIP_PRISMA%==0 (
    echo Generating Prisma client...
    echo [INFO] This may take 2-10 minutes on first run...
    echo [INFO] Check Task Manager to see if it's working
    echo.

    if exist "node_modules\.bin\prisma.cmd" (
        call node_modules\.bin\prisma.cmd generate
    ) else (
        call bun node_modules\.bin\prisma generate
    )

    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Prisma generation failed
        echo.
        echo Troubleshooting:
        echo 1. Check if it's downloading binaries (Task Manager)
        echo 2. Try running: test-prisma-windows.bat
        echo 3. See TROUBLESHOOTING-PRISMA.md for help
        echo.
        cd ..
        pause
        exit /b 1
    )
    echo [OK] Prisma client generated
) else (
    echo [OK] Using existing Prisma client
)
echo.

:: Build server executable
echo Building server executable...
set ICON_PATH=..\frontend\src\media\logo\workspace.ico
set OUTPUT_PATH=..\dist\gamemechanic-server.exe

call bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon="%ICON_PATH%" --external mock-aws-s3 --external aws-sdk --external nock ./index.js --outfile "%OUTPUT_PATH%"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Server build failed
    cd ..
    pause
    exit /b 1
)

cd ..
echo [OK] Server executable built with icon
echo.

:: Step 5: Build collector
echo ========================================================
echo Step 5/6: Building collector executable with icon
echo ========================================================
cd collector

if not exist "node_modules" (
    echo Installing collector dependencies...
    call bun install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Collector dependency installation failed
        cd ..
        pause
        exit /b 1
    )
)

echo Building collector executable...
set OUTPUT_PATH=..\dist\gamemechanic-collector.exe

call bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon="%ICON_PATH%" --external typescript --external fluent-ffmpeg --external pdf-parse ./index.js --outfile "%OUTPUT_PATH%"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Collector build failed
    cd ..
    pause
    exit /b 1
)

cd ..
echo [OK] Collector executable built with icon
echo.

:: Step 6: Copy files
echo ========================================================
echo Step 6/6: Creating distribution package
echo ========================================================

:: Copy everything needed
if exist "server\.env.example" copy /Y server\.env.example dist\server.env.example >nul
if exist "collector\.env.example" copy /Y collector\.env.example dist\collector.env.example >nul
if not exist "dist\storage" mkdir dist\storage
if not exist "dist\hotdir" mkdir dist\hotdir
if exist "collector\hotdir\__HOTDIR__.md" copy /Y collector\hotdir\__HOTDIR__.md dist\hotdir\ >nul
xcopy /E /I /Y server\public dist\public >nul
if exist "server\node_modules\.prisma" xcopy /E /I /Y server\node_modules\.prisma dist\node_modules\.prisma >nul
if exist "server\node_modules\@prisma" xcopy /E /I /Y server\node_modules\@prisma dist\node_modules\@prisma >nul
if exist "server\swagger" xcopy /E /I /Y server\swagger dist\swagger >nul
if exist "server\jobs" xcopy /E /I /Y server\jobs dist\jobs >nul

:: Copy collector dependencies
echo Copying collector dependencies...
if not exist "dist\node_modules" mkdir dist\node_modules
for %%P in (pdf-parse fluent-ffmpeg typescript node-ensure debug ms) do (
    if exist "collector\node_modules\%%P" (
        xcopy /E /I /Y collector\node_modules\%%P dist\node_modules\%%P >nul 2>&1
    )
)

echo [OK] Distribution package created
echo.

:: Display results
for %%F in (dist\gamemechanic-server.exe) do set SERVER_SIZE=%%~zF
for %%F in (dist\gamemechanic-collector.exe) do set COLLECTOR_SIZE=%%~zF
set /a SERVER_MB=!SERVER_SIZE! / 1048576
set /a COLLECTOR_MB=!COLLECTOR_SIZE! / 1048576

echo ========================================================
echo    Build Completed Successfully!
echo ========================================================
echo.
echo Package contents:
echo   [OK] gamemechanic-server.exe (!SERVER_MB! MB) - WITH ICON
echo   [OK] gamemechanic-collector.exe (!COLLECTOR_MB! MB) - WITH ICON
echo.
echo Next steps:
echo   cd dist
echo   setup.bat
echo   start.bat
echo.
pause
