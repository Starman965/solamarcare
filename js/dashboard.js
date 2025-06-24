// Dashboard Data Management
let isInitializing = false; // Flag to prevent double initialization

const dashboardData = {
    activeClients: 0,
    totalRevenue: 0,
    revenueCollected: 0,
    revenueDue: 0,
    revenuePastDue: 0,
    revenueDraft: 0,
    recentClients: [],
    recentInvoices: [],
    upcomingVisits: []
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

        try {
            await loadRecentActivity();
            console.log('Recent activity loaded successfully');
        } catch (error) {
            console.error('Error loading recent activity:', error);
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
        
        // Get recent clients (last 5)
        const recentClientsSnapshot = await db.collection('clients')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        dashboardData.recentClients = recentClientsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Client metrics loaded:', { activeClients: dashboardData.activeClients, recentClientsCount: dashboardData.recentClients.length });
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
        const recentInvoices = [];

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

            // Add to recent invoices
            recentInvoices.push({
                id: invoice.id,
                ...invoiceData,
                total: amount // Ensure we store the numeric value
            });
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

        // Sort and limit recent invoices
        dashboardData.recentInvoices = recentInvoices
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return dateB - dateA;
            })
            .slice(0, 5);

        console.log('Revenue metrics loaded:', {
            totalRevenueEarned,
            totalRevenueCollected,
            totalRevenueBilled,
            revenueDue,
            revenuePastDue,
            revenueDraft,
            recentInvoicesCount: dashboardData.recentInvoices.length
        });
    } catch (error) {
        console.error('Error in loadRevenueMetrics:', error);
        throw error;
    }
}

// Load Recent Activity
async function loadRecentActivity() {
    console.log('Starting to load recent activity...');
    try {
        const clientsSnapshot = await db.collection('clients').get();
        const upcomingVisits = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get upcoming visits for each client
        for (const clientDoc of clientsSnapshot.docs) {
            const clientData = clientDoc.data();
            console.log(`Processing visits for client: ${clientData.firstName} ${clientData.lastName}`);

            const visitsSnapshot = await clientDoc.ref.collection('serviceVisits')
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .limit(3)
                .get();

            console.log(`Found ${visitsSnapshot.size} upcoming visits for client`);

            visitsSnapshot.forEach(visit => {
                upcomingVisits.push({
                    id: visit.id,
                    clientId: clientDoc.id,
                    clientName: `${clientData.firstName} ${clientData.lastName}`,
                    ...visit.data()
                });
            });
        }

        // Sort and limit upcoming visits
        dashboardData.upcomingVisits = upcomingVisits
            .sort((a, b) => (a.date?.toDate() || 0) - (b.date?.toDate() || 0))
            .slice(0, 5);

        console.log('Recent activity loaded:', {
            upcomingVisitsCount: dashboardData.upcomingVisits.length
        });
    } catch (error) {
        console.error('Error in loadRecentActivity:', error);
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
            { id: 'revenueBilledAmount', value: formatCurrency(dashboardData.revenueBilled) },
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
        
        // Update revenue goal progress
        updateRevenueGoalProgress(dashboardData.totalRevenue);
        
        // Update activity lists
        updateRecentClientsList();
        updateRecentInvoicesList();
        updateUpcomingVisitsList();
        
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

function formatDate(date) {
    if (!date) return 'No date';
    if (typeof date === 'object' && date.toDate) {
        date = date.toDate();
    }
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function updateRecentClientsList() {
    const container = document.getElementById('recentClientsList');
    if (!container) return;

    container.innerHTML = dashboardData.recentClients.map(client => `
        <div class="activity-item client-item" onclick="window.location.href='clients.html#${client.id}'">
            <div class="activity-icon">
                <i class="fas fa-user-plus"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${client.firstName} ${client.lastName}</div>
                <div class="activity-subtitle">Added ${formatDate(client.createdAt)}</div>
            </div>
        </div>
    `).join('');
}

function updateRecentInvoicesList() {
    const container = document.getElementById('recentInvoicesList');
    if (!container) return;

    if (dashboardData.recentInvoices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-invoice"></i>
                <p>No recent invoices</p>
            </div>
        `;
        return;
    }

    container.innerHTML = dashboardData.recentInvoices.map(invoice => `
        <div class="activity-item invoice-item" onclick="window.location.href='invoices.html#${invoice.id}'">
            <div class="activity-icon">
                <i class="fas fa-file-invoice-dollar"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">Invoice #${invoice.invoiceNumber}</div>
                <div class="activity-subtitle">
                    ${invoice.clientName} - ${formatCurrency(invoice.total)}
                    <span class="status-badge ${invoice.status.toLowerCase().replace(' ', '-')}">
                        ${invoice.status}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateUpcomingVisitsList() {
    const container = document.getElementById('upcomingVisitsList');
    if (!container) return;

    container.innerHTML = dashboardData.upcomingVisits.map(visit => `
        <div class="activity-item visit-item" onclick="window.location.href='visits.html#${visit.id}'">
            <div class="activity-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${visit.clientName}</div>
                <div class="activity-subtitle">
                    Scheduled for ${formatDate(visit.date)}
                    <span class="status-badge ${visit.status.toLowerCase()}">
                        ${visit.status}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
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
    const progressPercentage = Math.min((currentRevenue / REVENUE_GOAL) * 100, 100);
    
    // Update progress bar
    const progressBar = document.getElementById('revenueGoalBar');
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
    }
    
    // Update percentage text
    const percentageElement = document.getElementById('revenueGoalPercentage');
    if (percentageElement) {
        percentageElement.textContent = `${Math.round(progressPercentage)}%`;
    }
    
    // Update amount text
    const amountElement = document.getElementById('revenueGoalAmount');
    if (amountElement) {
        amountElement.textContent = `${formatCurrency(currentRevenue)} / ${formatCurrency(REVENUE_GOAL)}`;
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