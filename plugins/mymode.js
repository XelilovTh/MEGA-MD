import { channelInfo } from '../lib/messageConfig.js';

export default {
    command: 't',
    aliases: ['stealth', 'gizli'],
    category: 'owner',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const ctx = { ...context, chatId, channelInfo };

        const steps = [
            { file: './areact.js',    args: ['off'] },
            { file: './autoread.js',  args: ['off'] },
            { file: './autotyping.js',args: ['off'] },
            { file: './autostatus.js',args: ['off'] },
            { file: './autoview.js',  args: ['off'] },
            { file: './antidelete.js',args: ['on'] },
            { file: './vvlink.js',    args: [] },
            { file: './mode.js',      args: ['private'] },
        ];

        for (const step of steps) {
            try {
                const plugin = (await import(step.file)).default;
                await plugin.handler(sock, message, step.args, ctx);
            } catch (err) {
                console.error(`[STEALTH] ${step.file} xətası:`, err.message);
            }
        }

        console.log('[STEALTH] ✅ Bütün əmrlər icra edildi');
    }
};
