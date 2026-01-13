# Building on Windows with Icon Embedding

This guide explains how to build the GameMechanicLLM executables directly on Windows to enable proper icon embedding.

## Why Build on Windows?

The `--windows-icon` flag in Bun only works when compiling **on Windows**. Cross-compiling from Linux/WSL/Docker to Windows does not support icon embedding.

Your dev container is currently running in Docker/WSL, which means:
- ✅ Builds succeed
- ❌ Icons are NOT embedded in the EXE files

To get the custom workspace.ico icon embedded, you need to run the build script **directly on your Windows host**.

## Your Current Setup

Your project is located at:
- **Dev Container Path**: `/workspaces/game-mechanic-llm`
- **Windows Host Path**: `D:\game-mechanic-llm` (or similar)

Since the dev container mounts from your Windows D: drive, you can access the same files from both environments.

## Prerequisites

### 1. Install Bun on Windows

**This is the ONLY requirement** - Bun handles everything including Prisma and other dependencies.

Open PowerShell as Administrator and run:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

After installation, close and reopen your terminal to refresh the PATH.

Verify installation:
```cmd
bun --version
```

**Note**: You do NOT need to install Node.js separately. Bun replaces npm/npx with its own `bunx` command.

## Build Instructions

### Option 1: Using the Windows Build Script (Recommended)

1. **Open Command Prompt or PowerShell on Windows**
   - Press `Win + R`
   - Type `cmd` or `powershell`
   - Press Enter

2. **Navigate to your project directory**
   ```cmd
   D:
   cd \game-mechanic-llm
   ```

   Or wherever your project is located on Windows.

3. **Run the Windows build script**
   ```cmd
   build-exe-windows.bat
   ```

4. **Wait for the build to complete**
   - The script will build the frontend
   - Compile the server executable with icon
   - Compile the collector executable with icon
   - Create the complete distribution package

5. **Check the results**
   ```cmd
   dir dist\*.exe
   ```

   Both EXE files should now have the custom workspace.ico icon embedded!

### Option 2: Manual Build Commands

If you prefer to run commands manually:

```cmd
:: 1. Build frontend
cd frontend
bun install
bun run build
cd ..

:: 2. Copy frontend to server
xcopy /E /I /Y frontend\dist server\public

:: 3. Build server with icon
cd server
bun install
bunx prisma generate
bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon="..\frontend\src\media\logo\workspace.ico" --external mock-aws-s3 --external aws-sdk --external nock ./index.js --outfile ..\dist\gamemechanic-server.exe
cd ..

:: 4. Build collector with icon
cd collector
bun install
bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon="..\frontend\src\media\logo\workspace.ico" --external typescript --external fluent-ffmpeg --external pdf-parse ./index.js --outfile ..\dist\gamemechanic-collector.exe
cd ..
```

## Verifying Icon Embedding

### Method 1: Visual Check
1. Right-click the EXE file in Windows Explorer
2. Look at the file icon - it should show your custom workspace icon

### Method 2: Properties Check
1. Right-click the EXE file
2. Select "Properties"
3. The icon in the properties dialog should be your custom icon

### Method 3: Command Line
You can use PowerShell to check:
```powershell
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon("dist\gamemechanic-server.exe")
Write-Host "Icon Size: $($icon.Width)x$($icon.Height)"
```

## Workflow: Dev Container + Windows Build

Here's the recommended workflow for development:

### For Development (Use Dev Container)
```bash
# Inside dev container
yarn dev:server
yarn dev:collector
yarn dev:frontend
```

### For Production Builds with Icons (Use Windows)
```cmd
# On Windows host
D:
cd \game-mechanic-llm
build-exe-windows.bat
```

## Troubleshooting

### Issue: "Bun is not installed"
**Solution**: Install Bun on Windows using the command above.

### Issue: "Command not found" after installing Bun
**Solution**: Close and reopen your terminal to refresh the PATH.

### Issue: "Cannot find path"
**Solution**: Make sure you're using the correct drive letter and path. Use `dir` to verify.

### Issue: Build works but no icon visible
**Solution**:
- Make sure you ran the build on Windows, not in the dev container
- Check that `frontend\src\media\logo\workspace.ico` exists
- Verify the icon file is a valid .ico format

### Issue: "Permission denied" errors
**Solution**: Run Command Prompt or PowerShell as Administrator.

### Issue: "bun build --compile" fails
**Solution**:
- Make sure you're using the latest version of Bun
- Check that you have enough disk space
- Try running `bun upgrade` to update Bun

### Issue: "prisma is not recognized" or Prisma generation fails with ESM errors
**Solution**:
- The script now uses the locally installed Prisma (not bunx)
- Make sure dependencies are installed first:
  ```cmd
  cd server
  bun install
  cd ..
  ```
- The build script will automatically detect and use the local Prisma installation
- If you still get ESM/require errors, it means `bunx` is trying to use the latest Prisma version which has compatibility issues
- The updated script now avoids this by using the project's installed Prisma 5.3.1

## Icon File Details

- **Location**: `frontend\src\media\logo\workspace.ico`
- **Size**: ~180 KB
- **Format**: Windows ICO format with multiple sizes

## Cross-Compilation Script

The `build-exe.cjs` script still works in the dev container but will skip icon embedding with a warning:

```bash
# In dev container - builds WITHOUT icons
node build-exe.cjs
```

This is useful for quick builds and testing, but for final distribution builds with icons, use the Windows script.

## Summary

| Environment | Build Script | Icon Embedded | Use Case |
|-------------|--------------|---------------|----------|
| Dev Container (Docker/WSL) | `node build-exe.cjs` | ❌ No | Quick builds, testing |
| Windows Host | `build-exe-windows.bat` | ✅ Yes | Production builds |

For the best results with icon embedding, always run your final production builds directly on Windows using `build-exe-windows.bat`.
