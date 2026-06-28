import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ─── Catbox-a yüklə ────────────────────────────────────────────────────────
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

// ─── Media yüklə ───────────────────────────────────────────────────────────
async function downloadMedia(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// ─── Bot JID ───────────────────────────────────────────────────────────────
function getBotJid(sock) {
    const raw = sock.user?.id || '';
    const num = raw.split(':')[0].split('@')[0];
    return `${num}@s.whatsapp.net`;
}

// ─── Listener ──────────────────────────────────────────────────────────────
function attachListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            try {
                if (!m?.message) continue;
                if (m.key.fromMe) continue;  // özümün mesajlarını keç

                const img = m.message?.imageMessage;
                const vid = m.message?.videoMessage;

                const isViewOnceImg = img?.viewOnce === true;
                const isViewOnceVid = vid?.viewOnce === true;

                if (!isViewOnceImg && !isViewOnceVid) continue;

                console.log('[VIEWONCE-AUTO] ViewOnce aşkarlandı →', isViewOnceImg ? 'şəkil' : 'video');

                let mimetype = isViewOnceImg
                    ? (img?.mimetype || 'image/jpeg')
                    : (vid?.mimetype || 'video/mp4');

                mimetype = mimetype.split(';')[0].trim();

                const buffer = isViewOnceImg
                    ? await downloadMedia(img, 'image')
                    : await downloadMedia(vid, 'video');

                if (!buffer || buffer.length === 0) {
                    console.error('[VIEWONCE-AUTO] Buffer boşdur');
                    continue;
                }

                const catboxUrl = await uploadToCatbox(buffer, mimetype);

                if (!catboxUrl?.startsWith('http')) {
                    console.error('[VIEWONCE-AUTO] Catbox URL etibarsızdır:', catboxUrl);
                    continue;
                }

                await sock.sendMessage(getBotJid(sock), {
                    text: `🔗 ${catboxUrl}`
                });

                console.log('[VIEWONCE-AUTO] ✅ Link göndərildi');

            } catch (err) {
                console.error('[VIEWONCE-AUTO] Xəta:', err.message);
            }
        }
    });

    console.log('[VIEWONCE-AUTO] ✅ Listener aktiv');
}

// ─── Plugin ────────────────────────────────────────────────────────────────
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
            { text: '✅ Aktiv edildi.\n\nArtıq hər viewonce mediaya avtomatik link şəxsinə gələcək.' },
            { quoted: message }
        );
    }
};
