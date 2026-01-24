# Local Testing Setup Script for Windows PowerShell
# This script helps you set up and test the dialer system locally

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dialer Local Testing Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running or not installed!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green
Write-Host ""

# Start Asterisk
Write-Host "Starting Asterisk container..." -ForegroundColor Yellow
docker-compose -f docker-compose.asterisk.yml up -d
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Asterisk container started" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to start Asterisk container" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait for Asterisk to initialize
Write-Host "Waiting for Asterisk to initialize (5 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check Asterisk status
Write-Host "Checking Asterisk status..." -ForegroundColor Yellow
$asteriskStatus = docker exec dialer-asterisk asterisk -rx "core show version" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Asterisk is running" -ForegroundColor Green
    Write-Host "  $asteriskStatus" -ForegroundColor Gray
} else {
    Write-Host "WARNING: Could not verify Asterisk status" -ForegroundColor Yellow
}
Write-Host ""

# Reload SIP configuration
Write-Host "Reloading SIP configuration..." -ForegroundColor Yellow
docker exec dialer-asterisk asterisk -rx "sip reload" | Out-Null
docker exec dialer-asterisk asterisk -rx "dialplan reload" | Out-Null
Write-Host "✓ Configuration reloaded" -ForegroundColor Green
Write-Host ""

# Show registered peers
Write-Host "Current SIP registrations:" -ForegroundColor Yellow
docker exec dialer-asterisk asterisk -rx "sip show peers"
Write-Host ""

# Display softphone configuration
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Softphone Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Use these settings in your softphone (Zoiper, X-Lite, etc.):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Extension 8013:" -ForegroundColor Green
Write-Host "  Username: 8013" -ForegroundColor White
Write-Host "  Password: password123" -ForegroundColor White
Write-Host "  Server: localhost" -ForegroundColor White
Write-Host "  Port: 5060" -ForegroundColor White
Write-Host "  Transport: UDP" -ForegroundColor White
Write-Host ""
Write-Host "Extension 8014:" -ForegroundColor Green
Write-Host "  Username: 8014" -ForegroundColor White
Write-Host "  Password: password123" -ForegroundColor White
Write-Host "  Server: localhost" -ForegroundColor White
Write-Host "  Port: 5060" -ForegroundColor White
Write-Host "  Transport: UDP" -ForegroundColor White
Write-Host ""
Write-Host "Test Extension 9000 (for simulating customer):" -ForegroundColor Green
Write-Host "  Username: 9000" -ForegroundColor White
Write-Host "  Password: test123" -ForegroundColor White
Write-Host "  Server: localhost" -ForegroundColor White
Write-Host "  Port: 5060" -ForegroundColor White
Write-Host "  Transport: UDP" -ForegroundColor White
Write-Host ""

# Display next steps
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Install a softphone (Zoiper, X-Lite, or Linphone)" -ForegroundColor Yellow
Write-Host "2. Configure it with the settings above" -ForegroundColor Yellow
Write-Host "3. Register the softphone" -ForegroundColor Yellow
Write-Host "4. Start your backend server:" -ForegroundColor Yellow
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   python -m uvicorn app.main:app --reload" -ForegroundColor White
Write-Host "5. Start your frontend server:" -ForegroundColor Yellow
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host "6. Open http://localhost:3000 and login" -ForegroundColor Yellow
Write-Host "7. Try making a call from the dialer interface!" -ForegroundColor Yellow
Write-Host ""
Write-Host "For detailed testing instructions, see LOCAL_TESTING_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Useful Commands" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "View Asterisk logs:" -ForegroundColor Yellow
Write-Host "  docker logs dialer-asterisk -f" -ForegroundColor White
Write-Host ""
Write-Host "Check SIP registrations:" -ForegroundColor Yellow
Write-Host "  docker exec dialer-asterisk asterisk -rx 'sip show peers'" -ForegroundColor White
Write-Host ""
Write-Host "Open Asterisk CLI:" -ForegroundColor Yellow
Write-Host "  docker exec -it dialer-asterisk asterisk -rvvv" -ForegroundColor White
Write-Host ""
Write-Host "Stop Asterisk:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.asterisk.yml down" -ForegroundColor White
Write-Host ""
