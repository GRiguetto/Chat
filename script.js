document.addEventListener('DOMContentLoaded', () =>{

    const loginForm = document.getElementById('login-form');
    const registerform = document.getElementById ('register-form');
    const showRegisterLink= document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');

    showRegisterLink.addEventListener('click', (event) =>{
        event.preventDefault();

        loginForm.style.display = 'none';

        registerform.style.display= 'block';
    })

    showLoginLink.addEventListener('click', (event)=>{
        event.preventDefault();

        loginForm.style.display= 'block';

        registerform.style.display='none';

    })

    registerform.addEventListener('submit', async (event) =>{

        event.preventDefault();


        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        const userData = {name, email, password};

        try{

            const response = await fetch ('http://localhost:3000/register',{
                method: 'POST',
                headers:{
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            console.log('Resposta do servidor', result);
            alert(result.message);

        }catch (error){
            console.error('Erro ao enviar formulario', error);
            alert('Ocorreu um erro ao tentar se cadastrar.');
        }
    });
})