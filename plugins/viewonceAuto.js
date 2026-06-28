import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function uploadToCatbox(buffer, mimetype) {
    const isVideo = mimetype?.includes('video');
    const ext     = isVideo ? 'mp4' : 'jpg';
    const tmpPath = path.join(process.cwd(), 'temp', `vo_auto_${Date.now()}.${ext}`);

    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buffer);

    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('userhash', '');
        form.append('fileToUpload', fs.createReadStream(tmpPath), {
            filename: `viewonce.${ext}`,
            contentType: isVideo ? 'video/mp4' : 'image/jpeg'
        });

        const res = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000
        });

        return res.data.trim();
    } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
    }
}

async function downloadMedia(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

function getBotJid(sock) {
    const raw = sock.user?.id || '';
    const num = raw.split(':')[0].split('@')[0];
    return `${num}@s.whatsapp.net`;
}

function findViewOnce(message) {
    if (!message) return null;

    // Birbaşa gələn viewonce
    const img = message?.imageMessage;
    const vid = message?.videoMessage;
    if (img?.viewOnce) return { media: img, type: 'image' };
    if (vid?.viewOnce) return { media: vid, type: 'video' };

    // viewOnceMessage wrapper
    const vo = message?.viewOnceMessage?.message;
    if (vo?.imageMessage) return { media: vo.imageMessage, type: 'image' };
    if (vo?.videoMessage) return { media: vo.videoMessage, type: 'video' };

    // viewOnceMessageV2 wrapper
    const vo2 = message?.viewOnceMessageV2?.message;
    if (vo2?.imageMessage) return { media: vo2.imageMessage, type: 'image' };
    if (vo2?.videoMessage) return { media: vo2.videoMessage, type: 'video' };

    // viewOnceMessageV2Extension wrapper
    const vo3 = message?.viewOnceMessageV2Extension?.message;
    if (vo3?.imageMessage) return { media: vo3.imageMessage, type: 'image' };
    if (vo3?.videoMessage) return { media: vo3.videoMessage, type: 'video' };

    return null;
}

function attachListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            try {
                if (!m?.message) continue;
                if (m.key.fromMe) continue;

                // DEBUG: bütün mesaj açarlarını log et
                const keys = Object.keys(m.message);
                if (keys.some(k => k.toLowerCase().includes('image') || k.toLowerCase().includes('video'))) {
                    console.log('[VIEWONCE-AUTO] Media mesaj açarları:', keys);
                }

                const found = findViewOnce(m.message);
                if (!found) continue;

                console.log('[VIEWONCE-AUTO] ✅ ViewOnce tapıldı →', found.type);

                let mimetype = found.media?.mimetype || (found.type === 'image' ? 'image/jpeg' : 'video/mp4');
                mimetype = mimetype.split(';')[0].trim();

                const buffer = await downloadMedia(found.media, found.type);

                if (!buffer || buffer.length === 0) {
                    console.error('[VIEWONCE-AUTO] Buffer boşdur');
                    continue;
                }

                const catboxUrl = await uploadToCatbox(buffer, mimetype);

                if (!catboxUrl?.startsWith('http')) {
                    console.error('[VIEWONCE-AUTO] URL etibarsızdır:', catboxUrl);
                    continue;
                }

                await sock.sendMessage(getBotJid(sock), { text: `🔗 ${catboxUrl}` });
                console.log('[VIEWONCE-AUTO] ✅ Link göndərildi');

            } catch (err) {
                console.error('[VIEWONCE-AUTO] Xəta:', err.message);
            }
        }
    });

    console.log('[VIEWONCE-AUTO] ✅ Listener aktiv');
}

export default {
    command: 'vvauto',
    aliases: ['viewonceauto'],
    category: 'owner',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        if (sock.__viewonceAutoAttached) {
            return sock.sendMessage(chatId,
                { text: '✅ Artıq aktivdir.' },
                { quoted: message }
            );
        }

        sock.__viewonceAutoAttached = true;
        attachListener(sock);

        await sock.sendMessage(chatId,
            { text: '✅ Aktiv edildi.' },
            { quoted: message }
        );
    }
};
