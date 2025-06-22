// Authentication Functions
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('authError');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Login successful - UI will update through the auth state observer
    } catch (error) {
        errorElement.textContent = error.message;
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        // Logout successful - UI will update through the auth state observer
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Auth State Observer
auth.onAuthStateChanged((user) => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');

    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'grid';
        loadDashboardData(); // Only load data after user is confirmed logged in
        setupClientSearch(); // Setup search after we know user is authenticated
    } else {
        // User is signed out
        console.log('User is signed out');
        loginSection.style.display = 'flex';
        dashboardSection.style.display = 'none';
        // Clear any existing data
        const clientsList = document.getElementById('clientsList');
        if (clientsList) clientsList.innerHTML = '';
    }
});

// Dashboard Navigation
function showSection(sectionName) {
    const sections = ['clients', 'visits', 'invoices', 'marketing'];
    sections.forEach(section => {
        const element = document.getElementById(`${section}Section`);
        element.style.display = section === sectionName ? 'block' : 'none';
    });
}

// Data Loading Functions
async function loadDashboardData() {
    try {
        await loadClients();
        await loadVisits();
        await loadInvoices();
        await loadMarketingCampaigns();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

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

async function loadVisits() {
    const visitsList = document.getElementById('visitsList');
    try {
        const snapshot = await db.collection('clients').get();
        visitsList.innerHTML = '';
        
        for (const clientDoc of snapshot.docs) {
            const visitsSnapshot = await clientDoc.ref.collection('serviceVisits').get();
            visitsSnapshot.forEach(doc => {
                const visit = doc.data();
                const visitCard = createVisitCard(doc.id, visit, clientDoc.data().name);
                visitsList.appendChild(visitCard);
            });
        }
    } catch (error) {
        console.error('Error loading visits:', error);
    }
}

async function loadInvoices() {
    const invoicesList = document.getElementById('invoicesList');
    try {
        const snapshot = await db.collection('clients').get();
        invoicesList.innerHTML = '';
        
        for (const clientDoc of snapshot.docs) {
            const invoicesSnapshot = await clientDoc.ref.collection('invoices').get();
            invoicesSnapshot.forEach(doc => {
                const invoice = doc.data();
                const invoiceCard = createInvoiceCard(doc.id, invoice, clientDoc.data().name);
                invoicesList.appendChild(invoiceCard);
            });
        }
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

async function loadMarketingCampaigns() {
    const campaignsList = document.getElementById('campaignsList');
    try {
        const snapshot = await db.collection('marketingCampaigns').get();
        campaignsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const campaign = doc.data();
            const campaignCard = createCampaignCard(doc.id, campaign);
            campaignsList.appendChild(campaignCard);
        });
    } catch (error) {
        console.error('Error loading campaigns:', error);
    }
}

// Card Creation Functions
function createClientCard(id, client) {
    const card = document.createElement('div');
    card.className = 'data-card client-card';
    const statusClass = client.isActive ? 'active' : 'inactive';
    const statusText = client.isActive ? 'Active' : 'Inactive';
    
    card.innerHTML = `
        <div class="client-info">
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

function createVisitCard(id, visit, clientName) {
    const card = document.createElement('div');
    card.className = 'data-card';
    card.innerHTML = `
        <h3>${clientName}</h3>
        <p>Date: ${new Date(visit.date.toDate()).toLocaleDateString()}</p>
        <p>Status: ${visit.status}</p>
        <div class="card-actions">
            <button onclick="editVisit('${id}')" class="card-button">
                <i class="fas fa-edit"></i> Edit
            </button>
        </div>
    `;
    return card;
}

function createInvoiceCard(id, invoice, clientName) {
    const card = document.createElement('div');
    card.className = 'data-card';
    card.innerHTML = `
        <h3>Invoice #${id.slice(0, 8)}</h3>
        <p>Client: ${clientName}</p>
        <p>Amount: $${invoice.amount}</p>
        <p>Status: ${invoice.status}</p>
        <div class="card-actions">
            <button onclick="viewInvoice('${id}')" class="card-button">
                <i class="fas fa-eye"></i> View
            </button>
        </div>
    `;
    return card;
}

function createCampaignCard(id, campaign) {
    const card = document.createElement('div');
    card.className = 'data-card';
    card.innerHTML = `
        <h3>${campaign.name}</h3>
        <p>Status: ${campaign.status}</p>
        <p>Created: ${new Date(campaign.createdAt.toDate()).toLocaleDateString()}</p>
        <div class="card-actions">
            <button onclick="editCampaign('${id}')" class="card-button">
                <i class="fas fa-edit"></i> Edit
            </button>
        </div>
    `;
    return card;
}

// Form Display Functions
function showAddClientForm() {
    // Implementation will be added later
    console.log('Add client form to be implemented');
}

function showAddVisitForm() {
    // Implementation will be added later
    console.log('Add visit form to be implemented');
}

function showCreateInvoiceForm() {
    // Implementation will be added later
    console.log('Create invoice form to be implemented');
}

function showAddCampaignForm() {
    // Implementation will be added later
    console.log('Add campaign form to be implemented');
} 