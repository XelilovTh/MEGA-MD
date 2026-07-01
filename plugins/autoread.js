import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const configPath = dataFile('autoread.json');

async function initConfig() {
    if (HAS_DB) {
        const config = await store.getSetting('global', 'autoread');
        return config || { enabled: false };
    }
    else {
        if (!fs.existsSync(configPath)) {
            const dataDir = path.dirname(configPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
}

async function saveConfig(config) {
    if (HAS_DB) {
        await store.saveSetting('global', 'autoread', config);
    }
    else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
}

async function isAutoreadEnabled() {
    try {
        const config = await initConfig();
        return config.enabled;
    }
    catch (error) {
        console.error('Error checking autoread status:', error);
        return false;
    }
}

function isBotMentionedInMessage(message, botNumber) {
    if (!message.message)
        return false;
    const messageTypes = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
        'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'
    ];
    for (const type of messageTypes) {
        if (message.message[type]?.contextInfo?.mentionedJid) {
            const mentionedJid = message.message[type].contextInfo.mentionedJid;
            if (mentionedJid.some((jid) => jid === botNumber)) {
                return true;
            }
        }
    }
    const textContent = message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption || '';
    if (textContent) {
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) {
            return true;
        }
        const botNames = [global.botname?.toLowerCase(), 'bot', 'mega', 'mega bot'];
        const words = textContent.toLowerCase().split(/\s+/);
        if (botNames.some(name => words.includes(name))) {
            return true;
        }
    }
    return false;
}

export async function handleAutoread(sock, message) {
    try {
        const ghostMode = await store.getSetting('global', 'stealthMode');
        if (ghostMode && ghostMode.enabled) {
            console.log('👻 Stealth mode active - skipping read receipt');
            return false;
        }
    }
    catch (err) {
        // ignore store errors and proceed
    }
    const enabled = await isAutoreadEnabled();
    if (enabled) {
        const botNumber = `${sock.user.id.split(':')[0] }@s.whatsapp.net`;
        const isBotMentioned = isBotMentionedInMessage(message, botNumber);
        if (isBotMentioned) {
            return false;
        }
        else {
            try {
                const key = {
                    remoteJid: message.key.remoteJid,
                    id: message.key.id,
                    participant: message.key.participant
                };
                // Delay readMessages by 5000ms (5 seconds) so the client can play notification sound
                setTimeout(async () => {
                    try {
                        await sock.readMessages([key]);
                        console.log('✅ Marked message as read (delayed 5s)');
                    }
                    catch (err) {
                        console.error('Error marking message as read (delayed):', err);
                    }
                }, 5000);
                return true;
            }
            catch (error) {
                console.error('Error scheduling read message:', error);
                return false;
            }
        }
    }
    return false;
}

export default {
    command: 'autoread',
    aliases: ['read', 'autoreadmsg'],
    category: 'owner',
    description: 'Toggle automatic message reading (blue ticks) with 5s delayed read',
    usage: '.autoread <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        try {
            const config = await initConfig();
            const action = args[0]?.toLowerCase();
            if (!action) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                const ghostActive = ghostMode && ghostMode.enabled;
                await sock.sendMessage(chatId, {
                    text: `*📖 AUTOREAD STATUS*\n\n` +
                        `*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                        `*Ghost Mode:* ${ghostActive ? '👻 Active (overrides autoread)' : '❌ Inactive'}\n` +
                        `*Behavior:* Delayed read (5 seconds) when enabled\n\n` +
                        `*Commands:*\n` +
                        `• \`.autoread on\` - Enable auto-read (delayed 5s)\n` +
                        `• \`.autoread off\` - Disable auto-read\n\n` +
                        `*What it does:*\n` +
                        `When enabled, the bot schedules a read receipt 5 seconds after a message arrives, allowing the recipient device to play a notification sound before the message is marked read.\n\n` +
                        `*Note:* Ghost mode takes priority over autoread. If ghost mode is active, no read receipts will be sent.`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            if (action === 'on' || action === 'enable') {
                if (config.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Autoread is already enabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                config.enabled = true;
                await saveConfig(config);
                const ghostMode = await store.getSetting('global', 'stealthMode');
                const ghostActive = ghostMode && ghostMode.enabled;
                await sock.sendMessage(chatId, {
                    text: `✅ *Auto-read enabled (delayed 5s)!*\n\nAll messages will now be scheduled to be marked as read after 5 seconds.${ghostActive ? '\n\n⚠️ *Note:* Ghost mode is currently active and will override autoread.' : ''}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else if (action === 'off' || action === 'disable') {
                if (!config.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Autoread is already disabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                config.enabled = false;
                await saveConfig(config);
                await sock.sendMessage(chatId, {
                    text: '❌ *Auto-read disabled!*\n\nMessages will no longer be automatically marked as read.',
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid option!*\n\nUse: `.autoread on/off`',
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in autoread command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error processing command!*',
                ...channelInfo
            }, { quoted: message });
        }
    },
    isAutoreadEnabled,
    isBotMentionedInMessage,
    handleAutoread
};
