document.addEventListener('DOMContentLoaded', () => {
    // --- URLs e Elementos ---
    const API_URL = 'http://102.37.16.141:3000'; // SEU IP CORRIGIDO
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');

    // --- Lógica para trocar de formulário ---
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });

    // --- Lógica de Login (Corrigida) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o recarregamento da página
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();

            if (response.ok) {
                // Salva os dados do usuário (incluindo ID e Nome) no localStorage
                localStorage.setItem('userData', JSON.stringify(data)); 
                window.location.href = 'chat.html'; // Redireciona para o chat
            } else {
                alert(data.error || 'Erro ao fazer login.');
            }
        } catch (err) {
            console.error('Erro de rede:', err);
            alert('Erro de conexão com o servidor.');
        }
    });

    // --- LÓGICA DE CADASTRO (Adicionada) ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o recarregamento da página
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Usuário cadastrado com sucesso! Faça o login.');
                // Limpa o formulário de cadastro
                registerForm.reset();
                // Volta para a tela de login
                showLoginLink.click();
            } else {
                alert(data.error || 'Erro ao cadastrar.');
            }
        } catch (err) {
            console.error('Erro de rede:', err);
            alert('Erro de conexão com o servidor.');
        }
    });
});