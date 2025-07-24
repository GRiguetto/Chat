const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Olá do nosso backend!');
});

app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ "error": "Erro ao processar a senha." });
        }
        
        const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        const params = [name, email, hashedPassword];

        db.run(sql, params, function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ "error": "Este email já está cadastrado." });
                }
                return res.status(400).json({ "error": err.message });
            }
            
            res.json({
                "message": "Usuário cadastrado com sucesso!",
                "data": { id: this.lastID, name, email }
            });
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    
    db.get(sql, [email], (err, user) => {
        if (err) {
            return res.status(500).json({ "error": "Erro interno do servidor." });
        }
        if (!user) {
            return res.status(400).json({ "error": "Email ou senha inválidos." });
        }

        bcrypt.compare(password, user.password, (err, passwordsMatch) => {
            if (err) {
                return res.status(500).json({ "error": "Erro ao verificar a senha." });
            }

           if (passwordsMatch) {
                res.json({
                    "message": "Login bem-sucedido!",
                    "user": {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            } else {
                res.status(400).json({ "error": "Email ou senha inválidos." });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});