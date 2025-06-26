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

    const visitCards = currentVisits.map(visit => {
        console.log('Creating card for visit:', visit);
        return createVisitCard(visit);
    });
    console.log('Generated visit cards:', visitCards);
    container.innerHTML = visitCards.join('');
}

function createVisitCard(visit) {
    console.log('Creating card with visit data:', visit);
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

    // Format completed date/time if visit is completed
    let dateTimeInfo = '';
    if (visit.status === 'COMPLETED' && visit.completedDateTime) {
        const completedDate = formatDateTime(visit.completedDateTime);
        dateTimeInfo = `
            <div class="visit-completed">
                <i class="fas fa-check-circle"></i>
                Completed: ${completedDate}
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

    const card = `
        <div class="visit-card" onclick="editVisit('${visit.id}')" data-status="${visit.status || ''}">
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
                <div class="visit-status ${statusClass}" onclick="showStatusModal(event, '${visit.id}')">
                    ${visit.status || 'Unknown'}
                </div>
            </div>
            <div class="visit-services">
                ${(visit.services || []).map(service => `
                    <span class="service-tag">${service.name}</span>
                `).join('')}
            </div>
            ${notesSection}
        </div>
    `;
    console.log('Generated card HTML:', card);
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

// Load Services into Select
async function loadServiceOptions() {
    try {
        const serviceSelect = document.getElementById('serviceSelector');
        if (!serviceSelect) return;

        // Clear existing options except the placeholder
        while (serviceSelect.options.length > 1) {
            serviceSelect.remove(1);
        }

        // Get all services first, then filter and sort in memory
        const servicesSnapshot = await db.collection('services').get();
        
        // Convert to array, filter active services, and sort by name
        const activeServices = servicesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(service => service.isActive)
            .sort((a, b) => a.name.localeCompare(b.name));

        activeServices.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = `${service.name} (${service.defaultDuration} min)`;
            option.setAttribute('data-name', service.name);
            option.setAttribute('data-duration', service.defaultDuration);
            serviceSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading service options:', error);
        showErrorMessage('Failed to load services: ' + error.message);
    }
}

// Update estimated time based on selected services
function updateEstimatedTime() {
    const selectedServices = document.querySelectorAll('#selectedServices .selected-service');
    const totalTime = Array.from(selectedServices).reduce((total, service) => {
        return total + parseInt(service.dataset.duration || 0);
    }, 0);
    
    document.getElementById('estimatedTime').textContent = totalTime;
}

// Add Selected Service
function addSelectedService() {
    const serviceSelect = document.getElementById('serviceSelector');
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        showErrorMessage('Please select a service');
        return;
    }

    const serviceId = selectedOption.value;
    const serviceName = selectedOption.getAttribute('data-name');
    const duration = selectedOption.getAttribute('data-duration');

    // Check if service is already added
    const existingService = document.querySelector(`.selected-service[data-service-id="${serviceId}"]`);
    if (existingService) {
        showErrorMessage('This service is already added');
        return;
    }

    const serviceElement = document.createElement('div');
    serviceElement.className = 'selected-service';
    serviceElement.setAttribute('data-service-id', serviceId);
    serviceElement.setAttribute('data-service-name', serviceName);
    serviceElement.setAttribute('data-duration', duration);
    
    serviceElement.innerHTML = `
        <span>${serviceName} (${duration} min)</span>
        <button type="button" onclick="removeSelectedService(this.parentElement)" class="remove-service">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.getElementById('selectedServices').appendChild(serviceElement);
    serviceSelect.selectedIndex = 0;
    
    // Update estimated time
    updateEstimatedTime();
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
    document.querySelectorAll('.tab-item').forEach(button => {
        button.addEventListener('click', switchTab);
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

// Update editVisit to set initial estimated time
async function editVisit(visitId) {
    try {
        const visit = currentVisits.find(v => v.id === visitId);
        if (!visit) {
            showErrorMessage('Visit not found');
            return;
        }

        editingVisitId = visitId;
        
        // Load options first
        await Promise.all([
            loadClientOptions(),
            loadServiceOptions()
        ]);
        
        // Update modal title
        document.getElementById('visitModalTitle').textContent = 'Edit Visit';
        
        // Show delete button and set visit ID
        const deleteButton = document.getElementById('deleteVisitButton');
        deleteButton.style.display = 'block';
        deleteButton.setAttribute('data-visit-id', visitId);
        
        // Show first tab
        document.querySelectorAll('.tab-item').forEach((btn, index) => {
            btn.classList.toggle('active', index === 0);
        });
        document.querySelectorAll('.tab-panel').forEach((content, index) => {
            content.classList.toggle('active', index === 0);
        });
        
        // Initialize tab listeners
        initializeTabListeners();
        
        // Populate form fields
        document.getElementById('visitClient').value = visit.clientId;
        
        // Convert ISO date string to local date and time
        const visitDate = new Date(visit.scheduledDateTime);
        document.getElementById('scheduledDate').value = visitDate.toISOString().split('T')[0];
        document.getElementById('scheduledTime').value = visitDate.toTimeString().slice(0, 5);
        
        // Set completed date and time if they exist
        if (visit.completedDateTime) {
            const completedDate = new Date(visit.completedDateTime);
            document.getElementById('completedDate').value = completedDate.toISOString().split('T')[0];
            document.getElementById('completedTime').value = completedDate.toTimeString().slice(0, 5);
        }

        // Set time to complete if it exists
        if (visit.timeToComplete) {
            document.getElementById('timeToComplete').value = visit.timeToComplete;
        }
        
        // Clear and populate selected services
        const selectedServicesContainer = document.getElementById('selectedServices');
        selectedServicesContainer.innerHTML = '';
        
        visit.services.forEach(service => {
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
        
        // Update estimated time after populating services
        updateEstimatedTime();
        
        // Set notes
        document.getElementById('visitNotes').value = visit.notes || '';
        
        // Show modal
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
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const clientId = document.getElementById('visitClient').value;
        const scheduledDate = document.getElementById('scheduledDate').value;
        const scheduledTime = document.getElementById('scheduledTime').value;
        const completedDate = document.getElementById('completedDate').value;
        const completedTime = document.getElementById('completedTime').value;
        const timeToComplete = document.getElementById('timeToComplete').value;
        const notes = document.getElementById('visitNotes').value;

        // Get selected services
        const selectedServiceElements = document.querySelectorAll('#selectedServices .selected-service');
        const services = Array.from(selectedServiceElements).map(el => ({
            id: el.dataset.serviceId,
            name: el.dataset.serviceName,
            defaultDuration: parseInt(el.dataset.duration)
        }));

        if (services.length === 0) {
            showErrorMessage('Please select at least one service');
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
        }
        if (timeToComplete) {
            visitData.timeToComplete = parseInt(timeToComplete);
        }

        if (editingVisitId) {
            // For editing, don't include status in the update
            await db.collection('visits').doc(editingVisitId).update(visitData);
        } else {
            // For new visits, add the status
            visitData.status = VISIT_STATUS.SCHEDULED;
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

// Remove Selected Service
function removeSelectedService(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        // Update estimated time after removal
        updateEstimatedTime();
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