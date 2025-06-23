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
        if (element) {
            element.style.display = section === sectionName ? 'block' : 'none';
        }
    });

    // Initialize sections as needed
    if (sectionName === 'invoices') {
        loadInvoices();
    }
}

// Data Loading Functions
async function loadDashboardData() {
    try {
        await loadClients();
        await loadVisits();
        // Invoices are loaded when showing the section
        await loadMarketingCampaigns();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
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

// loadInvoices function is now handled in invoice.js

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

// Invoice card creation is now handled in invoice.js

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

// Password visibility toggle
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('.password-toggle');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.classList.add('showing');
    } else {
        passwordInput.type = 'password';
        toggleButton.classList.remove('showing');
    }
}

// Calculate scrollbar width
const getScrollbarWidth = () => {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode.removeChild(outer);

    return scrollbarWidth;
};

// Show modal with proper centering
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Store scrollbar width as CSS variable
    document.documentElement.style.setProperty('--scrollbar-width', getScrollbarWidth() + 'px');
    
    // Add class to body to prevent scrolling and compensate for scrollbar
    document.body.classList.add('modal-open');
    
    // Show modal with animation
    modal.classList.add('show');
    modal.style.display = 'flex';
}

// Hide modal and restore scrolling
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Remove modal classes
    modal.classList.remove('show');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--scrollbar-width');
    }, 300);
}

// Update existing modal functions
function showAddClientModal() {
    const modal = document.getElementById('clientModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('clientForm');
    
    modalTitle.textContent = 'Add New Client';
    form.reset();
    showModal('clientModal');
}

function closeClientModal() {
    hideModal('clientModal');
} 