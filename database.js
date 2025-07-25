const sqlite3 = require('sqlite3').verbose();

const db =new sqlite3.Database('./chat.db', (err) =>{
    if (err){
        console.error(err.message);
        throw err;
    } else{
        console.log('Conectando ao banco de dados SQLite.');
        db.serialize(() =>{
            db.run(`CREATE TABLE IF NOT EXISTS users(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
                )`, (err) =>{
                    if(err){
                        console.error("Erro ao criar a tabela 'users'", err.message);
                    }else{
                        console.log("Tabela 'users' pronta para uso.")
                    }
                });
        });
    }
});

module.exports = db;