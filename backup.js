const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// === CONFIGURATION ===
const dbConfig = {
    user: 'postgres',
    database: 'advocate_db',
    password: '1008', // Matches your server.js password
    host: 'localhost',
    port: 5432
};

const backupDir = path.join(__dirname, 'backups');

async function runBackup() {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.sql`;
    const filePath = path.join(backupDir, fileName);

    console.log(`🚀 Starting backup: ${fileName}...`);

    // In Cloud environments like Render, we skip local pg_dump
    if (process.env.DATABASE_URL) {
        console.log('ℹ️ Cloud environment detected. Skipping local backup. (Use Render Managed Backups)');
        return;
    }

    const env = { ...process.env, PGPASSWORD: dbConfig.password };

    // Command: Use platform-aware path
    const pgDumpPath = process.platform === 'win32'
        ? '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"'
        : 'pg_dump';

    const cmd = `${pgDumpPath} -U ${dbConfig.user} -h ${dbConfig.host} -p ${dbConfig.port} ${dbConfig.database} > "${filePath}"`;

    exec(cmd, { env }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Backup failed: ${error.message}`);
            return;
        }
        if (stderr && !stderr.includes('done')) {
            console.warn(`⚠️ Backup Warning: ${stderr}`);
        }
        console.log(`✅ Backup saved successfully to: ${filePath}`);

        // Optional: Keep only last 30 backups to save space
        cleanOldBackups();
    });
}

function cleanOldBackups() {
    const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    if (files.length > 365) {
        files.slice(365).forEach(f => {
            fs.unlinkSync(path.join(backupDir, f.name));
            console.log(`🗑️ Deleted old backup: ${f.name}`);
        });
    }
}

// Export for use in server.js or run directly
if (require.main === module) {
    runBackup();
} else {
    module.exports = { runBackup };
}
