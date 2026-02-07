const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// === CLOUD-READY DATABASE CONFIGURATION ===
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for most cloud DBs like Render/Heroku
    })
    : new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'advocate_db',
        password: '1008',
        port: 5432,
    });

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
    let client;
    try {
        // In Cloud/Production, the database is pre-created or managed by the provider.
        // We connect directly using the pool.
        client = await pool.connect();
        console.log('✅ Connected to PostgreSQL database.');

        // Initialize Tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                "fullName" TEXT,
                "phoneNumber" TEXT,
                email VARCHAR(255) UNIQUE,
                "loginTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
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

        // Add indexes if they don't exist
        await client.query('CREATE INDEX IF NOT EXISTS idx_user_email ON applications("userEmail")');
        await client.query('CREATE INDEX IF NOT EXISTS idx_submission_time ON applications("submissionTime")');

        console.log('✅ Database tables initialized.');
    } catch (err) {
        console.error('❌ Database Initialization Error:', err.message);
        fs.writeFileSync("db_error.log", err.stack);
    } finally {
        if (client) client.release();
    }
}

initDB();

// API Routes
app.post('/api/login', async (req, res) => {
    const { fullName, phoneNumber, email } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            const insertResult = await pool.query(
                'INSERT INTO users ("fullName", "phoneNumber", email) VALUES ($1, $2, $3) RETURNING *',
                [fullName, phoneNumber, email]
            );
            res.status(200).json(insertResult.rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/submit-form', upload.array('attachments'), async (req, res) => {
    const { userEmail, type, data } = req.body;
    let applicationData = JSON.parse(data);

    if (req.files && req.files.length > 0) {
        applicationData.attachments = req.files.map(file => ({
            name: file.originalname,
            path: '/uploads/' + file.filename
        }));
    }

    try {
        const result = await pool.query(
            'INSERT INTO applications ("userEmail", type, data, "paymentStatus") VALUES ($1, $2, $3, $4) RETURNING id',
            [userEmail, type, applicationData, 'Pending']
        );
        res.status(200).json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/applications', async (req, res) => {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });

    try {
        const result = await pool.query(
            'SELECT * FROM applications WHERE "userEmail" = $1 ORDER BY "submissionTime" DESC',
            [userEmail]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cancel-application', async (req, res) => {
    const { applicationId, userEmail } = req.body;

    try {
        const result = await pool.query(
            'SELECT "paymentStatus" FROM applications WHERE id = $1 AND "userEmail" = $2',
            [applicationId, userEmail]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });
        if (result.rows[0].paymentStatus === 'Completed') return res.status(403).json({ error: 'Cannot cancel a completed application' });

        await pool.query('UPDATE applications SET "paymentStatus" = $1 WHERE id = $2', ['Cancelled', applicationId]);
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
        let dataQuery = 'SELECT * FROM applications';
        let params = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = ` WHERE "userEmail" ILIKE $1 OR "type" ILIKE $1 OR CAST(data AS TEXT) ILIKE $1`;
            countQuery += searchClause;
            dataQuery += searchClause;
            params.push(`%${search}%`);
            paramIndex++;
        }

        dataQuery += ` ORDER BY "submissionTime" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const dataParams = [...params, limit, offset];

        const countResult = await pool.query(countQuery, params);
        const dataResult = await pool.query(dataQuery, dataParams);

        res.status(200).json({
            applications: dataResult.rows,
            totalCount: parseInt(countResult.rows[0].total),
            currentPage: page,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operator/update-status', async (req, res) => {
    const { applicationId, status } = req.body;
    try {
        await pool.query('UPDATE applications SET "paymentStatus" = $1 WHERE id = $2', [status, applicationId]);
        res.status(200).json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operator/update-billing', upload.single('billAttachment'), async (req, res) => {
    const { applicationId, billAmount, billNumber } = req.body;
    let billAttachmentPath = req.file ? '/uploads/' + req.file.filename : null;

    try {
        let query = 'UPDATE applications SET "billAmount" = $1, "billNumber" = $2';
        let params = [billAmount, billNumber];

        if (billAttachmentPath) {
            query += ', "billAttachment" = $3';
            params.push(billAttachmentPath);
        }

        query += ` WHERE id = $${params.length + 1}`;
        params.push(applicationId);

        await pool.query(query, params);
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
