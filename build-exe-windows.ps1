# GameMechanicLLM Windows EXE Build Script (PowerShell)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "`n========================================================"
Write-Host "   GameMechanicLLM Windows EXE Builder"
Write-Host "========================================================`n"

# Check Bun
if (!(Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Bun is not installed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Bun is installed"

# Step 1: Prepare dist
Write-Host "`n========================================================"
Write-Host "Step 1/6: Preparing build directory"
Write-Host "========================================================"
if (Test-Path "$root\dist") { Remove-Item -Recurse -Force "$root\dist" }
New-Item -ItemType Directory -Path "$root\dist" | Out-Null
New-Item -ItemType Directory -Path "$root\dist\storage" | Out-Null
New-Item -ItemType Directory -Path "$root\dist\hotdir" | Out-Null
Write-Host "[OK] Dist directory ready"

# Step 2: Build frontend
Write-Host "`n========================================================"
Write-Host "Step 2/6: Building frontend"
Write-Host "========================================================"
Set-Location "$root\frontend"
& bun install
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Frontend install failed" -ForegroundColor Red; exit 1 }
& bun run build
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Frontend build failed" -ForegroundColor Red; exit 1 }
Set-Location $root
Write-Host "[OK] Frontend built"

# Step 3: Copy frontend
Write-Host "`n========================================================"
Write-Host "Step 3/6: Copying frontend to server"
Write-Host "========================================================"
if (Test-Path "$root\server\public") { Remove-Item -Recurse -Force "$root\server\public" }
Copy-Item -Recurse "$root\frontend\dist" "$root\server\public"
Write-Host "[OK] Frontend copied"

# Step 4: Build server
Write-Host "`n========================================================"
Write-Host "Step 4/6: Building server executable"
Write-Host "========================================================"
Set-Location "$root\server"

if (!(Test-Path "node_modules")) {
    Write-Host "Installing server dependencies..."
    & bun install
}

# Skip Prisma generate if client already exists (much faster)
$prismaClient = "$root\server\node_modules\.prisma\client\index.js"
if (Test-Path $prismaClient) {
    Write-Host "[OK] Prisma client already exists, skipping generation"
} else {
    Write-Host "Generating Prisma client..."
    # Disable update check and telemetry to prevent hanging
    $env:PRISMA_HIDE_UPDATE_MESSAGE = "true"
    $env:CHECKPOINT_DISABLE = "1"
    $process = Start-Process -FilePath "bun" -ArgumentList "node_modules/prisma/build/index.js", "generate" -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) { Write-Host "[ERROR] Prisma failed" -ForegroundColor Red; Set-Location $root; exit 1 }
    Write-Host "[OK] Prisma client generated"
}

Write-Host "Building server executable..."
$process = Start-Process -FilePath "bun" -ArgumentList "build", "--compile", "--target=bun-windows-x64", "--minify", "--sourcemap", "--windows-icon=$root\frontend\src\media\logo\workspace.ico", "--external", "mock-aws-s3", "--external", "aws-sdk", "--external", "nock", "./index.js", "--outfile", "$root\dist\gamemechanic-server.exe" -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ne 0) { Write-Host "[ERROR] Server build failed" -ForegroundColor Red; Set-Location $root; exit 1 }
Set-Location $root
Write-Host "[OK] Server executable built"

# Step 5: Build collector
Write-Host "`n========================================================"
Write-Host "Step 5/6: Building collector executable"
Write-Host "========================================================"
Set-Location "$root\collector"

if (!(Test-Path "node_modules")) {
    Write-Host "Installing collector dependencies..."
    & bun install
}

Write-Host "Building collector executable..."
$process = Start-Process -FilePath "bun" -ArgumentList "build", "--compile", "--target=bun-windows-x64", "--minify", "--sourcemap", "--windows-icon=$root\frontend\src\media\logo\workspace.ico", "--external", "typescript", "--external", "fluent-ffmpeg", "--external", "pdf-parse", "./index.js", "--outfile", "$root\dist\gamemechanic-collector.exe" -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ne 0) { Write-Host "[ERROR] Collector build failed" -ForegroundColor Red; Set-Location $root; exit 1 }
Set-Location $root
Write-Host "[OK] Collector executable built"

# Step 6: Package
Write-Host "`n========================================================"
Write-Host "Step 6/6: Creating distribution package"
Write-Host "========================================================"

# Copy configs
if (Test-Path "$root\server\.env.example") { Copy-Item "$root\server\.env.example" "$root\dist\server.env.example" }
if (Test-Path "$root\collector\.env.example") { Copy-Item "$root\collector\.env.example" "$root\dist\collector.env.example" }

# Copy public
Copy-Item -Recurse "$root\server\public" "$root\dist\public"

# Copy Prisma
if (Test-Path "$root\server\node_modules\.prisma") {
    Copy-Item -Recurse "$root\server\node_modules\.prisma" "$root\dist\node_modules\.prisma"
}
if (Test-Path "$root\server\node_modules\@prisma") {
    New-Item -ItemType Directory -Path "$root\dist\node_modules\@prisma" -Force | Out-Null
    Copy-Item -Recurse "$root\server\node_modules\@prisma\client" "$root\dist\node_modules\@prisma\client"
}

# Copy swagger/jobs
if (Test-Path "$root\server\swagger") { Copy-Item -Recurse "$root\server\swagger" "$root\dist\swagger" }
if (Test-Path "$root\server\jobs") { Copy-Item -Recurse "$root\server\jobs" "$root\dist\jobs" }

# Copy collector deps
$deps = @("pdf-parse", "fluent-ffmpeg", "typescript", "node-ensure", "debug", "ms")
foreach ($dep in $deps) {
    $src = "$root\collector\node_modules\$dep"
    if (Test-Path $src) { Copy-Item -Recurse $src "$root\dist\node_modules\$dep" }
}

# Create start.bat
@"
@echo off
echo Starting GameMechanicLLM...
start "Collector" cmd /k gamemechanic-collector.exe
timeout /t 2 /nobreak > nul
start "Server" cmd /k gamemechanic-server.exe
echo Server: http://localhost:3001
"@ | Out-File -FilePath "$root\dist\start.bat" -Encoding ASCII

# Create setup.bat
@"
@echo off
setlocal enabledelayedexpansion

:: GameMechanicLLM Setup Script
title GameMechanicLLM Setup

echo.
echo ========================================================
echo    GameMechanicLLM - Environment Setup
echo ========================================================
echo.

:: Check if .env already exists
if exist ".env" (
    echo [WARNING] .env file already exists!
    echo.
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "!OVERWRITE!"=="y" (
        echo.
        echo Setup cancelled. Existing .env file preserved.
        goto :end
    )
    echo.
)

:: Create directories
if not exist "hotdir" (
    mkdir hotdir
    echo [OK] Created hotdir directory
) else (
    echo [OK] Hotdir directory exists
)
if not exist "storage" (
    mkdir storage
    echo [OK] Created storage directory
) else (
    echo [OK] Storage directory exists
)

:: Check if server.env.example exists
if not exist "server.env.example" (
    echo [ERROR] server.env.example not found!
    goto :error
)

echo [OK] Found server.env.example template
echo.
echo Generating secure random keys...
echo.

:: Generate random strings using PowerShell
for /f %%i in ('powershell -Command "[System.Web.Security.Membership]::GeneratePassword(32,8)"') do set JWT_SECRET=%%i
for /f %%i in ('powershell -Command "[System.Web.Security.Membership]::GeneratePassword(64,16)"') do set SIG_KEY=%%i
for /f %%i in ('powershell -Command "[System.Web.Security.Membership]::GeneratePassword(64,16)"') do set SIG_SALT=%%i

:: Create .env file
echo Creating .env file...
(
    echo # GameMechanicLLM Configuration
    echo # Auto-generated on %%date%% at %%time%%
    echo.
    echo # NOTE: NODE_ENV is automatically set to 'production' by the executable
    echo.
    echo SERVER_PORT=3001
    echo DATABASE_URL="file:./storage/gamemechanic-llm.db"
    echo.
    echo # Collector Configuration
    echo COLLECTOR_HOTDIR="./hotdir"
    echo COLLECTOR_PORT=8888
    echo.
    echo ###########################################
    echo ######## VECTOR DATABASE #################
    echo ###########################################
    echo # QDrant is configured for RAG document storage
    echo # Make sure QDrant is running on port 6333
    echo # Docker: docker run -p 6333:6333 qdrant/qdrant
    echo.
    echo VECTOR_DB="qdrant"
    echo QDRANT_ENDPOINT="http://localhost:6333"
    echo # QDRANT_API_KEY=     # Optional for local instance
    echo.
    echo # Security Keys - Auto-generated
    echo JWT_SECRET="!JWT_SECRET!"
    echo SIG_KEY="!SIG_KEY!"
    echo SIG_SALT="!SIG_SALT!"
    echo.
    echo ###########################################
    echo ######## LLM API SELECTION ###############
    echo ###########################################
    echo # LMStudio is pre-configured for local LLM usage
    echo # Make sure LMStudio is running on port 5000
    echo.
    echo LLM_PROVIDER='lmstudio'
    echo LMSTUDIO_BASE_PATH='http://localhost:5000/v1'
    echo LMSTUDIO_MODEL_PREF='Loaded from Chat UI'
    echo LMSTUDIO_MODEL_TOKEN_LIMIT=4096
    echo.
    echo ###########################################
    echo ######## EMBEDDING API SELECTION #########
    echo ###########################################
    echo # LMStudio is pre-configured for embeddings
    echo.
    echo EMBEDDING_ENGINE='lmstudio'
    echo EMBEDDING_BASE_PATH='http://localhost:5000/v1'
    echo EMBEDDING_MODEL_MAX_CHUNK_LENGTH='8192'
    echo EMBEDDING_MODEL_PREF='text-embedding-nomic-embed-text-v1.5'
    echo.
    echo # Alternative providers - uncomment to use:
    echo.
    echo # LLM_PROVIDER='openai'
    echo # OPEN_AI_KEY=sk-your-api-key-here
    echo # OPEN_MODEL_PREF='gpt-4o'
    echo.
    echo # LLM_PROVIDER='anthropic'
    echo # ANTHROPIC_API_KEY=sk-ant-your-api-key-here
    echo # ANTHROPIC_MODEL_PREF='claude-3-5-sonnet-20241022'
    echo.
    echo # LLM_PROVIDER='ollama'
    echo # OLLAMA_BASE_PATH='http://localhost:11434'
    echo # OLLAMA_MODEL_PREF='llama2'
    echo.
    echo DISABLE_TELEMETRY=true
) > .env

echo ========================================================
echo.
echo [OK] .env file created successfully
echo [OK] Storage directory ready
echo [OK] Security keys generated
echo.
echo DATABASE: ./storage/gamemechanic-llm.db
echo SERVER PORT: 3001
echo.
echo ========================================================
echo    Next Steps:
echo ========================================================
echo 1. Run start-qdrant.bat to start QDrant vector DB
echo 2. Make sure LMStudio is running on port 1234
echo 3. Run start.bat to launch the application
echo 4. Open http://localhost:3001 in your browser
echo.
goto :end

:error
echo Setup failed. Please check the error above.
pause
exit /b 1

:end
echo Press any key to exit...
pause >nul
"@ | Out-File -FilePath "$root\dist\setup.bat" -Encoding ASCII

# Create start-qdrant.bat
@"
@echo off
title QDrant Vector Database
echo.
echo ========================================================
echo    Starting QDrant Vector Database
echo ========================================================
echo.
echo Make sure Docker is installed and running
echo Press Ctrl+C to stop
echo.
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running!
    pause
    exit /b 1
)
echo [OK] Docker is running
echo Starting QDrant on port 6333...
docker run -p 6333:6333 -p 6334:6334 -v "%cd%\qdrant_storage:/qdrant/storage" qdrant/qdrant
pause
"@ | Out-File -FilePath "$root\dist\start-qdrant.bat" -Encoding ASCII

# Create README.txt
@"
# GameMechanicLLM - Windows Distribution

## Quick Start

1. Run setup.bat - Creates .env with secure keys
2. (Optional) Run start-qdrant.bat for RAG/vector features
3. Run start.bat to launch the application
4. Open http://localhost:3001

## Files

- gamemechanic-server.exe - Main server (port 3001)
- gamemechanic-collector.exe - Document processor (port 8888)
- setup.bat - Environment configuration
- start.bat - Launch both services
- start-qdrant.bat - Start QDrant vector DB (requires Docker)

## Configuration

Edit .env to configure:
- LLM provider (LMStudio, OpenAI, Anthropic, Ollama)
- Embedding provider
- Vector database
- Server ports

See server.env.example for all options.
"@ | Out-File -FilePath "$root\dist\README.txt" -Encoding ASCII

Write-Host "[OK] Distribution package created"

# Done
Write-Host "`n========================================================"
Write-Host "   Build Completed Successfully!"
Write-Host "========================================================`n"
Write-Host "Output: dist\"
Write-Host "  - gamemechanic-server.exe"
Write-Host "  - gamemechanic-collector.exe"
Write-Host "  - setup.bat / start.bat`n"
Write-Host "Next: cd dist; .\setup.bat; .\start.bat"
