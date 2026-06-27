export default {
    command: 'viewonce-watcher',
    aliases: [],
    category: 'utility',
    description: 'View-once mediani avtomatik owner-ə göndərir',
    usage: '',
    isPrefixless: true,

    async handler(sock, message, args, context = {}) {
        const { config } = context;

        // Yalnız view-once mesajları tut
        const msg = message?.message;
        if (!msg) return;

        const viewOnceKey = Object.keys(msg).find(k =>
            k === 'viewOnceMessage' ||
            k === 'viewOnceMessageV2' ||
            k === 'viewOnceMessageV2Extension'
        );
        if (!viewOnceKey) return;

        const inner = msg[viewOnceKey]?.message;
        if (!inner) return;

        // Media tipini tap
        const mediaKey = Object.keys(inner).find(k =>
            k === 'imageMessage' ||
            k === 'videoMessage' ||
            k === 'audioMessage'
        );
        if (!mediaKey) return;

        const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
        const senderJid = message.key?.participant || message.key?.remoteJid;
        const chatJid = message.key?.remoteJid;

        try {
            // Mediaı yüklə
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(
                { message: inner, key: message.key },
                'buffer',
                {}
            );

            // Media tipinə görə göndər
            const mediaType = mediaKey.replace('Message', '');
            const mimetype = inner[mediaKey]?.mimetype || (
                mediaType === 'image' ? 'image/jpeg' :
                mediaType === 'video' ? 'video/mp4' :
                'audio/mp4'
            );

            await sock.sendMessage(ownerJid, {
                [mediaType]: buffer,
                mimetype,
                caption: `👁 *View-once media*\n📍 Chat: ${chatJid}\n👤 Göndərən: ${senderJid}`
            });

        } catch (err) {
            console.error('[viewonce-watcher] Xəta:', err.message);
        }
    }
};