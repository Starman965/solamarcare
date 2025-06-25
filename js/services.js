// Services Management System

// State Management
let currentCategories = [];
let currentServices = [];
let editingCategoryId = null;
let editingServiceId = null;

// Common service category icons
const CATEGORY_ICONS = [
    { icon: 'fas fa-home', name: 'Home Maintenance' },
    { icon: 'fas fa-couch', name: 'Furniture Assembly' },
    { icon: 'fas fa-laptop', name: 'Tech Support' },
    { icon: 'fas fa-tv', name: 'Installations' },
    { icon: 'fas fa-shuttle-van', name: 'Errands' },
    { icon: 'fas fa-heart', name: 'Heart/Care' },
    { icon: 'fas fa-hand-holding-heart', name: 'Helping Hand' },
    { icon: 'fas fa-pills', name: 'Medication' },
    { icon: 'fas fa-utensils', name: 'Food/Meals' },
    { icon: 'fas fa-broom', name: 'Cleaning' },
    { icon: 'fas fa-car', name: 'Transportation' },
    { icon: 'fas fa-bath', name: 'Personal Care' },
    { icon: 'fas fa-walking', name: 'Exercise' },
    { icon: 'fas fa-book-reader', name: 'Reading' },
    { icon: 'fas fa-calendar-check', name: 'Scheduling' },
    { icon: 'fas fa-hands-helping', name: 'Support' },
    { icon: 'fas fa-shopping-cart', name: 'Shopping' },
    { icon: 'fas fa-clock', name: 'Time/Schedule' },
    { icon: 'fas fa-first-aid', name: 'First Aid' },
    { icon: 'fas fa-wheelchair', name: 'Mobility' }
];

// Default Services Data
const DEFAULT_SERVICES = [
    // Wellness & Peace-of-Mind Services
    {
        name: "Medication Management",
        description: "Assistance with medication schedules, reminders, and organization of pill boxes.",
        defaultDuration: 30,
        isActive: true
    },
    {
        name: "Wellness Check-in",
        description: "Regular visits to ensure well-being, comfort checks, and companionship.",
        defaultDuration: 60,
        isActive: true
    },
    {
        name: "Companion Care",
        description: "Friendly conversation, reading together, playing games, or taking walks.",
        defaultDuration: 120,
        isActive: true
    },

    // Assembly Services
    {
        name: "Furniture Assembly",
        description: "Assembly of new furniture, including beds, tables, chairs, and storage units.",
        defaultDuration: 120,
        isActive: true
    },
    {
        name: "TV Wall Mounting",
        description: "Professional TV mounting including bracket installation and cable management.",
        defaultDuration: 90,
        isActive: true
    },

    // Home & Maintenance Services
    {
        name: "Light Yard Work",
        description: "Basic yard maintenance including weeding, pruning, and leaf cleanup.",
        defaultDuration: 120,
        isActive: true
    },
    {
        name: "Home Safety Check",
        description: "Inspection and maintenance of smoke detectors, fire extinguishers, and basic safety features.",
        defaultDuration: 60,
        isActive: true
    },
    {
        name: "Basic Home Repairs",
        description: "Minor repairs including fixing leaky faucets, replacing light fixtures, and patching walls.",
        defaultDuration: 90,
        isActive: true
    },

    // Installation Services
    {
        name: "Smart Home Setup",
        description: "Installation and configuration of smart home devices like thermostats, doorbells, and security cameras.",
        defaultDuration: 120,
        isActive: true
    },
    {
        name: "Appliance Installation",
        description: "Installation of household appliances including washers, dryers, and dishwashers.",
        defaultDuration: 120,
        isActive: true
    },

    // Tech Support Services
    {
        name: "Computer Setup & Training",
        description: "Setting up new computers, basic software installation, and user training.",
        defaultDuration: 90,
        isActive: true
    },
    {
        name: "WiFi Optimization",
        description: "WiFi network setup, optimization, and troubleshooting for better coverage.",
        defaultDuration: 60,
        isActive: true
    },
    {
        name: "Device Support",
        description: "Help with smartphones, tablets, printers, and other electronic devices.",
        defaultDuration: 60,
        isActive: true
    },

    // Errands and Upkeep
    {
        name: "Grocery Shopping",
        description: "Personal shopping for groceries and household essentials with delivery.",
        defaultDuration: 120,
        isActive: true
    },
    {
        name: "Donation Run",
        description: "Collecting and delivering items to donation centers or charities.",
        defaultDuration: 90,
        isActive: true
    }
];

// Tab Switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`.tab-button[onclick*="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Services page loaded, checking auth state...');
    
    // Check if Firebase is initialized
    if (typeof firebase === 'undefined') {
        console.error('Firebase not initialized');
        showErrorMessage('Error: Firebase not initialized');
        return;
    }

    // Check authentication
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log('User authenticated, initializing services...');
            initializeServices();
        } else {
            console.log('No user authenticated, redirecting to login...');
            window.location.href = 'login.html';
        }
    });

    // Setup event listeners
    setupEventListeners();
    
    setupIconPicker();
});

// Initialize Services
async function initializeServices() {
    try {
        await loadCategories();
        await loadServices();
    } catch (error) {
        console.error('Error initializing services:', error);
        showErrorMessage('Failed to load services: ' + error.message);
    }
}

// Load Categories
async function loadCategories() {
    try {
        const snapshot = await db.collection('serviceCategories').get();
        currentCategories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderCategories();
        updateCategoryDropdown();
    } catch (error) {
        console.error('Error loading categories:', error);
        throw error;
    }
}

// Load Services
async function loadServices() {
    try {
        const snapshot = await db.collection('services').get();
        currentServices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderServices();
    } catch (error) {
        console.error('Error loading services:', error);
        throw error;
    }
}

// Render Categories
function renderCategories() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    container.innerHTML = currentCategories.map(category => `
        <div class="category-card" data-id="${category.id}">
            <div class="category-icon">
                <i class="${category.icon}"></i>
            </div>
            <div class="category-content">
                <h3>${category.name}</h3>
                <p>${category.description || ''}</p>
                <div class="category-actions">
                    <button onclick="editCategory('${category.id}')" class="button secondary">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteCategory('${category.id}')" class="button danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Render Services
function renderServices() {
    const container = document.getElementById('servicesList');
    if (!container) return;

    if (currentServices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No services added yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentServices.map(service => {
        const category = currentCategories.find(c => c.id === service.categoryId);
        return `
            <div class="service-card ${service.isActive ? 'active' : 'inactive'}" data-id="${service.id}">
                <div class="service-header">
                    <h3>${service.name}</h3>
                    <span class="service-category">
                        <i class="${category ? category.icon : 'fas fa-tag'}"></i>
                        ${category ? category.name : 'Uncategorized'}
                    </span>
                </div>
                <div class="service-content">
                    <p>${service.description || ''}</p>
                    <div class="service-meta">
                        <span><i class="fas fa-clock"></i> ${service.defaultDuration} mins</span>
                        <span class="status-badge ${service.isActive ? 'active' : 'inactive'}">
                            ${service.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="service-actions">
                    <button onclick="editService('${service.id}')" class="button secondary">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="toggleService('${service.id}')" class="button ${service.isActive ? 'warning' : 'success'}">
                        <i class="fas fa-${service.isActive ? 'pause' : 'play'}"></i>
                        ${service.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onclick="deleteService('${service.id}')" class="button danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Category Modal Functions
function showAddCategoryModal() {
    editingCategoryId = null;
    document.getElementById('categoryModalTitle').textContent = 'Add New Category';
    document.getElementById('categoryForm').reset();
    const modal = document.getElementById('categoryModal');
    modal.classList.add('show');
    modal.style.display = 'block';
}

function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('categoryForm').reset();
        editingCategoryId = null;
    }, 300); // Match the CSS transition duration
}

async function saveCategory() {
    try {
        const form = document.getElementById('categoryForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const categoryData = {
            name: document.getElementById('categoryName').value,
            icon: document.getElementById('categoryIcon').value,
            description: document.getElementById('categoryDescription').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingCategoryId) {
            await db.collection('serviceCategories').doc(editingCategoryId).update(categoryData);
        } else {
            categoryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('serviceCategories').add(categoryData);
        }

        await loadCategories();
        closeCategoryModal();
        showSuccessMessage(editingCategoryId ? 'Category updated successfully' : 'Category added successfully');
    } catch (error) {
        console.error('Error saving category:', error);
        showErrorMessage('Failed to save category: ' + error.message);
    }
}

async function editCategory(categoryId) {
    try {
        const category = currentCategories.find(c => c.id === categoryId);
        if (!category) {
            showErrorMessage('Category not found');
            return;
        }

        editingCategoryId = categoryId;
        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryIcon').value = category.icon;
        document.getElementById('iconPreview').className = category.icon;
        document.getElementById('categoryDescription').value = category.description || '';
        const modal = document.getElementById('categoryModal');
        modal.style.display = 'block';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    } catch (error) {
        console.error('Error editing category:', error);
        showErrorMessage('Failed to edit category: ' + error.message);
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? This will affect all services in this category.')) {
        return;
    }

    try {
        // Check if category has services
        const servicesInCategory = currentServices.filter(s => s.categoryId === categoryId);
        if (servicesInCategory.length > 0) {
            if (!confirm(`This category has ${servicesInCategory.length} services. These services will be marked as uncategorized. Continue?`)) {
                return;
            }
            
            // Update services to remove category
            const batch = db.batch();
            servicesInCategory.forEach(service => {
                const serviceRef = db.collection('services').doc(service.id);
                batch.update(serviceRef, { categoryId: null });
            });
            await batch.commit();
        }

        await db.collection('serviceCategories').doc(categoryId).delete();
        await loadCategories();
        await loadServices();
        showSuccessMessage('Category deleted successfully');
    } catch (error) {
        console.error('Error deleting category:', error);
        showErrorMessage('Failed to delete category: ' + error.message);
    }
}

// Service Modal Functions
function showAddServiceModal() {
    editingServiceId = null;
    document.getElementById('serviceModalTitle').textContent = 'Add New Service';
    document.getElementById('serviceForm').reset();
    const modal = document.getElementById('serviceModal');
    modal.classList.add('show');
    modal.style.display = 'block';
}

function closeServiceModal() {
    const modal = document.getElementById('serviceModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('serviceForm').reset();
        editingServiceId = null;
    }, 300); // Match the CSS transition duration
}

async function saveService() {
    try {
        const form = document.getElementById('serviceForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const serviceData = {
            name: document.getElementById('serviceName').value,
            categoryId: document.getElementById('serviceCategory').value,
            description: document.getElementById('serviceDescription').value,
            defaultDuration: parseInt(document.getElementById('defaultDuration').value),
            isActive: document.getElementById('isActive').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingServiceId) {
            await db.collection('services').doc(editingServiceId).update(serviceData);
        } else {
            serviceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('services').add(serviceData);
        }

        await loadServices();
        closeServiceModal();
        showSuccessMessage(editingServiceId ? 'Service updated successfully' : 'Service added successfully');
    } catch (error) {
        console.error('Error saving service:', error);
        showErrorMessage('Failed to save service: ' + error.message);
    }
}

async function editService(serviceId) {
    try {
        console.log('Editing service:', serviceId);
        const service = currentServices.find(s => s.id === serviceId);
        if (!service) {
            showErrorMessage('Service not found');
            return;
        }

        editingServiceId = serviceId;
        document.getElementById('serviceModalTitle').textContent = 'Edit Service';
        document.getElementById('serviceName').value = service.name;
        document.getElementById('serviceCategory').value = service.categoryId || '';
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('defaultDuration').value = service.defaultDuration;
        document.getElementById('isActive').checked = service.isActive;
        
        const modal = document.getElementById('serviceModal');
        modal.style.display = 'block';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    } catch (error) {
        console.error('Error editing service:', error);
        showErrorMessage('Failed to edit service: ' + error.message);
    }
}

async function toggleService(serviceId) {
    try {
        const service = currentServices.find(s => s.id === serviceId);
        if (!service) {
            showErrorMessage('Service not found');
            return;
        }

        await db.collection('services').doc(serviceId).update({
            isActive: !service.isActive,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadServices();
        showSuccessMessage(`Service ${service.isActive ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
        console.error('Error toggling service:', error);
        showErrorMessage('Failed to toggle service: ' + error.message);
    }
}

async function deleteService(serviceId) {
    if (!confirm('Are you sure you want to delete this service? This cannot be undone.')) {
        return;
    }

    try {
        await db.collection('services').doc(serviceId).delete();
        await loadServices();
        showSuccessMessage('Service deleted successfully');
    } catch (error) {
        console.error('Error deleting service:', error);
        showErrorMessage('Failed to delete service: ' + error.message);
    }
}

// Helper Functions
function updateCategoryDropdown() {
    const select = document.getElementById('serviceCategory');
    if (!select) return;

    select.innerHTML = `
        <option value="">Select Category</option>
        ${currentCategories.map(category => `
            <option value="${category.id}">${category.name}</option>
        `).join('')}
    `;
}

function setupEventListeners() {
    // Icon preview for category
    const iconInput = document.getElementById('categoryIcon');
    const iconPreview = document.getElementById('iconPreview');
    if (iconInput && iconPreview) {
        iconInput.addEventListener('input', (e) => {
            const iconClass = e.target.value;
            iconPreview.className = iconClass;
        });
    }
}

function showSuccessMessage(message) {
    // Implement your success message UI here
    console.log('Success:', message);
}

function showErrorMessage(message) {
    // Implement your error message UI here
    console.error('Error:', message);
}

// Setup Icon Picker
function setupIconPicker() {
    const iconPickerContainer = document.getElementById('iconPickerGrid');
    if (!iconPickerContainer) return;

    iconPickerContainer.innerHTML = CATEGORY_ICONS.map(item => `
        <div class="icon-option" data-icon="${item.icon}">
            <i class="${item.icon}"></i>
            <span>${item.name}</span>
        </div>
    `).join('');

    // Add click handlers for icon options
    const iconOptions = document.querySelectorAll('.icon-option');
    iconOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedIcon = option.dataset.icon;
            document.getElementById('categoryIcon').value = selectedIcon;
            document.getElementById('iconPreview').className = selectedIcon;
            document.getElementById('iconPickerModal').classList.remove('show');
            setTimeout(() => {
                document.getElementById('iconPickerModal').style.display = 'none';
            }, 300);
        });
    });
}

// Show Icon Picker Modal
function showIconPicker() {
    const modal = document.getElementById('iconPickerModal');
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Initialize Default Services
async function initializeDefaultServices() {
    try {
        if (!confirm('This will create a set of default services. Continue?')) {
            return;
        }

        const batch = db.batch();
        const servicesRef = db.collection('services');

        // Add timestamp to all services
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const servicesWithTimestamp = DEFAULT_SERVICES.map(service => ({
            ...service,
            createdAt: timestamp,
            updatedAt: timestamp
        }));

        // Create all services in a batch
        servicesWithTimestamp.forEach(service => {
            const newServiceRef = servicesRef.doc();
            batch.set(newServiceRef, service);
        });

        // Commit the batch
        await batch.commit();
        
        // Reload services
        await loadServices();
        showSuccessMessage('Default services have been created successfully');
    } catch (error) {
        console.error('Error initializing default services:', error);
        showErrorMessage('Failed to initialize default services: ' + error.message);
    }
} 