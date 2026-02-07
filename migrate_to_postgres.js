const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

// === CONFIGURATION ===
const sqlitePath = path.join(__dirname, 'database.sqlite');
const pgConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'advocate_db',
    password: '1008', // Update this!
    port: 5432,
};

async function migrate() {
    console.log('🚀 Starting migration from SQLite to PostgreSQL...');

    // 1. Open SQLite
    const sqliteDB = new sqlite3.Database(sqlitePath);
    const getSqliteData = (query) => new Promise((resolve, reject) => {
        sqliteDB.all(query, [], (err, rows) => err ? reject(err) : resolve(rows));
    });

    const pgSystemClient = new Client({ ...pgConfig, database: 'postgres' });
    const pgClient = new Client(pgConfig);

    try {
        // 1. Create advocate_db if not exists
        await pgSystemClient.connect();
        const dbCheck = await pgSystemClient.query("SELECT 1 FROM pg_database WHERE datname = 'advocate_db'");
        if (dbCheck.rows.length === 0) {
            console.log('✨ advocate_db not found, creating it...');
            await pgSystemClient.query('CREATE DATABASE advocate_db');
        }
        await pgSystemClient.end();

        // 2. Open PostgreSQL connection to advocate_db
        await pgClient.connect();
        console.log('✅ Connected to PostgreSQL.');

        // NEW: Create tables before migration
        console.log('📦 Creating tables in PostgreSQL...');
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                "fullName" TEXT,
                "phoneNumber" TEXT,
                email VARCHAR(255) UNIQUE,
                "loginTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pgClient.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                "userEmail" VARCHAR(255),
                type TEXT,
                data JSONB,
                "paymentStatus" TEXT,
                "submissionTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "billAmount" TEXT,
                "billNumber" TEXT,
                "billAttachment" TEXT
            )
        `);

        // 3. Migrate Users
        console.log('--- Migrating Users ---');
        const users = await getSqliteData('SELECT * FROM users');
        for (const user of users) {
            await pgClient.query(
                'INSERT INTO users (id, "fullName", "phoneNumber", email, "loginTime") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET "fullName"=EXCLUDED."fullName"',
                [user.id, user.fullName, user.phoneNumber, user.email, user.loginTime]
            );
        }
        console.log(`✅ Migrated ${users.length} users.`);

        // 4. Migrate Applications
        console.log('--- Migrating Applications ---');
        const apps = await getSqliteData('SELECT * FROM applications');
        for (const app of apps) {
            await pgClient.query(
                'INSERT INTO applications (id, "userEmail", type, data, "paymentStatus", "submissionTime", "billAmount", "billNumber", "billAttachment") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [app.id, app.userEmail, app.type, app.data, app.paymentStatus, app.submissionTime, app.billAmount, app.billNumber, app.billAttachment]
            );
        }
        console.log(`✅ Migrated ${apps.length} applications.`);

        console.log('\n✨ Migration completed successfully!');
        await pgClient.end();
        sqliteDB.close();

    } catch (err) {
        console.error('❌ Migration Error:', err.message);
        console.log('\nMake sure you have created "advocate_db" in PostgreSQL first.');
        if (pgClient) await pgClient.end().catch(() => { });
    }
}

migrate();
