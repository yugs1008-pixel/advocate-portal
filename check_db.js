const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(applications)", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Columns in applications table:');
    rows.forEach(row => {
        console.log(`- ${row.name} (${row.type})`);
    });
    db.close();
});
