const { Pool } = require('pg');

// Use default PG config matching server.js
const pgPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'advocate_db',
    password: '1008',
    port: 5432
});

(async () => {
    try {
        console.log('Connecting to PostgreSQL...');
        const res = await pgPool.query('SELECT id, "userEmail", "submissionTime", "paymentStatus" FROM applications ORDER BY "submissionTime" DESC LIMIT 5');
        console.log('Recent Applications:', res.rows);
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pgPool.end();
    }
})();
