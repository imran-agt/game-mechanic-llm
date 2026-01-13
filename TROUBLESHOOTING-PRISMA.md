# Troubleshooting: Prisma Generation Hangs on Windows

## Symptoms

The build gets stuck at:
```
Step 4/6: Building server executable with icon
========================================================
Generating Prisma client...
Prisma schema loaded from prisma\schema.prisma
```

And then nothing happens for several minutes.

## Common Causes

### 1. First-Time Generation Takes Time (Most Common)
Prisma needs to download binary engines on first run. This can take 2-10 minutes depending on:
- Internet speed
- Windows Defender scanning
- Disk speed

**What to do:**
- ⏰ **Wait 5-10 minutes** - It's probably working!
- Look at your network activity - is data being downloaded?
- Check Task Manager - is there CPU/disk activity?

### 2. Windows Defender Scanning
Windows Defender scans new executables, which slows down Prisma binary downloads.

**Solution:**
```cmd
# Add exclusion for your project folder
# Open PowerShell as Administrator:
Add-MpPreference -ExclusionPath "D:\game-mechanic-llm"
```

### 3. Antivirus Blocking Prisma Binaries
Some antivirus software blocks or quarantines Prisma's native binaries.

**Solution:**
- Temporarily disable antivirus
- Add exclusion for `server\node_modules\.prisma` folder
- Check antivirus quarantine logs

### 4. Network/Firewall Issues
Corporate firewalls or proxy settings might block Prisma binary downloads.

**Solution:**
```cmd
# Set Prisma to use HTTP instead of HTTPS
set PRISMA_ENGINES_MIRROR=http://prisma-builds.s3-eu-west-1.amazonaws.com
```

### 5. Corrupted Prisma Cache
Old or corrupted Prisma files can cause hangs.

**Solution:**
```cmd
cd server
rmdir /s /q node_modules\.prisma
rmdir /s /q node_modules\@prisma
bun install
```

## Quick Diagnostic Steps

### Step 1: Check if it's really hung
Open Task Manager (Ctrl+Shift+Esc) and check:
- Is `bun.exe` using CPU? (It's working)
- Is there disk activity? (It's working)
- Is there network activity? (Downloading binaries)
- Is nothing happening for 10+ minutes? (Likely hung)

### Step 2: Check Prisma files
```cmd
cd server
dir node_modules\.prisma
dir node_modules\@prisma\client
```

If these folders don't exist or are empty, Prisma hasn't generated yet.

### Step 3: Test Prisma generation manually
Run the test script:
```cmd
test-prisma-windows.bat
```

This will show detailed output and help identify the issue.

## Solutions

### Solution 1: Manual Prisma Generation (Recommended)

1. **Open a new Command Prompt** (don't close the hung one yet)

2. **Navigate to server directory:**
   ```cmd
   D:
   cd \game-mechanic-llm\server
   ```

3. **Run Prisma generation manually:**
   ```cmd
   bun install
   bun node_modules\.bin\prisma generate
   ```

4. **Wait for it to complete** - you'll see:
   ```
   ✔ Generated Prisma Client
   ```

5. **Go back to the original window** and press Ctrl+C to cancel

6. **Run the build again:**
   ```cmd
   cd ..
   build-exe-windows.bat
   ```

   The Prisma step should now be instant since it's already generated!

### Solution 2: Use Existing Prisma from Dev Container

The Prisma client generated in the dev container should work on Windows too:

1. **Check if .prisma folder exists in dev container:**
   ```cmd
   dir server\node_modules\.prisma
   ```

2. **If it exists, just skip Prisma generation** and build directly

3. **Create a simplified build script** (see below)

### Solution 3: Skip Prisma Generation Entirely

If Prisma is already generated, you can build the EXE directly:

```cmd
cd server
bun build --compile --target=bun-windows-x64 --minify --sourcemap --windows-icon="..\frontend\src\media\logo\workspace.ico" --external mock-aws-s3 --external aws-sdk --external nock ./index.js --outfile ..\dist\gamemechanic-server.exe
cd ..
```

## Quick Fix Build Script (Skip Prisma)

I'll create a faster build script that skips Prisma generation if it's already done.

## After Prisma Generation Succeeds

Once Prisma generates successfully once:
- The binaries are cached
- Future builds will be much faster
- The `.prisma` folder contains the generated client

## Prevention for Future Builds

After successful first build:

1. **The Prisma binaries are cached** in:
   - `server\node_modules\.prisma`
   - `server\node_modules\@prisma\client`

2. **Don't delete these folders** unless you have issues

3. **Future builds will be much faster**

## What I Recommend Right Now

Since it's stuck, do this:

1. **Press Ctrl+C** to cancel the current build
2. **Run the test script** to see what's happening:
   ```cmd
   test-prisma-windows.bat
   ```
3. **If it hangs again**, manually generate Prisma in a separate window
4. **Once Prisma works**, run the build again
