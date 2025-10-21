# Set the storage location
$env:STORAGE_LOCATION = "$HOME\Documents\game-mechanic-llm"

# Create the storage directory and .env file if they don't exist
If(!(Test-Path $env:STORAGE_LOCATION)) {
    New-Item $env:STORAGE_LOCATION -ItemType Directory
}
If(!(Test-Path "$env:STORAGE_LOCATION\.env")) {
    New-Item "$env:STORAGE_LOCATION\.env" -ItemType File
}

# Run the container
docker run -d -p 3001:3001 `
    --name game-mechanic-llm `
    --cap-add SYS_ADMIN `
    -v "${env:STORAGE_LOCATION}:/app/server/storage" `
    -v "${env:STORAGE_LOCATION}\.env:/app/server/.env" `
    -e STORAGE_DIR="/app/server/storage" `
    game-mechanic-llm:latest