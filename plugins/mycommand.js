export default {
    command: 'mycommand',
    aliases: ['mc'],
    category: 'utility',
    description: 'Nəsə edir',
    usage: '.mycommand <input>',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    cooldown: 5,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        await sock.sendMessage(chatId, {
            text: `Yazdınnn: ${args.join(' ')}`,
            ...channelInfo
        }, { quoted: message });
    }
};