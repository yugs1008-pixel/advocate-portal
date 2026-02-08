const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// === CONFIGURATION ===
const sqlitePath = path.join(__dirname, 'database.sqlite');
const mysqlConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'advocate_db'
};

async function migrate() {
    console.log('🚀 Starting migration from SQLite to MySQL...');

    // 1. Open SQLite
    const sqliteDB = new sqlite3.Database(sqlitePath);
    const getSqliteData = (query) => new Promise((resolve, reject) => {
        sqliteDB.all(query, [], (err, rows) => err ? reject(err) : resolve(rows));
    });

    try {
        // 2. Open MySQL
        const mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('✅ Connected to MySQL.');

        // 3. Migrate Users
        console.log('--- Migrating Users ---');
        const users = await getSqliteData('SELECT * FROM users');
        for (const user of users) {
            await mysqlConn.execute(
                'INSERT INTO users (id, fullName, phoneNumber, email, loginTime) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE fullName=VALUES(fullName)',
                [user.id, user.fullName, user.phoneNumber, user.email, user.loginTime]
            );
        }
        console.log(`✅ Migrated ${users.length} users.`);

        // 4. Migrate Applications
        console.log('--- Migrating Applications ---');
        const apps = await getSqliteData('SELECT * FROM applications');
        for (const app of apps) {
            await mysqlConn.execute(
                'INSERT INTO applications (id, userEmail, type, data, paymentStatus, submissionTime, billAmount, billNumber, billAttachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [app.id, app.userEmail, app.type, app.data, app.paymentStatus, app.submissionTime, app.billAmount, app.billNumber, app.billAttachment]
            );
        }
        console.log(`✅ Migrated ${apps.length} applications.`);

        console.log('\n✨ Migration completed successfully!');
        await mysqlConn.end();
        sqliteDB.close();

    } catch (err) {
        console.error('❌ Migration Error:', err.message);
        console.log('\nMake sure you have created "advocate_db" in MySQL first.');
    }
}

migrate();
