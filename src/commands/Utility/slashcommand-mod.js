const { ChatInputCommandInteraction, ApplicationCommandOptionType } = require("discord.js");
const DiscordBot = require("../../client/DiscordBot");
const ApplicationCommand = require("../../structure/ApplicationCommand");
const config = require("../../config");
const CATEGORIES = ["Fun", "Games", "Misc"];

module.exports = new ApplicationCommand({
    command: {
        name: 'mod',
        description: 'Tell Modularis what you want your new command to do, in plain English',
        type: 1,
        options: [
            {
                name: 'category',
                description: 'Choose a command category — Fun, Games, Misc, or more!',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            },
            {
                name: 'prompt',
                description: 'Describe what you want your new command to do',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    options: {
        cooldown: 5000
    },
    /**
     * @param {DiscordBot} client
     * @param {ChatInputCommandInteraction} interaction
     */
    run: async (client, interaction) => {
        const category = interaction.options.getString('category');
        const prompt = interaction.options.getString('prompt');
        const { deepseekHandler } = require('../../integrations/deepseek')
        if (!CATEGORIES.includes(category)) {
            await interaction.reply({ content: `Invalid category!`, ephemeral: true });
            return;
        }
        await interaction.reply({
            content: `**Queued your mod command for [${category}]** with the prompt: ${prompt}`
        });
        try {
            const result = await deepseekHandler(prompt, category);
            if (result.success) {
                await interaction.followUp({ content: `**Command created!**\nCommand Name: ${config.prefix}${result.commandName}` })
            } else {
                await interaction.followUp({ content: `**Failed:**\n${result.error}`, ephemeral: true })
            }
        } catch (e) {
            await interaction.followUp({ content: `**Handler threw error:**\n${e}`, ephemeral: true })
        }
    },
    /**
     * @param {DiscordBot} client
     * @param {import('discord.js').AutocompleteInteraction} interaction
     */
    autocomplete: async (client, interaction) => {
        const focused = interaction.options.getFocused();
        const filtered = CATEGORIES.filter(cat => cat.toLowerCase().startsWith(focused.toLowerCase()));
        await interaction.respond(
            filtered.map(cat => ({ name: cat, value: cat }))
        );
    }
}).toJSON();
