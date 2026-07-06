import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ─── 0x0.st-ə yüklə ────────────────────────────────────────────────────────
async function uploadTo0x0(buffer, mimetype) {
    const isVideo = mimetype?.includes('video');
    const ext     = isVideo ? 'mp4' : 'jpg';
    const tmpPath = path.join(process.cwd(), 'temp', `vo_${Date.now()}.${ext}`);

    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buffer);

    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(tmpPath), {
            filename: `viewonce.${ext}`,
            contentType: isVideo ? 'video/mp4' : 'image/jpeg'
        });

        const res = await axios.post('https://0x0.st', form, {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000
        });

        const url = res.data.trim();
        if (url.startsWith('http')) return url;
        throw new Error('URL alınmadı: ' + url);
    } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
    }
}

// ─── litterbox.catbox.moe-yə yüklə (1 saatlıq) ───────────────────────────
async function uploadToLitterbox(buffer, mimetype) {
    const isVideo = mimetype?.includes('video');
    const ext     = isVideo ? 'mp4' : 'jpg';
    const tmpPath = path.join(process.cwd(), 'temp', `vo_${Date.now()}.${ext}`);

    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buffer);

    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', '24h');
        form.append('fileToUpload', fs.createReadStream(tmpPath), {
            filename: `viewonce.${ext}`,
            contentType: isVideo ? 'video/mp4' : 'image/jpeg'
        });

        const res = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000
        });

        const url = res.data.trim();
        if (url.startsWith('http')) return url;
        throw new Error('URL alınmadı: ' + url);
    } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
    }
}

// ─── Sıralı yükləmə — biri uğursuz olarsa digərini cəhd et ───────────────
async function uploadMedia(buffer, mimetype) {
    const uploaders = [
        { name: '0x0.st',      fn: () => uploadTo0x0(buffer, mimetype) },
        { name: 'Litterbox',   fn: () => uploadToLitterbox(buffer, mimetype) },
    ];

    for (const u of uploaders) {
        try {
            console.log(`[VIEWONCE-LINK] ${u.name}-ə yüklənir...`);
            const url = await u.fn();
            console.log(`[VIEWONCE-LINK] ✅ ${u.name} URL:`, url);
            return url;
        } catch (err) {
            console.error(`[VIEWONCE-LINK] ${u.name} xətası:`, err.message);
        }
    }

    throw new Error('Bütün upload servisləri uğursuz oldu');
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

                console.log('[VIEWONCE-LINK] ViewOnce tapıldı →', isViewOnceImg ? 'şəkil' : 'video');

                let mimetype = isViewOnceImg
                    ? (img?.mimetype || 'image/jpeg')
                    : (vid?.mimetype || 'video/mp4');
                mimetype = mimetype.split(';')[0].trim();

                const buffer = isViewOnceImg
                    ? await downloadMedia(img, 'image')
                    : await downloadMedia(vid, 'video');

                if (!buffer || buffer.length === 0) {
                    console.error('[VIEWONCE-LINK] Buffer boşdur');
                    continue;
                }

                const url = await uploadMedia(buffer, mimetype);

                await sock.sendMessage(getBotJid(sock), { text: `🔗 ${url}` });
                console.log('[VIEWONCE-LINK] ✅ Link göndərildi');

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