// ============================================================
//  MEGA-MD — Mahnı Tanı Plugin (Shazam)
//  Fayl: plugins/shazam.js
//  .env: AUDD_API_KEY=your_token (isteğe bağlı)
// ============================================================

import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import FormData from 'form-data';
import { createReadStream } from 'fs';

export default {
    command: 'audd',
    aliases: ['tanı', 'mahni', 'song', 'music'],
    category: 'utility',
    description: 'Səs/mahnı faylına reply edib mahnını tanı.',
    usage: 'Səs/mahnıya reply edib .shazam yaz',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 15,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
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
            const quotedMsg = {
                key: {
                    remoteJid: chatId,
                    id: contextInfo.stanzaId,
                    fromMe: contextInfo.participant === sock.user?.id
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            await writeFile(tmpFile, buffer);

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
                    text: '❌ Mahnı tanınmadı. Faylın keyfiyyəti aşağı ola bilər.',
                    ...channelInfo
                }, { quoted: message });
            }

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

            await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

        } catch (err) {
            console.error('[Shazam Plugin]', err.message);
            let errMsg = `❌ Xəta: ${err.message}`;
            if (err.response?.status === 429) {
                errMsg = '⚠️ Aylıq limit doldu. AUDD_API_KEY əlavə etməyi düşün → https://audd.io';
            }
            await sock.sendMessage(chatId, { text: errMsg, ...channelInfo }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
            unlink(tmpFile).catch(() => {});
        }
    }
};
