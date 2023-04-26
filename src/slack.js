const { v4: uuidv4 } = require('uuid');

const https = require('https');
const WebSocket = require('ws');

const { readBody, genHeaders, createBaseForm, convertToUnixTime, currentTime, buildPrompt } = require('./utils');

async function sendPromptMessage(config, prompt) {
    const form = createBaseForm(config);
    const headers = genHeaders(config);

    form.append('ts', convertToUnixTime(new Date()));
    form.append('type', 'message');
    form.append('xArgs', '{}');
    form.append('unfurl', '[]');
    form.append('blocks', JSON.stringify([{ "type": "rich_text", "elements": [{ "type": "rich_text_section", "elements": [{ "type": "text", "text": `${prompt}` }] }] }]));
    form.append('include_channel_perm_error', 'true');
    form.append('client_msg_id', uuidv4());
    form.append('_x_reason', 'webapp_message_send');

    const options = {
        method: 'POST',
        headers: {
            ...headers,
            ...form.getHeaders(),
        },
    };

    const req = https.request(`https://${config.teamId}.slack.com/api/chat.postMessage`, options, async (res) => {
        try {
            const response = await readBody(res, true);
            console.log(response);
        } catch (error) {
            console.error(error);
        }
    });

    req.on('error', (error) => {
        console.error(error);
    });

    form.pipe(req);
}

async function sendChatReset(config) {
    const form = createBaseForm(config);
    const headers = genHeaders(config);

    form.append('command', '/reset');
    form.append('disp', '/reset');
    form.append('client_token', `${new Date().getTime()}`);
    form.append('_x_reason', 'executeCommand');

    const options = {
        method: 'POST',
        headers: {
            ...headers,
            ...form.getHeaders(),
        },
    };

    const req = https.request(`https://${config.teamId}.slack.com/api/chat.command`, options, async (res) => {
        try {
            const response = await readBody(res, true);
            console.log(response);
        } catch (error) {
            console.error(error);
        }
    });

    req.on('error', (error) => {
        console.error(error);
    });

    form.pipe(req);
}

async function waitForWebSocketResponse(config, messages, onData) {
    const headers = genHeaders(config);

    return new Promise(async (resolve, reject) => {
        const websocketURL = `wss://wss-primary.slack.com/?token=${config.token}`;

        const websocket = new WebSocket(websocketURL, {
            headers: headers,
        });

        const waitForConnection = new Promise((connectionResolve) => {
            websocket.on('open', () => {
                console.log('Connected to WebSocket');
                connectionResolve();
            });
        });

        await waitForConnection;

        let messageIndex = 0;
        const sendNextPrompt = async () => {
            if (messageIndex < messages.length) {
                const prompt = buildPrompt(messages[messageIndex]);
                await sendPromptMessage(config, prompt);
                messageIndex++;
            }
        };

        await sendNextPrompt();

        websocket.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                if (data.subtype === 'message_changed') {
                    if (!data.message.text.endsWith("\n\n_Typing…_")) {
                        if (messageIndex < messages.length) {
                            await sendNextPrompt();
                        } else {
                            websocket.close();
                            resolve(data.message.text);
                        }
                    } else {
                        console.log(`${currentTime()} fetched ${data.message.text.length} characters...`);
                        if (onData) {
                            onData(data.message.text.split('\n\n_Typing…_')[0]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing message:', error);
                reject(error);
            }
        });

        websocket.on('error', (error) => {
            console.error('WebSocket error:', error.toString());
            reject(error);
        });

        websocket.on('close', (code, reason) => {
            console.log(`WebSocket closed with code ${code} and reason: ${reason.toString()}`);
        });
    });
}

function deleteAllMessages(config) {
    const form = createBaseForm(config);
    const headers = genHeaders(config);

    const requestOptions = {
        method: 'POST',
        path: `/api/conversations.history?channel=${config.claudeId}`,
        headers: {
            ...headers,
            ...form.getHeaders(),
        },
    };

    const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            const messages = JSON.parse(data).messages;
            messages.forEach((message) => {
                const deleteOptions = {
                    method: 'POST',
                    path: '/api/chat.delete',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                };
                const deleteReq = https.request(deleteOptions, (deleteRes) => { });
                deleteReq.write(JSON.stringify({ channel: channelId, ts: message.ts }));
                deleteReq.end();
            });
        });
    });

    req.end();
}


module.exports = {
    sendPromptMessage,
    sendChatReset,
    waitForWebSocketResponse,
    deleteAllMessages,
};