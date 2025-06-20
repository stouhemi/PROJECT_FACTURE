// script.js - Complete Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the app
    loadInvoices();
    
    // Set up event listeners
    document.getElementById('searchBtn').addEventListener('click', loadInvoices);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.getElementById('createBtn').addEventListener('click', showCreateForm);
});

async function loadInvoices() {
    const listContainer = document.getElementById('invoicesList');
    listContainer.innerHTML = '<div class="loading">Loading invoices...</div>';
    
    try {
        // Get filter values
        const params = new URLSearchParams();
        const client = document.getElementById('searchClient').value;
        const company = document.getElementById('searchCompany').value;
        const date = document.getElementById('searchDate').value;
        const status = document.getElementById('searchStatus').value;
        
        if (client) params.append('nom_client', client);
        if (company) params.append('nom_societe', company);
        if (date) params.append('date_facturation', date);
        if (status) params.append('status', status);
        
        const response = await fetch(`http://127.0.0.1:5000/api/factures?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load invoices: ${response.status}`);
        }
        
        const invoices = await response.json();
        displayInvoicesList(invoices);
    } catch (error) {
        console.error('Error loading invoices:', error);
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
    
    if (invoices.length === 0) {
        listContainer.innerHTML = '<div class="no-results">No invoices found matching your criteria</div>';
        return;
    }
    
    listContainer.innerHTML = '';
    
    invoices.forEach(invoice => {
        const invoiceElement = document.createElement('div');
        invoiceElement.className = 'invoice-card';
        invoiceElement.innerHTML = `
            <div class="invoice-card-header">
                <span class="invoice-number">#${invoice.numero_facture}</span>
                <span class="invoice-status ${invoice.status === 'payé' ? 'status-paid' : 'status-unpaid'}">
                    ${invoice.status}
                </span>
            </div>
            <div class="invoice-client">${invoice.nom_client}</div>
            <div class="invoice-company">${invoice.nom_societe || ''}</div>
            <div class="invoice-date">${invoice.date_facturation}</div>
            <div class="invoice-amount">${invoice.summary.net_a_payer.toFixed(2)} DZD</div>
        `;
        
        invoiceElement.addEventListener('click', () => showInvoiceDetail(invoice.id));
        listContainer.appendChild(invoiceElement);
    });
}

async function showInvoiceDetail(invoiceId) {
    const detailContainer = document.getElementById('invoiceDetail');
    const listContainer = document.getElementById('invoicesList');
    
    listContainer.classList.add('hidden');
    detailContainer.innerHTML = '<div class="loading">Loading invoice details...</div>';
    detailContainer.classList.remove('hidden');
    
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/factures/${invoiceId}`);
        
        if (!response.ok) {
            throw new Error(`Invoice not found: ${response.status}`);
        }
        
        const invoice = await response.json();
        displayInvoiceDetail(invoice);
    } catch (error) {
        console.error('Error loading invoice:', error);
        detailContainer.innerHTML = `
            <div class="error-message">
                <p>Failed to load invoice details</p>
                <p>${error.message}</p>
            </div>
            <button onclick="hideInvoiceDetail()" class="back-btn">Back to List</button>
        `;
    }
}

function displayInvoiceDetail(invoice) {
    const detailContainer = document.getElementById('invoiceDetail');
    
    // Format date
    const formattedDate = new Date(invoice.date_facturation).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Status styling
    const statusClass = invoice.status.toLowerCase().includes('payé') ? 'paid' : 'unpaid';
    
    // Generate items table rows
    const itemsRows = invoice.lines.map(line => `
        <tr>
            <td>${line.designation}</td>
            <td>${line.description || '-'}</td>
            <td class="text-right">${line.prix_unitaire.toFixed(2)}</td>
            <td class="text-right">${line.quantite}</td>
            <td class="text-right">${(line.prix_unitaire * line.quantite).toFixed(2)}</td>
            <td class="text-right">${line.tva.toFixed(2)}</td>
        </tr>
    `).join('');
    
    // Generate documents section
    const documentsHTML = generateDocumentsHTML(invoice.documents);
    
    // Build and display invoice
    detailContainer.innerHTML = `
        <div class="invoice-detail-container">
            <button onclick="hideInvoiceDetail()" class="back-btn">← Back to List</button>
            
            <div class="invoice-header">
                <div>
                    <h2>Invoice #${invoice.numero_facture}</h2>
                    <p class="invoice-date">${formattedDate}</p>
                </div>
                <span class="status-badge ${statusClass}">${invoice.status}</span>
            </div>
            
            <div class="client-info">
                <h3>Client Information</h3>
                <p><strong>Name:</strong> ${invoice.nom_client}</p>
                ${invoice.nom_societe ? `<p><strong>Company:</strong> ${invoice.nom_societe}</p>` : ''}
                ${invoice.adresse ? `<p><strong>Address:</strong> ${invoice.adresse}</p>` : ''}
            </div>
            
            <div class="invoice-items">
                <h3>Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Designation</th>
                            <th>Description</th>
                            <th class="text-right">Unit Price</th>
                            <th class="text-right">Quantity</th>
                            <th class="text-right">Total HT</th>
                            <th class="text-right">TVA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>
            
            <div class="invoice-summary">
                <h3>Summary</h3>
                <table class="summary-table">
                    ${renderSummaryRow('Total Services:', invoice.summary.total_services)}
                    ${renderSummaryRow('Total TVA:', invoice.summary.total_tva)}
                    ${renderSummaryRow('Total TTC:', invoice.summary.total_ttc)}
                    ${invoice.summary.total_frais > 0 ? renderSummaryRow('Frais:', invoice.summary.total_frais) : ''}
                    ${invoice.timbre ? renderSummaryRow('Timbre:', invoice.timbre) : ''}
                    ${renderSummaryRow('RAS (3%):', invoice.summary.ras)}
                    ${renderSummaryRow('Net à payer:', invoice.summary.net_a_payer, true)}
                </table>
            </div>
            
            ${documentsHTML}
            
            <div class="invoice-actions">
                <button onclick="window.print()" class="print-btn">
                    Print Invoice
                </button>
                <button onclick="downloadInvoicePdf(${invoice.id})" class="pdf-btn">
                    Download PDF
                </button>
                <button onclick="editInvoice(${invoice.id})" class="edit-btn">
                    Edit Invoice
                </button>
                <button onclick="deleteInvoice(${invoice.id})" class="delete-btn">
                    Delete Invoice
                </button>
            </div>
        </div>
    `;
}

function hideInvoiceDetail() {
    document.getElementById('invoiceDetail').classList.add('hidden');
    document.getElementById('invoicesList').classList.remove('hidden');
}

function resetFilters() {
    document.getElementById('searchClient').value = '';
    document.getElementById('searchCompany').value = '';
    document.getElementById('searchDate').value = '';
    document.getElementById('searchStatus').value = '';
    loadInvoices();
}

function showCreateForm() {
    // Implementation for create form would go here
    alert('Create new invoice form would appear here');
}

async function downloadInvoicePdf(invoiceId) {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/factures/${invoiceId}/download`);
        
        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Failed to download PDF: ' + error.message);
    }
}

// Helper functions (keep from previous implementation)
function generateDocumentsHTML(documents) {
    if (!documents?.length) return '';
    
    return `
        <div class="documents-section">
            <h3>Attached Documents</h3>
            <ul class="documents-list">
                ${documents.map(doc => `
                    <li class="document-item">
                        <span class="doc-icon">📄</span>
                        <a href="http://127.0.0.1:5000/api/documents/${doc.id}" 
                           target="_blank" 
                           class="doc-link">
                           ${doc.name}
                        </a>
                        <a href="http://127.0.0.1:5000/api/documents/${doc.id}/download" 
                           class="doc-download">
                           (Download)
                        </a>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function renderSummaryRow(label, value, isTotal = false) {
    return `
        <tr ${isTotal ? 'class="total-row"' : ''}>
            <td>${isTotal ? `<strong>${label}</strong>` : label}</td>
            <td class="text-right">${isTotal ? `<strong>${value.toFixed(2)}</strong>` : value.toFixed(2)}</td>
        </tr>
    `;
}

// Stub functions for edit/delete
function editInvoice(invoiceId) {
    alert(`Edit invoice ${invoiceId} - implementation would go here`);
}

async function deleteInvoice(invoiceId) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/factures/${invoiceId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete invoice');
            }
            
            alert('Invoice deleted successfully');
            hideInvoiceDetail();
            loadInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('Failed to delete invoice: ' + error.message);
        }
    }
}