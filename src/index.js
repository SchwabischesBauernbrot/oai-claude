require('dotenv').config();

const express = require('express');
const bearerToken = require('express-bearer-token');
const openai = require('./openai');

const app = express();
const port = 7860;

app.get('/', (req, res) => {
    res.json({
        prompts: 0,
    });
})

app.use('/v1', bearerToken({
    bodyKey: false,
    queryKey: false,
    headerKey: 'Bearer',
    reqKey: false,
    cookie: false, // by default is disabled
}), openai);

app.listen(port, () => {
    console.log(`Claude proxy listening on http://127.0.0.1:${port}/`);
});
