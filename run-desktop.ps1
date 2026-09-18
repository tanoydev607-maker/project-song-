# Songbird AI Desktop Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Launching Songbird AI Desktop Application" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

# 1. Start Python Hermes Agent Engine on port 18789 if not running
$enginePort = 18789
$engineRunning = Get-NetTCPConnection -LocalPort $enginePort -State Listen -ErrorAction SilentlyContinue
if (-not $engineRunning) {
    Write-Host "[1/3] Starting Hermes Agent Engine (Moonshine Tiny STT + Kokoro-82M TTS)..." -ForegroundColor Yellow
    $pythonExe = Join-Path $root "engine\hermes-agent\venv\Scripts\python.exe"
    $engineDir = Join-Path $root "engine\hermes-agent"
    if (Test-Path $pythonExe) {
        Start-Process -FilePath $pythonExe -ArgumentList "-u server.py" -WorkingDirectory $engineDir -WindowStyle Hidden
    } else {
        Write-Warning "Python venv not found at $pythonExe! Falling back to system python..."
        Start-Process -FilePath "python" -ArgumentList "-u server.py" -WorkingDirectory $engineDir -WindowStyle Hidden
    }

    # Wait for engine to finish loading models and bind port 18789
    $engineReady = $false
    $engAttempt = 0
    while (-not $engineReady -and $engAttempt -lt 25) {
        Start-Sleep -Milliseconds 400
        $engAttempt++
        $conn = Get-NetTCPConnection -LocalPort $enginePort -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $engineReady = $true
        }
    }
    if ($engineReady) {
        Write-Host "      [OK] Hermes Voice Engine active on ws://127.0.0.1:$enginePort." -ForegroundColor Green
    } else {
        Write-Warning "Hermes Engine is taking longer than expected to bind port $enginePort. Proceeding..."
    }
} else {
    Write-Host "[1/3] Hermes Agent Daemon already running on port $enginePort." -ForegroundColor Green
}

# 2. Start Vite Frontend on port 1420 if not running
$frontendPort = 1420
$frontendRunning = Get-NetTCPConnection -LocalPort $frontendPort -ErrorAction SilentlyContinue
if (-not $frontendRunning) {
    Write-Host "[2/3] Starting Desktop Frontend on port $frontendPort..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c pnpm dev:frontend" -WorkingDirectory $root -WindowStyle Hidden
} else {
    Write-Host "[2/3] Desktop Frontend already running on port $frontendPort." -ForegroundColor Green
}

# 3. Wait until Frontend is responsive
Write-Host "[3/3] Waiting for Songbird services to initialize..." -ForegroundColor Yellow
$maxAttempts = 15
$attempt = 0
$ready = $false
while (-not $ready -and $attempt -lt $maxAttempts) {
    Start-Sleep -Milliseconds 800
    $attempt++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:1420" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($resp -and $resp.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Retry
    }
}

# 4. Launch Desktop Window
$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$browserLaunched = $false
foreach ($p in $edgePaths) {
    if (Test-Path $p) {
        Write-Host "Launching Songbird Desktop App Window via Edge App Mode..." -ForegroundColor Cyan
        Start-Process -FilePath $p -ArgumentList "--app=http://localhost:1420"
        $browserLaunched = $true
        break
    }
}

if (-not $browserLaunched) {
    foreach ($p in $chromePaths) {
        if (Test-Path $p) {
            Write-Host "Launching Songbird Desktop App Window via Chrome App Mode..." -ForegroundColor Cyan
            Start-Process -FilePath $p -ArgumentList "--app=http://localhost:1420"
            $browserLaunched = $true
            break
        }
    }
}

if (-not $browserLaunched) {
    Write-Host "Opening Songbird in default browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:1420"
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Songbird AI is running successfully!" -ForegroundColor White
Write-Host "  Engine Daemon: ws://localhost:18789" -ForegroundColor Gray
Write-Host "  Desktop UI:    http://localhost:1420" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
