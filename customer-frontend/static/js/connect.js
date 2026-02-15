// Connect Feature - Phone Pairing via QR Code and BLE
// For Smart Trolley Customer Frontend

let qrcodeInstance = null;
let qrTimer = null;
let qrTimeLeft = 180; // 3 minutes in seconds
let connectionState = 'disconnected'; // disconnected, qr_display, connecting, connected, error

// Generate unique trolley ID and pairing token
function generatePairingData() {
    const trolleyId = `TRL-402-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    const pairingToken = Math.random().toString(36).substring(2, 14);
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 180; // 3 minutes validity

    return {
        trolley_id: trolleyId,
        pairing_token: pairingToken,
        service_uuid: "ble-smart-trolley",
        timestamp: timestamp,
        expires_at: expiresAt
    };
}

// Initialize QR Code
function initQRCode() {
    const qrcodeContainer = document.getElementById('qrcode');

    // Clear existing QR code
    if (qrcodeContainer) {
        qrcodeContainer.innerHTML = '';
    }

    if (qrcodeInstance) {
        qrcodeInstance = null;
    }

    const pairingData = generatePairingData();
    const qrData = JSON.stringify(pairingData);

    // Generate QR Code
    qrcodeInstance = new QRCode(qrcodeContainer, {
        text: qrData,
        width: 280,
        height: 280,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });

    // Store pairing data for demo
    sessionStorage.setItem('pairing_data', qrData);

    // Start countdown timer
    startQRTimer();
}

// Start QR code expiry timer
function startQRTimer() {
    qrTimeLeft = 180; // Reset to 3 minutes
    updateTimerDisplay();

    // Clear existing timer
    if (qrTimer) {
        clearInterval(qrTimer);
    }

    qrTimer = setInterval(() => {
        qrTimeLeft--;
        updateTimerDisplay();

        if (qrTimeLeft <= 0) {
            clearInterval(qrTimer);
            // Auto-refresh QR code when it expires
            refreshQRCode();
        }
    }, 1000);
}

// Update timer display
function updateTimerDisplay() {
    const timerElement = document.getElementById('qr-timer');
    if (timerElement) {
        const minutes = Math.floor(qrTimeLeft / 60);
        const seconds = qrTimeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Change color when time is running out
        if (qrTimeLeft < 30) {
            timerElement.classList.add('text-red-600');
            timerElement.classList.remove('text-orange-600');
        } else {
            timerElement.classList.add('text-orange-600');
            timerElement.classList.remove('text-red-600');
        }
    }
}

// Refresh QR Code (manual or automatic)
function refreshQRCode() {
    // Reinitialize QR code
    initQRCode();

    // Show brief feedback
    if (typeof showToast === 'function') {
        showToast(getTranslation('refreshCode') + ' ✓', 'success');
    }
}

// Open Connect Modal
function openConnectModal() {
    const modal = document.getElementById('connect-modal');
    if (modal) {
        // Reset to QR display state
        showConnectState('qr');

        // Initialize QR code
        initQRCode();

        // Show modal
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.bg-white').classList.remove('scale-95');
        }, 10);

        connectionState = 'qr_display';
        updateConnectIcon();
    }
}

// Close Connect Modal
function closeConnectModal() {
    const modal = document.getElementById('connect-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('.bg-white').classList.add('scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);

        // Clear QR timer
        if (qrTimer) {
            clearInterval(qrTimer);
            qrTimer = null;
        }

        // If connected, keep the connected state
        if (connectionState !== 'connected') {
            connectionState = 'disconnected';
        }

        // Return to home view
        if (typeof handleNav === 'function') {
            handleNav('home');
        }

        updateConnectIcon();
    }
}

// Show specific connection state
function showConnectState(state) {
    const qrState = document.getElementById('connect-qr-state');
    const connectingState = document.getElementById('connect-connecting-state');
    const successState = document.getElementById('connect-success-state');
    const errorState = document.getElementById('connect-error-state');

    // Hide all states
    [qrState, connectingState, successState, errorState].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Show requested state
    switch (state) {
        case 'qr':
            if (qrState) qrState.classList.remove('hidden');
            break;
        case 'connecting':
            if (connectingState) connectingState.classList.remove('hidden');
            break;
        case 'success':
            if (successState) successState.classList.remove('hidden');
            break;
        case 'error':
            if (errorState) errorState.classList.remove('hidden');
            break;
    }
}

// Simulate pairing (for demo purposes)
function simulatePairing() {
    connectionState = 'connecting';
    showConnectState('connecting');
    updateConnectIcon();

    // Simulate pairing delay (2-5 seconds)
    const pairingDelay = 2000 + Math.random() * 3000;

    setTimeout(() => {
        // 90% success rate for demo
        const isSuccess = Math.random() > 0.1;

        if (isSuccess) {
            connectionState = 'connected';
            showConnectState('success');
            updateConnectIcon();

            // Store connection state
            sessionStorage.setItem('phone_connected', 'true');

            // Auto-close after 3 seconds
            setTimeout(() => {
                closeConnectModal();
            }, 3000);

            if (typeof showToast === 'function') {
                showToast(getTranslation('phoneConnected'), 'success');
            }
        } else {
            connectionState = 'error';
            showConnectState('error');
            updateConnectIcon();
        }
    }, pairingDelay);
}

// Retry connection after error
function retryConnection() {
    // Reset to QR display
    showConnectState('qr');
    refreshQRCode();
    connectionState = 'qr_display';
    updateConnectIcon();
}

// Update Connect navigation icon based on state
function updateConnectIcon() {
    const navConnect = document.getElementById('nav-connect');
    const connectIcon = document.getElementById('connect-icon');

    if (!navConnect || !connectIcon) return;

    // Remove all state classes
    navConnect.classList.remove('text-gray-400', 'text-blue-500', 'text-green-500', 'text-orange-500');
    connectIcon.classList.remove('fa-bluetooth', 'fa-bluetooth-b', 'fa-check-circle', 'fa-exclamation-triangle');

    switch (connectionState) {
        case 'disconnected':
            navConnect.classList.add('text-gray-400');
            connectIcon.classList.add('fa-bluetooth');
            break;
        case 'qr_display':
        case 'connecting':
            navConnect.classList.add('text-blue-500');
            connectIcon.classList.add('fa-bluetooth-b');
            break;
        case 'connected':
            navConnect.classList.add('text-green-500');
            connectIcon.classList.add('fa-check-circle');
            break;
        case 'error':
            navConnect.classList.add('text-orange-500');
            connectIcon.classList.add('fa-exclamation-triangle');
            break;
    }
}

// Listen for simulated QR scan (for demo/testing)
function simulateQRScan() {
    if (connectionState === 'qr_display') {
        simulatePairing();
    }
}

// Check connection status on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if phone was previously connected
    const wasConnected = sessionStorage.getItem('phone_connected');
    if (wasConnected === 'true') {
        connectionState = 'connected';
        updateConnectIcon();
    }

    // Add keyboard shortcut for testing (Ctrl+Shift+C to simulate scan)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            console.log('Simulating QR scan for demo...');
            simulateQRScan();
        }
    });
});

// Make functions globally available
window.openConnectModal = openConnectModal;
window.closeConnectModal = closeConnectModal;
window.refreshQRCode = refreshQRCode;
window.retryConnection = retryConnection;
window.simulateQRScan = simulateQRScan;
