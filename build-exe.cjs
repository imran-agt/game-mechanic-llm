#!/usr/bin/env node

/**
 * GameMechanicLLM Windows EXE Build Script
 *
 * This script builds the GameMechanicLLM application as standalone Windows executables using Bun.
 * It handles:
 * - Frontend build (React/Vite)
 * - Server compilation (Express.js)
 * - Collector compilation (Document processor)
 * - Asset bundling and directory structure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.bright}${colors.cyan}▶${colors.reset} ${colors.bright}${msg}${colors.reset}`),
};

// Configuration
const config = {
  distDir: path.join(__dirname, 'dist'),
  serverDir: path.join(__dirname, 'server'),
  collectorDir: path.join(__dirname, 'collector'),
  frontendDir: path.join(__dirname, 'frontend'),
  bunPath: process.env.BUN_PATH || '~/.bun/bin/bun',
};

// Utility functions
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.success(`Created directory: ${dir}`);
  }
}

function copyRecursive(src, dest) {
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    log.success(`Copied ${src} → ${dest}`);
  } else {
    log.warning(`Source not found: ${src}`);
  }
}

function runCommand(command, cwd, description) {
  try {
    log.info(description);
    execSync(command, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    log.success(`Completed: ${description}`);
    return true;
  } catch (error) {
    log.error(`Failed: ${description}`);
    log.error(error.message);
    return false;
  }
}

function checkBunInstalled() {
  try {
    execSync(`${config.bunPath} --version`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function isWindows() {
  return process.platform === 'win32';
}

/**
 * Note: Icon embedding using --windows-icon flag
 *
 * This script conditionally includes the --windows-icon flag for both executables.
 * Icon path: frontend/src/media/logo/workspace.ico
 *
 * Behavior:
 * - When building ON Windows: The --windows-icon flag is used and the icon is embedded
 * - When cross-compiling (Linux/WSL -> Windows): The flag is skipped (not supported by Bun)
 *
 * The build will succeed in both scenarios, but icon embedding only works when
 * running the build script directly on Windows.
 */

// Main build process
async function build() {
  console.log(`
${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   GameMechanicLLM Windows EXE Builder (Bun Edition)   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
`);

  // Step 0: Check Bun installation
  log.step('Checking prerequisites');
  if (!checkBunInstalled()) {
    log.error('Bun is not installed or not found in PATH');
    log.info('Install Bun from: https://bun.sh');
    process.exit(1);
  }
  log.success('Bun is installed');

  // Step 1: Clean and prepare dist directory
  log.step('Step 1/6: Preparing build directory');
  if (fs.existsSync(config.distDir)) {
    try {
      // Remove only the contents, not the directory itself
      const files = fs.readdirSync(config.distDir);
      for (const file of files) {
        const filePath = path.join(config.distDir, file);
        try {
          fs.rmSync(filePath, { recursive: true, force: true });
        } catch (e) {
          log.warn(`Could not remove ${file}: ${e.message}`);
        }
      }
      log.info('Cleaned existing dist directory');
    } catch (e) {
      log.warn(`Could not clean dist directory: ${e.message}`);
    }
  }
  ensureDir(config.distDir);

  // Step 2: Build frontend
  log.step('Step 2/6: Building frontend (React/Vite)');
  const frontendBuildSuccess = runCommand(
    `${config.bunPath} install && ${config.bunPath} run build`,
    config.frontendDir,
    'Building frontend application'
  );

  if (!frontendBuildSuccess) {
    log.error('Frontend build failed. Aborting.');
    process.exit(1);
  }

  // Step 3: Copy frontend to server/public
  log.step('Step 3/6: Copying frontend to server');
  const frontendDist = path.join(config.frontendDir, 'dist');
  const serverPublic = path.join(config.serverDir, 'public');

  if (fs.existsSync(serverPublic)) {
    fs.rmSync(serverPublic, { recursive: true, force: true });
  }
  copyRecursive(frontendDist, serverPublic);

  // Step 4: Install server dependencies and build
  log.step('Step 4/6: Building server executable');

  // Install dependencies if needed
  const serverNodeModules = path.join(config.serverDir, 'node_modules');
  if (!fs.existsSync(serverNodeModules)) {
    runCommand(
      `${config.bunPath} install`,
      config.serverDir,
      'Installing server dependencies'
    );
  }

  // Generate Prisma client (skip if already exists to avoid hanging)
  const prismaClientPath = path.join(config.serverDir, 'node_modules', '.prisma', 'client', 'index.js');

  if (fs.existsSync(prismaClientPath)) {
    log.success('Prisma client already exists, skipping generation');
  } else {
    log.info('Generating Prisma client...');

    // Disable update check and telemetry to prevent hanging
    process.env.PRISMA_HIDE_UPDATE_MESSAGE = 'true';
    process.env.CHECKPOINT_DISABLE = '1';

    // Use local Prisma installation to avoid bunx compatibility issues
    const prismaPath = path.join(config.serverDir, 'node_modules', '.bin', 'prisma');
    const prismaCommand = fs.existsSync(prismaPath)
      ? `${config.bunPath} ${prismaPath} generate`
      : `${config.bunPath} x prisma generate`;

    const prismaSuccess = runCommand(
      prismaCommand,
      config.serverDir,
      'Generating Prisma client'
    );

    if (!prismaSuccess) {
      log.error('Prisma generation failed. Aborting.');
      process.exit(1);
    }
  }

  // Build server executable
  const iconPath = path.join(__dirname, 'frontend', 'src', 'media', 'logo', 'workspace.ico');
  const serverExePath = path.join(config.distDir, 'gamemechanic-server.exe');

  // Build command with conditional icon flag
  const iconFlag = isWindows() ? `--windows-icon="${iconPath}"` : '';
  const serverBuildCommand = `${config.bunPath} build --compile --target=bun-windows-x64 --minify --sourcemap ${iconFlag} --external mock-aws-s3 --external aws-sdk --external nock ./index.js --outfile ${serverExePath}`.replace(/\s+/g, ' ').trim();

  const serverBuildSuccess = runCommand(
    serverBuildCommand,
    config.serverDir,
    'Compiling server to Windows EXE'
  );

  if (!serverBuildSuccess) {
    log.error('Server build failed. Aborting.');
    process.exit(1);
  }

  // Note: Icon embedding status
  if (isWindows()) {
    log.success('Icon embedded via --windows-icon flag');
  } else {
    log.warning('Icon embedding skipped (only available when building on Windows)');
  }

  // Step 5: Install collector dependencies and build
  log.step('Step 5/6: Building collector executable');

  const collectorNodeModules = path.join(config.collectorDir, 'node_modules');
  if (!fs.existsSync(collectorNodeModules)) {
    runCommand(
      `${config.bunPath} install`,
      config.collectorDir,
      'Installing collector dependencies'
    );
  }

  const collectorExePath = path.join(config.distDir, 'gamemechanic-collector.exe');

  // Build command with conditional icon flag
  const collectorBuildCommand = `${config.bunPath} build --compile --target=bun-windows-x64 --minify --sourcemap ${iconFlag} --external typescript --external fluent-ffmpeg --external pdf-parse ./index.js --outfile ${collectorExePath}`.replace(/\s+/g, ' ').trim();

  const collectorBuildSuccess = runCommand(
    collectorBuildCommand,
    config.collectorDir,
    'Compiling collector to Windows EXE'
  );

  if (!collectorBuildSuccess) {
    log.error('Collector build failed. Aborting.');
    process.exit(1);
  }

  // Note: Icon embedding status
  if (isWindows()) {
    log.success('Icon embedded via --windows-icon flag');
  } else {
    log.warning('Icon embedding skipped (only available when building on Windows)');
  }

  // Copy external collector dependencies to dist/node_modules
  log.info('Copying external collector dependencies');
  const collectorNodeModulesPath = path.join(config.collectorDir, 'node_modules');
  const distNodeModulesPath = path.join(config.distDir, 'node_modules');

  // External packages that need to be copied
  // Also include hoisted dependencies of external packages:
  // - pdf-parse requires: node-ensure, debug
  // - debug requires: ms
  const externalPackages = ['pdf-parse', 'fluent-ffmpeg', 'typescript', 'node-ensure', 'debug', 'ms'];

  for (const pkg of externalPackages) {
    const srcPkg = path.join(collectorNodeModulesPath, pkg);
    const destPkg = path.join(distNodeModulesPath, pkg);

    if (fs.existsSync(srcPkg)) {
      copyRecursive(srcPkg, destPkg);
      log.success(`Copied ${pkg} to dist/node_modules`);
    }
  }

  // Step 6: Copy necessary files and create distribution structure
  log.step('Step 6/6: Creating distribution package');

  // Copy .env.example files
  const serverEnvExample = path.join(config.serverDir, '.env.example');
  const collectorEnvExample = path.join(config.collectorDir, '.env.example');

  if (fs.existsSync(serverEnvExample)) {
    fs.copyFileSync(serverEnvExample, path.join(config.distDir, 'server.env.example'));
    log.success('Copied server.env.example');
  }

  if (fs.existsSync(collectorEnvExample)) {
    fs.copyFileSync(collectorEnvExample, path.join(config.distDir, 'collector.env.example'));
    log.success('Copied collector.env.example');
  }

  // Create storage directory
  const storageDir = path.join(config.distDir, 'storage');
  ensureDir(storageDir);

  // Create hotdir directory for collector
  const hotDir = path.join(config.distDir, 'hotdir');
  ensureDir(hotDir);

  // Copy __HOTDIR__.md placeholder
  const hotdirMd = path.join(config.collectorDir, 'hotdir', '__HOTDIR__.md');
  if (fs.existsSync(hotdirMd)) {
    fs.copyFileSync(hotdirMd, path.join(hotDir, '__HOTDIR__.md'));
    log.success('Created hotdir with placeholder');
  }

  // Create public directory in dist (for server static files)
  const distPublic = path.join(config.distDir, 'public');
  copyRecursive(serverPublic, distPublic);

  // Copy Prisma artifacts (needed for runtime)
  const prismaDir = path.join(config.serverDir, 'node_modules', '.prisma');
  if (fs.existsSync(prismaDir)) {
    copyRecursive(prismaDir, path.join(config.distDir, 'node_modules', '.prisma'));
  }

  const prismaClientDir = path.join(config.serverDir, 'node_modules', '@prisma', 'client');
  if (fs.existsSync(prismaClientDir)) {
    copyRecursive(prismaClientDir, path.join(config.distDir, 'node_modules', '@prisma', 'client'));
  }

  // Copy swagger directory (needed for API docs)
  const swaggerDir = path.join(config.serverDir, 'swagger');
  if (fs.existsSync(swaggerDir)) {
    copyRecursive(swaggerDir, path.join(config.distDir, 'swagger'));
  }

  // Copy jobs directory (needed for background workers)
  const jobsDir = path.join(config.serverDir, 'jobs');
  if (fs.existsSync(jobsDir)) {
    copyRecursive(jobsDir, path.join(config.distDir, 'jobs'));
  }

  // Create README for distribution
  const readmeContent = `# GameMechanicLLM - Windows Executable Distribution

## Contents

- \`gamemechanic-server.exe\` - Main server application
- \`gamemechanic-collector.exe\` - Document processing service
- \`setup.bat\` - Automated environment setup script
- \`start.bat\` - Launch script for both executables
- \`public/\` - Frontend assets
- \`storage/\` - Database and document storage (created on first run)
- \`node_modules/\` - Required native dependencies

## Quick Start (Recommended)

1. **Run setup.bat** - Double-click to automatically:
   - Generate secure random keys (JWT_SECRET, SIG_KEY, SIG_SALT)
   - Create .env file with proper configuration
   - Create storage directory
   - Set default DATABASE_URL to ./storage/gamemechanic-llm.db

2. **Configure LLM provider** - Edit .env and uncomment your preferred LLM:
   - OpenAI: Set OPEN_AI_KEY
   - Anthropic Claude: Set ANTHROPIC_API_KEY
   - Ollama (local): Set OLLAMA_BASE_PATH
   - See server.env.example for all options

3. **Run start.bat** - Double-click to launch both executables

4. **Open browser** - Go to http://localhost:3001

## Manual Setup (Alternative)

1. Copy \`server.env.example\` to \`.env\` and configure manually
2. Run \`gamemechanic-collector.exe\` (in one terminal)
3. Run \`gamemechanic-server.exe\` (in another terminal)
4. Open your browser to http://localhost:3001

## Configuration

The \`.env\` file controls:
- Database path (DATABASE_URL)
- LLM provider and API keys
- Server port (default: 3001)
- JWT secrets and security keys
- Vector database settings
- Embedding provider
- Telemetry settings

See \`server.env.example\` for all available options.

## Notes

- Both executables must be running for full functionality
- The storage directory will be created automatically on first run
- Security keys are auto-generated by setup.bat
- Default database location: ./storage/gamemechanic-llm.db

Built with Bun ${execSync(`${config.bunPath} --version`).toString().trim()}
`;

  fs.writeFileSync(path.join(config.distDir, 'README.txt'), readmeContent);
  log.success('Created README.txt');

  // Create a simple start script
  const startScript = `@echo off
echo Starting GameMechanicLLM...
echo.
echo Starting Collector on port 8888...
start "GameMechanicLLM Collector" cmd /k gamemechanic-collector.exe

timeout /t 2 /nobreak > nul

echo Starting Server on port 3001...
start "GameMechanicLLM Server" cmd /k gamemechanic-server.exe

echo.
echo GameMechanicLLM is starting...
echo Server will be available at http://localhost:3001
echo.
echo Press any key to exit (this will NOT stop the servers)
pause > nul
`;

  fs.writeFileSync(path.join(config.distDir, 'start.bat'), startScript);
  log.success('Created start.bat launch script');

  // Create QDrant start script
  const qdrantScript = `@echo off
title Start QDrant Vector Database

echo.
echo ========================================================
echo    Starting QDrant Vector Database
echo ========================================================
echo.
echo This will start QDrant in Docker on port 6333
echo Make sure Docker is installed and running
echo.
echo Press Ctrl+C to stop QDrant when done
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.
echo Starting QDrant container...
echo.

:: Run QDrant with persistent storage
docker run -p 6333:6333 -p 6334:6334 ^
    -v "%cd%\\qdrant_storage:/qdrant/storage" ^
    qdrant/qdrant

pause
`;

  fs.writeFileSync(path.join(config.distDir, 'start-qdrant.bat'), qdrantScript);
  log.success('Created start-qdrant.bat QDrant launcher');

  // Create setup script for .env configuration
  const setupScript = `@echo off
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

:: Create storage directory

:: Create hotdir directory
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

    echo.
    echo # Collector configuration
    echo COLLECTOR_HOTDIR="./hotdir"     # Document upload directory
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
    echo # Auto-generated on %date% at %time%
    echo.
    echo # NOTE: NODE_ENV is automatically set to 'production' by the executable
    echo # NOTE: NODE_ENV is automatically set to 'production' by the executable
    echo # Do not add NODE_ENV to this file - it will be ignored
    echo.
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
    echo JWT_SECRET="%JWT_SECRET%"
    echo SIG_KEY="%SIG_KEY%"
    echo SIG_SALT="%SIG_SALT%"
    echo.
    echo ###########################################
    echo ######## LLM API SELECTION ###############
    echo ###########################################
    echo # LMStudio is pre-configured for local LLM usage
    echo # Make sure LMStudio is running on port 1234
    echo.
    echo LLM_PROVIDER='lmstudio'
    echo LMSTUDIO_BASE_PATH='http://localhost:1234/v1'
    echo LMSTUDIO_MODEL_PREF='Loaded from Chat UI'
    echo LMSTUDIO_MODEL_TOKEN_LIMIT=4096
    echo.
    echo ###########################################
    echo ######## EMBEDDING API SELECTION #########
    echo ###########################################
    echo # LMStudio is pre-configured for embeddings
    echo # This uses the same LMStudio instance as above
    echo.
    echo EMBEDDING_ENGINE='lmstudio'
    echo EMBEDDING_BASE_PATH='http://localhost:1234/v1'
    echo EMBEDDING_MODEL_MAX_CHUNK_LENGTH='8192'
    echo EMBEDDING_MODEL_PREF='text-embedding-nomic-embed-text-v1.5'
    echo.
    echo # Alternative embedding providers:
    echo.
    echo # EMBEDDING_ENGINE='native'
    echo # # Uses built-in AnythingLLM embeddings ^(no configuration needed^)
    echo.
    echo # EMBEDDING_ENGINE='openai'
    echo # OPEN_AI_KEY=sk-your-api-key-here
    echo # EMBEDDING_MODEL_PREF='text-embedding-3-small'
    echo.
    echo # See server.env.example for all embedding providers
    echo.
    echo ###########################################
    echo ######## LLM ALTERNATIVE PROVIDERS #######
    echo ###########################################
    echo # Alternative providers ^(comment LMStudio above and uncomment below^):
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
    echo # See server.env.example for all LLM providers
    echo.
    echo # ANTHROPIC_MODEL_PREF='claude-3-5-sonnet-20241022'
    echo.
    echo # LLM_PROVIDER='ollama'
    echo # OLLAMA_BASE_PATH='http://localhost:11434'
    echo # OLLAMA_MODEL_PREF='llama2'
    echo.
    echo # See server.env.example for all LLM providers
    echo.
    echo DISABLE_TELEMETRY=true
) > .env

echo 1. Make sure LMStudio is running on port 1234 with a model loaded
    echo 2. Run start.bat to launch the application
    echo 3. Open http://localhost:3001 in your browser
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
    echo 1. Run start-qdrant.bat in a separate window to start QDrant vector DB
    echo 2. Make sure LMStudio is running on port 1234 with a model loaded
    echo 3. Run start.bat to launch the application
    echo 4. Open http://localhost:3001 in your browser
echo 3. Open http://localhost:3001 in your browser
echo.
goto :end

:error
echo Setup failed. Please check the error above.
pause
exit /b 1

:end
echo Press any key to exit...
pause >nul
`;

  fs.writeFileSync(path.join(config.distDir, 'setup.bat'), setupScript);

  // Create database initialization script
  const initDbScript = `@echo off
setlocal

:: GameMechanicLLM Database Initialization Script
title GameMechanicLLM Database Init

echo.
echo ========================================================
echo    GameMechanicLLM - Database Initialization
echo ========================================================
echo.

:: Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Please run setup.bat first to create the configuration.
    goto :error
)

:: Check if storage directory exists
if not exist "storage" (
    mkdir storage
    echo [OK] Created storage directory
)

:: Delete existing database if it exists
if exist "storage\gamemechanic-llm.db" (
    echo [WARNING] Existing database found
    set /p OVERWRITE="Do you want to recreate the database? This will DELETE all data! (y/N): "
    if /i not "!OVERWRITE!"=="y" (
        echo.
        echo Database initialization cancelled.
        goto :end
    )
    del /f "storage\gamemechanic-llm.db"
    echo [OK] Deleted existing database
)

:: Copy Prisma schema and migrations
echo.
echo Initializing database...
echo.

:: Run Prisma migrations to create the database
:: Note: We need to have node_modules with Prisma CLI available
if exist "node_modules\.bin\prisma.cmd" (
    echo [OK] Running Prisma migrations...
    call node_modules\.bin\prisma migrate deploy
    if errorlevel 1 (
        echo [ERROR] Prisma migration failed
        goto :error
    )
    echo [OK] Database schema created successfully
) else (
    echo [INFO] Prisma CLI not found in node_modules
    echo [INFO] Database will be created automatically on first server start
)

echo.
echo ========================================================
echo    Database Initialization Complete!
echo ========================================================
echo.
echo [OK] Database ready at: storage\gamemechanic-llm.db
echo.
echo Next steps:
echo 1. Start the server: gamemechanic-server.exe
echo 2. The database will be initialized on first run
echo.
goto :end

:error
echo.
echo Database initialization failed.
pause
exit /b 1

:end
echo Press any key to exit...
pause >nul
`;

  fs.writeFileSync(path.join(config.distDir, 'init-database.bat'), initDbScript);
  log.success('Created init-database.bat script');

  log.success('Created setup.bat configuration script');

  // Build complete!
  console.log(`
${colors.bright}${colors.green}╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ✓ Build completed successfully!                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}Distribution package created in:${colors.reset}
  ${config.distDir}

${colors.bright}Package contents:${colors.reset}
  ✓ gamemechanic-server.exe (${(fs.statSync(path.join(config.distDir, 'gamemechanic-server.exe')).size / 1024 / 1024).toFixed(2)} MB)
  ✓ gamemechanic-collector.exe (${(fs.statSync(path.join(config.distDir, 'gamemechanic-collector.exe')).size / 1024 / 1024).toFixed(2)} MB)
  ✓ Frontend assets (public/)
  ✓ Configuration templates
  ✓ Setup script (setup.bat)
  ✓ Launch script (start.bat)

${colors.bright}${colors.cyan}Quick Start:${colors.reset}
  cd dist
  setup.bat     ${colors.bright}(run first to create .env)${colors.reset}
  start.bat     ${colors.bright}(launches both executables)${colors.reset}

${colors.bright}${colors.cyan}Or manually:${colors.reset}
  cd dist
  setup.bat
  gamemechanic-collector.exe    (in one terminal)
  gamemechanic-server.exe       (in another terminal)

${colors.green}✓ setup.bat will auto-generate secure keys and create .env${colors.reset}
`);
}

// Run the build
build().catch((error) => {
  log.error('Build failed with error:');
  console.error(error);
  process.exit(1);
});
