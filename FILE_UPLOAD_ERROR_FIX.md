# File Upload Error Fix Documentation

## Problem

When uploading files through the frontend UI, the system returned the generic error:
```
A processing error has occurred
```

The logs showed workspace vectors being reset but no indication of file processing or actual error details.

## Root Causes Identified

### 1. **Hardcoded Collector Port**
**File:** `collector/index.js:201`
- Collector was hardcoded to listen on port 8888
- Did not read `COLLECTOR_PORT` from environment variables
- If server expected a different port, communication would fail

### 2. **Generic Error Messages Without Details**
**File:** `collector/index.js` (multiple endpoints)
- When file processing failed, catch blocks returned:
  ```javascript
  reason: "A processing error has occurred."
  ```
- The actual error (`e.message`) was logged to console but not sent to the client
- Made debugging extremely difficult

### 3. **Missing Environment Configuration**
**File:** `build-exe.cjs`
- Generated `.env` file did not include `COLLECTOR_PORT`
- Users couldn't easily configure the collector port

## Solutions Implemented

### 1. Made Collector Port Configurable

**File: collector/index.js (lines 200-206)**

```javascript
const PORT = process.env.COLLECTOR_PORT || 8888;
app
  .listen(PORT, async () => {
    await wipeCollectorStorage();
    console.log(`[Collector] Document processor app listening on port ${PORT}`);
    console.log(`[Collector] Using hotdir from constants: ${WATCH_DIRECTORY}`);
  })
```

**Benefits:**
- Reads `COLLECTOR_PORT` from environment
- Falls back to 8888 if not set
- Logs the actual port being used

### 2. Improved Error Reporting

**File: collector/index.js (all endpoints)**

Changed all catch blocks from:
```javascript
} catch (e) {
  console.error(e);
  response.status(200).json({
    filename: filename,
    success: false,
    reason: "A processing error has occurred.",
    documents: [],
  });
}
```

To:
```javascript
} catch (e) {
  console.error(`[Collector] Error processing file "${filename}":`, e);
  response.status(200).json({
    filename: filename,
    success: false,
    reason: `A processing error occurred: ${e.message}`,
    documents: [],
  });
}
```

**Benefits:**
- Actual error message is returned to the client
- Console logging includes context (filename, operation type)
- Frontend can display meaningful error messages to users

### 3. Added Environment Configuration

**File: build-exe.cjs (lines 455-457)**

Added to `.env` generation:
```env
# Collector Configuration
COLLECTOR_HOTDIR="./hotdir"
COLLECTOR_PORT=8888
```

**Benefits:**
- Users can easily change the collector port
- Configuration is documented in the generated `.env`
- Consistent with other configuration patterns

## How to Use

### 1. Running the Executables

```batch
cd dist
setup.bat          # Creates .env with COLLECTOR_PORT=8888
start-qdrant.bat   # Start QDrant vector database
start.bat          # Launches both server and collector
```

### 2. Custom Port Configuration

To change the collector port, edit `dist/.env`:

```env
COLLECTOR_PORT=9999
```

**Important:** Both server and collector must use the same port!

### 3. Checking Logs

**Collector logs will show:**
```
[Collector] Document processor app listening on port 8888
[Collector] Using hotdir from constants: D:\path\to\dist\hotdir
```

**Server logs will show:**
```
[Multer] Using hotdir path: D:\path\to\dist\hotdir
[CollectorApi] Document processing API is online
```

**Both should use the same hotdir path!**

### 4. Troubleshooting File Uploads

If file uploads fail, check:

1. **Collector is running:**
   ```
   [Collector] Document processor app listening on port 8888
   ```

2. **Hotdir paths match:**
   - Server log: `[Multer] Using hotdir path: ...`
   - Collector log: `[Collector] Using hotdir from constants: ...`
   - Both should point to the same directory

3. **Check actual error message:**
   - Instead of "A processing error has occurred"
   - You'll now see: "A processing error occurred: [actual error]"
   - Examples:
     - `File does not exist in upload directory`
     - `File extension .xyz not supported for parsing`
     - `Invalid path to process`

4. **Verify collector is reachable:**
   - Server expects collector at `http://0.0.0.0:8888` (or configured COLLECTOR_PORT)
   - Collector must be running and listening on that port

## Common Errors and Solutions

### Error: "Document processing API is not online"

**Cause:** Server can't reach collector

**Solution:**
1. Check if collector executable is running
2. Verify `COLLECTOR_PORT` in `.env` matches
3. Check firewall isn't blocking port 8888

### Error: "File does not exist in upload directory"

**Cause:** File was saved to hotdir but collector can't find it

**Solution:**
1. Verify both server and collector use same `COLLECTOR_HOTDIR`
2. Check hotdir exists: `dir hotdir`
3. Check file permissions on hotdir

### Error: "File extension .xyz not supported for parsing"

**Cause:** Unsupported file type

**Solution:**
1. Check supported file types: `collector/utils/constants.js`
2. Supported: `.txt`, `.md`, `.pdf`, `.docx`, `.xlsx`, etc.
3. Binary files need explicit handlers

### Error: "A processing error occurred: [specific error]"

**Cause:** File processor threw an exception

**Solution:**
1. Read the specific error message (now visible!)
2. Check collector console for full stack trace
3. Common issues:
   - Corrupted file
   - Missing dependencies
   - Insufficient memory

## File Upload Flow (for debugging)

1. **Frontend uploads file** → POST to `/v1/document/upload`
2. **Server (multer) saves to hotdir** → `hotdir/filename.ext`
   - Log: `[Multer] Using hotdir path: ...`
3. **Server checks collector online** → GET `http://0.0.0.0:8888/`
   - Returns 200 if collector is running
4. **Server requests processing** → POST `http://0.0.0.0:8888/process`
   - Sends filename and metadata
5. **Collector reads from hotdir** → `WATCH_DIRECTORY/filename.ext`
   - Log: `[Collector] Processing file "filename.ext"`
6. **Collector processes file** → Converts to text/chunks
   - Logs processing steps
7. **Collector saves to documents** → `storage/documents/...`
8. **Collector generates embeddings** → Sends to LMStudio
9. **Collector stores vectors** → Stores in QDrant
10. **Collector returns success** → Response to server
11. **Server returns to frontend** → Upload complete

**Any step can fail - check logs at each step!**

## Testing the Fix

### 1. Start Services
```batch
cd dist
start-qdrant.bat    # Terminal 1
start.bat           # Terminal 2
```

### 2. Upload a Test File
- Open http://localhost:3001
- Create/select a workspace
- Upload a text file (e.g., README.md)

### 3. Check Logs

**Expected Collector Output:**
```
[Collector] Document processor app listening on port 8888
[Collector] Using hotdir from constants: D:\...\dist\hotdir
[Collector] Processing file "README.md"
```

**Expected Server Output:**
```
[Multer] Using hotdir path: D:\...\dist\hotdir
[CollectorApi] Document uploaded and processed successfully
```

### 4. Verify Success
- File should appear in workspace documents
- No errors in console
- File content is searchable in RAG queries

## Related Files

All files modified in this fix:

1. **collector/index.js** - Added configurable port, improved error messages, imported WATCH_DIRECTORY
2. **collector/utils/constants.js** - Already had hotdir path logic (from previous fix)
3. **server/utils/files/multer.js** - Already had hotdir path logic (from previous fix)
4. **build-exe.cjs** - Added COLLECTOR_PORT to .env generation

### Additional Fix 1: Missing WATCH_DIRECTORY Import

**Issue:** After adding logging for WATCH_DIRECTORY, forgot to import it, causing:
```
ReferenceError: WATCH_DIRECTORY is not defined
```

**Fix (collector/index.js:22):**
```javascript
// Before:
const { ACCEPTED_MIMES } = require("./utils/constants");

// After:
const { ACCEPTED_MIMES, WATCH_DIRECTORY } = require("./utils/constants");
```

### Additional Fix 2: Dynamic require() in Bun Compiled Executable

**Issue:** File processing failed with:
```
Cannot find module './convert/asTxt.js' from 'B:\~BUN\root\gamemechanic-collector.exe'
```

**Root Cause:** Dynamic `require()` with computed paths doesn't work in Bun compiled executables:
```javascript
const FileTypeProcessor = require(SUPPORTED_FILETYPE_CONVERTERS[processFileAs]);
```

**Fix (collector/processSingleFile/index.js):**
Pre-import all converters at the top of the file and use static mapping:

```javascript
// Pre-import all converters for Bun compiled executable compatibility
const asTxt = require("./convert/asTxt.js");
const asPDF = require("./convert/asPDF/index.js");
const asDocx = require("./convert/asDocx.js");
const asOfficeMime = require("./convert/asOfficeMime.js");
const asXlsx = require("./convert/asXlsx.js");
const asMbox = require("./convert/asMbox.js");
const asEPub = require("./convert/asEPub.js");
const asAudio = require("./convert/asAudio.js");
const asImage = require("./convert/asImage.js");

// Map file extensions to pre-imported converters
const CONVERTER_MAP = {
  ".txt": asTxt,
  ".md": asTxt,
  ".pdf": asPDF,
  ".docx": asDocx,
  // ... etc
};

// Use static reference instead of dynamic require
const FileTypeProcessor = CONVERTER_MAP[processFileAs];
```

**Build Script Update (build-exe.cjs:184):**
Added external packages to prevent bundling issues:
```javascript
--external typescript --external fluent-ffmpeg --external pdf-parse
```

**Why these packages are external:**
- `typescript` - Required by cosmiconfig at runtime
- `fluent-ffmpeg` - Has conditional requires that break bundling
- `pdf-parse` - Has debug code that runs at require time and tries to read test files

**Important:** External packages are automatically copied to `dist/node_modules/` during build so they're available at runtime.

The build script now includes:
```javascript
// Copy external collector dependencies to dist/node_modules
// Also include hoisted dependencies of external packages:
// - pdf-parse requires: node-ensure, debug
// - debug requires: ms
const externalPackages = ['pdf-parse', 'fluent-ffmpeg', 'typescript', 'node-ensure', 'debug', 'ms'];
for (const pkg of externalPackages) {
  copyRecursive(srcPkg, destPkg);
}
```

## Previous Related Fixes

This fix builds on the previous hotdir path fix (see HOTDIR_FIX.md):
- Made hotdir path configurable via COLLECTOR_HOTDIR
- Fixed server's multer to use dynamic hotdir path
- Both server and collector now use same hotdir resolution logic

Together, these fixes ensure:
- ✅ Files are saved to correct location
- ✅ Collector can find uploaded files
- ✅ Collector port is configurable
- ✅ Error messages are meaningful
- ✅ Everything is logged for debugging

## Benefits of This Fix

1. **Better Debugging** - Actual error messages instead of generic ones
2. **Flexible Configuration** - Can change collector port via environment variable
3. **Clear Logging** - Shows exactly what port and paths are being used
4. **Production Ready** - No hardcoded values, all configurable
5. **User Friendly** - Error messages help users fix their own issues

## Migration Notes

### For Existing Installations:

If you already have a dist folder from a previous build:

1. **Rebuild from source:**
   ```bash
   cd /path/to/game-mechanic-llm
   node build-exe.cjs
   ```

2. **Or manually update your .env:**
   ```env
   # Add this line to your existing .env
   COLLECTOR_PORT=8888
   ```

3. **Restart both executables** to pick up the changes

### For New Installations:

Just run:
```batch
cd dist
setup.bat
start.bat
```

Everything is pre-configured!

### Additional Fix 3: Hoisted Dependencies for External Packages

**Issue:** After fixing the dynamic require issue, PDF files still failed with:
```
error: Cannot find package 'node-ensure' from 'D:\...\dist\node_modules\pdf-parse\lib\pdf.js\v1.10.100\build\pdf.js'
```

**Root Cause:** When npm/bun installs packages, it "hoists" shared dependencies to the root `node_modules/` directory to save space.

Example structure:
```
collector/node_modules/
├── pdf-parse/              ← External package
│   └── node_modules/
│       └── debug/          ← Nested copy (sometimes)
├── node-ensure/            ← Hoisted dependency
├── debug/                  ← Hoisted dependency
└── ms/                     ← Hoisted dependency (of debug)
```

When we copied only `pdf-parse/` to `dist/node_modules/`, its hoisted dependencies (`node-ensure`, `debug`, `ms`) were not copied. At runtime, pdf-parse couldn't find these packages.

**Fix (build-exe.cjs:212-216):**

Added hoisted dependencies to the copy list:

```javascript
// External packages that need to be copied
// Also include hoisted dependencies of external packages:
// - pdf-parse requires: node-ensure, debug
// - debug requires: ms
const externalPackages = ['pdf-parse', 'fluent-ffmpeg', 'typescript', 'node-ensure', 'debug', 'ms'];
```

**How to Identify Hoisted Dependencies:**

1. Check the package.json of external packages:
   ```bash
   cat collector/node_modules/pdf-parse/package.json
   ```
   Look at the `dependencies` field.

2. Check if they exist in root node_modules:
   ```bash
   ls collector/node_modules/node-ensure
   ls collector/node_modules/debug
   ```

3. Add them to the `externalPackages` array in build-exe.cjs

**Benefits:**
- ✅ PDF files now process correctly
- ✅ All external package dependencies are available at runtime
- ✅ No need to modify npm's hoisting behavior
- ✅ Follows the existing pattern for external packages

## Future Enhancements

Potential improvements:

1. **Health Check Endpoint** - Dedicated endpoint for checking collector health
2. **Retry Logic** - Auto-retry failed uploads with exponential backoff
3. **File Validation** - Check file size/type before uploading
4. **Progress Tracking** - Show upload/processing progress to users
5. **Batch Uploads** - Process multiple files efficiently
6. **Error Recovery** - Automatic cleanup and retry on failures
7. **Automatic Dependency Detection** - Script to automatically detect and copy hoisted dependencies
