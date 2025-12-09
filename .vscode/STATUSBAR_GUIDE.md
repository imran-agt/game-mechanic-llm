# VS Code Status Bar Button Guide

## Required Extension

The status bar buttons require the **Tasks** extension:
- Extension ID: `actboy168.tasks`
- Status: ✅ Installed

## Available Status Bar Buttons

You should see these buttons in the bottom status bar:

1. **Collector: ▶ run** (Yellow) - Runs the collector
2. **Server: ▶ run** (Yellow) - Runs the server
3. **Frontend: ▶ run** (Yellow) - Runs the frontend
4. **Build: 📦 Windows EXE** (Green) - Builds Windows executables

## Troubleshooting

### Button Not Visible?

Try these steps:

#### 1. Reload VS Code Window
- Press: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type: "Developer: Reload Window"
- Press Enter

#### 2. Manually Trigger Task Refresh
- Press: `Ctrl+Shift+P` (or `Cmd+Shift+P`)
- Type: "Tasks: Run Task"
- You should see "Build Windows EXE" in the list
- Select it to run

#### 3. Check Extension Status
- Press: `Ctrl+Shift+X` (or `Cmd+Shift+X`)
- Search for: "actboy168.tasks"
- Ensure it's enabled (not disabled)

#### 4. Verify Tasks Configuration
- Open: `.vscode/tasks.json`
- Look for the task with `"label": "Build Windows EXE"`
- Ensure it has the `statusbar` property under `options`

#### 5. Alternative: Use Command Palette
If the button still doesn't appear, you can always run tasks via:
- `Ctrl+Shift+P` → "Tasks: Run Task" → "Build Windows EXE"

## Manual Task Execution

### Via Terminal
```bash
# Full build
npm run build:exe

# Or
yarn build:exe

# Or direct
node build-exe.js
```

### Via VS Code Tasks Panel
1. Click "Terminal" menu
2. Select "Run Task..."
3. Choose "Build Windows EXE"

## Status Bar Location

The buttons appear in the **bottom status bar** of VS Code:
- Usually on the left side
- Between the branch indicator and other status items
- Colored buttons with icons

## Button States

- **Idle**: Shows icon and label (e.g., "Build: 📦 Windows EXE")
- **Running**: Shows spinning gear (e.g., "Build: ⚙ Building EXE...")

## Expected Button Colors

- Yellow (`#ffea00`) - Development tasks (Collector, Server, Frontend)
- Green (`#00ff00`) - Build task (Windows EXE)
