import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ─── Catbox-a yüklə ────────────────────────────────────────────────────────
async function uploadToCatbox(buffer, mimetype) {
    const isVideo = mimetype?.includes('video');
    const ext     = isVideo ? 'mp4' : 'jpg';
    const tmpPath = path.join(process.cwd(), 'temp', `vo_${Date.now()}.${ext}`);

    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buffer);

    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(tmpPath));

        const res = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 30000
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
                if (!m.key.fromMe) continue;

                const myText =
                    m.message?.conversation ||
                    m.message?.extendedTextMessage?.text || '';
                if (!myText) continue;

                // .vvtg və ya digər komandaları keç
                const prefix = ['.', '!', '/', '#'];
                if (prefix.some(p => myText.startsWith(p))) continue;

                const ctx = m.message?.extendedTextMessage?.contextInfo;
                if (!ctx?.quotedMessage) continue;

                const quoted = ctx.quotedMessage;
                const img    = quoted?.imageMessage;
                const vid    = quoted?.videoMessage;

                const isViewOnceImg = img?.viewOnce === true;
                const isViewOnceVid = vid?.viewOnce === true;

                if (!isViewOnceImg && !isViewOnceVid) continue;

                const mimetype = isViewOnceImg
                    ? (img.mimetype || 'image/jpeg')
                    : (vid.mimetype || 'video/mp4');

                const buffer = isViewOnceImg
                    ? await downloadMedia(img, 'image')
                    : await downloadMedia(vid, 'video');

                const catboxUrl = await uploadToCatbox(buffer, mimetype);
                console.log('[VIEWONCE-LINK] ✅ URL:', catboxUrl);

                await sock.sendMessage(getBotJid(sock), {
                    text: `🔗 ${catboxUrl}`
                });

            } catch (err) {
                console.error('[VIEWONCE-LINK] Xəta:', err.message);
            }
        }
    });

    console.log('[VIEWONCE-LINK] ✅ Listener aktiv');
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default {
    command: 'vvlink',
    aliases: ['viewoncelink'],
    category: 'owner',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        if (sock.__viewonceLinkAttached) {
            return sock.sendMessage(chatId,
                { text: '✅ Artıq aktivdir.' },
                { quoted: message }
            );
        }

        sock.__viewonceLinkAttached = true;
        attachListener(sock);

        await sock.sendMessage(chatId,
            { text: '✅ Aktiv edildi.' },
            { quoted: message }
        );
    }
};
