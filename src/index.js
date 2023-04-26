require('dotenv').config();

const express = require('express');
const bearerToken = require('express-bearer-token');
const openai = require('./openai');
const { stats } = require('./utils');
const config = require('./config.json');

const app = express();
const port = 7860;
const started = new Date();

app.get('/', (req, res) => {
    res.json({
        uptime: (new Date() - started) / 1000,
        slacks: config.slacks.length || 0,
        prompts: stats.prompts.length || 0,
        avgTime: stats.prompts.reduce((acc, curr) => acc + curr.time, 0) / stats.prompts.length || 0,
        avgInputLength: stats.prompts.reduce((acc, curr) => acc + curr.inputLength, 0) / stats.prompts.length || 0,
        avgOutputLength: stats.prompts.reduce((acc, curr) => acc + curr.outputLength, 0) / stats.prompts.length || 0,
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
