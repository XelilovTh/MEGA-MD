import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ─── Catbox-a yüklə ────────────────────────────────────────────────────────
async function uploadToCatbox(buffer, mimetype) {
    const isVideo = mimetype?.includes('video');
    const ext = isVideo ? 'mp4' : 'jpg';
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
        try { fs.unlinkSync(tmpPath); } catch { }
    }
}

// ─── Media yüklə ───────────────────────────────────────────────────────────
async function downloadMedia(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// ─── Bot JID-ini düzgün al ─────────────────────────────────────────────────
function getBotJid(sock) {
    const raw = sock.user?.id || '';
    // "994556603890:34@s.whatsapp.net" → "994556603890@s.whatsapp.net"
    const num = raw.split(':')[0].split('@')[0];
    return `${num}@s.whatsapp.net`;
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default {
    command: 'vvlink',
    aliases: ['vvlink'],
    category: 'owner',
    description: 'ViewOnce-ə reply etdikdə Catbox linki şəxsinə göndərir',
    usage: 'Avtomatik işləyir — bir dəfə aktivləşdir',
    ownerOnly: false,

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        if (sock.__viewonceLinkAttached) {
            return sock.sendMessage(chatId,
                { text: '✅ ViewOnce→Link artıq aktivdir.' },
                { quoted: message }
            );
        }

        sock.__viewonceLinkAttached = true;

        // Test: botun öz JID-ini yoxla
        const botJid = getBotJid(sock);
        console.log('[VIEWONCE-LINK] Bot JID:', botJid);

        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m?.message) continue;
                    if (!m.key.fromMe) continue;

                    // Mətn olmalıdır
                    const myText =
                        m.message?.conversation ||
                        m.message?.extendedTextMessage?.text || '';
                    if (!myText) continue;

                    // Reply edilmiş mesaj olmalıdır
                    const ctx = m.message?.extendedTextMessage?.contextInfo;
                    if (!ctx?.quotedMessage) continue;

                    const quoted = ctx.quotedMessage;
                    const img = quoted?.imageMessage;
                    const vid = quoted?.videoMessage;

                    const isViewOnceImg = img?.viewOnce === true;
                    const isViewOnceVid = vid?.viewOnce === true;

                    if (!isViewOnceImg && !isViewOnceVid) continue;

                    console.log('[VIEWONCE-LINK] ViewOnce tapıldı, yüklənir...');

                    const mimetype = isViewOnceImg
                        ? (img.mimetype || 'image/jpeg')
                        : (vid.mimetype || 'video/mp4');

                    const buffer = isViewOnceImg
                        ? await downloadMedia(img, 'image')
                        : await downloadMedia(vid, 'video');

                    console.log('[VIEWONCE-LINK] Catbox-a göndərilir...');
                    const catboxUrl = await uploadToCatbox(buffer, mimetype);
                    console.log('[VIEWONCE-LINK] Catbox URL:', catboxUrl);

                    // Botun şəxsi JID-inə göndər
                    const myJid = getBotJid(sock);
                    await sock.sendMessage(myJid, {
                        text: `🔗 ${catboxUrl}`
                    });

                    console.log('[VIEWONCE-LINK] ✅ Link göndərildi:', myJid);

                } catch (err) {
                    console.error('[VIEWONCE-LINK] Xəta:', err.message);
                }
            }
        });

        await sock.sendMessage(chatId,
            { text: `✅ ViewOnce→Link aktiv edildi!\n\n📋 Bot JID: ${botJid}\n\nViewonce mesaja reply edib istənilən mətn yaz — link şəxsinə göndəriləcək.` },
            { quoted: message }
        );
    }
};