const express = require('express');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// === DATABASE CONFIGURATION ===
let dbMode = 'pg';
let pgPool;
let sqliteDb;

// PostgreSQL Setup
const pgConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { user: 'postgres', host: 'localhost', database: 'advocate_db', password: '1008', port: 5432 };

pgPool = new Pool(pgConfig);

// SQLite Setup (Fallback)
const sqlitePath = path.join(__dirname, 'database.sqlite');

/**
 * Unified Query Wrapper
 * Handles differences between PostgreSQL ($1) and SQLite (?) placeholders
 */
async function dbQuery(text, params = []) {
    if (dbMode === 'pg') {
        return await pgPool.query(text, params);
    } else {
        // Convert $1, $2... to ? for SQLite
        const sqliteQuery = text.replace(/\$\d+/g, '?');
        return new Promise((resolve, reject) => {
            if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
                sqliteDb.all(sqliteQuery, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                // For INSERT/UPDATE/DELETE
                sqliteDb.run(sqliteQuery, params, function (err) {
                    if (err) reject(err);
                    else {
                        // Mimic pg's return structure for RETURNING id
                        const result = { rows: [], rowCount: this.changes };
                        if (sqliteQuery.toUpperCase().includes('INSERT') && this.lastID) {
                            result.rows = [{ id: this.lastID }];
                        }
                        resolve(result);
                    }
                });
            }
        });
    }
}

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

async function initDB() {
    console.log('🚀 Initializing database connection...');
    try {
        // Try PostgreSQL first
        const client = await pgPool.connect();
        client.release();
        dbMode = 'pg';
        console.log('✅ Connected to PostgreSQL.');
    } catch (err) {
        console.error('⚠️ PostgreSQL connection failed, falling back to SQLite...');
        dbMode = 'sqlite';
        sqliteDb = new sqlite3.Database(sqlitePath);
        console.log('✅ Using SQLite database at:', sqlitePath);
    }

    try {
        // Initialize Tables (Compatible with both)
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                "fullName" TEXT,
                "phoneNumber" TEXT,
                email TEXT UNIQUE,
                "loginTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Note: PostgreSQL SERIAL PRIMARY KEY works, SQLite translates it to INTEGER PRIMARY KEY AUTOINCREMENT internally or handles it.
        // SQLite doesn't support JSONB, but we can store it as TEXT and parse/stringify in API handlers if needed.
        // However, standard JSON functions work in many SQLite environments. For simplicity, we use TEXT/JSONB.
        const applicationsTableQuery = dbMode === 'pg'
            ? `CREATE TABLE IF NOT EXISTS applications (
                id SERIAL PRIMARY KEY,
                "userEmail" VARCHAR(255),
                type TEXT,
                data JSONB,
                "paymentStatus" TEXT,
                "payment_status" TEXT DEFAULT 'Unpaid',
                "submissionTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "billAmount" TEXT,
                "billNumber" TEXT,
                "billAttachment" TEXT,
                "billOn" TEXT
            )`
            : `CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                "userEmail" TEXT,
                type TEXT,
                data TEXT,
                "paymentStatus" TEXT,
                "payment_status" TEXT DEFAULT 'Unpaid',
                "submissionTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "billAmount" TEXT,
                "billNumber" TEXT,
                "billAttachment" TEXT,
                "billOn" TEXT
            )`;

        await dbQuery(applicationsTableQuery);

        // Migration: Add payment_status if it doesn't exist
        try {
            if (dbMode === 'pg') {
                await dbQuery('ALTER TABLE applications ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT \'Unpaid\'');
            } else {
                // SQLite ALTER TABLE ADD COLUMN is safe if column exists? No, needs check.
                // For SQLite, we just rely on the CREATE TABLE IF NOT EXISTS or a manual check
                const cols = await dbQuery("PRAGMA table_info(applications)");
                if (!cols.rows.some(c => c.name === 'payment_status')) {
                    await dbQuery("ALTER TABLE applications ADD COLUMN payment_status TEXT DEFAULT 'Unpaid'");
                }
            }
        } catch (migErr) {
            console.log('Payment status column already exists or migration skipped.');
        }

        // Add indexes
        if (dbMode === 'pg') {
            await dbQuery('CREATE INDEX IF NOT EXISTS idx_user_email ON applications("userEmail")');
            await dbQuery('CREATE INDEX IF NOT EXISTS idx_submission_time ON applications("submissionTime")');
        } else {
            await dbQuery('CREATE INDEX IF NOT EXISTS idx_user_email ON applications("userEmail")');
            await dbQuery('CREATE INDEX IF NOT EXISTS idx_submission_time ON applications("submissionTime")');
        }

        // Migration: Add billOn if it doesn't exist
        try {
            if (dbMode === 'pg') {
                await dbQuery('ALTER TABLE applications ADD COLUMN IF NOT EXISTS "billOn" TEXT');
            } else {
                const cols = await dbQuery("PRAGMA table_info(applications)");
                if (!cols.rows.some(c => c.name === 'billOn')) {
                    await dbQuery("ALTER TABLE applications ADD COLUMN billOn TEXT");
                }
            }
        } catch (migErr) {
            console.log('billOn column migration skipped.');
        }

        console.log(`✅ Database tables verified/created successfully in ${dbMode} mode.`);
    } catch (err) {
        console.error('❌ CRITICAL: Database Initialization Failed!');
        console.error('Error:', err.message);

        try {
            fs.writeFileSync("db_error.log", `[${new Date().toISOString()}] ${err.stack}`);
        } catch (fsErr) { }
    }
}

initDB();

// Health Check for Auto-Redirect
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));

// 1x1 Transparent PNG for robust client-side pings from file://
app.get('/ping.png', (req, res) => {
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pixel.length });
    res.end(pixel);
});

// API Routes
app.post('/api/login', async (req, res) => {
    const { fullName, phoneNumber, email } = req.body;

    try {
        const result = await dbQuery('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            const insertResult = await dbQuery(
                'INSERT INTO users ("fullName", "phoneNumber", email) VALUES ($1, $2, $3)',
                [fullName, phoneNumber, email]
            );
            // After insert, fetch or return simulated
            res.status(200).json({ fullName, phoneNumber, email });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/submit-form', upload.array('attachments'), async (req, res) => {
    const { userEmail, type, data } = req.body;
    let applicationData = JSON.parse(data);
    const billOn = applicationData.billOn || null;

    if (req.files && req.files.length > 0) {
        applicationData.attachments = req.files.map(file => ({
            name: file.originalname,
            path: '/uploads/' + file.filename
        }));
    }

    try {
        const dataToSave = dbMode === 'sqlite' ? JSON.stringify(applicationData) : applicationData;

        const result = await dbQuery(
            'INSERT INTO applications ("userEmail", type, data, "paymentStatus", "payment_status", "billOn") VALUES ($1, $2, $3, $4, $5, $6)',
            [userEmail, type, dataToSave, 'Pending', 'Unpaid', billOn]
        );
        res.status(200).json({ id: result.rows[0] ? result.rows[0].id : null });
    } catch (err) {
        console.error('Submission Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/applications', async (req, res) => {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });

    try {
        const result = await dbQuery(
            'SELECT * FROM applications WHERE "userEmail" = $1 ORDER BY "submissionTime" DESC',
            [userEmail]
        );

        // SQLite parsing for JSON column
        const processedRows = result.rows.map(row => {
            if (dbMode === 'sqlite' && typeof row.data === 'string') {
                try { row.data = JSON.parse(row.data); } catch (e) { }
            }
            return row;
        });

        res.status(200).json(processedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cancel-application', async (req, res) => {
    const { applicationId, userEmail } = req.body;

    try {
        const result = await dbQuery(
            'SELECT "paymentStatus" FROM applications WHERE id = $1 AND "userEmail" = $2',
            [applicationId, userEmail]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });
        if (result.rows[0].paymentStatus === 'Completed') return res.status(403).json({ error: 'Cannot cancel a completed application' });

        await dbQuery('UPDATE applications SET "paymentStatus" = $1 WHERE id = $2', ['Cancelled', applicationId]);
        res.status(200).json({ message: 'Application cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Operator API Routes
app.get('/api/operator/applications', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    const offset = (page - 1) * limit;

    try {
        let countQuery = 'SELECT COUNT(*) as total FROM applications';
        let dataQuery = `
            SELECT a.*, u."fullName", u."phoneNumber" 
            FROM applications a 
            LEFT JOIN users u ON a."userEmail" = u.email
        `;
        let params = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = dbMode === 'pg'
                ? ` WHERE a."userEmail" ILIKE $1 OR a."type" ILIKE $1 OR CAST(a.data AS TEXT) ILIKE $1`
                : ` WHERE a."userEmail" LIKE $1 OR a."type" LIKE $1 OR a.data LIKE $1`; // SQLite ILIKE is not default
            countQuery += searchClause;
            dataQuery += searchClause;
            params.push(`%${search}%`);
            paramIndex++;
        }

        dataQuery += dbMode === 'pg'
            ? ` ORDER BY "submissionTime" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
            : ` ORDER BY "submissionTime" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

        const dataParams = [...params, limit, offset];

        const countResult = await dbQuery(countQuery, params);
        const dataResult = await dbQuery(dataQuery, dataParams);

        // SQLite parsing for JSON column
        const processedApps = dataResult.rows.map(row => {
            if (dbMode === 'sqlite' && typeof row.data === 'string') {
                try { row.data = JSON.parse(row.data); } catch (e) { }
            }
            return row;
        });

        res.status(200).json({
            applications: processedApps,
            totalCount: parseInt(dbMode === 'pg' ? countResult.rows[0].total : countResult.rows[0]['COUNT(*)']),
            currentPage: page,
            totalPages: Math.ceil(parseInt(dbMode === 'pg' ? countResult.rows[0].total : countResult.rows[0]['COUNT(*)']) / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operator/update-status', async (req, res) => {
    const { applicationId, status } = req.body;
    try {
        await dbQuery('UPDATE applications SET "paymentStatus" = $1 WHERE id = $2', [status, applicationId]);
        res.status(200).json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operator/update-payment-status', async (req, res) => {
    const { applicationId, payment_status } = req.body;
    try {
        await dbQuery('UPDATE applications SET "payment_status" = $1 WHERE id = $2', [payment_status, applicationId]);
        res.status(200).json({ message: 'Payment status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operator/update-billing', upload.single('billAttachment'), async (req, res) => {
    const { applicationId, billAmount, billNumber, billOn } = req.body;
    let billAttachmentPath = req.file ? '/uploads/' + req.file.filename : null;

    try {
        let query = 'UPDATE applications SET "billAmount" = $1, "billNumber" = $2, "billOn" = $3';
        let params = [billAmount, billNumber, billOn];

        if (billAttachmentPath) {
            query += ', "billAttachment" = $4';
            params.push(billAttachmentPath);
        }

        query += ` WHERE id = $${params.length + 1}`;
        params.push(applicationId);

        await dbQuery(query, params);
        res.status(200).json({ message: 'Billing updated successfully', billAttachment: billAttachmentPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { runBackup } = require('./backup');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);

    // Perform backup on startup and then every 24 hours
    runBackup();
    setInterval(runBackup, 24 * 60 * 60 * 1000);
});
