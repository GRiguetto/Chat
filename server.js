const express = require('express');

const app = express();

const PORT = 3000;

app.use(express.json());

app.get('/',(req, res) =>{
    res.send('Olá do nosso backend!')
});

app.post('/register',(req, res) =>{
    const userData = req.body;

    console.log('Dados recebidos do formulario de cadastro', userData)

    res.json({message:'Dados recebidos com sucesso!'});
})

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});