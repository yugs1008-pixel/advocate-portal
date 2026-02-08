// Quick diagnostic script to check bill attachments
const https = require('https');

// Get all applications and check bill attachments
https.get('https://advocate-portal.onrender.com/api/applications', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const apps = JSON.parse(data);
            console.log('Total applications:', apps.length);

            const withBills = apps.filter(a => a.billAttachment);
            console.log('Applications with bills:', withBills.length);

            if (withBills.length > 0) {
                console.log('\nBill URLs:');
                withBills.forEach((app, i) => {
                    console.log(`${i + 1}. App ID ${app.id}:`);
                    console.log(`   URL: ${app.billAttachment}`);
                    console.log(`   User: ${app.userEmail}`);
                    console.log(`   Type: ${app.billAttachment.startsWith('http') ? 'Cloudinary' : 'Local'}`);
                });
            } else {
                console.log('\nNo bills found in database.');
                console.log('Please upload bills through the operator dashboard.');
            }
        } catch (e) {
            console.log('Error parsing response:', e.message);
            console.log('Response:', data.substring(0, 200));
        }
    });
}).on('error', (e) => {
    console.log('Request error:', e.message);
});
