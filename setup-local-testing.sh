#!/bin/bash
# Local Testing Setup Script for Linux/Mac
# This script helps you set up and test the dialer system locally

echo "========================================"
echo "Dialer Local Testing Setup"
echo "========================================"
echo ""

# Check if Docker is running
echo "Checking Docker..."
if ! docker ps &> /dev/null; then
    echo "ERROR: Docker is not running or not installed!"
    echo "Please start Docker and try again."
    exit 1
fi
echo "✓ Docker is running"
echo ""

# Start Asterisk
echo "Starting Asterisk container..."
docker-compose -f docker-compose.asterisk.yml up -d
if [ $? -eq 0 ]; then
    echo "✓ Asterisk container started"
else
    echo "ERROR: Failed to start Asterisk container"
    exit 1
fi
echo ""

# Wait for Asterisk to initialize
echo "Waiting for Asterisk to initialize (5 seconds)..."
sleep 5

# Check Asterisk status
echo "Checking Asterisk status..."
if docker exec dialer-asterisk asterisk -rx "core show version" &> /dev/null; then
    echo "✓ Asterisk is running"
    docker exec dialer-asterisk asterisk -rx "core show version" | head -1
else
    echo "WARNING: Could not verify Asterisk status"
fi
echo ""

# Reload SIP configuration
echo "Reloading SIP configuration..."
docker exec dialer-asterisk asterisk -rx "sip reload" &> /dev/null
docker exec dialer-asterisk asterisk -rx "dialplan reload" &> /dev/null
echo "✓ Configuration reloaded"
echo ""

# Show registered peers
echo "Current SIP registrations:"
docker exec dialer-asterisk asterisk -rx "sip show peers"
echo ""

# Display softphone configuration
echo "========================================"
echo "Softphone Configuration"
echo "========================================"
echo ""
echo "Use these settings in your softphone (Zoiper, X-Lite, etc.):"
echo ""
echo "Extension 8013:"
echo "  Username: 8013"
echo "  Password: password123"
echo "  Server: localhost"
echo "  Port: 5060"
echo "  Transport: UDP"
echo ""
echo "Extension 8014:"
echo "  Username: 8014"
echo "  Password: password123"
echo "  Server: localhost"
echo "  Port: 5060"
echo "  Transport: UDP"
echo ""
echo "Test Extension 9000 (for simulating customer):"
echo "  Username: 9000"
echo "  Password: test123"
echo "  Server: localhost"
echo "  Port: 5060"
echo "  Transport: UDP"
echo ""

# Display next steps
echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""
echo "1. Install a softphone (Zoiper, X-Lite, or Linphone)"
echo "2. Configure it with the settings above"
echo "3. Register the softphone"
echo "4. Start your backend server:"
echo "   cd backend"
echo "   python -m uvicorn app.main:app --reload"
echo "5. Start your frontend server:"
echo "   cd frontend"
echo "   npm run dev"
echo "6. Open http://localhost:3000 and login"
echo "7. Try making a call from the dialer interface!"
echo ""
echo "For detailed testing instructions, see LOCAL_TESTING_GUIDE.md"
echo ""
echo "========================================"
echo "Useful Commands"
echo "========================================"
echo ""
echo "View Asterisk logs:"
echo "  docker logs dialer-asterisk -f"
echo ""
echo "Check SIP registrations:"
echo "  docker exec dialer-asterisk asterisk -rx 'sip show peers'"
echo ""
echo "Open Asterisk CLI:"
echo "  docker exec -it dialer-asterisk asterisk -rvvv"
echo ""
echo "Stop Asterisk:"
echo "  docker-compose -f docker-compose.asterisk.yml down"
echo ""
