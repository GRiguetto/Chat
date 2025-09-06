const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const bcrypt = require('bcrypt');
const db = require('./database.js');
const path = require('path');
const multer = require('multer');
const path = require('path')

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

// Mapa para associar userId com socket.id para notificações em tempo real
const onlineUsers = new Map();

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Salva os arquivos na pasta 'uploads'
    },
    filename: function (req, file, cb) {
        // Cria um nome de arquivo único para evitar conflitos
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage});

//sirva a pasta uploads como estatica para que o cliente possa acessar as imagens
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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


// --- LÓGICA DE CONTATOS E AMIZADES (NOVO) ---

// 1. Pesquisar novos usuários
app.get('/users/search', (req, res) => {
    const { term, userId } = req.query;
    if (!term) {
        return res.status(400).json({ error: "Termo de pesquisa é obrigatório." });
    }

    const sql = `
        SELECT id, name, email FROM users
        WHERE (name LIKE ? OR email LIKE ?) AND id != ?
          AND id NOT IN (
            SELECT user2_id FROM friendships WHERE user1_id = ?
            UNION
            SELECT user1_id FROM friendships WHERE user2_id = ?
          )
    `;
    const params = [`%${term}%`, `%${term}%`, userId, userId, userId];
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({ users: rows });
    });
});

// 2. Enviar um pedido de amizade
app.post('/friend-request', (req, res) => {
    const { senderId, receiverId } = req.body;
    const [user1_id, user2_id] = [senderId, receiverId].sort((a, b) => a - b);
    const sql = 'INSERT INTO friendships (user1_id, user2_id, status, action_user_id) VALUES (?, ?, ?, ?)';
    
    db.run(sql, [user1_id, user2_id, 'pending', senderId], function(err) {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        const receiverSocketId = onlineUsers.get(parseInt(receiverId));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_friend_request');
        }
        res.json({ message: "Pedido de amizade enviado!", id: this.lastID });
    });
});

// 3. Listar pedidos de amizade pendentes
app.get('/friend-requests/pending', (req, res) => {
    const userId = req.query.userId;
    const sql = `
        SELECT f.id, u.id as user_id, u.name 
        FROM friendships f 
        JOIN users u ON u.id = f.action_user_id 
        WHERE (f.user1_id = ? OR f.user2_id = ?) 
          AND f.status = 'pending' 
          AND f.action_user_id != ?
    `;
    db.all(sql, [userId, userId, userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({ requests: rows });
    });
});

// 4. Aceitar ou recusar um pedido
app.put('/friend-request/:id', (req, res) => {
    const { action, userId } = req.body;
    const friendshipId = req.params.id;

    if (action === 'accept') {
        const sql = "UPDATE friendships SET status = 'accepted', action_user_id = ? WHERE id = ?";
        db.run(sql, [userId, friendshipId], function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            notifyRequestAccepted(friendshipId, userId);
            res.json({ message: "Amizade aceita!" });
        });
    } else if (action === 'decline') {
        const sql = "DELETE FROM friendships WHERE id = ?";
        db.run(sql, [friendshipId], function(err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ message: "Pedido recusado." });
        });
    } else {
        res.status(400).json({ error: "Ação inválida." });
    }
});

function notifyRequestAccepted(friendshipId, acceptorId) {
    db.get('SELECT user1_id, user2_id FROM friendships WHERE id = ?', [friendshipId], (err, row) => {
        if (row) {
            const otherUserId = row.user1_id == acceptorId ? row.user2_id : row.user1_id;
            const otherUserSocketId = onlineUsers.get(otherUserId);
            if (otherUserSocketId) {
                io.to(otherUserSocketId).emit('request_accepted');
            }
        }
    });
}

// 5. Listar contatos (amigos aceitos) - Substitui a antiga rota /users
app.get('/contacts', (req, res) => {
    const userId = req.query.userId;
    const sql = `
        SELECT u.id, u.name FROM users u
        JOIN (
            SELECT 
                CASE
                    WHEN user1_id = ? THEN user2_id
                    ELSE user1_id
                END as friend_id
            FROM friendships
            WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'
        ) f ON u.id = f.friend_id
    `;
    db.all(sql, [userId, userId, userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ "error": "Erro ao buscar contatos." });
        }
        res.json({ users: rows });
    });
});


// --- LÓGICA DO SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('register_online', (userId) => {
        onlineUsers.set(userId, socket.id);
        console.log(`Usuário ${userId} ficou online com o socket ${socket.id}`);
    });

    socket.on('join room', ({ userId, contactId }) => {
        const roomName = [userId, contactId].sort().join('-');
        socket.join(roomName);
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

    socket.emit('login_success', { 
        token, 
        user: { 
            id: user.id, 
            name: user.name, 
            email: user.email,
            profile_picture: user.profile_picture,
            profile_banner: user.profile_banner
        } 
    });


    // Adicione esta nova rota DEPOIS das suas rotas de login/registro
    app.post('/api/user/update', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), (req, res) => {
        const { name, email } = req.body;
        const userId = req.user.id; // Supondo que você tenha um middleware de autenticação que adiciona o usuário ao req

        if (!userId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        let updateFields = [];
        let params = [];

        if (name) {
            updateFields.push('name = ?');
            params.push(name);
        }
        if (email) {
            updateFields.push('email = ?');
            params.push(email);
        }
        if (req.files['avatar']) {
            const avatarPath = '/uploads/' + req.files['avatar'][0].filename;
            updateFields.push('profile_picture = ?');
            params.push(avatarPath);
        }
        if (req.files['banner']) {
            const bannerPath = '/uploads/' + req.files['banner'][0].filename;
            updateFields.push('profile_banner = ?');
            params.push(bannerPath);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'Nenhum dado para atualizar' });
        }

        const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(userId);

        db.run(sql, params, function(err) {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar o perfil', error: err.message });
            }
            // Pega os dados atualizados do usuário para retornar
            db.get('SELECT id, name, email, profile_picture, profile_banner FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    return res.status(500).json({ message: 'Erro ao buscar dados atualizados.' });
                }
                res.json({ message: 'Perfil atualizado com sucesso!', user });

                // Notifica todos os clientes sobre a atualização
                io.emit('user_updated', { userId: user.id, name: user.name, profile_picture: user.profile_picture });
            });
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
        for (let [userId, id] of onlineUsers.entries()) {
            if (id === socket.id) {
                onlineUsers.delete(userId);
                console.log(`Usuário ${userId} ficou offline.`);
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando e ouvindo na porta ${PORT}`);
    console.log(`Acesse o chat em http://localhost:${PORT}`);
});