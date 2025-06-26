// Dashboard Data Management
let isInitializing = false; // Flag to prevent double initialization

const dashboardData = {
    activeClients: 0,
    totalRevenue: 0,
    revenueCollected: 0,
    revenueDue: 0,
    revenuePastDue: 0,
    revenueDraft: 0
};

const REVENUE_GOAL = 1000; // $1,000 goal

// Initialize Dashboard
async function initializeDashboard() {
    if (isInitializing) {
        console.log('Dashboard already initializing, skipping...');
        return;
    }
    
    isInitializing = true;
    console.log('Initializing dashboard...');
    showLoadingState();
    updateDebugStatus('Data Status: Loading...');

    try {
        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            console.error('No authenticated user found');
            window.location.href = 'login.html';
            return;
        }

        console.log('User authenticated, loading metrics...');
        
        // Load metrics one by one to better track issues
        try {
            await loadClientMetrics();
            console.log('Client metrics loaded successfully');
        } catch (error) {
            console.error('Error loading client metrics:', error);
        }

        try {
            await loadRevenueMetrics();
            console.log('Revenue metrics loaded successfully');
        } catch (error) {
            console.error('Error loading revenue metrics:', error);
        }

        console.log('All metrics loaded, updating UI...', dashboardData);
        updateDebugStatus('Data Status: Loaded');
        updateDashboardUI();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showErrorMessage('Failed to load dashboard data: ' + error.message);
        updateDebugStatus('Data Status: Error loading');
    } finally {
        hideLoadingState();
        isInitializing = false;
    }
}

// Show Loading State
function showLoadingState() {
    console.log('Showing loading state...');
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(section => {
        const list = section.querySelector('.activity-list');
        if (list) {
            list.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner"></i> Loading...
                </div>
            `;
        }
    });
}

// Hide Loading State
function hideLoadingState() {
    console.log('Hiding loading state...');
    const loadingStates = document.querySelectorAll('.loading-state');
    loadingStates.forEach(state => state.remove());
}

// Load Client Metrics
async function loadClientMetrics() {
    try {
        console.log('Loading client metrics...');
        const clientsSnapshot = await db.collection('clients').get();
        dashboardData.activeClients = clientsSnapshot.docs.filter(doc => doc.data().isActive).length;
        console.log('Client metrics loaded:', { activeClients: dashboardData.activeClients });
    } catch (error) {
        console.error('Error loading client metrics:', error);
        throw error;
    }
}

// Load Revenue Metrics
async function loadRevenueMetrics() {
    console.log('Starting to load revenue metrics...');
    try {
        // Get all invoices directly from the root collection
        const invoicesSnapshot = await db.collection('invoices').get();
        console.log(`Found ${invoicesSnapshot.size} total invoices`);

        let totalRevenueEarned = 0;    // All statuses combined
        let totalRevenueCollected = 0; // Only Paid
        let totalRevenueBilled = 0;    // Due + Past Due
        let revenueDue = 0;            // Only Due
        let revenuePastDue = 0;        // Only Past Due
        let revenueDraft = 0;          // Only Draft

        // Process each invoice
        for (const invoice of invoicesSnapshot.docs) {
            const invoiceData = invoice.data();
            // Convert total to number and handle potential string values
            const amount = Number(invoiceData.total) || 0;
            console.log('Processing invoice:', {
                id: invoice.id,
                status: invoiceData.status,
                amount: amount,
                rawTotal: invoiceData.total,
                clientName: invoiceData.clientName
            });

            // Add to total revenue earned (all statuses)
            totalRevenueEarned += amount;

            switch (invoiceData.status?.toLowerCase()) {
                case 'paid':
                    totalRevenueCollected += amount;
                    break;
                case 'due':
                    revenueDue += amount;
                    totalRevenueBilled += amount;
                    break;
                case 'past due':
                    revenuePastDue += amount;
                    totalRevenueBilled += amount;
                    break;
                case 'draft':
                    revenueDraft += amount;
                    break;
            }
        }

        console.log('Final revenue calculations:', {
            totalRevenueEarned,
            totalRevenueCollected,
            totalRevenueBilled,
            revenueDue,
            revenuePastDue,
            revenueDraft
        });

        // Update dashboard data
        Object.assign(dashboardData, {
            totalRevenue: totalRevenueEarned,
            revenueCollected: totalRevenueCollected,
            revenueBilled: totalRevenueBilled,
            revenueDue,
            revenuePastDue,
            revenueDraft
        });

        console.log('Revenue metrics loaded:', {
            totalRevenueEarned,
            totalRevenueCollected,
            totalRevenueBilled,
            revenueDue,
            revenuePastDue,
            revenueDraft
        });
    } catch (error) {
        console.error('Error in loadRevenueMetrics:', error);
        throw error;
    }
}

// Update Debug Status
function updateDebugStatus(status) {
    const debugDataStatus = document.getElementById('debugDataStatus');
    if (debugDataStatus) {
        debugDataStatus.textContent = status;
        // Only show debug info if there's an error
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo && status.toLowerCase().includes('error')) {
            debugInfo.style.display = 'block';
        }
    }
}

// Update Dashboard UI
function updateDashboardUI() {
    try {
        console.log('Updating dashboard UI with data:', dashboardData);
        
        // Update metrics one by one with error checking
        const updates = [
            { id: 'activeClientsCount', value: dashboardData.activeClients },
            { id: 'totalRevenueAmount', value: formatCurrency(dashboardData.totalRevenue) },
            { id: 'revenueCollectedAmount', value: formatCurrency(dashboardData.revenueCollected) },
            { id: 'revenueDueAmount', value: formatCurrency(dashboardData.revenueDue) },
            { id: 'revenuePastDueAmount', value: formatCurrency(dashboardData.revenuePastDue) },
            { id: 'revenueDraftAmount', value: formatCurrency(dashboardData.revenueDraft) }
        ];

        // Update each metric with error handling
        updates.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Element with id '${id}' not found in the document`);
            }
        });
        
        // Update revenue goal progress with total revenue
        console.log('Updating revenue goal progress with:', dashboardData.totalRevenue);
        updateRevenueGoalProgress(dashboardData.totalRevenue);
        
        console.log('Dashboard UI updated successfully');
    } catch (error) {
        console.error('Error updating dashboard UI:', error);
        showErrorMessage('Failed to update dashboard: ' + error.message);
    }
}

// Helper Functions
function updateElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        console.log(`Updating element ${elementId} with value:`, value);
        if (element.tagName === 'INPUT') {
            element.value = value;
        } else {
            element.textContent = value;
        }
    } else {
        console.error(`Element not found: ${elementId}`);
    }
}

function formatCurrency(amount) {
    // Ensure amount is a number and handle potential string values
    const numericAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numericAmount);
}

function showErrorMessage(message) {
    console.error(message);
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const debugInfo = document.getElementById('debugInfo');
    
    if (errorContainer && errorMessage) {
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';
        // Show debug info when there's an error
        if (debugInfo) {
            debugInfo.style.display = 'block';
        }
    }
}

// Update Revenue Goal Progress
function updateRevenueGoalProgress(currentRevenue) {
    console.log('Starting updateRevenueGoalProgress with currentRevenue:', currentRevenue);
    
    const progressPercentage = Math.min((currentRevenue / REVENUE_GOAL) * 100, 100);
    console.log('Calculated progress percentage:', progressPercentage);
    
    // Update progress bar
    const progressBar = document.getElementById('revenueGoalBar');
    console.log('Progress bar element:', progressBar);
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
        console.log('Set progress bar width to:', `${progressPercentage}%`);
    } else {
        console.warn('Progress bar element not found!');
    }
    
    // Update percentage text
    const percentageElement = document.getElementById('revenueGoalPercentage');
    console.log('Percentage element:', percentageElement);
    if (percentageElement) {
        percentageElement.textContent = `${Math.round(progressPercentage)}%`;
        console.log('Set percentage text to:', `${Math.round(progressPercentage)}%`);
    } else {
        console.warn('Percentage element not found!');
    }
    
    // Update amount text
    const amountElement = document.getElementById('revenueGoalAmount');
    console.log('Amount element:', amountElement);
    if (amountElement) {
        const text = `${formatCurrency(currentRevenue)} / ${formatCurrency(REVENUE_GOAL)}`;
        amountElement.textContent = text;
        console.log('Set amount text to:', text);
    } else {
        console.warn('Amount element not found!');
    }
}

// Initialize dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, checking auth state...');
    // Check if Firebase is initialized
    if (typeof firebase === 'undefined') {
        console.error('Firebase not initialized');
        showErrorMessage('Error: Firebase not initialized');
        return;
    }

    // Only initialize from dashboard.js if not already initialized by app.js
    if (!window.dashboardInitialized) {
        window.dashboardInitialized = true;
        // Check if user is authenticated
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                console.log('User authenticated, initializing dashboard...');
                initializeDashboard();
            } else {
                console.log('No user authenticated, redirecting to login...');
                window.location.href = 'login.html';
            }
        });
    }
}); 