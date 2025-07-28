document.addEventListener('DOMContentLoaded', ()=>{
    const socket = io('http://localhost:3000');

    const messageInput = document.getElementById('message-input');
    const sendIcon = document.getElementById('send-icon');
    const messageList = document.querySelector('.message-list');
    const usernameDisplay =document.getElementById('username-display');

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    if (!loggedInUser){
        alert('Você precisa estar logado para acessar o chat.');
        window.location.href='index.html';
        return;
    }

    usernameDisplay.textContent = loggedInUser.name;

    function sendMessage(){
        const messageText=messageInput.ariaValueMax.trim();

        if (messageText){
            const messageData={
                text: messageText,
                sender: {
                    id: loggedInUser.id,
                    name: loggedInUser.name
                }
            };

            socket.emit('chat message', messageData);

            messageInput.vallue = '';
            messageInput.focus();
        }
    }

    sendIcon.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (event)=>{
        if(event.key == 'Enter'){
            sendMessage();
        }
    });

    socket.on('chat message', (msg)=>{
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        if(msg.sender.id === loggedInUser.id){
            messageElement.classList.add('sent');
        }else{
            messageElement.classList.add('received');
        }

        const senderName=msg.sender.id !== loggedInUser.id !== loggedInUser.id ? `<strong>${msg.sender.name}</strong>` : '';

        messageElement.innerHTML = `
            ${senderName}
            <p>${msg.text}</p>
            <span>${new Date().toLocaleTimeString([],{hour: '2-digit', minute: '2-digit'})}</span>
        `;

        messageList.appendChild(messageElement);

        messageList.scrollTop=messageList.scrollHeight;
    })
})