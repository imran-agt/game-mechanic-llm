@echo off
:: GameMechanicLLM Windows EXE Build Script
:: Optimized for VS Code task execution

echo.
echo ========================================================
echo    GameMechanicLLM Windows EXE Builder
echo ========================================================
echo.

:: Check if Bun is installed
where bun >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Bun is not installed!
    echo Please install Bun from: https://bun.sh
    exit /b 1
)

echo [OK] Bun is installed
echo.

:: Step 1: Clean dist directory
echo ========================================================
echo Step 1/6: Preparing build directory
echo ========================================================
if exist "dist" rmdir /s /q dist
mkdir dist
mkdir dist\storage
mkdir dist\hotdir
echo [OK] Dist directory ready
echo.

:: Step 2: Build frontend
echo ========================================================
echo Step 2/6: Building frontend
echo ========================================================
cd frontend
bun install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend install failed
    cd ..
    exit /b 1
)
bun run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed
    cd ..
    exit /b 1
)
cd ..
echo [OK] Frontend built
echo.

:: Step 3: Copy frontend to server
echo ========================================================
echo Step 3/6: Copying frontend to server
echo ========================================================
if exist "server\public" rmdir /s /q server\public
xcopy /E /I /Y /Q frontend\dist server\public >nul
echo [OK] Frontend copied
echo.

:: Step 4: Build server executable
echo ========================================================
echo Step 4/6: Building server executable
echo ========================================================
cd server

:: Install deps if needed
if not exist "node_modules" (
    echo Installing server dependencies...
    bun install
)

:: Generate Prisma (skip if already exists to avoid hanging)
if exist "node_modules\.prisma\client\index.js" (
    echo [OK] Prisma client already exists, skipping generation
) else (
    echo Generating Prisma client...
    :: Disable update check and telemetry to prevent hanging
    set PRISMA_HIDE_UPDATE_MESSAGE=true
    set CHECKPOINT_DISABLE=1
    bun node_modules/prisma/build/index.js generate
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Prisma generation failed
        cd ..
        exit /b 1
    )
    echo [OK] Prisma client generated
)

:: Build server
echo Building server executable...
bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon=..\frontend\src\media\logo\workspace.ico --external mock-aws-s3 --external aws-sdk --external nock ./index.js --outfile ..\dist\gamemechanic-server.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Server build failed
    cd ..
    exit /b 1
)
cd ..
echo [OK] Server executable built
echo.

:: Step 5: Build collector executable
echo ========================================================
echo Step 5/6: Building collector executable
echo ========================================================
cd collector

:: Install deps if needed
if not exist "node_modules" (
    echo Installing collector dependencies...
    bun install
)

:: Build collector
echo Building collector executable...
bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon=..\frontend\src\media\logo\workspace.ico --external typescript --external fluent-ffmpeg --external pdf-parse ./index.js --outfile ..\dist\gamemechanic-collector.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Collector build failed
    cd ..
    exit /b 1
)
cd ..
echo [OK] Collector executable built
echo.

:: Step 6: Create distribution package
echo ========================================================
echo Step 6/6: Creating distribution package
echo ========================================================

:: Copy config examples
if exist "server\.env.example" copy /Y server\.env.example dist\server.env.example >nul
if exist "collector\.env.example" copy /Y collector\.env.example dist\collector.env.example >nul

:: Copy hotdir placeholder
if exist "collector\hotdir\__HOTDIR__.md" copy /Y collector\hotdir\__HOTDIR__.md dist\hotdir\ >nul

:: Copy public directory
xcopy /E /I /Y /Q server\public dist\public >nul

:: Copy Prisma artifacts
if exist "server\node_modules\.prisma" xcopy /E /I /Y /Q server\node_modules\.prisma dist\node_modules\.prisma >nul
if exist "server\node_modules\@prisma" xcopy /E /I /Y /Q server\node_modules\@prisma dist\node_modules\@prisma >nul

:: Copy swagger and jobs
if exist "server\swagger" xcopy /E /I /Y /Q server\swagger dist\swagger >nul
if exist "server\jobs" xcopy /E /I /Y /Q server\jobs dist\jobs >nul

:: Copy external collector dependencies
echo Copying external dependencies...
if not exist "dist\node_modules" mkdir dist\node_modules
for %%P in (pdf-parse fluent-ffmpeg typescript node-ensure debug ms) do (
    if exist "collector\node_modules\%%P" xcopy /E /I /Y /Q collector\node_modules\%%P dist\node_modules\%%P >nul
)

:: Create start.bat
echo @echo off> dist\start.bat
echo echo Starting GameMechanicLLM...>> dist\start.bat
echo start "Collector" cmd /k gamemechanic-collector.exe>> dist\start.bat
echo timeout /t 2 /nobreak ^> nul>> dist\start.bat
echo start "Server" cmd /k gamemechanic-server.exe>> dist\start.bat
echo echo Server: http://localhost:3001>> dist\start.bat

:: Create setup.bat
echo @echo off> dist\setup.bat
echo if not exist storage mkdir storage>> dist\setup.bat
echo if not exist hotdir mkdir hotdir>> dist\setup.bat
echo echo Generating security keys...>> dist\setup.bat
echo for /f %%%%i in ('powershell -Command "[guid]::NewGuid().ToString()"') do set JWT=%%%%i>> dist\setup.bat
echo for /f %%%%i in ('powershell -Command "[guid]::NewGuid().ToString()"') do set SIG=%%%%i>> dist\setup.bat
echo (>> dist\setup.bat
echo echo SERVER_PORT=3001>> dist\setup.bat
echo echo DATABASE_URL="file:./storage/gamemechanic-llm.db">> dist\setup.bat
echo echo COLLECTOR_PORT=8888>> dist\setup.bat
echo echo JWT_SECRET="%%JWT%%">> dist\setup.bat
echo echo SIG_KEY="%%SIG%%">> dist\setup.bat
echo echo SIG_SALT="%%SIG%%">> dist\setup.bat
echo echo LLM_PROVIDER='lmstudio'>> dist\setup.bat
echo echo LMSTUDIO_BASE_PATH='http://localhost:1234/v1'>> dist\setup.bat
echo echo EMBEDDING_ENGINE='lmstudio'>> dist\setup.bat
echo echo EMBEDDING_BASE_PATH='http://localhost:1234/v1'>> dist\setup.bat
echo echo VECTOR_DB="qdrant">> dist\setup.bat
echo echo QDRANT_ENDPOINT="http://localhost:6333">> dist\setup.bat
echo echo DISABLE_TELEMETRY=true>> dist\setup.bat
echo ) ^> .env>> dist\setup.bat
echo echo [OK] .env created>> dist\setup.bat
echo echo Run start.bat to launch>> dist\setup.bat

:: Create README
echo # GameMechanicLLM Windows Distribution> dist\README.txt
echo.>> dist\README.txt
echo 1. Run setup.bat to create .env>> dist\README.txt
echo 2. Run start.bat to launch>> dist\README.txt
echo 3. Open http://localhost:3001>> dist\README.txt

echo [OK] Distribution package created
echo.

:: Done
echo ========================================================
echo    Build Completed Successfully!
echo ========================================================
echo.
echo Output: dist\
echo   - gamemechanic-server.exe
echo   - gamemechanic-collector.exe
echo   - setup.bat / start.bat
echo.
echo Next: cd dist ^&^& setup.bat ^&^& start.bat
echo.
