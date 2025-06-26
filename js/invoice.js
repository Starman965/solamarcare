// Invoice Management

let currentInvoice = {
    items: [],
    subtotal: 0,
    total: 0,
    accountId: null,
    dueDate: 'Upon Receipt',
    status: 'draft',
    createdAt: null,
    invoiceNumber: null
};

// Add state tracking at the top of the file
let currentInvoices = [];
let hasUnsavedChanges = false;
let isInvoiceFormOpen = false;
let currentFilter = 'all';
let selectedVisits = new Set(); // Track selected visits to prevent duplicates

// Track changes in the form
function trackInvoiceChanges() {
    hasUnsavedChanges = true;
}

// Reset change tracking
function resetInvoiceChanges() {
    hasUnsavedChanges = false;
}

// Check for unsaved changes
function checkUnsavedChanges() {
    if (hasUnsavedChanges) {
        return confirm('You have unsaved changes. Do you want to leave without saving?');
    }
    return true;
}

// Toggle between list and create views
function toggleInvoiceView(view, skipChangeCheck = false) {
    const listView = document.getElementById('invoiceListView');
    const createView = document.getElementById('invoiceCreateView');
    const searchBox = document.querySelector('.header-actions .search-box');
    
    if (view === 'create') {
        listView.style.display = 'none';
        createView.style.display = 'block';
        if (searchBox) searchBox.style.display = 'none';
        isInvoiceFormOpen = true;
        initializeCreateView();
    } else {
        if (isInvoiceFormOpen && !skipChangeCheck && !checkUnsavedChanges()) {
            return; // Stay on current view if user cancels
        }
        listView.style.display = 'block';
        createView.style.display = 'none';
        if (searchBox) searchBox.style.display = 'flex';
        isInvoiceFormOpen = false;
        resetInvoiceChanges();
    }
}

// Initialize create view
function initializeCreateView() {
    // Reset current invoice
    currentInvoice = {
        items: [],
        subtotal: 0,
        total: 0,
        accountId: null,
        dueDate: 'Upon Receipt',
        status: 'draft',
        createdAt: null,
        invoiceNumber: null
    };
    
    // Clear selected visits
    selectedVisits.clear();
    
    // Clear form
    const form = document.getElementById('invoiceForm');
    if (form) {
        form.reset();
        // Add change listeners to all form inputs
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', trackInvoiceChanges);
        });
    }
    
    // Clear items
    const tbody = document.getElementById('invoiceItemsBody');
    if (tbody) tbody.innerHTML = '';
    
    // Set default status
    const statusSelect = document.getElementById('invoiceStatus');
    if (statusSelect) statusSelect.value = 'draft';
    
    // Load clients
    loadClientDropdown();
    
    // Reset totals and change tracking
    updateTotals();
    resetInvoiceChanges();
}

// Filter invoices
function filterInvoices(filter) {
    // Update active button state
    const buttons = document.querySelectorAll('.filter-button');
    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.filter === filter);
    });
    
    // Update current filter and apply filters
    currentFilter = filter;
    applyFiltersAndSearch();
}

// Apply both filters and search
function applyFiltersAndSearch() {
    console.log('Applying filters and search...');
    const tableBody = document.getElementById('invoiceTableBody');
    const emptyState = document.getElementById('emptyInvoiceState');
    const emptyStateTitle = document.getElementById('emptyStateTitle');
    const emptyStateMessage = document.getElementById('emptyStateMessage');
    const searchTerm = document.getElementById('invoiceSearch').value.toLowerCase();
    
    console.log('Current filter:', currentFilter);
    console.log('Search term:', searchTerm);
    console.log('Total invoices in memory:', currentInvoices.length);
    
    if (!tableBody || !emptyState || !emptyStateTitle || !emptyStateMessage) {
        console.error('Required invoice elements not found');
        return;
    }

    // Clear current list
    tableBody.innerHTML = '';
    emptyState.style.display = 'none';

    // Filter the in-memory invoices
    const filteredInvoices = currentInvoices.filter(invoice => {
        const matchesSearch = 
            (invoice.clientName || '').toLowerCase().includes(searchTerm) ||
            (invoice.invoiceNumber || '').toLowerCase().includes(searchTerm) ||
            (invoice.status || '').toLowerCase().includes(searchTerm) ||
            (invoice.clientAddress?.street || '').toLowerCase().includes(searchTerm) ||
            (invoice.clientAddress?.city || '').toLowerCase().includes(searchTerm) ||
            (invoice.clientAddress?.state || '').toLowerCase().includes(searchTerm) ||
            (invoice.clientAddress?.zip || '').toLowerCase().includes(searchTerm);
            
        const matchesFilter = currentFilter === 'all' || invoice.status === currentFilter;
        
        return matchesSearch && matchesFilter;
    });

    console.log('Filtered invoices:', filteredInvoices.length);

    // Show empty state if no results
    if (filteredInvoices.length === 0) {
        console.log('No results found, showing empty state');
        emptyState.style.display = 'block';
        if (searchTerm) {
            emptyStateTitle.textContent = 'No Matching Invoices';
            emptyStateMessage.textContent = 'Try adjusting your search or filter criteria.';
        } else if (currentFilter !== 'all') {
            const filterText = currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1);
            emptyStateTitle.textContent = `No ${filterText} Invoices`;
            emptyStateMessage.textContent = `There are no invoices with ${filterText} status.`;
        } else {
            emptyStateTitle.textContent = 'No Invoices Yet';
            emptyStateMessage.textContent = 'Create your first invoice by clicking the "Create Invoice" button above.';
        }
        return;
    }

    // Display filtered results
    console.log('Displaying filtered results');
    filteredInvoices.forEach(invoice => {
        const row = createInvoiceRow(invoice.id, invoice);
        if (row) tableBody.appendChild(row);
    });
}

// Load and display invoices
async function loadInvoices() {
    console.log('Loading invoices...');
    const tableBody = document.getElementById('invoiceTableBody');
    const emptyState = document.getElementById('emptyInvoiceState');
    const errorState = document.getElementById('errorInvoiceState');
    
    if (!tableBody || !emptyState || !errorState) {
        console.error('Required invoice elements not found');
        return;
    }

    try {
        // Clear current list and hide states
        tableBody.innerHTML = '';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';

        // Load all invoices into memory
        console.log('Fetching invoices from database...');
        const snapshot = await db.collection('invoices')
            .orderBy('createdAt', 'desc')
            .get();

        console.log('Processing', snapshot.size, 'invoices');
        
        // Store in memory
        currentInvoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Stored invoices in memory:', currentInvoices.length);

        // Apply current filters
        applyFiltersAndSearch();

    } catch (error) {
        console.error('Error loading invoices:', error);
        errorState.style.display = 'block';
        currentInvoices = []; // Reset the array on error
    }
}

// Create invoice table row
function createInvoiceRow(id, invoice) {
    if (!invoice) {
        console.error('Invalid invoice data:', { id, invoice });
        return null;
    }

    const row = document.createElement('tr');
    row.onclick = () => editInvoice(id);
    
    // Use the actual invoice number from the data
    const invoiceNumber = invoice.invoiceNumber || `INV-${id.slice(0, 8)}`;
    
    // Get the total from the invoice data
    const total = invoice.total || 0;

    // Get status with proper formatting
    const status = invoice.status || 'draft';
    const statusClass = getStatusClass(status);
    
    row.innerHTML = `
        <td>
            <span class="invoice-number">${invoiceNumber}</span>
        </td>
        <td>
            <div class="client-info">
                <span class="client-name">${invoice.clientName || 'Unknown Client'}</span>
                <span class="client-address">${invoice.clientAddress?.street || 'No address'}</span>
            </div>
        </td>
        <td class="amount">$${total.toFixed(2)}</td>
        <td><span class="status-badge ${statusClass}">${status.toUpperCase()}</span></td>
        <td class="actions">
            <button onclick="event.stopPropagation(); printInvoice('${id}')" class="action-button" title="Print">
                <i class="fas fa-print"></i>
            </button>
            <button onclick="event.stopPropagation(); deleteInvoice('${id}')" class="action-button delete" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    return row;
}

// Helper function to get status CSS class
function getStatusClass(status) {
    const statusMap = {
        'draft': 'status-draft',
        'due': 'status-due',
        'past due': 'status-delinquent',
        'paid': 'status-paid'
    };
    return statusMap[status.toLowerCase()] || 'status-draft';
}

// Load client name for invoice card
async function loadClientName(clientId) {
    try {
        const doc = await db.collection('clients').doc(clientId).get();
        if (doc.exists) {
            const client = doc.data();
            return `${client.firstName} ${client.lastName}`;
        }
        return 'Unknown Client';
    } catch (error) {
        console.error('Error loading client name:', error);
        return 'Error Loading Name';
    }
}

// Initialize invoice number format: INV-YYYY-XXXX
async function generateInvoiceNumber() {
    try {
        // Get all invoices ordered by invoice number in descending order
        const snapshot = await db.collection('invoices')
            .orderBy('invoiceNumber', 'desc')
            .limit(1)
            .get();

        const year = 2025; // Hardcoded to 2025 as requested
        let nextNumber = 1017; // Starting number if no invoices exist

        if (!snapshot.empty) {
            // Get the latest invoice number
            const latestInvoice = snapshot.docs[0].data();
            const latestNumber = latestInvoice.invoiceNumber;
            
            // Extract the numeric part and increment
            const match = latestNumber.match(/INV-\d{4}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `INV-${year}-${nextNumber}`;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        throw error;
    }
}

// Load clients into dropdown
async function loadClientDropdown() {
    const dropdown = document.getElementById('invoiceClient');
    try {
        const snapshot = await db.collection('clients').get();
        
        // Clear existing options except the first one
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }

        snapshot.forEach(doc => {
            const client = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${client.firstName} ${client.lastName}`;
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Create a row for a visit
function createVisitRow(visit, visitId, rowIndex) {
    // Handle cases where visit might be a line item from an invoice
    // or a full visit document
    let completedDate = '';
    let services = '';
    let timeToComplete = visit.quantity || visit.timeToComplete || 0;
    let description = visit.description || '';

    if (visit.completedDateTime) {
        completedDate = new Date(visit.completedDateTime).toLocaleDateString();
    }

    if (visit.services && Array.isArray(visit.services)) {
        services = visit.services.map(s => s.name).join(', ');
    }

    // If we have a description from the invoice item, use that
    // Otherwise, construct it from visit data
    if (!description && completedDate) {
        description = `Services on ${completedDate}${services ? ': ' + services : ''}`;
    }
    
    const row = document.createElement('tr');
    row.setAttribute('data-visit-id', visitId);
    row.innerHTML = `
        <td>
            <input type="number" 
                   min="1" 
                   value="${timeToComplete}" 
                   onchange="updateLineTotal(${rowIndex})" 
                   class="quantity-input"
                   title="Time in minutes">
        </td>
        <td>
            <input type="text" 
                   value="${description}" 
                   class="description-input"
                   required>
        </td>
        <td>
            <input type="number" 
                   min="0" 
                   step="0.01" 
                   value="${visit.unitPrice || 40}" 
                   onchange="updateLineTotal(${rowIndex})" 
                   class="unit-price"
                   title="Hourly rate">
        </td>
        <td class="line-total read-only">$${((timeToComplete / 60) * (visit.unitPrice || 40)).toFixed(2)}</td>
        <td>
            <button type="button" class="delete-row">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    // Add click handler to delete button
    const deleteButton = row.querySelector('.delete-row');
    deleteButton.addEventListener('click', () => removeVisitFromInvoice(rowIndex, visitId));
    
    return row;
}

// Create a row for a regular item
function createItemRow(item = {}, rowIndex) {
    const row = document.createElement('tr');
    const quantity = item.quantity || '';
    const description = item.description || '';
    const unitPrice = item.unitPrice || '';
    const lineTotal = item.lineTotal || (quantity && unitPrice ? quantity * unitPrice : 0);

    row.innerHTML = `
        <td>
            <input type="number" 
                   min="1" 
                   value="${quantity}" 
                   onchange="updateLineTotal(${rowIndex})" 
                   class="quantity-input"
                   title="Quantity">
        </td>
        <td>
            <input type="text" 
                   value="${description}" 
                   class="description-input"
                   required>
        </td>
        <td>
            <input type="number" 
                   min="0" 
                   step="0.01" 
                   value="${unitPrice}" 
                   onchange="updateLineTotal(${rowIndex})" 
                   class="unit-price"
                   title="Unit price">
        </td>
        <td class="line-total read-only">$${lineTotal.toFixed(2)}</td>
        <td>
            <button type="button" class="delete-row">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    // Add click handler to delete button
    const deleteButton = row.querySelector('.delete-row');
    deleteButton.addEventListener('click', () => deleteInvoiceItem(rowIndex));
    
    return row;
}

// Add new invoice item row
function addInvoiceItem() {
    const tbody = document.getElementById('invoiceItemsBody');
    const rowIndex = tbody.children.length;
    const row = createItemRow({}, rowIndex);
    tbody.appendChild(row);
    updateTotals();
    trackInvoiceChanges();
}

// Update line total when quantity or price changes
function updateLineTotal(rowIndex) {
    const tbody = document.getElementById('invoiceItemsBody');
    const row = tbody.children[rowIndex];
    
    // Check if this is a time-based visit row
    const isTimeBasedVisit = row.hasAttribute('data-visit-id') && 
                            row.querySelector('.description-input').value.toLowerCase().includes('services on');
    
    const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const unitPrice = parseFloat(row.querySelector('.unit-price').value) || 0;
    let lineTotal;
    
    if (isTimeBasedVisit) {
        // For time-based visits: (minutes / 60) * hourly rate
        lineTotal = (quantity / 60) * unitPrice;
    } else {
        // For regular items: quantity * unit price
        lineTotal = quantity * unitPrice;
    }
    
    row.querySelector('.line-total').textContent = `$${lineTotal.toFixed(2)}`;
    updateTotals();
    trackInvoiceChanges();
}

// Delete invoice item row
function deleteInvoiceItem(rowIndex) {
    const tbody = document.getElementById('invoiceItemsBody');
    tbody.deleteRow(rowIndex);
    updateTotals();
    trackInvoiceChanges();
}

// Update invoice totals
function updateTotals() {
    const tbody = document.getElementById('invoiceItemsBody');
    let subtotal = 0;
    
    Array.from(tbody.children).forEach(row => {
        const lineTotal = parseFloat(row.querySelector('.line-total').textContent.replace('$', '')) || 0;
        subtotal += lineTotal;
    });
    
    const total = subtotal; // No tax for now
    
    document.getElementById('invoiceSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('invoiceTotal').textContent = `$${total.toFixed(2)}`;
    
    // Update current invoice object
    currentInvoice.subtotal = subtotal;
    currentInvoice.total = total;
}

// Update client details when selected
async function updateClientDetails() {
    console.log('updateClientDetails: Starting client details update');
    const clientSelect = document.getElementById('invoiceClient');
    const clientDetailsSection = document.getElementById('clientDetailsSection');
    
    console.log('updateClientDetails: Selected client ID:', clientSelect.value);
    
    if (!clientSelect.value) {
        console.log('updateClientDetails: No client selected, hiding details section');
        clientDetailsSection.style.display = 'none';
        return;
    }
    
    try {
        console.log('updateClientDetails: Fetching client document for ID:', clientSelect.value);
        const clientDoc = await db.collection('clients').doc(clientSelect.value).get();
        const clientData = clientDoc.data();
        
        console.log('updateClientDetails: Retrieved client data:', clientData);
        
        if (!clientData) {
            console.error('updateClientDetails: Client data not found');
            return;
        }
        
        // Format the data
        const name = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim();
        const street = clientData.address?.street || '';
        const cityStateZip = [
            clientData.address?.city || '',
            clientData.address?.state || '',
            clientData.address?.zip || ''
        ].filter(Boolean).join(', ');
        
        console.log('updateClientDetails: Formatted client data:', {
            name,
            street,
            cityStateZip,
            accountId: clientData.accountId
        });
        
        // Update the elements
        document.getElementById('clientName').textContent = name;
        document.getElementById('clientStreetAddress').textContent = street;
        document.getElementById('clientCityStateZip').textContent = cityStateZip;
        
        // Show the section and store the account ID
        clientDetailsSection.style.display = 'block';
        clientDetailsSection.dataset.accountId = clientData.accountId;
        
        console.log('updateClientDetails: Updated DOM elements and stored accountId:', {
            displayedName: document.getElementById('clientName').textContent,
            displayedStreet: document.getElementById('clientStreetAddress').textContent,
            displayedCityStateZip: document.getElementById('clientCityStateZip').textContent,
            storedAccountId: clientDetailsSection.dataset.accountId
        });
        
    } catch (error) {
        console.error('updateClientDetails: Error updating client details:', error);
        alert('Error updating client details: ' + error.message);
    }
}

// Initialize invoice section
function initializeInvoiceSection() {
    console.log('Initializing invoice section');
    
    // Set up form submission handler
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        invoiceForm.onsubmit = function(e) {
            e.preventDefault(); // Prevent form submission
            return false;
        };
    }
    
    // Set up search handler
    const searchInput = document.getElementById('invoiceSearch');
    if (searchInput) {
        searchInput.addEventListener('input', applyFiltersAndSearch);
    }
    
    // Initial load
    loadInvoices();
    loadClientDropdown();
}

// Save invoice
async function saveInvoiceDraft(e) {
    // Prevent default button behavior
    if (e) e.preventDefault();
    
    console.log('saveInvoiceDraft: Starting invoice save process');
    
    try {
        // Get client selection and accountId
        const clientSelect = document.getElementById('invoiceClient');
        const clientDetailsSection = document.getElementById('clientDetailsSection');
        
        console.log('saveInvoiceDraft: Initial form state:', {
            selectedClientId: clientSelect.value,
            clientDetailsSectionDisplay: clientDetailsSection.style.display,
            storedAccountId: clientDetailsSection.dataset.accountId
        });
        
        if (!clientSelect.value) {
            console.error('saveInvoiceDraft: No client selected');
            alert('Please select a client');
            return;
        }

        const accountId = clientDetailsSection.dataset.accountId;
        console.log('saveInvoiceDraft: Retrieved accountId:', accountId);
        
        if (!accountId) {
            console.error('saveInvoiceDraft: No accountId found in dataset');
            alert('Error: Client account ID not found');
            return;
        }

        // Get client details from the display elements
        const clientName = document.getElementById('clientName').textContent;
        const clientStreetAddress = document.getElementById('clientStreetAddress').textContent;
        const clientCityStateZip = document.getElementById('clientCityStateZip').textContent;
        const [city = '', state = '', zip = ''] = clientCityStateZip.split(',').map(s => s.trim());
        
        console.log('saveInvoiceDraft: Retrieved client details from DOM:', {
            clientName,
            clientStreetAddress,
            clientCityStateZip,
            parsedAddress: { city, state, zip }
        });
        
        // Get all invoice items
        const items = [];
        const tbody = document.getElementById('invoiceItemsBody');
        
        console.log('saveInvoiceDraft: Processing invoice items from table body:', {
            numberOfRows: tbody.children.length
        });
        
        Array.from(tbody.children).forEach((row, index) => {
            const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
            const description = row.querySelector('.description-input').value || '';
            const unitPrice = parseFloat(row.querySelector('.unit-price').value) || 0;
            const lineTotal = parseFloat(row.querySelector('.line-total').textContent.replace('$', '')) || 0;
            const visitId = row.getAttribute('data-visit-id') || null;
            
            console.log('saveInvoiceDraft: Processing row', index + 1, {
                quantity,
                description,
                unitPrice,
                lineTotal,
                visitId
            });
            
            // Only add items that have either a description or a price
            if (description || unitPrice > 0) {
                items.push({
                    quantity,
                    description,
                    unitPrice,
                    lineTotal,
                    visitId
                });
            }
        });

        console.log('saveInvoiceDraft: Processed items:', items);

        if (items.length === 0) {
            console.error('saveInvoiceDraft: No valid items found');
            alert('Please add at least one item to the invoice');
            return;
        }
        
        // Calculate totals
        const subtotal = calculateSubtotal(items);
        console.log('saveInvoiceDraft: Calculated subtotal:', subtotal);

        // Get selected status
        const statusSelect = document.getElementById('invoiceStatus');
        const status = statusSelect ? statusSelect.value : 'draft';

        // Get due date information
        const dueDateType = document.getElementById('dueDateType').value;
        const dueDate = dueDateType === 'specific_date' ? 
            document.getElementById('specificDueDate').value : 'upon_receipt';
        
        console.log('saveInvoiceDraft: Retrieved form values:', {
            status,
            dueDateType,
            dueDate
        });
        
        // Create invoice data structure
        const invoiceData = {
            accountId: accountId,
            clientName: clientName,
            clientAddress: {
                street: clientStreetAddress,
                city: city,
                state: state,
                zip: zip
            },
            items: items,
            status: status,
            dueDateType: dueDateType,
            dueDate: dueDate,
            subtotal: subtotal,
            total: subtotal, // No tax for now
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('saveInvoiceDraft: Created invoice data:', invoiceData);

        // If it's a new invoice
        if (!currentInvoice.id) {
            console.log('saveInvoiceDraft: Creating new invoice');
            // Generate new invoice number and add creation timestamp
            invoiceData.invoiceNumber = await generateInvoiceNumber();
            invoiceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            console.log('saveInvoiceDraft: Generated invoice number:', invoiceData.invoiceNumber);
            
            // Save to Firebase in the top-level invoices collection
            console.log('saveInvoiceDraft: Attempting to save new invoice to Firebase');
            const docRef = await db.collection('invoices').add(invoiceData);
            console.log('saveInvoiceDraft: Successfully created new invoice with ID:', docRef.id);

            // Update all visits with the final invoice ID
            const visitPromises = Array.from(tbody.children)
                .filter(row => row.hasAttribute('data-visit-id'))
                .map(row => {
                    const visitId = row.getAttribute('data-visit-id');
                    return db.collection('visits').doc(visitId).update({
                        'invoicedOn.id': docRef.id
                    });
                });
            
            await Promise.all(visitPromises);
        } else {
            console.log('saveInvoiceDraft: Updating existing invoice:', currentInvoice.id);
            // Update existing invoice
            invoiceData.invoiceNumber = currentInvoice.invoiceNumber;
            invoiceData.createdAt = currentInvoice.createdAt;
            
            // Update the document
            console.log('saveInvoiceDraft: Attempting to update invoice in Firebase');
            await db.collection('invoices').doc(currentInvoice.id).update(invoiceData);
            console.log('saveInvoiceDraft: Successfully updated invoice');
        }
        
        // Reset current invoice
        currentInvoice = {
            items: [],
            subtotal: 0,
            total: 0,
            accountId: null,
            dueDate: 'Upon Receipt',
            status: 'draft',
            createdAt: null,
            invoiceNumber: null
        };
        
        // Clear selected visits
        selectedVisits.clear();
        
        console.log('saveInvoiceDraft: Reset current invoice state');
        
        // Reset changes and return to list view
        resetInvoiceChanges();
        console.log('saveInvoiceDraft: Reset change tracking');
        
        // Return to list view and refresh, skipping the unsaved changes check
        console.log('saveInvoiceDraft: Switching to list view and refreshing');
        toggleInvoiceView('list', true);
        loadInvoices();
        
        console.log('saveInvoiceDraft: Successfully completed invoice save process');
        return true;
    } catch (error) {
        console.error('saveInvoiceDraft: Error saving invoice:', error);
        console.error('saveInvoiceDraft: Error stack:', error.stack);
        alert('Error saving invoice: ' + error.message);
        return false;
    }
}

// Helper function to calculate subtotal
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
}

// Toggle due date field visibility
function toggleDueDateField() {
    const dueDateType = document.getElementById('dueDateType').value;
    const specificDateContainer = document.getElementById('specificDateContainer');
    specificDateContainer.style.display = dueDateType === 'specific_date' ? 'block' : 'none';
}

// Get formatted due date for display
function getFormattedDueDate() {
    const dueDateType = document.getElementById('dueDateType').value;
    if (dueDateType === 'upon_receipt') {
        return 'Upon Receipt';
    } else {
        const specificDate = document.getElementById('specificDueDate').value;
        return specificDate ? new Date(specificDate).toLocaleDateString() : 'Upon Receipt';
    }
}

// Show print preview
async function showPrintPreview() {
    try {
        // If we're editing an existing invoice, use the existing print function
        if (currentInvoice.id) {
            await printInvoice(currentInvoice.id);
            return;
        }

        // Rest of the existing showPrintPreview code for new invoices
        // Validate client selection
        const clientSelect = document.getElementById('invoiceClient');
        if (!clientSelect.value) {
            alert('Please select a client');
            return;
        }
        
        // Validate items
        const tbody = document.getElementById('invoiceItemsBody');
        if (tbody.children.length === 0) {
            alert('Please add at least one item');
            return;
        }

        // Get client details from the displayed elements
        const clientName = document.getElementById('clientName').textContent;
        const clientStreetAddress = document.getElementById('clientStreetAddress').textContent;
        const clientCityStateZip = document.getElementById('clientCityStateZip').textContent;

        // Get the client's actual accountId from their document
        const clientDoc = await db.collection('clients').doc(clientSelect.value).get();
        const clientData = clientDoc.data();
        if (!clientData || !clientData.accountId) {
            alert('Error: Client account ID not found');
            return;
        }

        // Get all invoice items
        const items = [];
        Array.from(tbody.children).forEach(row => {
            const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
            const unitPrice = parseFloat(row.querySelector('.unit-price').value) || 0;
            items.push({
                quantity: quantity,
                description: row.querySelector('.description-input').value || '',
                unitPrice: unitPrice,
                lineTotal: quantity * unitPrice
            });
        });

        // Calculate totals
        const subtotal = calculateSubtotal(items);

        // Get current status and due date
        const statusSelect = document.getElementById('invoiceStatus');
        const status = statusSelect ? statusSelect.value : 'draft';
        const dueDateType = document.getElementById('dueDateType').value;
        const dueDate = dueDateType === 'specific_date' ? 
            document.getElementById('specificDueDate').value : 'upon_receipt';

        // Create invoice data
        const invoiceData = {
            accountId: clientData.accountId,
            items: items,
            status: status,
            dueDateType: dueDateType,
            dueDate: dueDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            subtotal: subtotal,
            total: subtotal // No tax for now
        };

        // If it's a new invoice, add createdAt and generate invoice number
        if (!currentInvoice.id) {
            invoiceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            invoiceData.invoiceNumber = await generateInvoiceNumber();
            // Create new invoice
            const docRef = await db.collection('invoices').add(invoiceData);
            console.log('saveInvoiceDraft: Successfully created new invoice with ID:', docRef.id);
        } else {
            // Update existing invoice
            invoiceData.invoiceNumber = currentInvoice.invoiceNumber;
            invoiceData.createdAt = currentInvoice.createdAt;
            // Update the document
            console.log('saveInvoiceDraft: Attempting to update invoice in Firebase');
            await db.collection('invoices').doc(currentInvoice.id).update(invoiceData);
            console.log('saveInvoiceDraft: Successfully updated invoice');
        }

        // Create modal for print preview
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            border: none;
            background: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
        `;
        closeButton.onclick = () => document.body.removeChild(modalContainer);

        // Create the print content
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoiceData.invoiceNumber}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        color: #333;
                    }
                    .invoice-header {
                        display: flex;
                        justify-content: flex-start;
                        gap: 150px;
                        margin-bottom: 40px;
                    }
                    .company-logo {
                        max-width: 200px;
                        margin-bottom: 15px;
                    }
                    .company-info, .bill-to-info {
                        margin-bottom: 20px;
                        min-width: 250px;
                    }
                    .company-info h2, .bill-to-info h2 {
                        margin: 0 0 10px 0;
                        color: #2d3748;
                        font-size: 1.5em;
                    }
                    .company-info p, .bill-to-info p {
                        margin: 0 0 5px 0;
                        line-height: 1.4;
                    }
                    .invoice-info {
                        margin-top: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th:last-child, td:last-child {
                        text-align: right;
                    }
                    .totals {
                        width: 100%;
                        margin-top: 20px;
                        display: grid;
                        grid-template-columns: auto 150px;
                        justify-content: end;
                    }
                    .totals p {
                        margin: 5px 0;
                        text-align: right;
                        padding-right: 12px;
                    }
                    .payment-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        text-align: center;
                        font-size: 0.9em;
                        color: #4a5568;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                    @media (max-width: 768px) {
                        .invoice-header {
                            flex-direction: column;
                            gap: 20px;
                        }
                        table {
                            font-size: 14px;
                        }
                        th, td {
                            padding: 8px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-preview">
                    <div class="invoice-header">
                        <div>
                            <img src="images/solamar_care_logo.png" class="company-logo" alt="Solamar Care">
                            <div class="company-info">
                                <h2>Solamar Care</h2>
                                <p>Attn: Marc Bussio</p>
                                <p>6513 Easy Street</p>
                                <p>Carlsbad, CA 92011</p>
                            </div>
                            <div class="invoice-info">
                                <p>Invoice #: ${invoiceData.invoiceNumber}</p>
                                <p>Date: ${new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div>
                            <div style="height: 200px;"></div><!-- Logo space alignment -->
                            <div class="bill-to-info">
                                <h2>Bill To:</h2>
                                <p>${clientName}</p>
                                <p>${clientStreetAddress}</p>
                                <p>${clientCityStateZip}</p>
                            </div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Qty/Time</th>
                                <th>Description</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${item.quantity}</td>
                                    <td>${item.description}</td>
                                    <td>$${item.unitPrice.toFixed(2)}</td>
                                    <td>$${item.lineTotal.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="totals">
                        <div></div>
                        <div>
                            <p><strong>Total: $${subtotal.toFixed(2)}</strong></p>
                            <p>Due: ${getFormattedDueDate()}</p>
                        </div>
                    </div>

                    <div class="payment-info">
                        <p>Please make payable to Marc Bussio</p>
                        <p>Pay by Venmo to @marcbussio</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Create iframe for print preview
        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
            width: 100%;
            height: calc(90vh - 100px);
            border: none;
            margin-bottom: 20px;
        `;

        // Create print button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            text-align: center;
            margin-top: 20px;
        `;

        // Create print button
        const printButton = document.createElement('button');
        printButton.innerHTML = '<i class="fas fa-print"></i> Print Invoice';
        printButton.style.cssText = `
            background-color: #4a90e2;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
        `;
        printButton.onclick = () => {
            iframe.contentWindow.print();
        };

        // Assemble the modal
        buttonContainer.appendChild(printButton);
        modalContent.appendChild(closeButton);
        modalContent.appendChild(iframe);
        modalContent.appendChild(buttonContainer);
        modalContainer.appendChild(modalContent);
        document.body.appendChild(modalContainer);

        // Write content to iframe after it's added to DOM
        iframe.contentDocument.open();
        iframe.contentDocument.write(printContent);
        iframe.contentDocument.close();

        // Return to list view and refresh
        toggleInvoiceView('list');
        
    } catch (error) {
        console.error('Error showing print preview:', error);
        alert('Error showing print preview: ' + error.message);
    }
}

// Modify showSection function to handle invoice loading
function showSection(sectionName) {
    const sections = ['clients', 'visits', 'invoices', 'marketing'];
    sections.forEach(section => {
        const element = document.getElementById(`${section}Section`);
        if (element) {
            element.style.display = section === sectionName ? 'block' : 'none';
        }
    });
    
    // Load data based on section
    if (sectionName === 'invoices') {
        const createView = document.getElementById('invoiceCreateView');
        const listView = document.getElementById('invoiceListView');
        
        // Only load invoices if we're showing the list view
        if (listView && listView.style.display !== 'none') {
            loadInvoices();
        }
    }
}

// Delete invoice
async function deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice? All associated visits will be marked as unbilled.')) {
        return;
    }

    try {
        // First get the invoice to find associated visits
        const invoiceDoc = await db.collection('invoices').doc(id).get();
        if (!invoiceDoc.exists) {
            console.error('Invoice not found');
            return;
        }

        const invoice = invoiceDoc.data();
        const visitIds = invoice.items
            .filter(item => item.visitId)
            .map(item => item.visitId);

        console.log('Found visit IDs to update:', visitIds);

        // Update all associated visits
        const visitUpdates = visitIds.map(visitId => 
            db.collection('visits').doc(visitId).update({
                billingStatus: 'UNBILLED',
                invoicedOn: firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
        );

        // Wait for all visit updates to complete
        await Promise.all(visitUpdates);
        console.log('Updated all associated visits');

        // Delete the invoice
        await db.collection('invoices').doc(id).delete();
        console.log('Deleted invoice:', id);

        // Show success message
        showSuccessMessage('Invoice deleted and visits updated');

        // Refresh the list
        loadInvoices();
    } catch (error) {
        console.error('Error deleting invoice:', error);
        alert('Error deleting invoice: ' + error.message);
    }
}

// Edit invoice
async function editInvoice(id) {
    try {
        // Get the invoice data
        const doc = await db.collection('invoices').doc(id).get();
        if (!doc.exists) {
            alert('Invoice not found');
            return;
        }

        const invoice = doc.data();
        
        // Switch to create view
        toggleInvoiceView('create');
        
        // Load all clients into dropdown first
        await loadClientDropdown();
        
        // Find and select the client by accountId
        const clientSelect = document.getElementById('invoiceClient');
        const clientsSnapshot = await db.collection('clients')
            .where('accountId', '==', invoice.accountId)
            .limit(1)
            .get();

        if (!clientsSnapshot.empty) {
            clientSelect.value = clientsSnapshot.docs[0].id;
        }

        // Set the invoice status
        const statusSelect = document.getElementById('invoiceStatus');
        if (statusSelect) {
            statusSelect.value = invoice.status || 'draft';
        }
        
        // Update client details section
        const clientDetailsSection = document.getElementById('clientDetailsSection');
        if (clientDetailsSection) {
            // Show the section
            clientDetailsSection.style.display = 'block';
            
            // Update the display elements
            document.getElementById('clientName').textContent = invoice.clientName;
            document.getElementById('clientStreetAddress').textContent = invoice.clientAddress?.street || '';
            document.getElementById('clientCityStateZip').textContent = [
                invoice.clientAddress?.city || '',
                invoice.clientAddress?.state || '',
                invoice.clientAddress?.zip || ''
            ].filter(Boolean).join(', ');
            
            // Store the accountId for reference
            clientDetailsSection.dataset.accountId = invoice.accountId;
        }
        
        // Clear existing items
        const tbody = document.getElementById('invoiceItemsBody');
        tbody.innerHTML = '';
        
        // Clear selected visits
        selectedVisits.clear();
        
        // Add each item
        invoice.items.forEach((item, index) => {
            let row;
            if (item.visitId) {
                // For visit-based items
                row = createVisitRow(item, item.visitId, index);
                selectedVisits.add(item.visitId);
            } else {
                // For regular items
                row = createItemRow({
                    quantity: item.quantity,
                    description: item.description,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal
                }, index);
            }
            tbody.appendChild(row);
        });
        
        // Update the totals
        updateTotals();
        
        // Store the invoice ID and other data for updating later
        currentInvoice = {
            ...invoice,
            id: id
        };
        
        // Populate due date fields
        populateDueDateFields(invoice);
        
    } catch (error) {
        console.error('Error loading invoice for edit:', error);
        alert('Error loading invoice: ' + error.message);
    }
}

// Print invoice
async function printInvoice(id) {
    try {
        // Get the invoice data
        const doc = await db.collection('invoices').doc(id).get();
        if (!doc.exists) {
            alert('Invoice not found');
            return;
        }

        const invoice = doc.data();
        
        // Get client data
        const clientDoc = await db.collection('clients')
            .where('accountId', '==', invoice.accountId)
            .limit(1)
            .get();
            
        if (clientDoc.empty) {
            alert('Client not found');
            return;
        }
        
        const clientData = clientDoc.docs[0].data();
        
        // Create printable invoice
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoice.invoiceNumber}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        color: #333;
                    }
                    .invoice-header {
                        display: flex;
                        justify-content: flex-start;
                        gap: 150px;
                        margin-bottom: 40px;
                    }
                    .company-logo {
                        max-width: 200px;
                        margin-bottom: 15px;
                    }
                    .company-info, .bill-to-info {
                        margin-bottom: 20px;
                        min-width: 250px;
                    }
                    .company-info h2, .bill-to-info h2 {
                        margin: 0 0 10px 0;
                        color: #2d3748;
                        font-size: 1.5em;
                    }
                    .company-info p, .bill-to-info p {
                        margin: 0 0 5px 0;
                        line-height: 1.4;
                    }
                    .invoice-info {
                        margin-top: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th:last-child, td:last-child {
                        text-align: right;
                    }
                    .totals {
                        width: 100%;
                        margin-top: 20px;
                        display: grid;
                        grid-template-columns: auto 150px;
                        justify-content: end;
                    }
                    .totals p {
                        margin: 5px 0;
                        text-align: right;
                        padding-right: 12px;
                    }
                    .payment-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        text-align: center;
                        font-size: 0.9em;
                        color: #4a5568;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-preview">
                    <div class="invoice-header">
                        <div>
                            <img src="images/solamar_care_logo.png" class="company-logo" alt="Solamar Care">
                            <div class="company-info">
                                <h2>Solamar Care</h2>
                                <p>Attn: Marc Bussio</p>
                                <p>6513 Easy Street</p>
                                <p>Carlsbad, CA 92011</p>
                            </div>
                            <div class="invoice-info">
                                <p>Invoice #: ${invoice.invoiceNumber}</p>
                                <p>Date: ${new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div>
                            <div style="height: 200px;"></div><!-- Logo space alignment -->
                            <div class="bill-to-info">
                                <h2>Bill To:</h2>
                                <p>${clientData.firstName} ${clientData.lastName}</p>
                                <p>${clientData.address?.street || ''}</p>
                                <p>${clientData.address?.city || ''}, ${clientData.address?.state || ''} ${clientData.address?.zip || ''}</p>
                            </div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Qty/Time</th>
                                <th>Description</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoice.items.map(item => `
                                <tr>
                                    <td>${item.quantity}</td>
                                    <td>${item.description}</td>
                                    <td>$${item.unitPrice.toFixed(2)}</td>
                                    <td>$${item.lineTotal.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="totals">
                        <div></div>
                        <div>
                            <p><strong>Total: $${invoice.total.toFixed(2)}</strong></p>
                            <p>Due: ${invoice.dueDate === 'upon_receipt' ? 'Upon Receipt' : new Date(invoice.dueDate).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div class="payment-info">
                        <p>Please make payable to Marc Bussio</p>
                        <p>Pay by Venmo to @marcbussio</p>
                    </div>
                    
                    <div class="no-print">
                        <button onclick="window.print()">Print Invoice</button>
                    </div>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error printing invoice:', error);
        alert('Error printing invoice: ' + error.message);
    }
}

// When editing an existing invoice, populate the due date fields
function populateDueDateFields(invoice) {
    const dueDateTypeSelect = document.getElementById('dueDateType');
    const specificDateContainer = document.getElementById('specificDateContainer');
    const specificDueDateInput = document.getElementById('specificDueDate');

    if (invoice.dueDateType) {
        dueDateTypeSelect.value = invoice.dueDateType;
        if (invoice.dueDateType === 'specific_date') {
            specificDateContainer.style.display = 'block';
            specificDueDateInput.value = invoice.dueDate;
        } else {
            specificDateContainer.style.display = 'none';
        }
    } else {
        // Handle legacy invoices that don't have the new fields
        dueDateTypeSelect.value = 'upon_receipt';
        specificDateContainer.style.display = 'none';
    }
}

// Add navigation handler
function handleInvoiceNavigation() {
    if (isInvoiceFormOpen) {
        if (checkUnsavedChanges()) {
            toggleInvoiceView('list');
            showSection('invoices'); // This will handle loading invoices
        }
    } else {
        showSection('invoices');
    }
}

// Visit Selection Modal Functions
async function showVisitSelectionModal() {
    const modal = document.getElementById('visitSelectionModal');
    const list = document.getElementById('visitSelectionList');
    const clientId = document.getElementById('invoiceClient').value;

    if (!clientId) {
        alert('Please select a client first');
        return;
    }

    try {
        // Get completed visits for the selected client that haven't been billed
        const visitsSnapshot = await db.collection('visits')
            .where('clientId', '==', clientId)
            .where('status', '==', 'COMPLETED')
            .where('billingStatus', '!=', 'BILLED')
            .orderBy('billingStatus')
            .orderBy('completedDateTime', 'desc')
            .get();

        if (visitsSnapshot.empty) {
            list.innerHTML = '<p class="no-data">No completed visits found for this client</p>';
        } else {
            list.innerHTML = visitsSnapshot.docs.map(doc => {
                const visit = doc.data();
                const completedDate = new Date(visit.completedDateTime).toLocaleDateString();
                const services = visit.services.map(s => s.name).join(', ');
                const isSelected = selectedVisits.has(doc.id);
                
                return `
                    <div class="visit-selection-item ${isSelected ? 'selected' : ''}" 
                         onclick="selectVisit('${doc.id}')"
                         data-visit-id="${doc.id}">
                        <div class="visit-date">
                            <i class="fas fa-calendar-check"></i>
                            Completed on ${completedDate}
                        </div>
                        <div class="visit-duration">
                            <i class="fas fa-clock"></i>
                            ${visit.timeToComplete} minutes
                        </div>
                        <div class="visit-services">
                            ${visit.services.map(service => 
                                `<span class="service-tag">${service.name}</span>`
                            ).join('')}
                        </div>
                        <div class="billing-status ${visit.billingStatus?.toLowerCase() || 'unbilled'}">
                            <i class="fas fa-file-invoice-dollar"></i>
                            ${visit.billingStatus || 'UNBILLED'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('show'), 10);
    } catch (error) {
        console.error('Error loading completed visits:', error);
        alert('Error loading visits: ' + error.message);
    }
}

function closeVisitSelectionModal() {
    const modal = document.getElementById('visitSelectionModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function selectVisit(visitId) {
    try {
        const visitDoc = await db.collection('visits').doc(visitId).get();
        if (!visitDoc.exists) {
            alert('Visit not found');
            return;
        }

        const visit = visitDoc.data();
        const tbody = document.getElementById('invoiceItemsBody');
        const rowIndex = tbody.children.length;
        
        // Create and add the row
        const row = createVisitRow(visit, visitId, rowIndex);
        tbody.appendChild(row);
        updateTotals();
        trackInvoiceChanges();

        // Get current invoice information
        const invoiceNumber = currentInvoice.invoiceNumber || await generateInvoiceNumber();
        const invoiceId = currentInvoice.id || 'pending';

        // Mark visit as billed and store invoice reference in the database
        await db.collection('visits').doc(visitId).update({
            billingStatus: 'BILLED',
            invoicedOn: {
                id: invoiceId,
                number: invoiceNumber,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add to selected visits set
        selectedVisits.add(visitId);

        // Close the modal
        closeVisitSelectionModal();
        
        // Show success message
        showSuccessMessage('Visit added to invoice');
    } catch (error) {
        console.error('Error selecting visit:', error);
        alert('Error adding visit: ' + error.message);
    }
}

async function removeVisitFromInvoice(rowIndex, visitId) {
    try {
        // Remove the row from the invoice
        const tbody = document.getElementById('invoiceItemsBody');
        tbody.deleteRow(rowIndex);
        updateTotals();
        trackInvoiceChanges();

        // Update the visit's billing status and remove invoice reference
        await db.collection('visits').doc(visitId).update({
            billingStatus: 'UNBILLED',
            invoicedOn: firebase.firestore.FieldValue.delete(), // Remove the invoice reference
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Remove from selected visits set
        selectedVisits.delete(visitId);

        // Show success message
        showSuccessMessage('Visit removed from invoice');
    } catch (error) {
        console.error('Error removing visit:', error);
        alert('Error removing visit: ' + error.message);
    }
}

// Show success message
function showSuccessMessage(message) {
    // Create success message element
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Style the message
    successMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4caf50;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 9999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    
    // Add to document
    document.body.appendChild(successMessage);
    
    // Trigger animation
    setTimeout(() => {
        successMessage.style.opacity = '1';
        successMessage.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        successMessage.style.opacity = '0';
        successMessage.style.transform = 'translateY(-10px)';
        setTimeout(() => successMessage.remove(), 300);
    }, 3000);
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeInvoiceSection();
}); 