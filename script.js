document.addEventListener('DOMContentLoaded', () => {
    // Session Check
    const user = JSON.parse(localStorage.getItem('advocate_user'));
    if (!user && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    // Display User info in Header if exists
    if (user) {
        const nav = document.querySelector('nav ul');
        const userLi = document.createElement('li');
        userLi.innerHTML = `<span style="color: var(--accent-gold); font-weight: 600; font-size: 0.9rem;">Welcome, ${user.fullName}</span>`;
        nav.appendChild(userLi);

        const logoutLi = document.createElement('li');
        logoutLi.innerHTML = `<a href="#" id="logoutBtn" style="color: #ff4d4d; font-size: 0.8rem;">Logout</a>`;
        nav.appendChild(logoutLi);

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('advocate_user');
            window.location.href = 'login.html';
        });
    }

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            let targetId;
            if (target === 'standard') targetId = 'estampForm';
            else if (target === 'bulk') targetId = 'bulkForm';
            else targetId = 'notaryForm';
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Submissions Handler Factory
    const handleFormSubmission = (formId, type) => {
        const form = document.getElementById(formId);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Collect Form Data
            const formData = new FormData(form);
            const dataObj = {};

            // Filter out files from data object part
            for (let [key, value] of formData.entries()) {
                if (!(value instanceof File)) {
                    // Handle array inputs (e.g., firstParty[], secondParty[])
                    if (key.endsWith('[]')) {
                        const cleanKey = key.slice(0, -2);
                        if (!dataObj[cleanKey]) dataObj[cleanKey] = [];
                        dataObj[cleanKey].push(value);
                    } else {
                        dataObj[key] = value;
                    }
                }
            }

            // Prepare for Multipart Submission
            const submissionFormData = new FormData();
            submissionFormData.append('userEmail', user.email);
            submissionFormData.append('type', type);
            submissionFormData.append('data', JSON.stringify(dataObj));

            // Add files
            const files = form.querySelector('input[type="file"]').files;
            for (let i = 0; i < files.length; i++) {
                submissionFormData.append('attachments', files[i]);
            }

            try {
                const response = await fetch('/api/submit-form', {
                    method: 'POST',
                    body: submissionFormData // Browser sets correct boundary for FormData
                });

                if (response.ok) {
                    console.log(`${type} Submission Successful`);
                    showSuccessMessage(type);
                } else {
                    alert('Submission failed. Please try again.');
                }
            } catch (err) {
                console.error('Submission Error:', err);
                alert('Network error. Check if server is running.');
            }
        });
    };

    handleFormSubmission('estampForm', 'Standard E-Stamp');
    handleFormSubmission('bulkForm', 'Bulk Order');
    handleFormSubmission('notaryForm', 'Notary / True Copy');

    // Dynamic Bulk Fields
    const addStampBtn = document.getElementById('addStampBtn');
    if (addStampBtn) {
        addStampBtn.addEventListener('click', () => {
            const container = document.getElementById('additionalParties');
            const partyPair = document.createElement('div');
            partyPair.className = 'full-width';
            partyPair.style = 'display: grid; grid-template-columns: 1fr 1fr 0.5fr; gap: 20px; margin-top: 10px; position: relative;';

            partyPair.innerHTML = `
                <div class="form-group">
                    <label>First Party Name</label>
                    <input type="text" name="firstParty[]" maxlength="50" placeholder="Full Legal Name">
                </div>
                <div class="form-group">
                    <label>Second Party Name</label>
                    <input type="text" name="secondParty[]" maxlength="50" placeholder="Full Legal Name">
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" name="quantity[]" min="1" value="1">
                </div>
                <button type="button" class="remove-btn" style="position: absolute; right: -10px; top: 0; background: #fee2e2; color: #ef4444; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;" onclick="this.parentElement.remove()">×</button>
            `;
            container.appendChild(partyPair);
        });
    }

    // ... (rest of the file)

    function showSuccessMessage(type) {
        const activeForm = document.querySelector('.tab-content.active');
        activeForm.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3.5rem; margin-bottom: 1rem;">⚖️</div>
                <h3 style="font-size: 1.8rem; color: var(--primary-color); margin-bottom: 1rem;">${type} Received</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Your request has been logged. Our chamber will process the details and contact you for further execution.</p>
                <button onclick="location.reload()" class="btn primary">New Application</button>
            </div>
        `;
    }

    // Modal Logic
    const appsModal = document.getElementById('appsModal');
    const myAppsLink = document.getElementById('myAppsLink');
    const closeBtn = document.querySelector('.close-modal');
    const appsList = document.getElementById('appsList');

    if (myAppsLink) {
        myAppsLink.addEventListener('click', (e) => {
            e.preventDefault();
            appsModal.style.display = 'block';
            fetchUserApplications();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            appsModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target == appsModal) {
            appsModal.style.display = 'none';
        }
    });

    let userApplications = []; // Global within DOMContentLoaded

    async function fetchUserApplications() {
        appsList.innerHTML = '<div class="loading-spinner">Fetching your legal applications...</div>';

        try {
            const response = await fetch(`/api/applications?userEmail=${user.email}`);
            if (response.ok) {
                userApplications = await response.json();
                renderApplications(userApplications);
            } else {
                appsList.innerHTML = `<div class="no-apps">Failed to load applications (Error ${response.status}).</div>`;
            }
        } catch (err) {
            console.error('Fetch Error:', err);
            appsList.innerHTML = `
                <div class="no-apps" style="color: #e74c3c;">
                    <div class="empty-icon">⚠️</div>
                    <h3>Server Connection Lost</h3>
                    <p>Could not sync your applications. Please ensure you are accessing the site via 
                       <a href="http://localhost:3000" style="color: var(--primary-color); text-decoration: underline; font-weight: 700;">http://localhost:3000</a>
                    </p>
                </div>`;
        }
    }

    function renderApplications(apps) {
        if (apps.length === 0) {
            appsList.innerHTML = `
                <div class="no-apps">
                    <div class="empty-icon">📂</div>
                    <h3>No Applications Yet</h3>
                    <p>You haven't submitted any legal applications yet. Start by filling out an e-stamp or notary form.</p>
                </div>
            `;
            return;
        }

        appsList.innerHTML = apps.map(app => {
            const date = new Date(app.submissionTime).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusClass = app.paymentStatus.toLowerCase() === 'completed' ? 'status-completed' :
                (app.paymentStatus.toLowerCase() === 'cancelled' ? 'status-cancelled' : 'status-pending');

            // Handle real attachments from data
            let attachmentHTML = '';
            if (app.data.attachments && app.data.attachments.length > 0) {
                const firstImg = app.data.attachments.find(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.path));
                const thumbSrc = firstImg ? firstImg.path : 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80';

                attachmentHTML = `
                    <img src="${thumbSrc}" alt="Attachment Preview" class="app-thumbnail">
                    <div class="attachment-links" style="margin-bottom: 1rem; font-size: 0.8rem;">
                        <strong>📎 Attachments:</strong><br>
                        ${app.data.attachments.map(a => `<a href="${a.path}" target="_blank" style="color: blue; text-decoration: underline; margin-right: 0.5rem;">${a.name}</a>`).join(' ')}
                    </div>
                `;
            } else {
                attachmentHTML = `<img src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80" alt="Legal Doc" class="app-thumbnail">`;
            }

            return `
                <div class="app-card">
                    <span class="status-badge ${statusClass}">${app.paymentStatus}</span>
                    ${attachmentHTML}
                    <div class="app-type">${app.type}</div>
                    <div class="app-date">📅 Submitted on ${date}</div>
                    
                    <div class="app-info-item">
                        <span class="app-info-label">Bill On:</span>
                        <span>${app.data.billOn || 'N/A'}</span>
                    </div>
                    <div class="app-info-item">
                        <span class="app-info-label">Contact:</span>
                        <span>${app.data.contactPerson || 'N/A'}</span>
                    </div>
                    
                    <div style="margin-top: 1rem; padding: 0.8rem; background: #f8fafc; border-radius: 6px; font-size: 0.85rem;">
                        <strong>Details:</strong><br>
                        ${renderAppData(app.data)}
                    </div>

                    ${app.billAmount ? `
                    <div style="margin-top: 1rem; padding: 0.8rem; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; font-size: 0.85rem;">
                        <strong style="color: #047857;">Billing Information:</strong><br>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                            <span>Bill #: <strong>${app.billNumber}</strong></span>
                            <span>Amount: <strong>₹${app.billAmount}</strong></span>
                        </div>
                        ${app.billAttachment ? `<a href="${app.billAttachment}" target="_blank" style="display: block; margin-top: 8px; color: #059669; font-weight: 600; text-decoration: underline;">📄 View Bill Copy</a>` : ''}
                    </div>
                    ` : ''}

                    <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
                        <button class="view-btn" style="flex: 2; padding: 10px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600;" onclick="openFullFormView(${app.id})">View Full Form</button>
                        ${app.paymentStatus !== 'Completed' && app.paymentStatus !== 'Cancelled' ? `
                            <button class="cancel-btn" onclick="cancelApplication(${app.id})" style="flex: 1; padding: 10px; background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Cancel</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderAppData(data) {
        let details = '';
        const formatValue = (val) => Array.isArray(val) ? val.join(', ') : val;

        if (data.firstParty) details += `First Party: ${formatValue(data.firstParty)}<br>`;
        if (data.secondParty) details += `Second Party: ${formatValue(data.secondParty)}<br>`;
        if (data.docDescription) details += `Doc: ${data.docDescription}<br>`;
        if (data.stampAmount) details += `Amount: ₹${data.stampAmount}<br>`;
        return details || 'Standard application details';
    }

    window.openFullFormView = (id) => {
        const app = userApplications.find(a => a.id === id);
        if (!app) return;

        const content = document.getElementById('fullFormContent');
        const date = new Date(app.submissionTime).toLocaleString('en-IN');

        let html = `
            <div style="border: 2px solid var(--primary-color); padding: 30px; border-radius: 8px; background: white;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-color); margin-bottom: 25px; padding-bottom: 15px;">
                    <h2 style="margin: 0; color: var(--primary-color);">ADVOCATE CHAMBER</h2>
                    <p style="margin: 5px 0; font-size: 0.9rem;">Official Application Summary</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 0.95rem;">
                    <div><strong>Reference ID:</strong> #${app.id}</div>
                    <div style="text-align: right;"><strong>Date:</strong> ${date}</div>
                    <div><strong>Service Type:</strong> ${app.type}</div>
                    <div style="text-align: right;"><strong>Status:</strong> <span style="padding: 2px 8px; border-radius: 4px; background: #eee;">${app.paymentStatus}</span></div>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 6px;">
                    <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px; font-size: 1.1rem;">Filled Specifications</h3>
                    
                    ${Array.isArray(app.data.firstParty) ? `
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: #e2e8f0; text-align: left;">
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">First Party</th>
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Second Party</th>
                                    <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${app.data.firstParty.map((fp, i) => `
                                    <tr>
                                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${fp || '-'}</td>
                                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${app.data.secondParty[i] || '-'}</td>
                                        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${app.data.quantity ? app.data.quantity[i] : 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div style="margin-top: 15px;">
                            ${Object.entries(app.data).map(([key, val]) => {
            if (['attachments', 'firstParty', 'secondParty', 'quantity'].includes(key)) return '';
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return `<p style="margin: 5px 0;"><strong>${displayKey}:</strong> ${val}</p>`;
        }).join('')}
                        </div>
                    ` : `
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            ${Object.entries(app.data).map(([key, val]) => {
            if (key === 'attachments') return '';
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const displayVal = Array.isArray(val) ? `<ul style="margin: 0; padding-left: 15px;">${val.map(v => `<li>${v}</li>`).join('')}</ul>` : val;
            return `
                                    <tr>
                                        <td style="padding: 10px 0; font-weight: 600; width: 40%; color: #475569;">${displayKey}:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${displayVal || 'N/A'}</td>
                                    </tr>
                                `;
        }).join('')}
                        </table>
                    `}
                </div>

                ${app.data.attachments && app.data.attachments.length > 0 ? `
                <div style="margin-top: 25px;">
                    <h3 style="font-size: 1.1rem; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Attachments</h3>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                        ${app.data.attachments.map(a => `<a href="${a.path}" target="_blank" style="padding: 8px 12px; background: #e2e8f0; color: #1e293b; text-decoration: none; border-radius: 4px; font-size: 0.85rem;">📄 ${a.name}</a>`).join('')}
                    </div>
                </div>
                ` : ''}

                <div style="margin-top: 30px; font-size: 0.8rem; color: #94a3b8; text-align: center;">
                    This application was electronically submitted through the Advocate Practice Portal.
                </div>
            </div>
        `;

        content.innerHTML = html;
        document.getElementById('fullFormModal').style.display = 'block';
    };

    window.cancelApplication = async (id) => {
        if (!confirm('Are you sure you want to cancel this application? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/cancel-application', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId: id, userEmail: user.email })
            });

            if (response.ok) {
                fetchUserApplications(); // Refresh list
            } else {
                const err = await response.json();
                alert('Failed to cancel: ' + (err.error || 'Server error'));
            }
        } catch (err) {
            console.error('Cancel Error:', err);
            alert('Network error while cancelling.');
        }
    };

    // Smooth scroll for navigation
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                document.querySelector(targetId).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
