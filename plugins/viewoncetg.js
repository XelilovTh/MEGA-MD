import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';

// ─── Telegram-a göndər ────────────────────────────────────────────────────
async function sendToTelegram(buffer, mimetype, caption) {
    const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;

    if (!TG_TOKEN || !TG_CHAT) {
        console.error('[VIEWONCE-TG] TELEGRAM_BOT_TOKEN yoxdur');
        return false;
    }

    try {
        const isVideo = mimetype?.includes('video');
        const form    = new FormData();
        
        form.append('chat_id', TG_CHAT);
        form.append('caption', caption || '');
        form.append(
            isVideo ? 'video' : 'photo',
            new Blob([buffer], { type: mimetype }),
            isVideo ? 'media.mp4' : 'media.jpg'
        );

        const endpoint = isVideo ? 'sendVideo' : 'sendPhoto';
        const res = await axios.post(
            `https://api.telegram.org/bot${TG_TOKEN}/${endpoint}`,
            form,
            { timeout: 30000 }
        );

        console.log('[VIEWONCE-TG] ✅ Telegram-a göndərildi');
        return true;
    } catch (err) {
        console.error('[VIEWONCE-TG] Xəta:', err.message);
        return false;
    }
}

// ─── Media yüklə ───────────────────────────────────────────────────────────
async function downloadMedia(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// ─── Listener ──────────────────────────────────────────────────────────────
function attachListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            try {
                if (!m?.message) continue;
                if (!m.key.fromMe) continue;

                const myText =
                    m.message?.conversation ||
                    m.message?.extendedTextMessage?.text || '';
                if (!myText) continue;

                const prefixes = ['.', '!', '/', '#'];
                if (prefixes.some(p => myText.trim().startsWith(p))) continue;

                const ctx = m.message?.extendedTextMessage?.contextInfo;
                if (!ctx?.quotedMessage) continue;

                const quoted = ctx.quotedMessage;
                const img    = quoted?.imageMessage;
                const vid    = quoted?.videoMessage;

                const isViewOnceImg = img?.viewOnce === true;
                const isViewOnceVid = vid?.viewOnce === true;

                if (!isViewOnceImg && !isViewOnceVid) continue;

                console.log('[VIEWONCE-TG] ViewOnce tapıldı →', isViewOnceImg ? 'şəkil' : 'video');

                const mimetype = isViewOnceImg
                    ? (img?.mimetype || 'image/jpeg')
                    : (vid?.mimetype || 'video/mp4');

                const buffer = isViewOnceImg
                    ? await downloadMedia(img, 'image')
                    : await downloadMedia(vid, 'video');

                if (!buffer || buffer.length === 0) {
                    console.error('[VIEWONCE-TG] Buffer boşdur');
                    continue;
                }

                const caption = `📩 Viewonce ${isViewOnceImg ? 'şəkil' : 'video'}\n💬 ${myText}`;
                await sendToTelegram(buffer, mimetype, caption);

            } catch (err) {
                console.error('[VIEWONCE-TG] Xəta:', err.message);
            }
        }
    });

    console.log('[VIEWONCE-TG] ✅ Listener aktiv');
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default {
    command: 'vvtg',
    aliases: ['viewoncetg'],
    category: 'owner',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        if (sock.__viewonceTgAttached) {
            return sock.sendMessage(chatId,
                { text: '✅ Artıq aktivdir.' },
                { quoted: message }
            );
        }

        sock.__viewonceTgAttached = true;
        attachListener(sock);

        await sock.sendMessage(chatId,
            { text: '✅ Aktiv edildi.\n\nArtıq hər viewonce mediaya avtomatik Telegram-a gələcək.' },
            { quoted: message }
        );
    }
};
