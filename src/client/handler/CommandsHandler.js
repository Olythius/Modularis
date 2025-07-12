const { REST, Routes } = require('discord.js');
const { info, error, success } = require('../../utils/Console');
const { readdirSync } = require('fs');
const chokidar = require('chokidar');
const DiscordBot = require('../DiscordBot');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const MessageCommand = require('../../structure/MessageCommand');

class CommandsHandler {
    client;

    /**
     *
     * @param {DiscordBot} client 
     */
    constructor(client) {
        this.client = client;
        this.hotReloadDirs = [
            './src/commands/Fun',
            './src/commands/Games',
            './src/commands/Misc'
        ];
        this.watcher = null;
        this.startWatcher();
    }

    startWatcher = () => {
        if (this.watcher) return;
        this.watcher = chokidar.watch(this.hotReloadDirs, {
            persistent: true,
            ignoreInitial: true,
            depth: 1,
            awaitWriteFinish: true,
            ignored: /(^|[/\\])\../ // ignore dotfiles
        });

        this.watcher
            .on('add', (path) => this.handleFileChange(path, 'add'))
            .on('change', (path) => this.handleFileChange(path, 'change'))
            .on('unlink', (path) => this.handleFileChange(path, 'unlink'));
    }

    handleFileChange = (filePath, eventType) => {
        if (!filePath.endsWith('.js')) return;
        // Normalize for require path
        const relPath = filePath.replace(/\\/g, '/').replace(/^src\//, '');
        const modulePath = '../../' + relPath;
        let directory = filePath.split(/[/\\]/).slice(-2, -1)[0];

        // Remove from require cache
        try { delete require.cache[require.resolve(modulePath)]; } catch {}

        if (eventType === 'unlink') {
            // Remove command from collections
            const collections = this.client.collection;
            // Try both command types
            for (const type of ['application_commands', 'message_commands']) {
                for (const [name, mod] of collections[type]) {
                    if (mod && mod.__filePath === filePath) {
                        collections[type].delete(name);
                    }
                }
            }
            // Remove aliases
            if (collections.message_commands_aliases) {
                for (const [alias, name] of collections.message_commands_aliases) {
                    const cmd = collections.message_commands.get(name);
                    if (cmd && cmd.__filePath === filePath) {
                        collections.message_commands_aliases.delete(alias);
                    }
                }
            }
            return;
        }

        // (Re)load command
        let module;
        try {
            module = require(modulePath);
            if (!module) return;
            module.__filePath = filePath;
        } catch (e) {
            error('Unable to load a command from the path: ' + filePath);
            return;
        }
        const collections = this.client.collection;
        if (module.__type__ === 2) {
            if (!module.command || !module.run) {
                error('Unable to load the message command ' + filePath);
                return;
            }
            collections.message_commands.set(module.command.name, module);
            if (module.command.aliases && Array.isArray(module.command.aliases)) {
                module.command.aliases.forEach((alias) => {
                    collections.message_commands_aliases.set(alias, module.command.name);
                });
            }
            info(`[Watcher] Loaded/Reloaded message command: ${filePath}`);
        } else if (module.__type__ === 1) {
            if (!module.command || !module.run) {
                error('Unable to load the application command ' + filePath);
                return;
            }
            collections.application_commands.set(module.command.name, module);
            this.client.rest_application_commands_array = this.client.rest_application_commands_array.filter(cmd => cmd.name !== module.command.name);
            this.client.rest_application_commands_array.push(module.command);
            info(`[Watcher] Loaded/Reloaded application command: ${filePath}`);
        } else {
            error(`[Watcher] Invalid command type ${module.__type__} from command file ${filePath}`);
        }
    }

    load = () => {
        for (const directory of readdirSync('./src/commands/')) {
            for (const file of readdirSync('./src/commands/' + directory).filter((f) => f.endsWith('.js'))) {
                try {
                    /**
                     * @type {ApplicationCommand['data'] | MessageCommand['data']}
                     */
                    const module = require('../../commands/' + directory + '/' + file);

                    if (!module) continue;

                    if (module.__type__ === 2) {
                        if (!module.command || !module.run) {
                            error('Unable to load the message command ' + file);
                            continue;
                        }

                        this.client.collection.message_commands.set(module.command.name, module);

                        if (module.command.aliases && Array.isArray(module.command.aliases)) {
                            module.command.aliases.forEach((alias) => {
                                this.client.collection.message_commands_aliases.set(alias, module.command.name);
                            });
                        }

                        info('Loaded new message command: ' + file);
                    } else if (module.__type__ === 1) {
                        if (!module.command || !module.run) {
                            error('Unable to load the application command ' + file);
                            continue;
                        }

                        this.client.collection.application_commands.set(module.command.name, module);
                        this.client.rest_application_commands_array.push(module.command);

                        info('Loaded new application command: ' + file);
                    } else {
                        error('Invalid command type ' + module.__type__ + ' from command file ' + file);
                    }
                } catch {
                    error('Unable to load a command from the path: ' + 'src/commands/' + directory + '/' + file);
                }
            }
        }

        success(`Successfully loaded ${this.client.collection.application_commands.size} application commands and ${this.client.collection.message_commands.size} message commands.`);
    }

    reload = () => {
        this.client.collection.message_commands.clear();
        this.client.collection.message_commands_aliases.clear();
        this.client.collection.application_commands.clear();
        this.client.rest_application_commands_array = [];

        this.load();
    }
    
    /**
     * @param {{ enabled: boolean, guildId: string }} development
     * @param {Partial<import('discord.js').RESTOptions>} restOptions 
     */
    registerApplicationCommands = async (development, restOptions = null) => {
        const rest = new REST(restOptions ? restOptions : { version: '10' }).setToken(this.client.token);

        if (development.enabled) {
            await rest.put(Routes.applicationGuildCommands(this.client.user.id, development.guildId), { body: this.client.rest_application_commands_array });
        } else {
            await rest.put(Routes.applicationCommands(this.client.user.id), { body: this.client.rest_application_commands_array });
        }
    }
}

module.exports = CommandsHandler;