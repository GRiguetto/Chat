document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000');

    // Elementos do DOM
    const messageList = document.querySelector('.message-list');
    const contactList = document.querySelector('.contact-list');
    const chatHeaderName = document.querySelector('.chat-header h2');
    const chatHeaderImg = document.querySelector('.chat-header img');
    const usernameDisplay = document.getElementById('username-display');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');

    // Novos Elementos
    const addContactBtn = document.getElementById('add-contact-btn');
    const addContactModal = document.getElementById('add-contact-modal');
    const closeModalBtn = document.querySelector('.modal .close-btn');
    const searchInput = document.getElementById('search-contact-input');
    const searchResultsList = document.getElementById('search-results-list');
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationsDropdown = document.getElementById('notifications-dropdown');

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    let currentContact = null;

    if (!loggedInUser) {
        window.location.href = 'index.html';
        return;
    }

    usernameDisplay.textContent = loggedInUser.name;
    document.querySelector('.sidebar-header img').src = `https://ui-avatars.com/api/?name=${loggedInUser.name.charAt(0)}&background=9146FF&color=fff`;
    socket.emit('register_online', loggedInUser.id);

    // --- CARREGAR DADOS INICIAIS ---
    async function loadContacts() {
        try {
            const response = await fetch(`http://localhost:3000/contacts?userId=${loggedInUser.id}`);
            const { users } = await response.json();
            contactList.innerHTML = '';
            users.forEach(user => {
                if (user.id !== loggedInUser.id) {
                    const contactElement = document.createElement('div');
                    contactElement.classList.add('contact-item');
                    contactElement.dataset.userId = user.id;
                    contactElement.dataset.userName = user.name;
                    contactElement.innerHTML = `
                        <img src="https://ui-avatars.com/api/?name=${user.name.replace(/\s/g, '+')}&background=random&color=fff" alt="${user.name}">
                        <div class="contact-info">
                            <h3>${user.name}</h3>
                        </div>
                    `;
                    contactList.appendChild(contactElement);
                }
            });
        } catch (error) { console.error('Erro ao carregar contatos:', error); }
    }

    async function loadPendingRequests() {
        try {
            const response = await fetch(`http://localhost:3000/friend-requests/pending?userId=${loggedInUser.id}`);
            const { requests } = await response.json();

            notificationsDropdown.innerHTML = '';
            if (requests.length > 0) {
                notificationBadge.textContent = requests.length;
                notificationBadge.style.display = 'block';
                requests.forEach(req => {
                    const item = document.createElement('div');
                    item.classList.add('notification-item');
                    item.innerHTML = `
                        <span><b>${req.name}</b> quer te adicionar.</span>
                        <div class="notification-actions">
                            <button class="accept-btn" data-id="${req.id}">Aceitar</button>
                            <button class="decline-btn" data-id="${req.id}">Recusar</button>
                        </div>
                    `;
                    notificationsDropdown.appendChild(item);
                });
            } else {
                notificationBadge.style.display = 'none';
                notificationsDropdown.innerHTML = '<p style="padding: 10px; text-align: center; color: #adadb8;">Nenhuma nova notificação.</p>';
            }
        } catch (error) { console.error('Erro ao carregar pedidos de amizade:', error); }
    }

    // --- LÓGICA DO MODAL DE ADICIONAR CONTATO ---
    addContactBtn.addEventListener('click', () => addContactModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => addContactModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == addContactModal) {
            addContactModal.style.display = 'none';
        }
    });

    searchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value;
        if (searchTerm.length < 2) {
            searchResultsList.innerHTML = '';
            return;
        }

        const response = await fetch(`http://localhost:3000/users/search?term=${searchTerm}&userId=${loggedInUser.id}`);
        const { users } = await response.json();
        
        searchResultsList.innerHTML = '';
        users.forEach(user => {
            const item = document.createElement('div');
            item.classList.add('search-result-item');
            item.innerHTML = `
                <span>${user.name} (${user.email})</span>
                <button class="add-friend-btn" data-id="${user.id}">Adicionar</button>
            `;
            searchResultsList.appendChild(item);
        });
    });

    searchResultsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('add-friend-btn')) {
            const receiverId = e.target.dataset.id;
            e.target.disabled = true;
            try {
                const response = await fetch('http://localhost:3000/friend-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderId: loggedInUser.id, receiverId: parseInt(receiverId) })
                });
                if (response.ok) {
                    e.target.textContent = 'Enviado';
                } else {
                    e.target.disabled = false;
                }
            } catch (error) { 
                console.error(error); 
                e.target.disabled = false;
            }
        }
    });

    // --- LÓGICA DAS NOTIFICAÇÕES ---
    notificationsBtn.addEventListener('click', () => {
        const isDisplayed = notificationsDropdown.style.display === 'block';
        notificationsDropdown.style.display = isDisplayed ? 'none' : 'block';
        if (!isDisplayed) {
            loadPendingRequests();
        }
    });

    notificationsDropdown.addEventListener('click', async (e) => {
        const requestId = e.target.dataset.id;
        let action = '';
        if (e.target.classList.contains('accept-btn')) action = 'accept';
        if (e.target.classList.contains('decline-btn')) action = 'decline';
        
        if (action && requestId) {
            try {
                await fetch(`http://localhost:3000/friend-request/${requestId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: action, userId: loggedInUser.id })
                });
                
                loadPendingRequests();
                if(action === 'accept') loadContacts();
            } catch (error) { console.error(error); }
        }
    });

    // --- LÓGICA DO CHAT (EXISTENTE) ---
    contactList.addEventListener('click', (event) => {
        const contactItem = event.target.closest('.contact-item');
        if (contactItem) {
            document.querySelectorAll('.contact-item.active').forEach(item => item.classList.remove('active'));
            contactItem.classList.add('active');
            currentContact = {
                id: parseInt(contactItem.dataset.userId),
                name: contactItem.dataset.userName
            };
            chatHeaderName.textContent = currentContact.name;
            chatHeaderImg.src = `https://ui-avatars.com/api/?name=${currentContact.name.replace(/\s/g, '+')}&background=3a3a3d&color=fff`;
            messageList.innerHTML = '';
            socket.emit('join room', { userId: loggedInUser.id, contactId: currentContact.id });
        }
    });

    function renderMessage(msg) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(msg.sender_id === loggedInUser.id ? 'sent' : 'received');
        messageElement.innerHTML = `<p>${msg.message_text}</p><span>${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
        messageList.appendChild(messageElement);
        messageList.scrollTop = messageList.scrollHeight;
    }

    function handleSendMessage(event) {
        event.preventDefault();
        const messageText = messageInput.value.trim();
        if (messageText && currentContact) {
            socket.emit('private message', {
                senderId: loggedInUser.id,
                receiverId: currentContact.id,
                messageText: messageText
            });
            messageInput.value = '';
            messageInput.focus();
        }
    }
    messageForm.addEventListener('submit', handleSendMessage);

    // --- EVENTOS DE SOCKET.IO ---
    socket.on('new_friend_request', () => {
        loadPendingRequests();
    });

    socket.on('request_accepted', () => {
        alert('Seu pedido de amizade foi aceito!');
        loadContacts();
    });

    socket.on('new message', (msg) => {
        if (currentContact && (msg.sender_id === currentContact.id || msg.sender_id === loggedInUser.id)) {
            renderMessage(msg);
        }
    });
    
    socket.on('chat history', (history) => {
        history.forEach(renderMessage);
    });

    // --- CARGA INICIAL ---
    loadContacts();
    loadPendingRequests();
});