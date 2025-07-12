require('dotenv').config()

const { deepseekHandler } = require('./src/integrations/deepseek')

async function test() {
    const prompt = 'create a command that sends a random unicode emoticon'
    const category = 'Fun'

    let result
    try {
        result = await deepseekHandler(prompt, category)
    } catch (e) {
        console.error('Handler threw error:', e)
        return
    }
    if (result.success) {
        console.log('Command created!')
        console.log('File:', result.filePath)
        console.log('Command Name:', result.commandName)
    } else {
        console.error('Failed:', result.error)
    }
}

test()
