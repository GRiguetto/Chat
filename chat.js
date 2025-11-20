document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticação e Configuração Inicial ---
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    const { user, token } = userData;
    const userId = user.id;

    // CORREÇÃO: Aponta para o IP do seu servidor, não localhost
    const API_URL = 'http://102.37.16.141:3000';
    const socket = io(API_URL);

    let currentContactId = null;

    // --- Elementos do DOM ---
    const usernameDisplay = document.getElementById('username-display');
    const userProfilePic = document.getElementById('user-profile-pic');
    const contactList = document.getElementById('contact-list');
    const messageList = document.getElementById('message-list');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messageInputArea = document.getElementById('message-input-area');
    
    // Header do Chat
    const chatHeaderProfile = document.getElementById('chat-header-profile');
    const chatWithUsername = document.getElementById('chat-with-username');
    const noChatSelected = document.getElementById('no-chat-selected');

    // Botões
    const logoutBtn = document.getElementById('logout-btn');
    const addContactBtn = document.getElementById('add-contact-btn');
    const notificationsBtn = document.getElementById('notifications-btn');

    // Modal
    const addContactModal = document.getElementById('add-contact-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const searchContactInput = document.getElementById('search-contact-input');
    const searchResultsList = document.getElementById('search-results-list');

    // Notificações
    const notificationsDropdown = document.getElementById('notifications-dropdown');
    const notificationBadge = document.getElementById('notification-badge');

    // --- Configuração da UI ---
    usernameDisplay.textContent = user.name;
    if (user.profile_picture) {
        userProfilePic.src = user.profile_picture.startsWith('http') ? user.profile_picture : `${API_URL}${user.profile_picture}`;
    }

    // --- Lógica de Logout ---
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    });

    // --- Lógica do Socket.io ---
    socket.emit('register_online', userId);

    socket.on('chat history', (messages) => {
        messageList.innerHTML = ''; // Limpa mensagens anteriores
        messages.forEach(msg => displayMessage(msg.sender_id, msg.message_text));
        scrollToBottom();
    });

    // CORREÇÃO: Lógica de 'nova mensagem'
    socket.on('new message', (message) => {
        // Apenas exibe a mensagem se ela for do contato com quem estou falando AGORA.
        // A minha própria mensagem já é exibida localmente (ver 'Envio de Mensagem').
        if (message.sender_id === currentContactId) {
            displayMessage(message.sender_id, message.message_text);
            scrollToBottom();
        } else {
            // Futuramente: adicionar notificação se a mensagem for de *outro* contato.
        }
    });

    socket.on('new_friend_request', () => {
        fetchFriendRequests(); // Atualiza as notificações
    });
    
    socket.on('request_accepted', () => {
        fetchContacts(); // Atualiza a lista de contatos
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        
        if (messageText && currentContactId) {
            displayMessage(userId, messageText); 
            scrollToBottom(); // Rola para o final

            socket.emit('private message', {
                senderId: userId,
                receiverId: currentContactId,
                messageText: messageText
            });
            
            messageInput.value = '';
        }
    });

    // --- Carregamento de Contatos ---
    async function fetchContacts() {
        try {
            const response = await fetch(`${API_URL}/contacts?userId=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` } // Assumindo que você usará token no futuro
            });
            if (!response.ok) throw new Error('Falha ao buscar contatos');
            
            const data = await response.json();
            contactList.innerHTML = ''; // Limpa lista antiga
            
            data.users.forEach(contact => {
                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                contactItem.dataset.contactId = contact.id;
                contactItem.dataset.contactName = contact.name;
                
                // Adiciona foto de perfil padrão
                const contactImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random&color=fff`;

                contactItem.innerHTML = `
                    <img src="${contactImg}" alt="Perfil de ${contact.name}">
                    <div class="contact-info">
                        <h3>${contact.name}</h3>
                        <p>Clique para conversar</p>
                    </div>
                `;
                contactList.appendChild(contactItem);
            });
        } catch (error) {
            console.error('Erro ao buscar contatos:', error);
        }
    }

    // --- Lógica de Seleção de Chat ---
    contactList.addEventListener('click', (e) => {
        const contactItem = e.target.closest('.contact-item');
        if (contactItem) {
            // Remove a classe 'active' de todos
            document.querySelectorAll('.contact-item.active').forEach(item => {
                item.classList.remove('active');
            });
            // Adiciona 'active' ao clicado
            contactItem.classList.add('active');

            currentContactId = parseInt(contactItem.dataset.contactId);
            const contactName = contactItem.dataset.contactName;

            // Atualiza o header do chat
            chatWithUsername.textContent = contactName;
            chatHeaderProfile.querySelector('img').src = contactItem.querySelector('img').src;
            chatHeaderProfile.style.display = 'flex';
            noChatSelected.style.display = 'none';
            messageInputArea.style.display = 'flex';
            
            // Entra na sala do Socket
            socket.emit('join room', { userId, contactId: currentContactId });
        }
    });

    // --- Exibição de Mensagens ---
    function displayMessage(senderId, messageText) {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        
        // Define se a mensagem é 'sent' (enviada por mim) ou 'received' (recebida)
        const messageType = (senderId === userId) ? 'sent' : 'received';
        messageItem.classList.add(messageType);
        
        messageItem.innerHTML = `
            <div class="message-content">
                ${messageText}
            </div>
        `;
        messageList.appendChild(messageItem);
    }

    function scrollToBottom() {
        messageList.scrollTop = messageList.scrollHeight;
    }

    // --- Lógica do Modal (Adicionar Contato) ---
    addContactBtn.addEventListener('click', () => {
        addContactModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        addContactModal.style.display = 'none';
    });
    
    // Fecha o modal se clicar fora do conteúdo
    window.addEventListener('click', (e) => {
        if (e.target === addContactModal) {
            addContactModal.style.display = 'none';
        }
    });

    // --- Lógica de Busca de Contatos ---
    let searchTimeout;
    searchContactInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const searchTerm = searchContactInput.value.trim();
        
        if (searchTerm.length < 2) {
            searchResultsList.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${API_URL}/users/search?term=${searchTerm}&userId=${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Falha na busca');
                
                const data = await response.json();
                displaySearchResults(data.users);
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
                searchResultsList.innerHTML = '<p>Erro ao buscar.</p>';
            }
        }, 300); // Debounce de 300ms
    });

    function displaySearchResults(users) {
        searchResultsList.innerHTML = '';
        if (users.length === 0) {
            searchResultsList.innerHTML = '<p>Nenhum usuário encontrado.</p>';
            return;
        }
        
        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <span>${user.name} (${user.email})</span>
                <button class="add-btn" data-id="${user.id}">Adicionar</button>
            `;
            searchResultsList.appendChild(item);
        });
    }

    // Event listener para o botão "Adicionar" nos resultados da busca
    searchResultsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-btn')) {
            const receiverId = e.target.dataset.id;
            sendFriendRequest(userId, receiverId);
            e.target.textContent = 'Enviado!';
            e.target.disabled = true;
        }
    });

    async function sendFriendRequest(senderId, receiverId) {
        try {
            await fetch(`${API_URL}/friend-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId, receiverId })
            });
            // Opcional: mostrar uma mensagem de sucesso
        } catch (error) {
            console.error('Erro ao enviar pedido de amizade:', error);
        }
    }

    // --- Lógica de Notificações (Pedidos de Amizade) ---
    notificationsBtn.addEventListener('click', () => {
        const isDisplayed = notificationsDropdown.style.display === 'block';
        notificationsDropdown.style.display = isDisplayed ? 'none' : 'block';
        if (!isDisplayed) {
            fetchFriendRequests(); // Busca ao abrir
        }
    });

    async function fetchFriendRequests() {
        try {
            const response = await fetch(`${API_URL}/friend-requests/pending?userId=${userId}`);
            if (!response.ok) throw new Error('Falha ao buscar pedidos');
            
            const data = await response.json();
            updateNotificationsDropdown(data.requests);
            
            // Atualiza o contador (badge)
            if (data.requests.length > 0) {
                notificationBadge.textContent = data.requests.length;
                notificationBadge.style.display = 'block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao buscar pedidos de amizade:', error);
        }
    }

    function updateNotificationsDropdown(requests) {
        notificationsDropdown.innerHTML = '';
        if (requests.length === 0) {
            notificationsDropdown.innerHTML = '<div class="notification-item"><p>Nenhum pedido pendente.</p></div>';
            return;
        }
        
        requests.forEach(req => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <p><b>${req.name}</b> quer ser seu amigo.</p>
                <button class="accept-btn" data-id="${req.id}">Aceitar</button>
                <button class="decline-btn" data-id="${req.id}">Recusar</button>
            `;
            notificationsDropdown.appendChild(item);
        });
    }

    // Event listener para Aceitar/Recusar pedidos
    notificationsDropdown.addEventListener('click', (e) => {
        const target = e.target;
        const requestId = target.dataset.id;
        
        if (!requestId) return;

        if (target.classList.contains('accept-btn')) {
            handleFriendRequest(requestId, 'accept');
        } else if (target.classList.contains('decline-btn')) {
            handleFriendRequest(requestId, 'decline');
        }
    });

    async function handleFriendRequest(requestId, action) {
        try {
            await fetch(`${API_URL}/friend-request/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, userId })
            });
            
            fetchFriendRequests(); // Recarrega os pedidos
            if (action === 'accept') {
                fetchContacts(); // Recarrega a lista de amigos
            }
        } catch (error) {
            console.error('Erro ao responder pedido:', error);
        }
    }

    // --- Carregamento Inicial ---
    fetchContacts();
    fetchFriendRequests(); // Busca inicial para o badge
    
    
    // Pega os elementos do menu que adicionamos no chat.html
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // Função para abrir/fechar o menu
    const toggleSidebar = () => {
        sidebar.classList.toggle('active'); // Adiciona/remove a classe .active
        
        // Mostra ou esconde o overlay
        if (sidebar.classList.contains('active')) {
            sidebarOverlay.style.display = 'block';
        } else {
            sidebarOverlay.style.display = 'none';
        }
    };

    // Adiciona o evento de clique no botão de menu (hambúrguer)
    menuToggle.addEventListener('click', toggleSidebar);

    // Adiciona o evento de clique no overlay (para fechar o menu)
    sidebarOverlay.addEventListener('click', toggleSidebar);

    /* Adiciona um evento para fechar o menu se o usuário clicar em um contato.
       Isso melhora a UX no celular.
    */
    contactList.addEventListener('click', (event) => {
        // Verifica se o clique foi em um item de contato e se o menu está ativo
        if (event.target.closest('.contact-item') && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

});