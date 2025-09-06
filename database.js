const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "chat.db";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, 
            email TEXT NOT NULL UNIQUE, 
            password TEXT  NOT NULL, 
            profile_picture TEXT DEFAULT 'https://ui-avatars.com/api/?name=EU&background=8A2BE2&color=fff',
            profile_banner TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            message_text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )`);

        // --- NOVA TABELA PARA AMIZADES ---
        db.run(`CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_id INTEGER,
            user2_id INTEGER,
            status TEXT, -- pode ser 'pending' ou 'accepted'
            action_user_id INTEGER, -- quem enviou o pedido
            FOREIGN KEY(user1_id) REFERENCES users(id),
            FOREIGN KEY(user2_id) REFERENCES users(id),
            FOREIGN KEY(action_user_id) REFERENCES users(id),
            UNIQUE(user1_id, user2_id)
        )`);
    }
});

module.exports = db;