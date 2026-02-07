const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration...');

db.serialize(() => {
    db.run(`ALTER TABLE applications ADD COLUMN billAmount TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding billAmount:', err.message);
        } else if (!err) {
            console.log('Added billAmount');
        } else {
            console.log('billAmount already exists');
        }
    });

    db.run(`ALTER TABLE applications ADD COLUMN billNumber TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding billNumber:', err.message);
        } else if (!err) {
            console.log('Added billNumber');
        } else {
            console.log('billNumber already exists');
        }
    });

    db.run(`ALTER TABLE applications ADD COLUMN billAttachment TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding billAttachment:', err.message);
        } else if (!err) {
            console.log('Added billAttachment');
        } else {
            console.log('billAttachment already exists');
        }
    });
});

db.close(() => {
    console.log('Migration finished.');
});
