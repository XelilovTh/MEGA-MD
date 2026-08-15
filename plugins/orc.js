// ============================================================
//  MEGA-MD — OCR Plugin (Şəkildən Mətn)
//  Fayl: plugins/ocr.js
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export default {
    command: 'ocr',
    aliases: ['read', 'oxu', 'metn'],
    category: 'ai',
    description: 'Şəkildəki mətni oxu və çıxart.',
    usage: 'Şəkilə reply edib .ocr yaz',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 5,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return await sock.sendMessage(chatId, {
                text: '❌ *GEMINI_API_KEY* tapılmadı!',
                ...channelInfo
            }, { quoted: message });
        }

        // Reply edilmiş mesajı tap
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage
            || quoted?.viewOnceMessage?.message?.imageMessage;

        if (!imageMsg) {
            return await sock.sendMessage(chatId, {
                text: '📷 *Şəkilə reply edib .ocr yaz!*\n\nMisal: şəkil göndər → şəkilə reply et → `.ocr`',
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: '🔍 _Şəkil oxunur..._',
            ...channelInfo
        }, { quoted: message });

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            // Düzgün mesaj obyekti qur
            const quotedMsg = {
                key: {
                    remoteJid: chatId,
                    id: contextInfo.stanzaId,
                    fromMe: contextInfo.participant === sock.user?.id
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});

            const base64Image = buffer.toString('base64');
            const mimeType = imageMsg.mimetype || 'image/jpeg';

            const ai = new GoogleGenAI({ apiKey });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                    parts: [
                        { inlineData: { mimeType, data: base64Image } },
                        { text: 'Bu şəkildəki bütün mətni dəqiq şəkildə çıxart. Yalnız mətni ver, heç bir əlavə izah etmə. Əgər şəkildə mətn yoxdursa "Şəkildə mətn tapılmadı" yaz.' }
                    ]
                }]
            });

            const text = response.text?.trim();

            if (!text || text === 'Şəkildə mətn tapılmadı') {
                return await sock.sendMessage(chatId, {
                    text: '❌ Şəkildə oxuna bilən mətn tapılmadı.',
                    ...channelInfo
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, {
                text: `📝 *OCR Nəticəsi:*\n\n${text}`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[OCR Plugin]', err.message);
            await sock.sendMessage(chatId, {
                text: `❌ Xəta: ${err.message}`,
                ...channelInfo
            }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
