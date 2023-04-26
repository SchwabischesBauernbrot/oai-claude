const FormData = require('form-data');

const wait = (duration) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
};

function buildPrompt(messages) {
    prompt = "\n\n" + preparePrompt(messages);
    return prompt;
    //do not escape for now
    const escapedPrompt = prompt.replace(/\r?\n|\r/g, '\\n').replace(/"/g, '\\"');
    return escapedPrompt;
};

const readBody = (res, json) => new Promise((resolve, reject) => {
    let buffer = '';

    res.on('data', chunk => {
        buffer += chunk;
    });

    res.on('end', () => {
        try {
            if (json) buffer = JSON.parse(buffer);
            resolve(buffer);
        } catch (e) {
            console.error(buffer);
            reject(e);
        }
    });
})

function preparePrompt(messages) {
    return messages.filter(m => m.content?.trim()).map(m => {
        let author = '';
        switch (m.role) {
            case 'user': author = 'Human'; break;
            case 'assistant': author = 'Assistant'; break;
            case 'system': author = 'System Note'; break;
            default: author = m.role; break;
        }

        return `${author}: ${m.content.trim()}`;
    }).join('\n\n');
}

const currentTime = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const genHeaders = (config) => {
    return {
        'Cookie': `d=${config.cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
    }
}

function splitJsonArray(jsonArray, maxLength) {
    let result = [];
    let currentChunk = [];
    let currentLength = 2; // Accounts for the opening and closing square brackets in the JSON array

    const jail = '(OOC: This is just a part of the context, reply only with "OOC: understood")';
    const assistant = "\n\nAssistant: ";

    const addObjectToChunk = (object, chunk) => {
        chunk.push(object);
        return currentLength + JSON.stringify(object).length + 1;
    };

    const appendTextToContent = (object, text) => {
        const newObj = JSON.parse(JSON.stringify(object));
        newObj.content += text;
        return newObj;
    };

    for (const obj of jsonArray) {
        const objLength = JSON.stringify(obj).length + 1;

        if (currentLength + objLength <= maxLength) {
            currentLength = addObjectToChunk(obj, currentChunk);
        } else {
            const lastObjectInChunk = currentChunk[currentChunk.length - 1];
            const lastObjectWithJail = appendTextToContent(lastObjectInChunk, ` ${jail}`);
            const lastObjectWithJailLength = JSON.stringify(lastObjectWithJail).length + 1;

            if (currentLength - JSON.stringify(lastObjectInChunk).length - 1 + lastObjectWithJailLength <= maxLength) {
                currentChunk[currentChunk.length - 1] = lastObjectWithJail;
            }

            result.push(currentChunk);
            currentChunk = [obj];
            currentLength = 2 + objLength;
        }
    }

    if (currentChunk.length > 0) {
        result.push(currentChunk);
    }

    const lastChunk = result[result.length - 1];
    const lastObjectInLastChunk = lastChunk[lastChunk.length - 1];
    const lastObjectWithAssistant = appendTextToContent(lastObjectInLastChunk, assistant);
    const lastObjectWithAssistantLength = JSON.stringify(lastObjectWithAssistant).length + 1;

    if (currentLength - JSON.stringify(lastObjectInLastChunk).length - 1 + lastObjectWithAssistantLength <= maxLength) {
        lastChunk[lastChunk.length - 1] = lastObjectWithAssistant;
    }

    return result;
}

function convertToUnixTime(date) {
    const unixTime = Math.floor(date.getTime() / 1000);
    const randomDigit = Math.floor(Math.random() * 10);
    return `${unixTime}.xxxxx${randomDigit}`;
}

function createBaseForm(config) {
    const form = new FormData();
    form.append('token', config.token);
    form.append('channel', `${config.claudeId}`);
    form.append('_x_mode', 'online');
    form.append('_x_sonic', 'true');
    return form;
}

// Add the utility functions here
// e.g. escapePrompt, readBody, preparePrompt, currentTime, headers, convertToUnixTime, createBaseForm

const dataToResponse = (
    data,
    promptTokens,
    completionTokens,
    stream = false,
    reason = null
) => {
    const currDate = new Date();
    const contentData = { content: data, role: 'assistant' };
    const contentName = stream ? 'delta' : 'message';

    return {
        choices: [
            {
                [contentName]: !!data ? contentData : {},
                finish_reason: reason,
                index: 0,
            },
        ],
        created: currDate.getTime(),
        id: `chatcmpl-${(Math.random().toString(36).slice(2))}`,
        object: 'chat.completion.chunk',
        usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
        },
    };
};

const stats = {
    prompts: []
}

module.exports = {
    buildPrompt,
    readBody,
    preparePrompt,
    currentTime,
    genHeaders,
    convertToUnixTime,
    createBaseForm,
    splitJsonArray,
    wait,
    dataToResponse,
    stats,
};