// ============================================================
//  MEGA-MD — Mahnı Tanı Plugin (Shazam)
//  Fayl: plugins/shazam.js
//  audd.io API istifadə edir — pulsuz tier: 300 sorğu/ay
//  .env-ə əlavə et: AUDD_API_KEY=your_token (isteğe bağlı)
//  API token olmadan da işləyir (limitli)
// ============================================================

import axios from 'axios';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export default {
    command: 'audd',
    aliases: ['tanı', 'mahni', 'song', 'music'],
    category: 'utility',
    description: 'Səs/video/mahnı faylına reply edib mahnını tanı.',
    usage: 'Səs/mahnıya reply edib .shazam yaz',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 15,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const audioMsg = quoted?.audioMessage
            || quoted?.videoMessage
            || quoted?.documentMessage;

        if (!audioMsg) {
            return await sock.sendMessage(chatId, {
                text: '🎵 *Mahnı Tanıma*\n\nSəs və ya video faylına reply edib `.shazam` yaz!\n\n*Dəstəklənən formatlar:*\n• Səs mesajı 🎙️\n• MP3/MP4 fayl 🎵\n• Video 🎬',
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: '🎵 _Mahnı tanınır... 10-20 saniyə gözləyin_',
            ...channelInfo
        }, { quoted: message });

        await sock.sendPresenceUpdate('composing', chatId);

        const tmpFile = join(tmpdir(), `shazam_${Date.now()}.mp3`);

        try {
            // Faylı yüklə
            const stream = await sock.downloadMediaMessage(
                { message: quoted, key: message.message?.extendedTextMessage?.contextInfo }
            );
            const buffer = Buffer.isBuffer(stream) ? stream : Buffer.concat(
                await (async () => { const chunks = []; for await (const c of stream) chunks.push(c); return chunks; })()
            );

            await writeFile(tmpFile, buffer);

            // audd.io API-yə göndər
            const FormData = (await import('form-data')).default;
            const { createReadStream } = await import('fs');

            const form = new FormData();
            form.append('file', createReadStream(tmpFile));
            form.append('return', 'apple_music,spotify');

            const apiToken = process.env.AUDD_API_KEY || '';
            if (apiToken) form.append('api_token', apiToken);

            const response = await axios.post('https://api.audd.io/', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            const result = response.data?.result;

            if (!result) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Mahnı tanınmadı. Faylın keyfiyyəti aşağı ola bilər və ya tanınmayan mahnıdır.',
                    ...channelInfo
                }, { quoted: message });
            }

            // Nəticəni format et
            let text = `🎵 *Mahnı Tapıldı!*\n\n`;
            text += `🎤 *Artist:* ${result.artist || 'Naməlum'}\n`;
            text += `🎵 *Mahnı:* ${result.title || 'Naməlum'}\n`;
            text += `💿 *Albom:* ${result.album || 'Naməlum'}\n`;
            text += `📅 *İl:* ${result.release_date || 'Naməlum'}\n`;

            if (result.spotify?.external_urls?.spotify) {
                text += `\n🟢 *Spotify:*\n${result.spotify.external_urls.spotify}`;
            }
            if (result.apple_music?.url) {
                text += `\n🍎 *Apple Music:*\n${result.apple_music.url}`;
            }

            await sock.sendMessage(chatId, {
                text,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Shazam Plugin]', err.message);

            let errMsg = `❌ Xəta: ${err.message}`;
            if (err.response?.status === 429) {
                errMsg = '⚠️ Aylıq limit doldu. AUDD_API_KEY əlavə etməyi düşün.';
            }

            await sock.sendMessage(chatId, {
                text: errMsg,
                ...channelInfo
            }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
            unlink(tmpFile).catch(() => {});
        }
    }
};
