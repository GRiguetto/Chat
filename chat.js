document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000');

    // Elementos do DOM
    const messageList = document.querySelector('.message-list');
    const usernameDisplay = document.getElementById('username-display');
    const contactList = document.querySelector('.contact-list');
    const chatHeaderName = document.querySelector('.chat-header h2');
    const chatHeaderImg = document.querySelector('.chat-header img');
    
    // Elementos do Formulário
    const messageForm = document.getElementById('message-form'); // Pegamos o form
    const messageInput = document.getElementById('message-input');

    // Dados do usuário e da conversa atual
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    let currentContact = null;

    if (!loggedInUser) {
        window.location.href = 'index.html';
        return;
    }
    usernameDisplay.textContent = loggedInUser.name;
    document.querySelector('.sidebar-header img').src = `https://ui-avatars.com/api/?name=${loggedInUser.name.charAt(0)}&background=9146FF&color=fff`;

    async function loadContacts() {
        try {
            const response = await fetch('http://localhost:3000/users');
            if (!response.ok) throw new Error('Falha ao buscar contatos.');
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
        } catch (error) { console.error(error); }
    }

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
        event.preventDefault(); // <-- A mágica está aqui
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

    // Escutador de evento ÚNICO no formulário
    messageForm.addEventListener('submit', handleSendMessage);

    socket.on('new message', (msg) => {
        if (currentContact && (msg.sender_id === currentContact.id || msg.sender_id === loggedInUser.id)) {
            renderMessage(msg);
        }
    });
    socket.on('chat history', (history) => {
        history.forEach(renderMessage);
    });

    loadContacts();
});