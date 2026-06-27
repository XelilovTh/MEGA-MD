// ============================================================
//  MEGA-MD — Şəkil İzah Plugin (Gemini Vision)
//  Fayl: plugins/describe.js
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export default {
    command: 'describe',
    aliases: ['bax', 'izah', 'vision', 'see', 'ne'],
    category: 'ai',
    description: 'Şəkilə bax və nə olduğunu izah et.',
    usage: 'Şəkilə reply edib .describe yaz | .describe sual',

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

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage
            || quoted?.viewOnceMessage?.message?.imageMessage
            || quoted?.stickerMessage;

        // Birbaşa şəkil göndərilibsə
        const directImage = message.message?.imageMessage;
        const targetImage = imageMsg || directImage;

        if (!targetImage) {
            return await sock.sendMessage(chatId, {
                text: `👁️ *Şəkil İzah (Gemini Vision)*\n\n*İstifadə:*\n• Şəkilə reply edib \`.describe\` yaz\n• Şəkilə reply edib \`.describe bu nə rəngdir?\` — xüsusi sual ver\n\n*Bacarıqları:*\n• Şəkildəki əşyaları tanıyır 🏠\n• İnsanların emosiyasını oxuyur 😊\n• Mətni görür (OCR) 📝\n• Yerləri tanıyır 🗺️`,
                ...channelInfo
            }, { quoted: message });
        }

        const customQuestion = args.join(' ').trim();
        const prompt = customQuestion
            ? `Bu şəkil haqqında sual: "${customQuestion}". Azərbaycan dilində cavab ver.`
            : `Bu şəkili ətraflı izah et. Nə görürsən? Şəkildə nələr var? Azərbaycan dilində cavab ver. WhatsApp formatından istifadə et: *qalın* əsas məlumatlar üçün.`;

        await sock.sendMessage(chatId, {
            text: '👁️ _Şəkil analiz edilir..._',
            ...channelInfo
        }, { quoted: message });

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            let buffer;

            if (imageMsg && contextInfo) {
                const quotedMsg = {
                    key: {
                        remoteJid: chatId,
                        id: contextInfo.stanzaId,
                        fromMe: contextInfo.participant === sock.user?.id
                    },
                    message: quoted
                };
                buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            } else {
                // Birbaşa göndərilmiş şəkil
                buffer = await downloadMediaMessage(message, 'buffer', {});
            }

            const base64Image = buffer.toString('base64');
            const mimeType = targetImage.mimetype || 'image/jpeg';

            const ai = new GoogleGenAI({ apiKey });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                    parts: [
                        { inlineData: { mimeType, data: base64Image } },
                        { text: prompt }
                    ]
                }]
            });

            const text = response.text?.trim();
            if (!text) throw new Error('Cavab alınmadı');

            const header = customQuestion
                ? `👁️ *Gemini Vision*\n❓ *Sual:* ${customQuestion}\n\n`
                : `👁️ *Şəkil İzahı:*\n\n`;

            await sock.sendMessage(chatId, {
                text: `${header}${text}`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Describe Plugin]', err.message);
            let errMsg = `❌ Xəta: ${err.message}`;
            if (err.message?.includes('SAFETY')) {
                errMsg = '🚫 Bu şəkil Gemini-nin təhlükəsizlik filtrindən keçmədi.';
            }
            await sock.sendMessage(chatId, { text: errMsg, ...channelInfo }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
