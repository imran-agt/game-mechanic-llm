# Hotdir Path Fix Documentation

## Problem

When uploading files, the collector was using a hardcoded development path:
```
D:\workspaces\game-mechanic-llm\collector\hotdir\
```

This caused the error:
```
ENOENT: no such file or directory, open 'D:\workspaces\game-mechanic-llm\collector\hotdir\game_design_specification.md'
```

## Root Cause

The `WATCH_DIRECTORY` constant in `collector/utils/constants.js` was using `__dirname` which resolved to the development path even when running as a compiled executable.

## Solution Implemented

### 1. Made Hotdir Path Configurable

**File: `collector/utils/constants.js`**

Added compiled executable detection and environment variable support:

```javascript
const getBasePath = () => {
  const isCompiledExe = process.execPath.toLowerCase().includes('gamemechanic-collector.exe');
  const isMalformedPath = process.platform === 'win32' &&
                         __dirname.startsWith('\\') &&
                         !__dirname.match(/^[A-Z]:\\/i);

  if (isCompiledExe || isMalformedPath || !fs.existsSync(__dirname)) {
    const execDir = path.dirname(process.execPath);
    console.log(`[Collector] Running as compiled executable from: ${execDir}`);
    return execDir;
  }

  console.log(`[Collector] Running in development mode from: ${__dirname}`);
  return path.resolve(__dirname, "..");
};

const basePath = getBasePath();

// Allow COLLECTOR_HOTDIR to be configured via environment variable
const WATCH_DIRECTORY = process.env.COLLECTOR_HOTDIR
  ? path.resolve(process.env.COLLECTOR_HOTDIR)
  : path.resolve(basePath, "hotdir");
```

### 2. Updated File Cleanup Function

**File: `collector/utils/files/index.js`**

Changed `wipeCollectorStorage()` to use the `WATCH_DIRECTORY` constant instead of hardcoded path:

```javascript
async function wipeCollectorStorage() {
  const { WATCH_DIRECTORY } = require("./constants");
  const cleanHotDir = new Promise((resolve) => {
    const directory = WATCH_DIRECTORY;
    // ... rest of the function
  });
}
```

### 3. Added to .env Configuration

**File: `build-exe.cjs` (setup.bat generation)**

Added hotdir configuration to the generated `.env` file:

```env
# Collector configuration
COLLECTOR_HOTDIR="./hotdir"     # Document upload directory
```

### 4. Created Hotdir Directory in Distribution

**File: `build-exe.cjs` (build process)**

Added code to create hotdir during build:

```javascript
// Create hotdir directory for collector
const hotDir = path.join(config.distDir, 'hotdir');
ensureDir(hotDir);

// Copy __HOTDIR__.md placeholder
const hotdirMd = path.join(config.collectorDir, 'hotdir', '__HOTDIR__.md');
if (fs.existsSync(hotdirMd)) {
  fs.copyFileSync(hotdirMd, path.join(hotDir, '__HOTDIR__.md'));
  log.success('Created hotdir with placeholder');
}
```

### 5. Added to Setup Script

**File: `build-exe.cjs` (setup.bat generation)**

Added hotdir creation to the setup process:

```batch
:: Create hotdir directory
if not exist "hotdir" (
    mkdir hotdir
    echo [OK] Created hotdir directory
) else (
    echo [OK] Hotdir directory exists
)
```

## How It Works Now

### Development Mode:
- Hotdir path: `<project-root>/collector/hotdir/`
- Uses `__dirname` to resolve path
- Works as before

### Compiled Executable Mode:
- Hotdir path: `<exe-directory>/hotdir/`
- Resolves relative to the executable location
- Configurable via `COLLECTOR_HOTDIR` environment variable

### Configuration Options:

**Default (relative path):**
```env
COLLECTOR_HOTDIR="./hotdir"
```

**Custom absolute path:**
```env
COLLECTOR_HOTDIR="C:\Users\Username\Documents\GameMechanicUploads"
```

**Network path:**
```env
COLLECTOR_HOTDIR="\\\\ServerName\\ShareName\\uploads"
```

## Directory Structure

After running setup.bat:

```
dist/
├── gamemechanic-server.exe
├── gamemechanic-collector.exe
├── hotdir/                    ← Document upload directory
│   └── __HOTDIR__.md         ← Placeholder file
├── storage/                   ← Database directory
│   └── gamemechanic-llm.db
├── qdrant_storage/            ← Vector database storage
├── .env                       ← Contains COLLECTOR_HOTDIR
└── start.bat
```

## File Upload Flow

1. **User uploads file via UI** → Sent to server
2. **Server forwards to collector** → File saved to hotdir
3. **Collector processes file** → Reads from hotdir
4. **Document vectorized** → Stored in QDrant
5. **File cleaned up** → Removed from hotdir
6. **Vectors persist** → Available for RAG queries

## Troubleshooting

### Error: Cannot find hotdir

**Cause:** COLLECTOR_HOTDIR points to non-existent directory

**Solution:**
1. Check .env: `COLLECTOR_HOTDIR="./hotdir"`
2. Verify directory exists: `dir hotdir`
3. Create if missing: `mkdir hotdir`
4. Restart collector

### Error: Permission denied writing to hotdir

**Cause:** Insufficient write permissions

**Solution:**
1. Check directory permissions
2. Run as administrator (if needed)
3. Or change to a writable location:
   ```env
   COLLECTOR_HOTDIR="C:\Users\YourName\AppData\Local\GameMechanic\uploads"
   ```

### Uploads work but files accumulate in hotdir

**Cause:** Collector not cleaning up after processing

**Solution:**
1. Check collector logs for errors
2. Manually clean: `del /Q hotdir\*` (except __HOTDIR__.md)
3. Restart collector

### Want to use a different upload directory

**Solution:**
1. Edit `dist/.env`
2. Change `COLLECTOR_HOTDIR` to your desired path
3. Create the directory if it doesn't exist
4. Restart both collector and server

## Logging

The collector now logs its hotdir path on startup:

```
[Collector] Running as compiled executable from: D:\Bitbucket\game-mechanic-llm\dist
[Collector] Watch directory (hotdir): D:\Bitbucket\game-mechanic-llm\dist\hotdir
```

Verify this matches your expected path in the console output.

## Testing the Fix

1. Run `setup.bat` to create .env with COLLECTOR_HOTDIR
2. Start QDrant: `start-qdrant.bat`
3. Start LMStudio with a model loaded
4. Start the application: `start.bat`
5. Open http://localhost:3001
6. Create a workspace
7. Upload a document (any text file)
8. Check collector console for:
   ```
   [Collector] Watch directory (hotdir): <correct-path>
   Adding new vectorized document into namespace...
   ```
9. Document should process without ENOENT errors

## Benefits

1. **No more hardcoded paths** - Works in any directory
2. **Configurable** - Easy to change upload location
3. **Portable** - Dist folder can be moved anywhere
4. **Flexible** - Supports absolute, relative, and network paths
5. **Transparent** - Logs show exactly where files are stored

## Related Files

- `collector/utils/constants.js` - Path resolution logic
- `collector/utils/files/index.js` - File cleanup using constant
- `build-exe.cjs` - Build script with hotdir setup
- `.env` - COLLECTOR_HOTDIR configuration
- `setup.bat` - Creates hotdir directory

## Migration Notes

### Existing Installations:

If you have an existing installation:

1. Add to your `.env`:
   ```env
   COLLECTOR_HOTDIR="./hotdir"
   ```

2. Create the hotdir:
   ```batch
   mkdir hotdir
   ```

3. Restart collector and server

### Custom Paths:

If you were using a custom hotdir location, update `.env`:

```env
# Before (not supported):
# Had to modify code

# After (in .env):
COLLECTOR_HOTDIR="C:\Your\Custom\Path"
```

## Future Enhancements

Potential improvements:

1. **UI Configuration** - Change hotdir path from settings UI
2. **Multiple Hotdirs** - Support different paths per workspace
3. **Cloud Storage** - S3/Azure Blob support for uploads
4. **Auto-cleanup** - Configurable retention policy
5. **Size Limits** - Per-file and total directory size limits
