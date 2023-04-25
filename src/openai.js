const { Router } = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const slack = require('./slack');
const yup = require('yup');
const { splitJsonArray } = require("./utils");

const messageArraySchema = yup.array().of(
    yup.object().shape({
        role: yup.string().required(),
        content: yup.string().required(),
    })
);

const jsonParser = bodyParser.json();

const spoofModelName = 'gpt-4';

const openaiRouter = Router();
openaiRouter.get("/models", (req, res) => {
    res.json([
        {
            id: spoofModelName,
            object: spoofModelName,
            owned_by: 'user',
            permission: [],
        }
    ]);
});

openaiRouter.post("/chat/completions", jsonParser, async (req, res) => {
    try {
        if (req.token !== config.API_KEY) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { messages } = req.body;
        if (!messages || !(await messageArraySchema.isValid(messages))) {
            res.status(400).json({ error: "Bad request" });
            return;
        }

        const id = `chatcmpl-${(Math.random().toString(36).slice(2))}`;
        const created = Math.floor(Date.now() / 1000);

        const messagesSplit = splitJsonArray(messages, 12000);

        const result = await slack.waitForWebSocketResponse(messagesSplit);

        res.json({
            id, created,
            object: 'chat.completion',
            model: spoofModelName,
            choices: [{
                message: {
                    role: 'assistant',
                    content: result.trimStart(),
                },
                finish_reason: 'stop',
                index: 0,
            }]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// If a browser tries to visit a route that doesn't exist, redirect to the info
// page to help them find the right URL.
openaiRouter.get("*", (req, res, next) => {
    const isBrowser = req.headers["user-agent"]?.includes("Mozilla");
    if (isBrowser) {
        res.redirect("/");
    } else {
        next();
    }
});
openaiRouter.use((req, res) => {
    //logger.warn(`Blocked openai proxy request: ${req.method} ${req.path}`);
    res.status(404).json({ error: "Not found" });
});

module.exports = openaiRouter;