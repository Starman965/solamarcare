// Authentication Functions
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const authError = document.getElementById('authError');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Auth observer will handle redirect
    } catch (error) {
        console.error('Login error:', error);
        authError.textContent = getAuthErrorMessage(error);
        authError.style.display = 'block';
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error('Logout error:', error);
    });
}

// Auth state observer
auth.onAuthStateChanged(user => {
    const currentPath = window.location.pathname;
    const publicPages = ['/login.html', '/register.html'];
    const isPublicPage = publicPages.some(page => currentPath.endsWith(page));
    
    if (!user && !isPublicPage) {
        // Not logged in and trying to access protected page - redirect to login
        window.location.href = 'login.html';
    } else if (user && isPublicPage) {
        // Logged in but on a public page - redirect to dashboard
        window.location.href = 'dashboard.html';
    } else if (user) {
        // User is logged in and on a protected page - ensure Firebase is initialized
        if (typeof db === 'undefined') {
            console.error('Firestore not initialized');
            handleLogout();
            return;
        }
        
        // Initialize any page-specific functionality
        const pageName = currentPath.split('/').pop();
        console.log('Initializing page:', pageName);
        
        switch (pageName) {
            case 'dashboard.html':
                if (typeof initializeDashboard === 'function' && !window.dashboardInitialized) {
                    console.log('Initializing dashboard from app.js...');
                    window.dashboardInitialized = true;
                    initializeDashboard();
                } else {
                    console.log('Dashboard already initialized or initialization function not found');
                }
                break;
            case 'clients.html':
                if (typeof loadClients === 'function') loadClients();
                break;
            case 'visits.html':
                if (typeof loadVisits === 'function') loadVisits();
                break;
            case 'invoices.html':
                if (typeof loadInvoices === 'function') loadInvoices();
                break;
            case 'marketing.html':
                if (typeof loadMarketingCampaigns === 'function') loadMarketingCampaigns();
                break;
        }
    }
});

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

// Helper function to get auth error messages
function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        default:
            return 'An error occurred during login';
    }
} 