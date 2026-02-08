const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const DATABASE_URL = process.argv[2];
const BACKUP_FILE = path.join(__dirname, 'backups', 'backup_2026-02-08T08-11-36-225Z.sql');

// Full path found in your backup.js
const PSQL_PATH = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';

if (!DATABASE_URL) {
    console.error('❌ Error: Please provide your Render External Database URL.');
    console.log('Usage: node migrate.js "postgresql://user:pass@host/db"');
    process.exit(1);
}

if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Error: Backup file not found at ${BACKUP_FILE}`);
    process.exit(1);
}

async function migrate() {
    console.log('🚀 Starting migration using psql.exe...');

    // Command using the -f flag which works better with PowerShell/CMD
    const cmd = `${PSQL_PATH} -f "${BACKUP_FILE}" "${DATABASE_URL}"`;

    console.log('⚡ Executing migration...');

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Migration failed: ${error.message}`);
            console.log('\n💡 TIP: If psql.exe path is different on your machine, please edit migrate.js line 9.');
            return;
        }
        if (stderr) {
            // psql often outputs warnings to stderr, we'll show them but not fail
            console.warn(`⚠️ psql Output: ${stderr}`);
        }
        if (stdout) console.log(stdout);

        console.log('🎉 Migration completed! Your data should now be on Render.');
    });
}

migrate();
