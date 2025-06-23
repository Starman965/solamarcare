// Invoice Management

let currentInvoice = {
    items: [],
    subtotal: 0,
    total: 0,
    clientId: null,
    dueDate: 'Upon Receipt',
    status: 'draft',
    createdAt: null,
    invoiceNumber: null
};

// Add state tracking at the top of the file
let hasUnsavedChanges = false;
let isInvoiceFormOpen = false;

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
function toggleInvoiceView(view) {
    const listView = document.getElementById('invoiceListView');
    const createView = document.getElementById('invoiceCreateView');
    const dashboardSection = document.getElementById('dashboardSection');
    
    // Ensure we're in the dashboard context
    if (!dashboardSection || dashboardSection.style.display === 'none') {
        return; // Don't toggle if we're not in the dashboard
    }
    
    if (view === 'create') {
        listView.style.display = 'none';
        createView.style.display = 'block';
        isInvoiceFormOpen = true;
        initializeCreateView();
    } else {
        if (isInvoiceFormOpen && !checkUnsavedChanges()) {
            return; // Stay on current view if user cancels
        }
        listView.style.display = 'block';
        createView.style.display = 'none';
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
        clientId: null,
        dueDate: 'Upon Receipt',
        status: 'draft',
        createdAt: null,
        invoiceNumber: null
    };
    
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
    
    // Load clients and add first item
    loadClientDropdown();
    addInvoiceItem();
    
    // Reset totals and change tracking
    updateTotals();
    resetInvoiceChanges();
}

// Load and display invoices
async function loadInvoices() {
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

        // Get all invoices from the top-level invoices collection
        const invoicesSnapshot = await db.collection('invoices')
            .orderBy('createdAt', 'desc')
            .get();

        // Show empty state if no invoices
        if (invoicesSnapshot.empty) {
            emptyState.style.display = 'block';
            return;
        }

        // Process each invoice
        for (const doc of invoicesSnapshot.docs) {
            const invoice = doc.data();
            
            if (!invoice || !invoice.accountId) {
                console.warn('Invalid invoice data:', { id: doc.id, invoice });
                continue;
            }

            try {
                // Find client by their accountId field
                const clientsSnapshot = await db.collection('clients')
                    .where('accountId', '==', invoice.accountId)
                    .limit(1)
                    .get();

                if (clientsSnapshot.empty) {
                    console.warn('Client not found for invoice:', { id: doc.id, accountId: invoice.accountId });
                    continue;
                }

                const clientData = clientsSnapshot.docs[0].data();
                const row = createInvoiceRow(doc.id, invoice, clientData);
                if (row) tableBody.appendChild(row);
            } catch (error) {
                console.error('Error processing invoice:', { id: doc.id, error });
            }
        }

    } catch (error) {
        console.error('Error loading invoices:', error);
        errorState.style.display = 'block';
    }
}

// Create invoice table row
function createInvoiceRow(id, invoice, clientData) {
    if (!invoice || !clientData) {
        console.error('Invalid invoice or client data:', { id, invoice, clientData });
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
            ${clientData.firstName || ''} ${clientData.lastName || ''}
            <div class="client-address">${clientData.address?.street || 'No address'}</div>
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
function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    return `INV-${year}-${random}`;
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

// Add new invoice item row
function addInvoiceItem() {
    const tbody = document.getElementById('invoiceItemsBody');
    const rowIndex = tbody.children.length;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="number" 
                   min="1" 
                   value="1" 
                   onchange="updateLineTotal(${rowIndex}); trackInvoiceChanges();" 
                   class="quantity-input">
        </td>
        <td>
            <input type="text" 
                   placeholder="Item description" 
                   class="description-input"
                   onchange="trackInvoiceChanges();" 
                   required>
        </td>
        <td>
            <input type="number" 
                   min="0" 
                   step="0.01" 
                   placeholder="0.00" 
                   onchange="updateLineTotal(${rowIndex}); trackInvoiceChanges();" 
                   class="unit-price">
        </td>
        <td class="line-total read-only">$0.00</td>
        <td>
            <button type="button" 
                    onclick="deleteInvoiceItem(${rowIndex}); trackInvoiceChanges();" 
                    class="delete-row">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(row);
    updateTotals();
    trackInvoiceChanges();
}

// Update line total when quantity or price changes
function updateLineTotal(rowIndex) {
    const tbody = document.getElementById('invoiceItemsBody');
    const row = tbody.children[rowIndex];
    
    const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const unitPrice = parseFloat(row.querySelector('.unit-price').value) || 0;
    const lineTotal = quantity * unitPrice;
    
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

// Save invoice
async function saveInvoiceDraft() {
    try {
        // Get client selection
        const clientSelect = document.getElementById('invoiceClient');
        if (!clientSelect.value) {
            alert('Please select a client');
            return;
        }

        // Get the client's actual accountId from their document
        const clientDoc = await db.collection('clients').doc(clientSelect.value).get();
        const clientData = clientDoc.data();
        if (!clientData || !clientData.accountId) {
            alert('Error: Client account ID not found');
            return;
        }
        
        // Get all invoice items
        const items = [];
        const tbody = document.getElementById('invoiceItemsBody');
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

        // Get selected status
        const statusSelect = document.getElementById('invoiceStatus');
        const status = statusSelect ? statusSelect.value : 'draft';

        // Get due date information
        const dueDateType = document.getElementById('dueDateType').value;
        const dueDate = dueDateType === 'specific_date' ? 
            document.getElementById('specificDueDate').value : 'upon_receipt';
        
        // Create invoice data structure
        const invoiceData = {
            accountId: clientData.accountId,  // Using the client's actual accountId field
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
            // Save to Firebase in the top-level invoices collection
            await db.collection('invoices').add(invoiceData);
        } else {
            // Update existing invoice
            // Keep the original invoice number and created date
            invoiceData.invoiceNumber = currentInvoice.invoiceNumber;
            invoiceData.createdAt = currentInvoice.createdAt;
            // Update the document
            await db.collection('invoices').doc(currentInvoice.id).update(invoiceData);
        }
        
        // Return to list view - toggleInvoiceView will handle the refresh
        toggleInvoiceView('list');
        
        resetInvoiceChanges();
        return true;
    } catch (error) {
        console.error('Error saving invoice:', error);
        alert('Error saving invoice: ' + error.message);
        return false;
    }
}

// Helper function to calculate subtotal
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
}

// Update client details when selected
async function updateClientDetails() {
    const clientSelect = document.getElementById('invoiceClient');
    const clientDetailsSection = document.getElementById('clientDetailsSection');
    
    if (!clientSelect.value) {
        clientDetailsSection.style.display = 'none';
        return;
    }
    
    try {
        const clientDoc = await db.collection('clients').doc(clientSelect.value).get();
        const clientData = clientDoc.data();
        
        if (!clientData) {
            console.error('Client data not found');
            return;
        }
        
        // Format the data
        const name = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim();
        const street = clientData.address.street || '';
        const cityStateZip = [
            clientData.address.city || '',
            clientData.address.state || '',
            clientData.address.zip || ''
        ].filter(Boolean).join(', ');
        
        // Update the elements
        document.getElementById('clientName').textContent = name;
        document.getElementById('clientStreetAddress').textContent = street;
        document.getElementById('clientCityStateZip').textContent = cityStateZip;
        
        // Show the section and store the account ID
        clientDetailsSection.style.display = 'block';
        clientDetailsSection.dataset.accountId = clientData.accountId;
        
        // Log for debugging
        console.log('Client details updated:', {
            name,
            street,
            cityStateZip,
            elements: {
                name: document.getElementById('clientName').textContent,
                street: document.getElementById('clientStreetAddress').textContent,
                cityStateZip: document.getElementById('clientCityStateZip').textContent
            }
        });
        
    } catch (error) {
        console.error('Error updating client details:', error);
        alert('Error updating client details: ' + error.message);
    }
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
        // If it's an existing invoice, keep original number and creation date
        if (!currentInvoice.id) {
            invoiceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            invoiceData.invoiceNumber = await generateInvoiceNumber();
            // Create new invoice
            await db.collection('invoices').add(invoiceData);
        } else {
            // Update existing invoice
            invoiceData.invoiceNumber = currentInvoice.invoiceNumber;
            invoiceData.createdAt = currentInvoice.createdAt;
            // Update the document
            await db.collection('invoices').doc(currentInvoice.id).update(invoiceData);
        }

        // Create printable invoice
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoiceData.invoiceNumber}</title>
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
                                <th>Quantity</th>
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
                                    <td>$${(item.quantity * item.unitPrice).toFixed(2)}</td>
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
                    
                    <div class="no-print">
                        <button onclick="window.print()">Print Invoice</button>
                    </div>
                </div>
            </body>
            </html>
        `);
        
        // Return to list view and refresh
        toggleInvoiceView('list');
        
    } catch (error) {
        console.error('Error showing print preview:', error);
        alert('Error showing print preview: ' + error.message);
    }
}

// Initialize invoice section
function initializeInvoiceSection() {
    loadClientDropdown();
    addInvoiceItem(); // Add first row
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
    if (!confirm('Are you sure you want to delete this invoice?')) {
        return;
    }

    try {
        await db.collection('invoices').doc(id).delete();
        loadInvoices(); // Refresh the list
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
        
        // Get client data first
        const clientsSnapshot = await db.collection('clients')
            .where('accountId', '==', invoice.accountId)
            .limit(1)
            .get();

        if (clientsSnapshot.empty) {
            alert('Client not found');
            return;
        }

        const clientData = clientsSnapshot.docs[0].data();
        
        // Load all clients into dropdown first
        await loadClientDropdown();
        
        // Set the selected client
        const clientSelect = document.getElementById('invoiceClient');
        Array.from(clientSelect.options).forEach(option => {
            if (option.textContent === `${clientData.firstName} ${clientData.lastName}`) {
                option.selected = true;
            }
        });

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
            
            // Format the address components
            const name = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim();
            const street = clientData.address.street || '';
            const cityStateZip = [
                clientData.address.city || '',
                clientData.address.state || '',
                clientData.address.zip || ''
            ].filter(Boolean).join(', ');
            
            // Update the display elements with new IDs
            document.getElementById('clientName').textContent = name;
            document.getElementById('clientStreetAddress').textContent = street;
            document.getElementById('clientCityStateZip').textContent = cityStateZip;
            
            // Store the accountId for reference
            clientDetailsSection.dataset.accountId = clientData.accountId;
        }
        
        // Clear existing items
        const tbody = document.getElementById('invoiceItemsBody');
        tbody.innerHTML = '';
        
        // Add each item
        invoice.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="number" 
                           min="1" 
                           value="${item.quantity}" 
                           onchange="updateLineTotal(${tbody.children.length})" 
                           class="quantity-input">
                </td>
                <td>
                    <input type="text" 
                           value="${item.description}" 
                           class="description-input" 
                           required>
                </td>
                <td>
                    <input type="number" 
                           min="0" 
                           step="0.01" 
                           value="${item.unitPrice}" 
                           onchange="updateLineTotal(${tbody.children.length})" 
                           class="unit-price">
                </td>
                <td class="line-total read-only">$${item.lineTotal.toFixed(2)}</td>
                <td>
                    <button type="button" 
                            onclick="deleteInvoiceItem(${tbody.children.length})" 
                            class="delete-row">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
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
                                <th>Quantity</th>
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
                                    <td>$${(item.quantity * item.unitPrice).toFixed(2)}</td>
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