# Runs VRCPupil (dev mode). Double-clicking won't work by default;
# run it from a terminal:  powershell -ExecutionPolicy Bypass -File run.ps1

Set-Location -Path $PSScriptRoot

# First run: install dependencies (electron etc.)
if (-not (Test-Path ".\node_modules")) {
    Write-Host "node_modules missing, running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed"
        exit 1
    }
}

npm start
