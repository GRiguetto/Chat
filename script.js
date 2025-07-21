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
})