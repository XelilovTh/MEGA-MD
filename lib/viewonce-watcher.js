import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export async function handleViewOnce(sock, message) {
    try {
        const msg = message?.message;
        if (!msg) return;

        // Bütün viewonce variantlarını yoxla
        const viewOnceContainer =
            msg?.viewOnceMessageV2?.message ||
            msg?.viewOnceMessageV2Extension?.message ||
            msg?.viewOnceMessage?.message;

        if (!viewOnceContainer) return;

        const ownerNumber = process.env.OWNER_NUMBER?.replace(/[^0-9]/g, '');
        if (!ownerNumber) return;
        const ownerJid = ownerNumber + '@s.whatsapp.net';

        const sender = message.key?.participant || message.key?.remoteJid;
        const senderName = sender?.split('@')[0] || 'unknown';

        if (viewOnceContainer.imageMessage) {
            const stream = await downloadContentFromMessage(
                viewOnceContainer.imageMessage, 'image'
            );
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            await sock.sendMessage(ownerJid, {
                image: buffer,
                mimetype: 'image/jpeg',
                caption: `👁 *View-once şəkil*\n👤 Göndərən: ${senderName}\n📍 Chat: ${message.key?.remoteJid}`
            });
        }

        else if (viewOnceContainer.videoMessage) {
            const stream = await downloadContentFromMessage(
                viewOnceContainer.videoMessage, 'video'
            );
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            await sock.sendMessage(ownerJid, {
                video: buffer,
                mimetype: 'video/mp4',
                caption: `👁 *View-once video*\n👤 Göndərən: ${senderName}\n📍 Chat: ${message.key?.remoteJid}`
            });
        }

    } catch (err) {
        console.error('[viewonce-watcher] Xəta:', err.message);
    }
}