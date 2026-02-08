// Restore script to import backup JSON into PostgreSQL database
// Usage: node restore_backup.js backup/applications_backup_2026-02-09.json

const fs = require('fs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function restoreBackup(backupFilePath) {
    try {
        console.log('📂 Reading backup file:', backupFilePath);
        const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

        console.log('📊 Found', backupData.length, 'applications to restore');

        let successCount = 0;
        let errorCount = 0;

        for (const app of backupData) {
            try {
                // Insert application into database
                const query = `
                    INSERT INTO applications 
                    (id, "userEmail", type, data, "paymentStatus", "submissionTime", 
                     "billAmount", "billNumber", "billOn", "billAttachment", "payment_status")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        "userEmail" = EXCLUDED."userEmail",
                        type = EXCLUDED.type,
                        data = EXCLUDED.data,
                        "paymentStatus" = EXCLUDED."paymentStatus",
                        "submissionTime" = EXCLUDED."submissionTime",
                        "billAmount" = EXCLUDED."billAmount",
                        "billNumber" = EXCLUDED."billNumber",
                        "billOn" = EXCLUDED."billOn",
                        "billAttachment" = EXCLUDED."billAttachment",
                        "payment_status" = EXCLUDED."payment_status"
                `;

                await pool.query(query, [
                    app.id,
                    app.userEmail,
                    app.type,
                    app.data,
                    app.paymentStatus || 'Pending',
                    app.submissionTime,
                    app.billAmount,
                    app.billNumber,
                    app.billOn,
                    app.billAttachment,
                    app.payment_status || 'Unpaid'
                ]);

                successCount++;
                if (successCount % 100 === 0) {
                    console.log(`✅ Restored ${successCount} applications...`);
                }
            } catch (err) {
                errorCount++;
                console.error(`❌ Error restoring application ${app.id}:`, err.message);
            }
        }

        console.log('\n📊 Restore Complete!');
        console.log(`✅ Successfully restored: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📈 Total: ${backupData.length}`);

        await pool.end();

    } catch (err) {
        console.error('❌ Restore failed:', err);
        process.exit(1);
    }
}

// Get backup file from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
    console.error('❌ Usage: node restore_backup.js <backup-file-path>');
    console.error('Example: node restore_backup.js backup/applications_backup_2026-02-09.json');
    process.exit(1);
}

if (!fs.existsSync(backupFile)) {
    console.error('❌ Backup file not found:', backupFile);
    process.exit(1);
}

restoreBackup(backupFile);
