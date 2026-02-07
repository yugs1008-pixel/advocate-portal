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
    const pageSize = 15;
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
                    <td colspan="6" style="text-align: center; padding: 3rem; color: #e74c3c;">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                        <strong style="display: block; margin-bottom: 0.5rem;">Server is Unreachable (Offline)</strong>
                        Please ensure the server is running and access this dashboard via:<br>
                        <a href="http://localhost:3000/operator.html" style="color: blue; text-decoration: underline; font-weight: 600;">http://localhost:3000/operator.html</a>
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
                    <td><span class="expand-btn" onclick="toggleDetails(${app.id})">Details ➕</span></td>
                </tr>
                <tr id="details-${app.id}" class="detail-row">
                    <td colspan="6">
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

        updatePaginationUI();
    }

    function updatePaginationUI() {
        const startIdx = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const endIdx = Math.min(currentPage * pageSize, totalCount);

        paginationInfo.innerText = `Showing ${startIdx} to ${endIdx} of ${totalCount} applications`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;

        prevPageBtn.style.opacity = prevPageBtn.disabled ? '0.5' : '1';
        nextPageBtn.style.opacity = nextPageBtn.disabled ? '0.5' : '1';
    }

    // Pagination Listeners
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchAllApplications();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchAllApplications();
        }
    });

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

    window.updateBilling = async (id) => {
        const amt = document.getElementById(`billAmt-${id}`).value;
        const num = document.getElementById(`billNum-${id}`).value;
        const fileInput = document.getElementById(`billFile-${id}`);

        const formData = new FormData();
        formData.append('applicationId', id);
        formData.append('billAmount', amt);
        formData.append('billNumber', num);
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

        let content = `
            <div style="font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 40px;">
                <div style="text-align: center; border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 20px;">
                    <h1 style="margin:0; text-transform: uppercase; letter-spacing: 2px;">Advocate Practice</h1>
                    <p style="margin: 5px 0;">Legal Professional & E-Stamp Services</p>
                    <h2 style="margin-top: 20px; background: #333; color: white; display: inline-block; padding: 5px 20px;">APPLICATION FORM #${app.id}</h2>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div><strong>Application Type:</strong> ${app.type}</div>
                    <div style="text-align: right;"><strong>Date:</strong> ${date}</div>
                    <div><strong>User Email:</strong> ${app.userEmail}</div>
                    <div style="text-align: right;"><strong>Status:</strong> ${app.paymentStatus}</div>
                </div>

                <div style="border: 1px solid #ccc; padding: 20px; background: #f9f9f9; margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #333; padding-bottom: 10px; margin-top: 0;">Form Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${Object.entries(app.data).map(([key, val]) => {
            if (key === 'attachments') return '';
            return `<tr>
                                <td style="padding: 8px 0; font-weight: 600; width: 40%; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1')}:</td>
                                <td style="padding: 8px 0;">${val}</td>
                            </tr>`;
        }).join('')}
                    </table>
                </div>

                ${app.billAmount ? `
                <div style="border: 1px solid #ccc; padding: 20px; background: #fff; margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #333; padding-bottom: 10px; margin-top: 0;">Billing Information</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div><strong>Bill Amount:</strong> ₹${app.billAmount}</div>
                        <div><strong>Bill Number:</strong> ${app.billNumber}</div>
                    </div>
                </div>
                ` : ''}

                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="text-align: center; width: 200px; border-top: 1px solid #333; padding-top: 10px;">Operator Signature</div>
                    <div style="text-align: center; width: 200px; border-top: 1px solid #333; padding-top: 10px;">Seal / Date</div>
                </div>

                <div style="margin-top: 40px; font-size: 0.8rem; color: #666; text-align: center;">
                    This is a computer-generated document from the Advocate Practice portal.
                </div>
            </div>
        `;

        printArea.innerHTML = content;
        window.print();
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
