// CRM Database Operations

// Client Management
const clientsCollection = db.collection('clients');

// Load Clients Function
async function loadClients() {
    const clientsList = document.getElementById('clientsList');
    try {
        const snapshot = await db.collection('clients').get();
        clientsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const client = doc.data();
            const clientCard = createClientCard(doc.id, client);
            clientsList.appendChild(clientCard);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

const crmOperations = {
    // Client Operations
    addClient: async (clientData) => {
        try {
            const docRef = await clientsCollection.add({
                ...clientData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding client: ", error);
            throw error;
        }
    },

    updateClient: async (clientId, clientData) => {
        try {
            await clientsCollection.doc(clientId).update({
                ...clientData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating client: ", error);
            throw error;
        }
    },

    // Service Visits
    addServiceVisit: async (clientId, visitData) => {
        try {
            const clientRef = clientsCollection.doc(clientId);
            const visitsCollection = clientRef.collection('serviceVisits');
            
            await visitsCollection.add({
                ...visitData,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'completed'
            });
        } catch (error) {
            console.error("Error adding service visit: ", error);
            throw error;
        }
    },

    // Invoices
    createInvoice: async (clientId, invoiceData) => {
        try {
            const clientRef = clientsCollection.doc(clientId);
            const invoicesCollection = clientRef.collection('invoices');
            
            await invoicesCollection.add({
                ...invoiceData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
        } catch (error) {
            console.error("Error creating invoice: ", error);
            throw error;
        }
    },

    // Marketing Campaigns
    addMarketingCampaign: async (campaignData) => {
        try {
            const campaignsCollection = db.collection('marketingCampaigns');
            await campaignsCollection.add({
                ...campaignData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });
        } catch (error) {
            console.error("Error adding marketing campaign: ", error);
            throw error;
        }
    },

    // Analytics
    getClientStats: async () => {
        try {
            const snapshot = await clientsCollection.get();
            return {
                totalClients: snapshot.size,
                // Add more analytics as needed
            };
        } catch (error) {
            console.error("Error getting client stats: ", error);
            throw error;
        }
    }
};

// Client Modal Functions
function showAddClientModal() {
    const modal = document.getElementById('clientModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('clientForm');
    const deleteContainer = document.getElementById('deleteButtonContainer');
    
    modalTitle.textContent = 'Add New Client';
    form.reset();
    
    // Clear any existing client ID
    form.dataset.clientId = '';
    
    // Hide delete button for new clients
    if (deleteContainer) {
        deleteContainer.style.display = 'none';
    }
    
    // Pre-populate Carlsbad address fields
    document.getElementById('clientCity').value = 'Carlsbad';
    document.getElementById('clientState').value = 'CA';
    document.getElementById('clientZip').value = '92011';
    
    // Use the proper modal show function
    showModal('clientModal');
}

// View Client Details Function
let currentViewingClientId = null;

async function viewClientDetails(clientId) {
    try {
        const doc = await db.collection('clients').doc(clientId).get();
        if (!doc.exists) {
            console.error('Client not found');
            return;
        }

        const client = doc.data();
        currentViewingClientId = clientId; // Store the current client ID
        
        const viewModal = document.getElementById('clientViewModal');
        const modalTitle = document.getElementById('viewModalTitle');
        const viewContent = document.getElementById('clientViewContent');

        if (!viewModal || !modalTitle || !viewContent) {
            console.error('Required view modal elements not found');
            return;
        }

        modalTitle.textContent = 'Client Details';

        const modalContent = `
            <div class="detail-header">
                <h4>Client ID: ${client.accountId || 'Not Assigned'}</h4>
                <span class="status-badge ${client.isActive ? 'active' : 'inactive'}">
                    <i class="fas fa-circle"></i> ${client.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="detail-row">
                <div class="detail-group">
                    <label>Name</label>
                    <p>${client.firstName} ${client.lastName}</p>
                </div>
                <div class="detail-group">
                    <label>Email</label>
                    <p>${client.email}</p>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-group">
                    <label>Phone</label>
                    <p>${client.phone}</p>
                </div>
                <div class="detail-group">
                    <label>Address</label>
                    <p>${client.address.street}<br>
                    ${client.address.city}, ${client.address.state} ${client.address.zip}</p>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-group">
                    <label>Start Date</label>
                    <p>${new Date(client.startDate).toLocaleDateString()}</p>
                </div>
                ${client.endDate ? `
                <div class="detail-group">
                    <label>End Date</label>
                    <p>${new Date(client.endDate).toLocaleDateString()}</p>
                </div>
                ` : ''}
            </div>
            <div class="detail-row">
                <div class="detail-group">
                    <label>Notes</label>
                    <p>${client.notes || 'No notes available'}</p>
                </div>
            </div>
        `;

        viewContent.innerHTML = modalContent;
        viewModal.style.display = 'block';
    } catch (error) {
        console.error('Error viewing client details:', error);
    }
}

function closeViewModal() {
    const viewModal = document.getElementById('clientViewModal');
    if (viewModal) {
        viewModal.style.display = 'none';
        currentViewingClientId = null;
    }
}

function editFromView() {
    if (currentViewingClientId) {
        closeViewModal();
        editClient(currentViewingClientId);
    }
}

// Update the closeClientModal function to also reset the form
function closeClientModal() {
    const form = document.getElementById('clientForm');
    if (form) {
        form.reset();
        // Remove any existing Client ID display
        const existingClientId = form.querySelector('.account-id');
        if (existingClientId) {
            existingClientId.remove();
        }
        // Reset the form's client ID
        form.dataset.clientId = '';
    }
    // Use the proper modal hide function
    hideModal('clientModal');
}

// Generate Client ID
async function generateUniqueClientId() {
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops
    
    while (attempts < maxAttempts) {
        const candidateId = generateClientIdNumber();
        
        // Check if this ID already exists
        const snapshot = await db.collection('clients')
            .where('accountId', '==', candidateId)
            .limit(1)
            .get();
            
        if (snapshot.empty) {
            return candidateId; // ID is unique, use it
        }
        
        attempts++;
    }
    
    throw new Error('Unable to generate unique client ID after multiple attempts');
}

// Generate a candidate client ID number
function generateClientIdNumber() {
    const min = 100000; // Minimum 6-digit number
    const max = 999999; // Maximum 6-digit number
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return `A${randomNumber}`;
}

async function saveClient() {
    const form = document.getElementById('clientForm');
    const clientId = form.dataset.clientId;
    const firstName = document.getElementById('clientFirstName').value.trim();
    const lastName = document.getElementById('clientLastName').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    const city = document.getElementById('clientCity').value.trim();
    const state = document.getElementById('clientState').value.trim().toUpperCase();
    const zip = document.getElementById('clientZip').value.trim();
    const startDate = document.getElementById('clientStartDate').value;
    const endDate = document.getElementById('clientEndDate').value || null;
    const isActive = document.getElementById('clientStatus').checked;
    const notes = document.getElementById('clientNotes').value.trim();

    try {
        let clientData = {
            firstName,
            lastName,
            email,
            phone,
            address: {
                street: address,
                city,
                state,
                zip
            },
            startDate,
            endDate,
            isActive,
            notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (clientId) {
            // Check if the document still exists before updating
            const docRef = db.collection('clients').doc(clientId);
            const doc = await docRef.get();
            
            if (!doc.exists) {
                throw new Error('Client no longer exists. They may have been deleted.');
            }
            
            // Update existing client - don't modify the accountId
            await docRef.update(clientData);
        } else {
            // Add new client - generate new unique accountId
            clientData.accountId = await generateUniqueClientId();
            clientData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('clients').add(clientData);
        }

        hideModal('clientModal'); // Use hideModal instead of closeClientModal
        loadClients(); // Refresh the client list
    } catch (error) {
        console.error('Error saving client:', error);
        alert('Error saving client: ' + error.message);
        
        // If the client was deleted, close the modal
        if (error.message.includes('no longer exists')) {
            hideModal('clientModal');
        }
    }
}

// Client Search Function
function setupClientSearch() {
    const searchInput = document.getElementById('clientSearch');
    if (!searchInput) {
        console.error('Search input element not found');
        return;
    }
    
    console.log('Setting up client search');
    let debounceTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = searchInput.value.toLowerCase();
            console.log('Searching for:', searchTerm);
            filterClients(searchTerm);
        }, 300);
    });
}

async function filterClients(searchTerm) {
    const clientsList = document.getElementById('clientsList');
    try {
        console.log('Filtering clients for term:', searchTerm);
        const snapshot = await db.collection('clients').get();
        
        clientsList.innerHTML = '';
        let matchCount = 0;
        
        snapshot.forEach(doc => {
            const client = doc.data();
            const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
            const email = client.email.toLowerCase();
            const phone = client.phone;
            
            if (fullName.includes(searchTerm) || 
                email.includes(searchTerm) ||
                phone.includes(searchTerm)) {
                const clientCard = createClientCard(doc.id, client);
                clientsList.appendChild(clientCard);
                matchCount++;
            }
        });
        
        console.log(`Found ${matchCount} matches`);
    } catch (error) {
        console.error('Error filtering clients:', error);
    }
}

// Enhanced Client Card Creation
function createClientCard(id, client) {
    const card = document.createElement('div');
    card.className = 'data-card client-card';
    card.onclick = () => {
        editClient(id);
        showModal('clientModal');
    };
    const statusClass = client.isActive ? 'active' : 'inactive';
    const statusText = client.isActive ? 'Active' : 'Inactive';
    
    card.innerHTML = `
        <div class="client-info">
            <div class="account-id">Client ID: ${client.accountId || 'Not Assigned'}</div>
            <div class="client-header">
                <h3>${client.firstName} ${client.lastName} <span class="status-badge ${statusClass}">
                    <i class="fas fa-circle"></i> ${statusText}
                </span></h3>
            </div>
            <div class="contact-info">
                <p><i class="fas fa-envelope"></i> ${client.email}</p>
                <p><i class="fas fa-phone"></i> ${client.phone}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${client.address.street}, ${client.address.city}, ${client.address.state} ${client.address.zip}</p>
                <p><i class="fas fa-calendar"></i> Start Date: ${new Date(client.startDate).toLocaleDateString()}</p>
                ${client.endDate ? `<p><i class="fas fa-calendar-times"></i> End Date: ${new Date(client.endDate).toLocaleDateString()}</p>` : ''}
            </div>
        </div>
    `;
    return card;
}

// Initialize Client Section
function initializeClientSection() {
    console.log('Initializing client section');
    setupClientSearch();
    loadClients();
}

// Call initialization when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeClientSection();
});

// Delete Client Function
async function deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
        return;
    }

    try {
        await db.collection('clients').doc(clientId).delete();
        // Clear the form's client ID before closing
        const form = document.getElementById('clientForm');
        if (form) {
            form.dataset.clientId = '';
            form.reset();
        }
        hideModal('clientModal'); // Use hideModal instead of closeClientModal
        loadClients(); // Refresh the client list
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client. Please try again.');
    }
}

// Edit Client Function
async function editClient(clientId) {
    try {
        const doc = await db.collection('clients').doc(clientId).get();
        if (!doc.exists) {
            console.error('Client not found');
            return;
        }

        const client = doc.data();
        const modal = document.getElementById('clientModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('clientForm');
        const deleteContainer = document.getElementById('deleteButtonContainer');

        if (!modal || !modalTitle || !form) {
            console.error('Required modal elements not found');
            return;
        }

        modalTitle.textContent = 'Edit Client';
        form.dataset.clientId = clientId;

        // Show delete button for existing clients
        if (deleteContainer) {
            deleteContainer.style.display = 'block';
        }

        // Add Client ID display at the top of the form
        const existingClientId = form.querySelector('.account-id');
        if (existingClientId) {
            existingClientId.remove();
        }
        const clientIdDisplay = document.createElement('div');
        clientIdDisplay.className = 'account-id';
        clientIdDisplay.style.fontFamily = 'monospace';
        clientIdDisplay.style.fontSize = '1.1em';
        clientIdDisplay.style.marginBottom = '16px';
        clientIdDisplay.textContent = `Client ID: ${client.accountId || 'Not Assigned'}`;
        form.insertBefore(clientIdDisplay, form.firstChild);

        // Populate the fields
        document.getElementById('clientFirstName').value = client.firstName || '';
        document.getElementById('clientLastName').value = client.lastName || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientPhone').value = client.phone || '';
        document.getElementById('clientAddress').value = client.address?.street || '';
        document.getElementById('clientCity').value = client.address?.city || '';
        document.getElementById('clientState').value = client.address?.state || '';
        document.getElementById('clientZip').value = client.address?.zip || '';
        document.getElementById('clientStartDate').value = client.startDate || '';
        if (client.endDate) {
            document.getElementById('clientEndDate').value = client.endDate;
        }
        document.getElementById('clientStatus').checked = client.isActive;
        document.getElementById('clientNotes').value = client.notes || '';

        updateStatusText(client.isActive);
    } catch (error) {
        console.error('Error loading client details:', error);
    }
}

// Add function to update status text
function updateStatusText(isActive) {
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = isActive ? 'Active' : 'Inactive';
    }
}

// Add event listener for status toggle
document.addEventListener('DOMContentLoaded', () => {
    const statusToggle = document.getElementById('clientStatus');
    if (statusToggle) {
        statusToggle.addEventListener('change', (e) => {
            updateStatusText(e.target.checked);
        });
    }
}); 