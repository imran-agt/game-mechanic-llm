# ============================================================
# Game Mechanic LLM - Docker Build and Export Script (Windows)
# ============================================================

# Configuration
$ProjectRoot = "D:\Bitbucket\game-mechanic-llm"
$ImageName = "game-mechanic-llm"
$ImageVersion = "v0.1a"
$ExportPath = "$ProjectRoot\exports"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Create exports directory if it doesn't exist
if (!(Test-Path $ExportPath)) {
    New-Item -ItemType Directory -Path $ExportPath | Out-Null
    Write-Host "Created exports directory: $ExportPath" -ForegroundColor Green
}

# Navigate to project root
Set-Location $ProjectRoot
Write-Host "`nBuilding Docker image from: $ProjectRoot" -ForegroundColor Cyan

# Step 1: Build the Docker image with all customizations
Write-Host "`n[1/4] Building Docker image..." -ForegroundColor Yellow
docker build `
    --file .\docker\Dockerfile `
    --tag "${ImageName}:latest" `
    --tag "${ImageName}:${ImageVersion}" `
    --tag "${ImageName}:${Timestamp}" `
    --build-arg ARG_UID=1000 `
    --build-arg ARG_GID=1000 `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Docker image built successfully!" -ForegroundColor Green

# Step 2: Verify the image was created
Write-Host "`n[2/4] Verifying image..." -ForegroundColor Yellow
docker images | Select-String $ImageName

# Step 3: Export the image to tar file (uncompressed)
$ExportFileTar = "$ExportPath\${ImageName}-${ImageVersion}-${Timestamp}.tar"
Write-Host "`n[3/4] Exporting image to: $ExportFileTar" -ForegroundColor Yellow

docker save -o $ExportFileTar "${ImageName}:latest" "${ImageName}:${ImageVersion}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker export failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Image exported successfully!" -ForegroundColor Green

# Step 4: Compress using native Windows compression
Write-Host "`n[4/4] Compressing with Windows native compression..." -ForegroundColor Yellow
$ExportFileZip = "$ExportPath\${ImageName}-${ImageVersion}-${Timestamp}.zip"

# Compress the tar file
Compress-Archive -Path $ExportFileTar -DestinationPath $ExportFileZip -CompressionLevel Optimal -Force

# Remove the uncompressed tar file to save space (optional)
Remove-Item $ExportFileTar

# Get file size
$FileSize = (Get-Item $ExportFileZip).Length / 1GB
Write-Host "`nCompression completed successfully!" -ForegroundColor Green
Write-Host "File: $ExportFileZip" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round($FileSize, 2)) GB" -ForegroundColor Cyan

# Step 5: Create a README for deployment
$ReadmePath = "$ExportPath\DEPLOYMENT-INSTRUCTIONS-${Timestamp}.txt"
@"
Game Mechanic LLM - Docker Deployment Instructions
===================================================

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Image Version: ${ImageVersion}
Export File: ${ImageName}-${ImageVersion}-${Timestamp}.zip

DEPLOYMENT STEPS FOR TARGET MACHINE:
------------------------------------

1. Transfer the ZIP file to the target machine via USB or network

2. Extract the ZIP file to get the .tar file:
   Right-click > Extract All
   
   Or use PowerShell:
   Expand-Archive -Path "${ImageName}-${ImageVersion}-${Timestamp}.zip" -DestinationPath .

3. Load the Docker image:
   docker load -i ${ImageName}-${ImageVersion}-${Timestamp}.tar

4. Verify the image loaded:
   docker images

5. Create storage directory:
   `$env:STORAGE_LOCATION = "`$HOME\Documents\game-mechanic-llm"
   If(!(Test-Path `$env:STORAGE_LOCATION)) {New-Item `$env:STORAGE_LOCATION -ItemType Directory}
   If(!(Test-Path "`$env:STORAGE_LOCATION\.env")) {New-Item "`$env:STORAGE_LOCATION\.env" -ItemType File}

6. Run the container:
   docker run -d -p 3001:3001 ``
     --name game-mechanic-llm ``
     --cap-add SYS_ADMIN ``
     -v "`$env:STORAGE_LOCATION:/app/server/storage" ``
     -v "`$env:STORAGE_LOCATION\.env:/app/server/.env" ``
     -e STORAGE_DIR="/app/server/storage" ``
     ${ImageName}:latest

7. Access the application:
   http://localhost:3001

NOTES:
------
- All custom branding and logos are included in this image
- No internet connection required after initial load
- Data persists in the mounted storage directory
- Container name: game-mechanic-llm
- To stop: docker stop game-mechanic-llm
- To start: docker start game-mechanic-llm
- To update, load a new image and recreate the container

"@ | Out-File -FilePath $ReadmePath -Encoding UTF8

Write-Host "`nDeployment instructions created: $ReadmePath" -ForegroundColor Cyan

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "BUILD AND EXPORT COMPLETE!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "`nExported files:" -ForegroundColor Yellow
Write-Host "  Image: $ExportFileZip" -ForegroundColor White
Write-Host "  Docs:  $ReadmePath" -ForegroundColor White
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")