export default {
    command: 'vo',
    aliases: ['viewonce'],
    category: 'utility',
    description: 'View-once mediani göndər',
    usage: '.vo (view-once mesajına reply et)',
    isPrefixless: false,

    async handler(sock, message, args, context = {}) {
        const { chatId, config } = context;

        const contextInfo = message?.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (!quoted) {
            await sock.sendMessage(chatId, { text: '❌ View-once mesajına reply et' }, { quoted: message });
            return;
        }

        // Media tipini tap və viewOnce yoxla
        const mediaKey = ['imageMessage', 'videoMessage', 'audioMessage'].find(k => quoted[k]);
        if (!mediaKey || !quoted[mediaKey]?.viewOnce) {
            await sock.sendMessage(chatId, { text: '❌ Bu view-once deyil' }, { quoted: message });
            return;
        }

        const mediaMsg = quoted[mediaKey];

        try {
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

            // Quoted mesaj obyekti düzəlt
            const fakeMessage = {
                key: {
                    remoteJid: chatId,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(fakeMessage, 'buffer', {});

            const mediaType = mediaKey.replace('Message', '');
            const mimetype = mediaMsg.mimetype;

            await sock.sendMessage(chatId, {
                [mediaType]: buffer,
                mimetype,
                caption: mediaMsg.caption || ''
            }, { quoted: message });

        } catch (err) {
            console.error('[vo] Xəta:', err.message);
            await sock.sendMessage(chatId, { text: `❌ Xəta: ${err.message}` }, { quoted: message });
        }
    }
};