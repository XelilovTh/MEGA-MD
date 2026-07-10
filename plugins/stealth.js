import store from '../lib/lightweight_store.js';
export default {
    command: 'stealth',
    aliases: ['alwaysonline', 'stealthmode'],
    category: 'owner',
    description: 'Toggle online status - bot will not send presence updates if off',
    usage: '.stealth <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId } = context;
        const action = args[0]?.toLowerCase();
        if (!action || !['on', 'off'].includes(action)) {
            const currentState = await store.getSetting('global', 'stealthMode');
            const status = currentState?.enabled ? 'ON' : 'OFF';
            return await sock.sendMessage(chatId, {
                text: `👻 *Stealth Mode Status:* ${status}\n\n*Usage:* .stealth <on|off>\n\n*What it does:*\n• Blocks all presence updates (typing, online, last seen)\n• Makes the bot completely invisible\n\n*When enabled:*\n✓ No "typing..." indicator\n✓ No "online" status\n✓ Complete stealth mode`
            }, { quoted: message });
        }
        const enabled = action === 'on';
        await store.saveSetting('global', 'stealthMode', { enabled });
        
        await sock.sendMessage(chatId, {
            text: `👻 Stealth mode has been turned *${enabled ? 'ON' : 'OFF'}*\n\n${enabled ? '✓ Bot is now in complete stealth mode\n✓ No presence updates\n✓ No typing indicators' : '✓ Presence updates enabled\n✓ Typing indicators enabled'}`
        }, { quoted: message });
    }
};
