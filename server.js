const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');
const db = require('./database.js');
const path = require('path'); // <-- Adicione esta linha

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;
app.use(cors());
app.use(express.json());

// --- ESTA É A ADIÇÃO MAIS IMPORTANTE ---
// Serve os arquivos estáticos (HTML, CSS, JS do cliente) da pasta atual
app.use(express.static(path.join(__dirname, '')));
// -----------------------------------------

// Suas rotas de API continuam exatamente as mesmas
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) { return res.status(500).json({ "error": "Erro ao processar a senha." }); }
        const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        const params = [name, email, hashedPassword];
        db.run(sql, params, function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) { return res.status(400).json({ "error": "Este email já está cadastrado." }); }
                return res.status(400).json({ "error": err.message });
            }
            res.json({ "message": "Usuário cadastrado com sucesso!", "data": { id: this.lastID, name, email } });
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], (err, user) => {
        if (err || !user) { return res.status(400).json({ "error": "Email ou senha inválidos." }); }
        bcrypt.compare(password, user.password, (err, passwordsMatch) => {
            if (passwordsMatch) {
                res.json({ "message": "Login bem-sucedido!", "user": { id: user.id, name: user.name, email: user.email } });
            } else {
                res.status(400).json({ "error": "Email ou senha inválidos." });
            }
        });
    });
});

app.get('/users', (req, res) => {
    const sql = "SELECT id, name FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": "Erro ao buscar usuários." });
        }
        res.json({ users: rows });
    });
});


// Sua lógica do Socket.IO continua exatamente a mesma
io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    socket.on('join room', ({ userId, contactId }) => {
        const roomName = [userId, contactId].sort().join('-');
        socket.join(roomName);
        console.log(`Usuário ${socket.id} entrou na sala: ${roomName}`);
        
        const sql = `
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC
        `;
        db.all(sql, [userId, contactId, contactId, userId], (err, rows) => {
            if (!err) {
                socket.emit('chat history', rows);
            }
        });
    });

    socket.on('private message', ({ senderId, receiverId, messageText }) => {
        const roomName = [senderId, receiverId].sort().join('-');
        
        const sql = 'INSERT INTO messages (sender_id, receiver_id, message_text) VALUES (?, ?, ?)';
        db.run(sql, [senderId, receiverId, messageText], function(err) {
            if (!err) {
                const newMessage = {
                    id: this.lastID,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    message_text: messageText,
                    timestamp: new Date().toISOString()
                };
                io.to(roomName).emit('new message', newMessage);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Um usuário se desconectou:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando e ouvindo na porta ${PORT}`);
    console.log(`Acesse o chat em http://localhost:${PORT}`); // <-- Instrução
}); 