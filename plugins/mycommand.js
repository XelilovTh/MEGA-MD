export default {
    command: 'vo',
    aliases: [],
    category: 'utility',
    description: 'Test',
    usage: '.vo',
    isPrefixless: false,

    async handler(sock, message, args, context = {}) {
        const { chatId } = context;

        // Reply edilən mesajı yoxla
        const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            await sock.sendMessage(chatId, { text: 'View-once mesajına reply et' }, { quoted: message });
            return;
        }

        console.log('[QUOTED]', JSON.stringify(quoted, null, 2));
        await sock.sendMessage(chatId, { text: JSON.stringify(quoted, null, 2) }, { quoted: message });
    }
};