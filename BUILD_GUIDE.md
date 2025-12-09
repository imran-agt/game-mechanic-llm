# GameMechanicLLM Build Guide

## Overview

This guide explains how to build GameMechanicLLM as standalone Windows executables with LMStudio pre-configured for local LLM usage.

## Build System Components

### 1. Build Script (`build-exe.cjs`)

The main build script that:
- Builds the frontend (React/Vite) into static assets
- Compiles the server to a Windows executable using Bun
- Compiles the collector to a Windows executable using Bun
- Copies all necessary files (frontend assets, Prisma, Swagger, jobs)
- Generates helper batch files (setup.bat, start.bat, init-database.bat)

### 2. VS Code Status Bar Task

The build task is accessible from the VS Code status bar:
- **Label**: "Build: 📦 Windows EXE"
- **Tooltip**: "Build Windows EXE with LMStudio pre-configured"
- **Color**: Green when idle, Orange when building
- Click the button to start the build process

### 3. Generated Files

After building, the `dist/` directory contains:

```
dist/
├── gamemechanic-server.exe      (324 MB) - Main server
├── gamemechanic-collector.exe   (125 MB) - Document processor
├── public/                      Frontend static assets
├── node_modules/                Prisma runtime
├── swagger/                     API documentation
├── jobs/                        Background job definitions
├── storage/                     Database directory
├── setup.bat                    Environment configuration
├── start.bat                    Launch script
├── init-database.bat            Database initialization
├── server.env.example           Configuration template
└── README.txt                   Quick start guide
```

## LMStudio Pre-Configuration

### Default Settings

The `setup.bat` generates a `.env` file with LMStudio **enabled by default**:

```env
LLM_PROVIDER='lmstudio'
LMSTUDIO_BASE_PATH='http://localhost:1234/v1'
LMSTUDIO_MODEL_PREF='Loaded from Chat UI'
LMSTUDIO_MODEL_TOKEN_LIMIT=4096
```

### Requirements

1. **LMStudio must be running** on port 1234
2. **A model must be loaded** in LMStudio before starting the server
3. The model should be accessible via the LMStudio API endpoint

### Alternative Providers

To use a different LLM provider:
1. Open `dist/.env` after running setup.bat
2. Comment out the LMStudio configuration lines
3. Uncomment your preferred provider (OpenAI, Anthropic, Ollama)
4. Add your API key if required

## Build Process Steps

### Prerequisites

- **Bun v1.3.4+** installed and in PATH
- **Node.js 18+** for npm scripts
- Windows development environment

### Step 1: Run the Build

**Option A: VS Code Status Bar**
- Click "Build: 📦 Windows EXE" in the status bar
- Wait for the build to complete (~2-3 minutes)

**Option B: Command Line**
```bash
npm run build:exe
```

### Step 2: Build Process

The script performs these steps:

1. **Check Prerequisites** - Verify Bun is installed
2. **Build Frontend** - Compile React/Vite application
3. **Copy Frontend** - Move assets to server/public
4. **Build Server** - Compile server to .exe with Bun
5. **Build Collector** - Compile collector to .exe with Bun
6. **Create Distribution** - Copy files and generate batch scripts

### Step 3: Verify Build

Check the console output for:
```
✓ Build completed successfully!

Distribution package created in:
  /workspaces/game-mechanic-llm/dist

Package contents:
  ✓ gamemechanic-server.exe (324.78 MB)
  ✓ gamemechanic-collector.exe (125.56 MB)
  ✓ Frontend assets (public/)
  ✓ Configuration templates
  ✓ Setup script (setup.bat)
  ✓ Launch script (start.bat)
```

## Deployment Steps

### Step 1: Setup Environment

Navigate to the dist directory and run setup:
```batch
cd dist
setup.bat
```

This will:
- Generate secure random keys (JWT_SECRET, SIG_KEY, SIG_SALT)
- Create `.env` file with LMStudio pre-configured
- Create storage directory for SQLite database

### Step 2: Start LMStudio

1. Launch LMStudio
2. Load your preferred model
3. Ensure the server is running on port 1234
4. Verify the endpoint is accessible

### Step 3: Launch Application

**Option A: Using start.bat**
```batch
start.bat
```
This launches both the collector and server in separate windows.

**Option B: Manual Launch**
```batch
gamemechanic-collector.exe
gamemechanic-server.exe
```

### Step 4: Access Application

Open your browser to:
```
http://localhost:3001
```

You should see the GameMechanicLLM interface.

## Troubleshooting

### Build Errors

**Error: Bun not found**
- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Add Bun to PATH

**Error: Frontend build fails**
- Check Node.js version: `node --version` (should be 18+)
- Clear node_modules: `cd frontend && rm -rf node_modules && bun install`

**Error: Server build fails with dependency errors**
- Dependencies mock-aws-s3, aws-sdk, nock are externalized
- This is expected - they're not needed in production

### Runtime Errors

**Error: Port 3001 already in use**
- Stop any running instances
- Check for processes using port 3001
- Change SERVER_PORT in .env

**Error: Database connection failed**
- Ensure storage directory exists
- Check DATABASE_URL in .env
- Run init-database.bat for a fresh database

**Error: LMStudio connection failed**
- Verify LMStudio is running on port 1234
- Check the model is loaded
- Test the endpoint: `curl http://localhost:1234/v1/models`

**Error: Frontend shows "Not Found"**
- This issue has been fixed in the current build
- The `isCompiled` check ensures frontend is served
- Verify logs show: `[Frontend Setup] Will serve frontend: true`

## Advanced Configuration

### Custom LMStudio Port

If LMStudio runs on a different port:
1. Edit `dist/.env`
2. Change `LMSTUDIO_BASE_PATH='http://localhost:YOUR_PORT/v1'`
3. Restart the server

### Database Location

To change the database location:
1. Edit `dist/.env`
2. Modify `DATABASE_URL="file:./your/custom/path.db"`
3. Ensure the directory exists
4. Run init-database.bat if needed

### Multiple Instances

To run multiple instances:
1. Copy the dist folder
2. Run setup.bat in each copy
3. Change SERVER_PORT in each .env file
4. Start each instance separately

## Build Script Customization

### Modifying setup.bat Generation

Edit `build-exe.cjs` around line 398:

```javascript
echo LLM_PROVIDER='lmstudio'
echo LMSTUDIO_BASE_PATH='http://localhost:1234/v1'
echo LMSTUDIO_MODEL_PREF='Loaded from Chat UI'
echo LMSTUDIO_MODEL_TOKEN_LIMIT=4096
```

Change these values to customize the default LMStudio configuration.

### Adding Custom Files

To include additional files in the distribution:

```javascript
// In build-exe.cjs, add after line 245
const customDir = path.join(config.serverDir, 'custom-directory');
if (fs.existsSync(customDir)) {
  copyRecursive(customDir, path.join(config.distDir, 'custom-directory'));
  log.success('Copied custom directory');
}
```

## Key Fixes from Development

### Issue 1: NODE_ENV Not Respected
**Problem**: `process.env.NODE_ENV = 'production'` doesn't work in Bun compiled executables.
**Solution**: Check `isCompiled` variable directly in conditionals instead of relying on NODE_ENV.

### Issue 2: Background Worker Port Conflict
**Problem**: Background jobs loaded index.js and tried to start a second server.
**Solution**: Check `process.send` to detect child processes and skip server startup.

### Issue 3: Multiple dotenv.config() Calls
**Problem**: Various modules called dotenv.config(), overriding NODE_ENV.
**Solution**: Set `DOTENV_CONFIGURED` flag and check it before calling dotenv in modules.

## Support

For issues or questions:
- Check the console logs for detailed error messages
- Review the troubleshooting section above
- Verify LMStudio is properly configured
- Ensure all prerequisites are met

## License

MIT License - See LICENSE file for details
