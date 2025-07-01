// script.js - Optimized Implementation
const API_BASE_URL = window.location.origin; // Dynamic API base URL

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    loadInvoices();
    
    // Set up event listeners
    document.getElementById('searchBtn')?.addEventListener('click', loadInvoices);
    document.getElementById('resetBtn')?.addEventListener('click', resetFilters);
    document.getElementById('createBtn')?.addEventListener('click', showCreateForm);

    // Invoice form initialization (conditionally)
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        addInvoiceItemRow();
        document.getElementById('addItemBtn')?.addEventListener('click', addInvoiceItemRow);
        invoiceForm.addEventListener('submit', handleInvoiceSubmit);
        document.getElementById('taxRate')?.addEventListener('input', calculateInvoiceTotals);
    }

    // Event delegation for dynamic elements
    document.querySelector('#itemsTable')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-item')) {
            e.target.closest('tr').remove();
            calculateInvoiceTotals();
        }
    });
});

// ==============================================
// INVOICE LISTING FUNCTIONS
// ==============================================
async function loadInvoices() {
    const listContainer = document.getElementById('invoicesList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div class="loading">Loading invoices...</div>';
    
    try {
        const params = new URLSearchParams({
            nom_client: document.getElementById('searchClient').value || '',
            nom_societe: document.getElementById('searchCompany').value || '',
            date_facturation: document.getElementById('searchDate').value || '',
            status: document.getElementById('searchStatus').value || ''
        });
        
        const response = await fetch(`${API_BASE_URL}/api/factures?${params.toString()}`);
        
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        displayInvoicesList(await response.json());
    } catch (error) {
        console.error('Invoice load failed:', error);
        listContainer.innerHTML = `
            <div class="error-message">
                <p>Failed to load invoices</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displayInvoicesList(invoices) {
    const listContainer = document.getElementById('invoicesList');
    if (!listContainer) return;

    listContainer.innerHTML = invoices.length === 0 
        ? '<div class="no-results">No invoices found</div>'
        : invoices.map(invoice => `
            <div class="invoice-card" onclick="showInvoiceDetail(${invoice.id})">
                <div class="invoice-card-header">
                    <span class="invoice-number">#${invoice.numero_facture}</span>
                    <span class="invoice-status ${invoice.status === 'payé' ? 'status-paid' : 'status-unpaid'}">
                        ${invoice.status}
                    </span>
                </div>
                <div class="invoice-client">${invoice.nom_client}</div>
                <div class="invoice-date">${new Date(invoice.date_facturation).toLocaleDateString()}</div>
                <div class="invoice-amount">${invoice.summary.net_a_payer.toFixed(2)} DZD</div>
            </div>
        `).join('');
}

// ==============================================
// INVOICE DETAIL FUNCTIONS
// ==============================================
async function showInvoiceDetail(invoiceId) {
    const detailContainer = document.getElementById('invoiceDetail');
    const listContainer = document.getElementById('invoicesList');
    
    if (!detailContainer || !listContainer) return;
    
    listContainer.classList.add('hidden');
    detailContainer.innerHTML = '<div class="loading">Loading details...</div>';
    detailContainer.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/factures/${invoiceId}`);
        if (!response.ok) throw new Error(`Invoice load failed: ${response.status}`);
        displayInvoiceDetail(await response.json());
    } catch (error) {
        console.error('Detail load failed:', error);
        detailContainer.innerHTML = `
            <div class="error-message">
                <p>Failed to load details</p>
                <p>${error.message}</p>
                <button onclick="hideInvoiceDetail()" class="back-btn">Back to List</button>
            </div>
        `;
    }
}

function displayInvoiceDetail(invoice) {
    const detailContainer = document.getElementById('invoiceDetail');
    if (!detailContainer) return;

    detailContainer.innerHTML = `
        <div class="invoice-detail-container">
            ${renderInvoiceHeader(invoice)}
            ${renderClientInfo(invoice)}
            ${renderItemsTable(invoice.lines)}
            ${renderSummary(invoice.summary)}
            ${renderDocuments(invoice.documents)}
            ${renderActionButtons(invoice.id)}
        </div>
    `;
}

// ==============================================
// INVOICE FORM FUNCTIONS
// ==============================================
function addInvoiceItemRow() {
    const tbody = document.querySelector('#itemsTable tbody');
    if (!tbody) return;

    tbody.insertAdjacentHTML('beforeend', `
        <tr>
            <td><input type="text" class="item-desc" required placeholder="Item description"></td>
            <td><input type="number" class="item-qty" min="1" value="1" required></td>
            <td><input type="number" class="item-price" min="0" step="0.01" required placeholder="0.00"></td>
            <td class="item-total">0.00</td>
            <td><button type="button" class="btn-remove-item">×</button></td>
        </tr>
    `);
}

function calculateInvoiceRowTotal(e) {
    const row = e.target.closest('tr');
    if (!row) return;

    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    row.querySelector('.item-total').textContent = (qty * price).toFixed(2);
    calculateInvoiceTotals();
}

function calculateInvoiceTotals() {
    let subtotal = 0;
    document.querySelectorAll('.item-total').forEach(cell => {
        subtotal += parseFloat(cell.textContent) || 0;
    });

    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    
    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('taxAmount').textContent = taxAmount.toFixed(2);
    document.getElementById('grandTotal').textContent = (subtotal + taxAmount).toFixed(2);
}

async function handleInvoiceSubmit(e) {
    e.preventDefault();
    
    // Form validation
    const formData = {
        client: document.getElementById('clientName').value.trim(),
        date: document.getElementById('invoiceDate').value,
        dueDate: document.getElementById('dueDate').value,
        items: Array.from(document.querySelectorAll('#itemsTable tbody tr')).map(row => ({
            description: row.querySelector('.item-desc').value.trim(),
            quantity: parseFloat(row.querySelector('.item-qty').value),
            price: parseFloat(row.querySelector('.item-price').value)
        })),
        subtotal: parseFloat(document.getElementById('subtotal').textContent),
        tax: parseFloat(document.getElementById('taxAmount').textContent),
        total: parseFloat(document.getElementById('grandTotal').textContent)
    };

    // Validation checks
    if (!formData.client || !formData.date || formData.items.length === 0) {
        alert("Please fill all required fields and add at least one item.");
        return;
    }

    const invalidItems = formData.items.some(item => 
        !item.description || item.quantity <= 0 || item.price <= 0
    );
    if (invalidItems) {
        alert("Please check all item fields (description, quantity, price).");
        return;
    }

    // Submit with CSRF protection
    try {
        const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
        const response = await fetch(`${API_BASE_URL}/create_invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
        
        const result = await response.json();
        alert('Invoice created successfully!');
        window.location.href = `/invoices/${result.invoice_id}`; // Redirect to new invoice
    } catch (error) {
        console.error('Submission error:', error);
        alert(`Failed to create invoice: ${error.message}`);
    }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================
function hideInvoiceDetail() {
    document.getElementById('invoiceDetail')?.classList.add('hidden');
    document.getElementById('invoicesList')?.classList.remove('hidden');
}

function resetFilters() {
    ['searchClient', 'searchCompany', 'searchDate', 'searchStatus'].forEach(id => {
        document.getElementById(id).value = '';
    });
    loadInvoices();
}

function showCreateForm() {
    window.location.href = '/invoices/create'; // Redirect to create page
}

async function downloadInvoicePdf(invoiceId) {
    const btn = document.querySelector(`.pdf-btn[onclick*="${invoiceId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generating...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/factures/${invoiceId}/download`);
        if (!response.ok) throw new Error('PDF generation failed');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${invoiceId}.pdf`;
        a.click();
    } catch (error) {
        console.error('PDF download failed:', error);
        alert('PDF download failed: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Download PDF';
        }
    }
}

// ==============================================
// RENDER HELPERS (DRY Templates)
// ==============================================
function renderInvoiceHeader(invoice) {
    return `
        <button onclick="hideInvoiceDetail()" class="back-btn">← Back to List</button>
        <div class="invoice-header">
            <div>
                <h2>Invoice #${invoice.numero_facture}</h2>
                <p class="invoice-date">
                    ${new Date(invoice.date_facturation).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </p>
            </div>
            <span class="status-badge ${invoice.status === 'payé' ? 'paid' : 'unpaid'}">
                ${invoice.status}
            </span>
        </div>
    `;
}

function renderClientInfo(invoice) {
    return `
        <div class="client-info">
            <h3>Client</h3>
            <p><strong>Name:</strong> ${invoice.nom_client}</p>
            ${invoice.nom_societe ? `<p><strong>Company:</strong> ${invoice.nom_societe}</p>` : ''}
            ${invoice.adresse ? `<p><strong>Address:</strong> ${invoice.adresse}</p>` : ''}
        </div>
    `;
}

function renderItemsTable(items) {
    return `
        <div class="invoice-items">
            <h3>Items</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Designation</th>
                        <th>Description</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Quantity</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.designation}</td>
                            <td>${item.description || '-'}</td>
                            <td class="text-right">${item.prix_unitaire.toFixed(2)}</td>
                            <td class="text-right">${item.quantite}</td>
                            <td class="text-right">${(item.prix_unitaire * item.quantite).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderActionButtons(invoiceId) {
    return `
        <div class="invoice-actions">
            <button onclick="window.print()" class="print-btn">Print</button>
            <button onclick="downloadInvoicePdf(${invoiceId})" class="pdf-btn">Download PDF</button>
            <button onclick="editInvoice(${invoiceId})" class="edit-btn">Edit</button>
            <button onclick="deleteInvoice(${invoiceId})" class="delete-btn">Delete</button>
        </div>
    `;
}