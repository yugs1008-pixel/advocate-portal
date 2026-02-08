// --- AUTO-SERVER REDIRECT ---
if (window.location.protocol === 'file:') {
    const ping = new Image();
    ping.onload = () => {
        window.location.href = 'http://localhost:3000/operator.html';
    };
    ping.src = 'http://localhost:3000/ping.png?cache=' + Date.now();
}

document.addEventListener('DOMContentLoaded', () => {
    const operatorList = document.getElementById('operatorList');
    const operatorSearch = document.getElementById('operatorSearch');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

    let applications = [];
    let totalCount = 0;
    let totalPages = 1;
    let currentPage = 1;
    const pageSize = 500; // Effectively show all
    let currentSearch = '';

    async function fetchAllApplications() {
        operatorList.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading applications...</td></tr>';

        try {
            const url = `/api/operator/applications?page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(currentSearch)}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                applications = data.applications;
                totalCount = data.totalCount;
                totalPages = data.totalPages;
                renderOperatorTable();
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error:', errorData);
                operatorList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Failed to load data (Server Error: ${response.status}).</td></tr>`;
            }
        } catch (err) {
            console.error('Fetch error:', err);
            operatorList.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; color: #64748b;">
                        <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
                        <strong style="display: block; margin-bottom: 0.5rem; font-size: 1.2rem;">Server Connection Issue</strong>
                        Unable to reach the backend services. Please ensure the server is running and database configuration is correct.
                        <br><br>
                        <button onclick="location.reload()" class="btn-small" style="background: var(--primary-color); color: white;">Retry System Check</button>
                    </td>
                </tr>`;
        }
    }

    function renderOperatorTable() {
        if (applications.length === 0) {
            operatorList.innerHTML = `<tr><td colspan="6" class="no-apps-table">No applications found ${currentSearch ? 'matching your search' : 'in the system yet'}.</td></tr>`;
            updatePaginationUI();
            return;
        }

        operatorList.innerHTML = applications.map(app => {
            const date = new Date(app.submissionTime).toLocaleString('en-IN');

            return `
                <tr data-id="${app.id}">
                    <td>${app.id}</td>
                    <td><strong>${app.userEmail}</strong></td>
                    <td>${app.type}</td>
                    <td>${date}</td>
                    <td>
                        <select class="status-select ${app.paymentStatus === 'Cancelled' ? 'status-cancelled' : ''}" onchange="updateAppStatus(${app.id}, this.value)">
                            <option value="Pending" ${app.paymentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Completed" ${app.paymentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                            <option value="Processing" ${app.paymentStatus === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Cancelled" ${app.paymentStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td>
                        <select class="status-select" onchange="updatePaymentStatus(${app.id}, this.value)">
                            <option value="Unpaid" ${app.payment_status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                            <option value="Paid" ${app.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Waived" ${app.payment_status === 'Waived' ? 'selected' : ''}>Waived</option>
                        </select>
                    </td>
                    <td><span class="expand-btn" onclick="toggleDetails(${app.id})">Details ➕</span></td>
                </tr>
                <tr id="details-${app.id}" class="detail-row">
                    <td colspan="7">
                        <div style="padding: 1.5rem; line-height: 1.6;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <strong>Form Content:</strong><br>
                                    ${renderFormDetails(app.data)}
                                    <br><br><strong>Attachments:</strong><br>
                                    ${renderAttachments(app.data.attachments)}
                                </div>
                                <button class="btn-small btn-print" onclick="printApplication(${app.id})">🖨️ Print Form</button>
                            </div>

                            <div class="billing-form">
                                <div style="flex: 2;">
                                    <label style="display:block; font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">Billing Name (Entity)</label>
                                    <input type="text" id="billOn-${app.id}" value="${app.billOn || ''}" placeholder="Company or Individual Name">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">Bill Amount (₹)</label>
                                    <input type="text" id="billAmt-${app.id}" value="${app.billAmount || ''}" placeholder="0.00">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">Bill Number</label>
                                    <input type="text" id="billNum-${app.id}" value="${app.billNumber || ''}" placeholder="INV-001">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">Bill Copy (PDF/JPG)</label>
                                    <input type="file" id="billFile-${app.id}">
                                </div>
                                <button class="btn-small btn-save" onclick="updateBilling(${app.id})">Save Bill Info</button>
                            </div>
                            
                            ${app.billAttachment ? `<div style="margin-top: 10px; font-size: 0.8rem;"><a href="${app.billAttachment}" target="_blank" style="color: #059669;">✅ Bill Uploaded: View Bill Copy</a></div>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Pagination Listeners Removed

    function renderFormDetails(data) {
        let details = '';
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'attachments' && value) {
                const displayValue = Array.isArray(value) ? value.join(', ') : value;
                details += `<span style="text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1')}</span>: <strong>${displayValue}</strong> | `;
            }
        }
        return details || 'N/A';
    }

    function renderAttachments(attachments) {
        if (!attachments || attachments.length === 0) return 'No files attached';
        return attachments.map(a => `<a href="${a.path}" target="_blank" class="attachment-link">📄 ${a.name}</a>`).join('');
    }

    // Global toggle for details
    window.toggleDetails = (id) => {
        const row = document.getElementById(`details-${id}`);
        const btn = document.querySelector(`tr[data-id="${id}"] .expand-btn`);
        if (row.style.display === 'table-row') {
            row.style.display = 'none';
            btn.innerHTML = 'Details ➕';
        } else {
            row.style.display = 'table-row';
            btn.innerHTML = 'Details ➖';
        }
    };

    // Global status update
    window.updateAppStatus = async (id, newStatus) => {
        try {
            const response = await fetch('/api/operator/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId: id, status: newStatus })
            });

            if (response.ok) {
                console.log(`Status of #${id} updated to ${newStatus}`);
            } else {
                alert('Failed to update status.');
            }
        } catch (err) {
            console.error('Update status error:', err);
        }
    };

    window.updatePaymentStatus = async (id, newPaymentStatus) => {
        try {
            const response = await fetch('/api/operator/update-payment-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId: id, payment_status: newPaymentStatus })
            });

            if (response.ok) {
                console.log(`Payment status of #${id} updated to ${newPaymentStatus}`);
            } else {
                alert('Failed to update payment status.');
            }
        } catch (err) {
            console.error('Update payment status error:', err);
        }
    };

    window.updateBilling = async (id) => {
        const amt = document.getElementById(`billAmt-${id}`).value;
        const num = document.getElementById(`billNum-${id}`).value;
        const billOn = document.getElementById(`billOn-${id}`).value;
        const fileInput = document.getElementById(`billFile-${id}`);

        const formData = new FormData();
        formData.append('applicationId', id);
        formData.append('billAmount', amt);
        formData.append('billNumber', num);
        formData.append('billOn', billOn);
        if (fileInput.files[0]) {
            formData.append('billAttachment', fileInput.files[0]);
        }

        try {
            const response = await fetch('/api/operator/update-billing', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert('Billing information updated successfully!');
                fetchAllApplications(); // Refresh to show attachment link
            } else {
                alert('Failed to update billing info.');
            }
        } catch (err) {
            console.error('Billing update error:', err);
        }
    };

    window.printApplication = (id) => {
        const app = applications.find(a => a.id === id);
        if (!app) return;

        const printArea = document.getElementById('printArea');
        const date = new Date(app.submissionTime).toLocaleString('en-IN');
        const isBulk = app.type === 'Bulk Order' && Array.isArray(app.data.firstParty);

        let content = `
            <style>
                @page {
                    size: A4;
                    margin: 0; 
                }
                @media print {
                    /* Hide everything by default */
                    body * { visibility: hidden; }
                    /* Show ONLY the print area and its contents */
                    #printArea, #printArea * { visibility: visible; }
                    /* Position print area at the absolute top-left */
                    #printArea { 
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-container {
                        border: none !important; /* Optional: remove outer border for cleaner look */
                        height: 297mm;
                        width: 100%;
                    }
                }
            </style>
            <div class="print-container" style="font-family: 'Inter', sans-serif; width: 100%; border: 1.5px solid #000; padding: 20px 30px; color: #000; background: #fff; font-size: 1.15rem; line-height: 1.4; display: flex; flex-direction: column; height: 297mm; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #000; margin-bottom: 12px; padding-bottom: 8px;">
                    <div style="text-align: left;">
                        <h1 style="margin:0; text-transform: uppercase; letter-spacing: 0.5px; color: #000; font-size: 1.8rem;">Advocate Practice</h1>
                        <p style="margin: 2px 0; font-size: 0.9rem; font-weight: 700;">Legal Professional & E-Stamp Services</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; background: #000; color: white; display: inline-block; padding: 5px 15px; border-radius: 4px; font-size: 1.1rem;">FORM #${app.id}</h2>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px; font-size: 1rem; border-bottom: 1.5px solid #000; padding-bottom: 12px;">
                    <div>
                        <p style="margin: 4px 0;"><strong>Applicant:</strong> ${app.fullName || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Contact:</strong> ${app.phoneNumber || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Email ID:</strong> ${app.userEmail}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 4px 0;"><strong>Type:</strong> ${app.type}</p>
                        <p style="margin: 4px 0;"><strong>Date:</strong> ${date}</p>
                        <p style="margin: 4px 0;"><strong>Status:</strong> ${app.payment_status || 'Unpaid'}</p>
                    </div>
                </div>

                <div style="border: 1.2px solid #000; padding: 15px; background: #fff; margin-bottom: 15px; flex-shrink: 1; overflow: hidden;">
                    <h3 style="border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">Application Specifications</h3>
                    
                    ${isBulk ? `
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #f8fafc; text-align: left;">
                                    <th style="padding: 10px; border: 1.2px solid #000;">First Party</th>
                                    <th style="padding: 10px; border: 1.2px solid #000;">Second Party</th>
                                    <th style="padding: 10px; border: 1.2px solid #000; text-align: center;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${app.data.firstParty.map((fp, i) => `
                                    <tr>
                                        <td style="padding: 8px; border: 1.2px solid #000;">${fp || '-'}</td>
                                        <td style="padding: 8px; border: 1.2px solid #000;">${app.data.secondParty[i] || '-'}</td>
                                        <td style="padding: 8px; border: 1.2px solid #000; text-align: center;">${app.data.quantity ? app.data.quantity[i] : '1'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.95rem;">
                            ${Object.entries(app.data).map(([key, val]) => {
            if (['attachments', 'firstParty', 'secondParty', 'quantity'].includes(key)) return '';
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `<p style="margin: 4px 0;"><strong>${displayKey}:</strong> ${val}</p>`;
        }).join('')}
                        </div>
                    ` : `
                        <table style="width: 100%; border-collapse: collapse; font-size: 1rem;">
                            ${Object.entries(app.data).map(([key, val]) => {
            if (key === 'attachments') return '';
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `<tr>
                                    <td style="padding: 10px 0; font-weight: 600; width: 40%; text-transform: capitalize; border-bottom: 1px solid #ddd;">${displayKey}:</td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${val}</td>
                                </tr>`;
        }).join('')}
                        </table>
                    `}
                </div>

                ${app.billAmount ? `
                <div style="border: 1.2px solid #000; padding: 15px; background: #fff; margin-bottom: 15px;">
                    <h3 style="border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 0; margin-bottom: 10px; font-size: 1rem; text-transform: uppercase;">Payment Details</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 1.05rem;">
                        <div><strong>Total Amount:</strong> ₹${app.billAmount}</div>
                        <div><strong>Bill/Txn No:</strong> ${app.billNumber || 'N/A'}</div>
                    </div>
                </div>
                ` : ''}

                <div style="margin-top: auto; padding-top: 20px; display: flex; justify-content: space-between; font-size: 1.05rem;">
                    <div style="text-align: center; width: 230px;">
                        <div style="height: 40px;"></div>
                        <div style="border-top: 2.5px solid #000; padding-top: 8px; font-weight: 800;">Operator Signature</div>
                    </div>
                    <div style="text-align: center; width: 230px;">
                        <div style="height: 40px;"></div>
                        <div style="border-top: 2.5px solid #000; padding-top: 8px; font-weight: 800;">Seal / Official Date</div>
                    </div>
                </div>

                <div style="margin-top: 20px; font-size: 0.8rem; color: #000; text-align: center; border-top: 1.5px dashed #000; padding-top: 10px;">
                    Official Document Generated via Advocate Practice Portal | Ref ID: #${app.id} | Page 1 of 1
                </div>
            </div>
        `;

        printArea.innerHTML = content;

        // Use a small delay to ensure content is settled before printing
        setTimeout(() => {
            window.print();
        }, 200);
    };

    // Search Logic (Debounced)
    let searchTimeout;
    operatorSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            fetchAllApplications();
        }, 300); // 300ms debounce
    });

    fetchAllApplications();
});
