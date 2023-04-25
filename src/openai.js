const { Router } = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const slack = require('./slack');
const yup = require('yup');
const { splitJsonArray, dataToResponse, buildPrompt } = require("./utils");
const { Queue } = require('async-await-queue');

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

const parallelQueries = 1;
const myq = new Queue(parallelQueries, 100);

openaiRouter.post("/chat/completions", jsonParser, async (req, res) => {
    try {
        if (req.token !== config.API_KEY) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { messages, stream } = req.body;
        if (!messages || !(await messageArraySchema.isValid(messages))) {
            res.status(400).json({ error: "Bad request" });
            return;
        }

        const id = `chatcmpl-${(Math.random().toString(36).slice(2))}`;
        const created = Math.floor(Date.now() / 1000);

        const messagesSplit = splitJsonArray(messages, 12000);

        if (stream) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            });
        }

        const generateResponse = (content) => {
            return {
                id, created,
                object: 'chat.completion',
                model: spoofModelName,
                choices: [{
                    message: {
                        role: 'assistant',
                        content,
                    },
                    finish_reason: 'stop',
                    index: 0,
                }]
            };
        }

        const promptTokens = Math.ceil(buildPrompt(messages).length / 4);
        let completionTokens = 0;

        let lastContent = '';
        const onData = (newContent) => {
            if (stream) {
                const data = newContent.slice(lastContent.length);
                lastContent = newContent;
                completionTokens = Math.ceil(newContent.length / 4);
                const chunk = dataToResponse(data, promptTokens, completionTokens, stream);
                res.write('event: data\n');
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
        };

        const result = await myq.run(() => slack.waitForWebSocketResponse(messagesSplit, onData));

        if (stream) {
            res.write('event: data\n');
            res.write(
                `data: ${JSON.stringify(
                    dataToResponse(
                        undefined,
                        promptTokens,
                        completionTokens,
                        stream,
                        'stop'
                    )
                )}\n\n`
            );
            res.write('event: data\n');
            res.write('data: [DONE]\n\n');
        } else {
            res.json(generateResponse(result));
        }
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