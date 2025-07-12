const fs = require('fs')
const path = require('path')
const OpenAI = require('openai')

async function fetchDeepSeekCommand(prompt, category) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY environment variable is missing.')
    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
    })
    const systemPrompt = "You are a highly skilled JavaScript developer and Discord bot command generator. Return ONLY a JSON object with keys: \"command_name\" (string) and \"code\" (JavaScript source code as a string). No extra text or explanation, you may use comments sparingly. You are limited to using the following modules: discord.js, axios, cheerio, dayjs, node-fetch, form-data, fs-extra, got, lodash, moment, quick-yaml.db if needed. You are not allowed to use any other modules. For the cooldown on the command, make sure to assess the command load on the bot's performance, and select an appropriate cooldown."
    const userPrompt = buildPrompt(prompt, category)
    let completion
    try {
        completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    } catch (e) {
        throw new Error('DeepSeek API error: ' + e)
    }
    const content = completion.choices[0].message.content
    return parseResponse(content)
}

function buildPrompt(prompt, category) {
    return `
You are to ONLY return a JSON object like this: 
{
  "command_name": "short_unique_command_name",
  "code": "<full JavaScript code in the format below>"
}

DO NOT include anything else in your response.

The command must be for a Discord.js prefix bot, categorized under "${category}".

Here is the structure you MUST follow inside the "code" field:

\`\`\`js
const { Message } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const MessageCommand = require("../../structure/MessageCommand");

module.exports = new MessageCommand({
    command: {
        name: 'command_name',
        description: 'A short description',
        aliases: ['optional', 'aliases'],
        permissions: ['SendMessages']
    },
    options: {
        cooldown: 5000
    },
    /**
     * @param {DiscordBot} client
     * @param {Message} message
     * @param {string[]} args
     */
    run: async (client, message, args) => {
        // Your logic here
    }
}).toJSON();
\`\`\`

Now generate a command in that format based on this request: ${prompt}
`
}


function parseResponse(content) {
    try {
        // Remove code fences and leading/trailing whitespace
        let clean = content.trim()
        if (clean.startsWith('```')) {
            clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim()
        }
        const parsed = JSON.parse(clean)
        if (typeof parsed.command_name !== 'string' || typeof parsed.code !== 'string') throw new Error('Invalid JSON structure')
        return parsed
    } catch (err) {
        throw new Error('DeepSeek did not return valid JSON: ' + err)
    }
}

async function deepseekHandler(prompt, category) {
    let command
    try {
        command = await fetchDeepSeekCommand(prompt, category)
    } catch (e) {
        return { success: false, error: e + '' }
    }
    const dir = path.join(__dirname, '..', 'commands', 'generated',category)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    const fileName = 'messagecommand-' + command.command_name + '.js'
    const filePath = path.join(dir, fileName)
    try {
        fs.writeFileSync(filePath, command.code, 'utf8')
        return { success: true, filePath, commandName: command.command_name }
    } catch (e) {
        return { success: false, error: e + '' }
    }
}

module.exports = { deepseekHandler }