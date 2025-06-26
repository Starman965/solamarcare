// State Management
let currentVisits = [];
let currentServices = [];
let currentCategories = [];
let editingVisitId = null;
let currentStatusVisitId = null;
let frequentlyUsedServices = new Set();

// Message Display Functions
function showErrorMessage(message) {
    const container = document.getElementById('errorMessage');
    const text = document.getElementById('errorText');
    if (container && text) {
        text.textContent = message;
        container.style.display = 'flex';
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

function showSuccessMessage(message) {
    const container = document.getElementById('successMessage');
    const text = document.getElementById('successText');
    if (container && text) {
        text.textContent = message;
        container.style.display = 'flex';
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

// Visit Status Constants
const VISIT_STATUS = {
    SCHEDULED: 'SCHEDULED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
};

// Visit Billing Status
const VISIT_BILLING_STATUS = {
    BILLED: 'BILLED',
    UNBILLED: 'UNBILLED'
};

// Initialize Visits Page
async function initializeVisitsPage() {
    try {
        console.log('Initializing visits page...');
        await loadVisits();
        updateVisitsList();
        
        // Set up search functionality
        const searchInput = document.getElementById('visitSearch');
        if (searchInput) {
            searchInput.addEventListener('input', handleVisitSearch);
        }
        
        // Initialize filter tabs
        initializeFilterTabs();
    } catch (error) {
        console.error('Error initializing visits page:', error);
        showErrorMessage('Failed to initialize page: ' + error.message);
    }
}

// Load Visits
async function loadVisits() {
    try {
        const visitsSnapshot = await db.collection('visits').orderBy('scheduledDateTime', 'desc').get();
        
        // Get all unique client IDs from visits
        const clientIds = new Set();
        visitsSnapshot.docs.forEach(doc => clientIds.add(doc.data().clientId));
        
        // Fetch all referenced clients in one batch
        const clientsSnapshot = await db.collection('clients')
            .where(firebase.firestore.FieldPath.documentId(), 'in', Array.from(clientIds))
            .get();
            
        // Create a map of client data
        const clientsMap = {};
        clientsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const address = data.address && typeof data.address === 'object' ? 
                (data.address.street || 'No street address') : 'No address available';
            
            clientsMap[doc.id] = {
                name: `${data.firstName} ${data.lastName}`,
                address: address
            };
        });
        
        // Map visits with client data
        currentVisits = visitsSnapshot.docs.map(doc => {
            const visit = { id: doc.id, ...doc.data() };
            const clientData = clientsMap[visit.clientId] || {};
            return {
                ...visit,
                clientName: clientData.name || 'Unknown Client',
                clientAddress: clientData.address
            };
        });
        
        updateVisitsList();
    } catch (error) {
        console.error('Error loading visits:', error);
        showErrorMessage('Failed to load visits: ' + error.message);
    }
}

// Update Visits List
function updateVisitsList() {
    console.log('Updating visits list...');
    const container = document.getElementById('visitsList');
    if (!container) {
        console.error('Visits list container not found!');
        return;
    }

    console.log('Current visits:', currentVisits);
    if (currentVisits.length === 0) {
        console.log('No visits to display');
        container.innerHTML = '<p class="no-data">No visits found</p>';
        return;
    }

    // Clear existing content
    container.innerHTML = '';
    
    // Create and append visit cards
    currentVisits.forEach(visit => {
        const card = createVisitCard(visit);
        container.appendChild(card);
    });
}

// Create Visit Card
function createVisitCard(visit) {
    const client = visit.clientName || 'Unknown Client';
    const address = visit.clientAddress || 'No address available';
    
    // Format date without seconds
    function formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const scheduledDate = visit.scheduledDateTime ? formatDateTime(visit.scheduledDateTime) : 'No date set';
    const duration = visit.timeToComplete || visit.estimatedDuration || 0;
    const statusClass = visit.status ? visit.status.toLowerCase().replace('_', '-') : '';
    const billingStatus = visit.billingStatus || VISIT_BILLING_STATUS.UNBILLED;

    // Format completed date/time if visit is completed
    let dateTimeInfo = '';
    if (visit.status === 'COMPLETED' && visit.completedDateTime) {
        const completedDate = formatDateTime(visit.completedDateTime);
        dateTimeInfo = `
            <div class="visit-completed">
                <i class="fas fa-check-circle"></i>
                Completed: ${completedDate}
                ${billingStatus === VISIT_BILLING_STATUS.BILLED ? '<span class="billing-status billed"><i class="fas fa-file-invoice-dollar"></i> Billed</span>' : ''}
            </div>
        `;
    } else {
        dateTimeInfo = `
            <div class="visit-datetime">
                <i class="fas fa-calendar"></i>
                Scheduled: ${scheduledDate}
            </div>
        `;
    }

    // Format notes section if notes exist
    const notesSection = visit.notes ? `
        <div class="visit-notes">
            <i class="fas fa-sticky-note"></i>
            <p>${visit.notes}</p>
        </div>
    ` : '';

    const card = document.createElement('div');
    card.className = 'visit-card';
    card.setAttribute('data-status', visit.status || '');
    card.onclick = (e) => {
        e.preventDefault();
        editVisit(visit.id);
    };

    card.innerHTML = `
        <div class="visit-main-info">
            <div class="visit-client">
                <h3>${client}</h3>
                <div class="client-address">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${address}</span>
                </div>
            </div>
            ${dateTimeInfo}
            <div class="visit-duration">
                <i class="fas fa-clock"></i>
                ${duration} minutes
            </div>
            <div class="visit-status ${statusClass}" onclick="event.stopPropagation(); showStatusModal(event, '${visit.id}')">
                ${visit.status || 'Unknown'}
            </div>
        </div>
        <div class="visit-services">
            ${(visit.services || []).map(service => `
                <span class="service-tag">${service.name}</span>
            `).join('')}
        </div>
        ${notesSection}
    `;

    return card;
}

// Handle Visit Search
function handleVisitSearch(event) {
    filterVisits();
}

// Filter visits based on search and status
function filterVisits() {
    const searchTerm = document.getElementById('visitSearch').value.toLowerCase();
    const activeFilter = document.querySelector('.filter-tab.active').dataset.filter;
    const container = document.getElementById('visitsList');
    
    if (!container) return;

    const filteredVisits = currentVisits.filter(visit => {
        const matchesSearch = 
            visit.clientName.toLowerCase().includes(searchTerm) ||
            (visit.services || []).some(service => service.name.toLowerCase().includes(searchTerm)) ||
            (visit.status || '').toLowerCase().includes(searchTerm);
            
        const matchesFilter = activeFilter === 'all' || visit.status === activeFilter;
        
        return matchesSearch && matchesFilter;
    });

    if (filteredVisits.length === 0) {
        container.innerHTML = '<p class="no-data">No matching visits found</p>';
        return;
    }

    container.innerHTML = filteredVisits.map(visit => createVisitCard(visit)).join('');
}

// Initialize filter tabs
function initializeFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter visits
            filterVisits();
        });
    });
}

// Status Modal Functions
function showStatusModal(event, visitId) {
    event.stopPropagation(); // Prevent the visit card click event
    currentStatusVisitId = visitId;
    const modal = document.getElementById('statusModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        currentStatusVisitId = null;
    }, 300);
}

// Update Visit Status
async function updateVisitStatus(visitId, newStatus) {
    try {
        const visit = currentVisits.find(v => v.id === visitId);
        if (!visit) {
            showErrorMessage('Visit not found');
            return;
        }

        await db.collection('visits').doc(visitId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeStatusModal();
        await loadVisits();
        updateVisitsList();
        showSuccessMessage('Visit status updated successfully');
    } catch (error) {
        console.error('Error updating visit status:', error);
        showErrorMessage('Failed to update visit status: ' + error.message);
    }
}

// Load Clients into Select
async function loadClientOptions() {
    try {
        const clientSelect = document.getElementById('visitClient');
        if (!clientSelect) return;

        // Clear existing options except the placeholder
        while (clientSelect.options.length > 1) {
            clientSelect.remove(1);
        }

        // Get all clients first, then filter and sort in memory
        const clientsSnapshot = await db.collection('clients').get();
        
        // Convert to array, filter active clients, and sort by name
        const activeClients = clientsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(client => client.isActive)
            .sort((a, b) => a.firstName.localeCompare(b.firstName));

        activeClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.firstName} ${client.lastName}`;
            clientSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading client options:', error);
        showErrorMessage('Failed to load clients: ' + error.message);
    }
}

// Load selected services into the services tab
async function loadSelectedServices(services = []) {
    try {
        // First load all service options
        await loadServiceOptions();
        
        // Get the container for selected services
        const selectedServicesContainer = document.getElementById('selectedServices');
        selectedServicesContainer.innerHTML = '';
        
        // Add each service
        services.forEach(service => {
            const serviceElement = document.createElement('div');
            serviceElement.className = 'selected-service';
            serviceElement.setAttribute('data-service-id', service.id);
            serviceElement.setAttribute('data-service-name', service.name);
            serviceElement.setAttribute('data-duration', service.defaultDuration);
            
            serviceElement.innerHTML = `
                <span>${service.name} (${service.defaultDuration} min)</span>
                <button type="button" onclick="removeSelectedService(this.parentElement)" class="remove-service">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            selectedServicesContainer.appendChild(serviceElement);
        });
        
        // Update estimated time
        updateEstimatedTime();
    } catch (error) {
        console.error('Error loading selected services:', error);
        throw new Error('Failed to load selected services: ' + error.message);
    }
}

// Load service options into the dropdown
async function loadServiceOptions() {
    try {
        const snapshot = await db.collection('services').get();
        const serviceSelect = document.getElementById('serviceSelector');
        
        if (!serviceSelect) return;
        
        // Clear existing options except the first one
        while (serviceSelect.options.length > 1) {
            serviceSelect.remove(1);
        }
        
        // Add new options
        snapshot.forEach(doc => {
            const service = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${service.name} (${service.defaultDuration} min)`;
            option.setAttribute('data-name', service.name);
            option.setAttribute('data-duration', service.defaultDuration);
            serviceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading service options:', error);
        throw new Error('Failed to load service options: ' + error.message);
    }
}

// Update estimated time based on selected services
function updateEstimatedTime() {
    const selectedServices = document.querySelectorAll('.selected-service');
    const totalTime = Array.from(selectedServices).reduce((total, service) => {
        return total + parseInt(service.getAttribute('data-duration') || 0);
    }, 0);
    
    const estimatedTimeElement = document.getElementById('estimatedTime');
    if (estimatedTimeElement) {
        estimatedTimeElement.textContent = `${totalTime} minutes`;
    }
}

// Remove a selected service
function removeSelectedService(serviceElement) {
    if (serviceElement && serviceElement.parentNode) {
        serviceElement.parentNode.removeChild(serviceElement);
        updateEstimatedTime();
    }
}

// Handle Tab Switching
function switchTab(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const tabName = button.getAttribute('data-tab');
    
    // Update active tab button
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update active tab content
    document.querySelectorAll('.tab-panel').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Initialize Tab Event Listeners
function initializeTabListeners() {
    const tabButtons = document.querySelectorAll('.tab-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = button.getAttribute('data-tab');
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Activate selected tab
            button.classList.add('active');
            document.getElementById(`${targetTab}Tab`).classList.add('active');
        });
    });
}

// Show Add Visit Modal
async function showAddVisitModal() {
    editingVisitId = null;
    
    // Hide delete button
    const deleteButton = document.getElementById('deleteVisitButton');
    deleteButton.style.display = 'none';
    deleteButton.removeAttribute('data-visit-id');
    
    // Load options first
    await Promise.all([
        loadClientOptions(),
        loadServiceOptions()
    ]);
    
    // Update modal title
    document.getElementById('visitModalTitle').textContent = 'Schedule New Visit';
    
    // Show first tab
    document.querySelectorAll('.tab-item').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.tab-panel').forEach((content, index) => {
        content.classList.toggle('active', index === 0);
    });
    
    // Initialize tab listeners
    initializeTabListeners();
    
    // Show modal
    const modal = document.getElementById('visitModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);
}

// Close Visit Modal
function closeVisitModal() {
    const modal = document.getElementById('visitModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('visitForm').reset();
        document.getElementById('selectedServices').innerHTML = '';
        editingVisitId = null;
        document.getElementById('visitModalTitle').textContent = 'Schedule New Visit';
    }, 300);
}

// Edit visit function
async function editVisit(visitId) {
    try {
        // Update modal title
        document.getElementById('visitModalTitle').textContent = 'Edit Visit';
        
        // Show delete button
        const deleteButton = document.getElementById('deleteVisitButton');
        deleteButton.style.display = 'block';
        deleteButton.setAttribute('data-visit-id', visitId);
        
        // Load the visit data into the modal
        await loadVisitIntoModal(visitId);
        
        // Show first tab
        document.querySelectorAll('.tab-item').forEach((btn, index) => {
            btn.classList.toggle('active', index === 0);
        });
        document.querySelectorAll('.tab-panel').forEach((panel, index) => {
            panel.classList.toggle('active', index === 0);
        });
        
        // Initialize tab listeners
        initializeTabListeners();
        
        // Show modal with animation
        const modal = document.getElementById('visitModal');
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('show'), 10);
        
    } catch (error) {
        console.error('Error editing visit:', error);
        showErrorMessage('Failed to edit visit: ' + error.message);
    }
}

// Save Visit
async function saveVisit() {
    try {
        const form = document.getElementById('visitForm');
        
        // Check required fields and collect their labels
        const requiredFields = [
            { id: 'visitClient', label: 'Client' },
            { id: 'dateScheduled', label: 'Date Scheduled' },
            { id: 'timeScheduled', label: 'Time Scheduled' }
        ];

        const emptyFields = requiredFields.filter(field => {
            const element = document.getElementById(field.id);
            return !element.value;
        });

        if (emptyFields.length > 0) {
            const fieldList = emptyFields.map(field => field.label).join(', ');
            showErrorMessage(`Please fill in all required fields: ${fieldList}`);
            return;
        }

        // Get form values
        const clientId = document.getElementById('visitClient').value;
        const scheduledDate = document.getElementById('dateScheduled').value;
        const scheduledTime = document.getElementById('timeScheduled').value;
        const completedDate = document.getElementById('dateCompleted').value;
        const completedTime = document.getElementById('timeCompleted').value;
        const timeToComplete = document.getElementById('timeToComplete').value;
        const notes = document.getElementById('visitNotes').value;

        // Get selected services
        const selectedServiceElements = document.querySelectorAll('#selectedServices .selected-service');
        const services = Array.from(selectedServiceElements).map(el => ({
            id: el.getAttribute('data-service-id'),
            name: el.getAttribute('data-service-name'),
            defaultDuration: parseInt(el.getAttribute('data-duration'))
        }));

        if (services.length === 0) {
            showErrorMessage('Please select at least one service for the visit');
            return;
        }

        // Validate completed date/time consistency
        if ((completedDate && !completedTime) || (!completedDate && completedTime)) {
            showErrorMessage('If entering completion details, both date and time must be provided');
            return;
        }

        // Calculate estimated duration based on selected services
        const estimatedDuration = services.reduce((total, service) => 
            total + (service.defaultDuration || 0), 0);

        // Get client details
        const clientDoc = await db.collection('clients').doc(clientId).get();
        const clientData = clientDoc.data();

        // Create base visit data without status
        const visitData = {
            clientId,
            clientName: `${clientData.firstName} ${clientData.lastName}`,
            scheduledDateTime: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
            services,
            estimatedDuration,
            notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Add completed date/time and actual duration if provided
        if (completedDate && completedTime) {
            visitData.completedDateTime = new Date(`${completedDate}T${completedTime}`).toISOString();
            // If the visit is being marked as completed, ensure it has a billing status
            if (!editingVisitId || !currentVisits.find(v => v.id === editingVisitId)?.billingStatus) {
                visitData.billingStatus = VISIT_BILLING_STATUS.UNBILLED;
            }
        }
        if (timeToComplete) {
            visitData.timeToComplete = parseInt(timeToComplete);
        }

        if (editingVisitId) {
            // For editing, preserve existing status and billing status
            const existingVisit = currentVisits.find(v => v.id === editingVisitId);
            if (existingVisit) {
                visitData.status = existingVisit.status;
                visitData.billingStatus = existingVisit.billingStatus || VISIT_BILLING_STATUS.UNBILLED;
            }
            await db.collection('visits').doc(editingVisitId).update(visitData);
        } else {
            // For new visits, add the status and billing status
            visitData.status = VISIT_STATUS.SCHEDULED;
            visitData.billingStatus = VISIT_BILLING_STATUS.UNBILLED;
            visitData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('visits').add(visitData);
        }

        closeVisitModal();
        await loadVisits();
        updateVisitsList();
        showSuccessMessage(editingVisitId ? 'Visit updated successfully' : 'Visit scheduled successfully');
    } catch (error) {
        console.error('Error saving visit:', error);
        showErrorMessage('Failed to save visit: ' + error.message);
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initializeVisitsPage();
        } else {
            window.location.href = 'login.html';
        }
    });
});

function showVisitModal(visitId = null) {
    const modal = document.getElementById('visitModal');
    const deleteButton = document.getElementById('deleteVisitButton');
    modal.style.display = 'block';
    
    if (visitId) {
        // Show delete button for existing visits
        deleteButton.style.display = 'block';
        deleteButton.setAttribute('data-visit-id', visitId);
        // ... rest of existing visit loading code ...
    } else {
        // Hide delete button for new visits
        deleteButton.style.display = 'none';
        deleteButton.removeAttribute('data-visit-id');
    }
}

function confirmDeleteVisit() {
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    deleteConfirmModal.style.display = 'block';
    // Use setTimeout to trigger the animation
    setTimeout(() => deleteConfirmModal.classList.add('show'), 10);
}

function closeDeleteConfirmModal() {
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    deleteConfirmModal.classList.remove('show');
    // Wait for animation to complete before hiding
    setTimeout(() => {
        deleteConfirmModal.style.display = 'none';
    }, 300);
}

async function deleteVisit() {
    try {
        const deleteButton = document.getElementById('deleteVisitButton');
        const visitId = deleteButton.getAttribute('data-visit-id');
        
        if (!visitId) {
            throw new Error('No visit ID found');
        }

        // Delete the visit from Firestore
        await db.collection('visits').doc(visitId).delete();
        
        // Close both modals with animation
        closeDeleteConfirmModal();
        closeVisitModal();
        
        // Refresh the visits list
        await loadVisits();
        updateVisitsList();
        
        showSuccessMessage('Visit deleted successfully');
    } catch (error) {
        console.error('Error deleting visit:', error);
        showErrorMessage('Failed to delete visit: ' + error.message);
    }
}

// Helper functions for date/time formatting
function formatDateForInput(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toISOString().split('T')[0];
}

function formatTimeForInput(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Update billing status display
function updateBillingStatusDisplay(visit) {
    const billingStatusElement = document.querySelector('#detailsTab .billing-status');
    if (!billingStatusElement) return;

    const status = visit.billingStatus || 'UNBILLED';
    
    if (status === 'BILLED' && visit.invoicedOn) {
        billingStatusElement.innerHTML = `
            <div class="status-content">
                <i class="fas fa-file-invoice-dollar"></i>
                BILLED (Invoice #${visit.invoicedOn.number})
            </div>
            <button type="button" onclick="event.stopPropagation(); clearBillingStatus(event);" class="button small danger" title="Clear billing status">
                <i class="fas fa-times"></i>
            </button>
        `;
        billingStatusElement.className = 'billing-status billed with-clear-button';
    } else {
        billingStatusElement.innerHTML = `
            <i class="fas fa-clock"></i>
            UNBILLED
        `;
        billingStatusElement.className = 'billing-status unbilled';
    }
}

// Clear billing status
async function clearBillingStatus(event) {
    // Prevent event from bubbling up to modal
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        if (!editingVisitId) {
            showErrorMessage('No visit selected');
            return;
        }

        // Show confirmation dialog
        if (!confirm('Are you sure you want to clear the billing status? This should only be done if the invoice was deleted.')) {
            return;
        }

        console.log('Clearing billing status for visit:', editingVisitId);

        // Update the visit in Firestore
        await db.collection('visits').doc(editingVisitId).update({
            billingStatus: 'UNBILLED',
            invoicedOn: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('Successfully updated Firestore');

        // Fetch the updated visit data
        const visitDoc = await db.collection('visits').doc(editingVisitId).get();
        const updatedVisit = visitDoc.data();
        console.log('Updated visit data:', updatedVisit);

        // Update the UI
        updateBillingStatusDisplay(updatedVisit);
        
        showSuccessMessage('Billing status cleared successfully');
    } catch (error) {
        console.error('Error clearing billing status:', error);
        showErrorMessage('Failed to clear billing status: ' + error.message);
    }
}

// Show confirmation dialog
function showConfirmDialog(title, message, confirmText = 'OK', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        // Create modal elements
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'confirmDialog';
        
        modal.innerHTML = `
            <div class="modal-content delete-modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button onclick="document.getElementById('confirmDialog').remove()" class="close-button" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="warning-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancelButton" class="button secondary">${cancelText}</button>
                    <button id="confirmButton" class="button danger">${confirmText}</button>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('show'), 10);

        // Add event listeners
        const confirmButton = modal.querySelector('#confirmButton');
        const cancelButton = modal.querySelector('#cancelButton');
        const closeButton = modal.querySelector('.close-button');

        confirmButton.onclick = () => {
            modal.remove();
            resolve(true);
        };

        cancelButton.onclick = closeButton.onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
}

// Load visit data into modal
async function loadVisitIntoModal(visitId) {
    try {
        const visitDoc = await db.collection('visits').doc(visitId).get();
        if (!visitDoc.exists) {
            console.error('Visit not found');
            return;
        }

        const visit = visitDoc.data();
        console.log('Loaded visit data:', visit);
        currentVisit = { id: visitId, ...visit };
        editingVisitId = visitId;

        // Load client options before setting the value
        await loadClientOptions();

        // Update form fields
        document.getElementById('visitClient').value = visit.clientId || '';
        document.getElementById('dateScheduled').value = formatDateForInput(visit.scheduledDateTime);
        document.getElementById('timeScheduled').value = formatTimeForInput(visit.scheduledDateTime);
        document.getElementById('dateCompleted').value = formatDateForInput(visit.completedDateTime);
        document.getElementById('timeCompleted').value = formatTimeForInput(visit.completedDateTime);
        document.getElementById('timeToComplete').value = visit.timeToComplete || '';
        document.getElementById('visitNotes').value = visit.notes || '';

        // Update services
        await loadSelectedServices(visit.services || []);
        
        // Update billing status
        updateBillingStatusDisplay(visit);

        // Initialize tab listeners
        initializeTabListeners();

    } catch (error) {
        console.error('Error loading visit:', error);
        showErrorMessage('Failed to load visit: ' + error.message);
    }
}

// Add selected service
function addSelectedService() {
    const serviceSelect = document.getElementById('serviceSelector');
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        showErrorMessage('Please select a service to add');
        return;
    }

    // Check if service is already added
    const existingService = document.querySelector(`.selected-service[data-service-id="${selectedOption.value}"]`);
    if (existingService) {
        showErrorMessage('This service is already added to the visit');
        return;
    }

    const serviceElement = document.createElement('div');
    serviceElement.className = 'selected-service';
    serviceElement.setAttribute('data-service-id', selectedOption.value);
    serviceElement.setAttribute('data-service-name', selectedOption.getAttribute('data-name'));
    serviceElement.setAttribute('data-duration', selectedOption.getAttribute('data-duration'));
    
    serviceElement.innerHTML = `
        <span>${selectedOption.getAttribute('data-name')} (${selectedOption.getAttribute('data-duration')} min)</span>
        <button type="button" onclick="removeSelectedService(this.parentElement)" class="remove-service">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.getElementById('selectedServices').appendChild(serviceElement);
    updateEstimatedTime();
}