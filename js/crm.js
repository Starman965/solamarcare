// CRM Database Operations

// Client Management
const clientsCollection = db.collection('clients');

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

// Authentication State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
    } else {
        // User is signed out
        console.log('User is signed out');
    }
});

// Client Modal Functions
function showAddClientModal() {
    const modal = document.getElementById('clientModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('clientForm');
    
    modalTitle.textContent = 'Add New Client';
    form.reset();

    // Pre-populate Carlsbad address fields
    document.getElementById('clientCity').value = 'Carlsbad';
    document.getElementById('clientState').value = 'CA';
    document.getElementById('clientZip').value = '92011';
    
    modal.style.display = 'block';
}

function closeClientModal() {
    const modal = document.getElementById('clientModal');
    modal.style.display = 'none';
}

async function saveClient() {
    const clientId = document.getElementById('clientForm').dataset.clientId;
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
        const clientData = {
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
            // Update existing client
            await db.collection('clients').doc(clientId).update(clientData);
        } else {
            // Add new client
            clientData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('clients').add(clientData);
        }

        closeClientModal();
        loadClients(); // Refresh the client list
    } catch (error) {
        console.error('Error saving client:', error);
        alert('Error saving client. Please try again.');
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
    const statusClass = client.isActive ? 'active' : 'inactive';
    const statusText = client.isActive ? 'Active' : 'Inactive';
    
    card.innerHTML = `
        <div class="client-info">
            <div class="client-header">
                <h3>${client.firstName} ${client.lastName}</h3>
                <span class="status-badge ${statusClass}">
                    <i class="fas fa-circle"></i> ${statusText}
                </span>
            </div>
            <div class="contact-info">
                <p><i class="fas fa-envelope"></i> ${client.email}</p>
                <p><i class="fas fa-phone"></i> ${client.phone}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${client.address.street}, ${client.address.city}, ${client.address.state} ${client.address.zip}</p>
                <p><i class="fas fa-calendar"></i> Start Date: ${new Date(client.startDate).toLocaleDateString()}</p>
                ${client.endDate ? `<p><i class="fas fa-calendar-times"></i> End Date: ${new Date(client.endDate).toLocaleDateString()}</p>` : ''}
            </div>
        </div>
        <div class="card-actions">
            <button onclick="editClient('${id}')" class="button secondary">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="viewClientDetails('${id}')" class="button primary">
                <i class="fas fa-eye"></i> View
            </button>
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
        closeClientModal();
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
        const client = doc.data();
        
        // Populate the modal with client data
        document.getElementById('modalTitle').textContent = 'Edit Client';
        document.getElementById('clientFirstName').value = client.firstName;
        document.getElementById('clientLastName').value = client.lastName;
        document.getElementById('clientEmail').value = client.email;
        document.getElementById('clientPhone').value = client.phone;
        document.getElementById('clientAddress').value = client.address.street;
        document.getElementById('clientCity').value = client.address.city;
        document.getElementById('clientState').value = client.address.state;
        document.getElementById('clientZip').value = client.address.zip;
        document.getElementById('clientStartDate').value = client.startDate;
        document.getElementById('clientEndDate').value = client.endDate || '';
        document.getElementById('clientStatus').checked = client.isActive;
        document.getElementById('clientNotes').value = client.notes || '';

        // Update status text based on checkbox
        updateStatusText(client.isActive);

        // Store the client ID for the save function
        document.getElementById('clientForm').dataset.clientId = clientId;

        // Update modal footer to include delete button
        const modalFooter = document.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button onclick="deleteClient('${clientId}')" class="button danger">
                <i class="fas fa-trash"></i> Delete Client
            </button>
            <div class="footer-right">
                <button onclick="closeClientModal()" class="button secondary">Cancel</button>
                <button onclick="saveClient()" class="button primary">Save Changes</button>
            </div>
        `;

        // Show the modal
        document.getElementById('clientModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading client details:', error);
        alert('Error loading client details. Please try again.');
    }
}

// View Client Details Function
async function viewClientDetails(clientId) {
    try {
        const doc = await db.collection('clients').doc(clientId).get();
        const client = doc.data();
        
        const statusClass = client.isActive ? 'active' : 'inactive';
        const statusText = client.isActive ? 'Active' : 'Inactive';
        
        // Create and show a view-only modal
        const viewModal = document.createElement('div');
        viewModal.className = 'modal';
        viewModal.style.display = 'block';
        viewModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Client Details</h3>
                    <button onclick="this.closest('.modal').remove()" class="close-button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="client-details">
                        <div class="detail-header">
                            <div class="detail-group">
                                <label>Name</label>
                                <p>${client.firstName} ${client.lastName}</p>
                            </div>
                            <span class="status-badge ${statusClass}">
                                <i class="fas fa-circle"></i> ${statusText}
                            </span>
                        </div>
                        <div class="detail-group">
                            <label>Email</label>
                            <p>${client.email}</p>
                        </div>
                        <div class="detail-group">
                            <label>Phone</label>
                            <p>${client.phone}</p>
                        </div>
                        <div class="detail-group">
                            <label>Address</label>
                            <p>${client.address.street}<br>
                               ${client.address.city}, ${client.address.state} ${client.address.zip}</p>
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
                        <div class="detail-group">
                            <label>Notes</label>
                            <p>${client.notes || 'No notes available'}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="button secondary">Close</button>
                    <button onclick="editClient('${clientId}'); this.closest('.modal').remove()" class="button primary">Edit</button>
                </div>
            </div>
        `;
        document.body.appendChild(viewModal);
    } catch (error) {
        console.error('Error loading client details:', error);
        alert('Error loading client details. Please try again.');
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