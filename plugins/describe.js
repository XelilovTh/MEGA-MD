// ============================================================
//  MEGA-MD — Şəkil İzah Plugin (Gemini Vision)
//  Fayl: plugins/describe.js
//  Gemini 2.5 Flash multimodal — GEMINI_API_KEY lazımdır
// ============================================================

import { GoogleGenAI } from '@google/genai';

export default {
    command: 'describe',
    aliases: ['bax', 'izah', 'vision', 'see', 'ne'],
    category: 'ai',
    description: 'Şəkilə bax və nə olduğunu izah et.',
    usage: 'Şəkilə reply edib .describe yaz | .describe sual (şəkil haqqında sual ver)',

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

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage
            || quoted?.viewOnceMessage?.message?.imageMessage
            || quoted?.stickerMessage;

        // Şəkil birbaşa göndərilibsə
        const directImage = message.message?.imageMessage;

        const targetImage = imageMsg || directImage;

        if (!targetImage) {
            return await sock.sendMessage(chatId, {
                text: `👁️ *Şəkil İzah (Gemini Vision)*\n\n*İstifadə:*\n• Şəkilə reply edib \`.describe\` yaz\n• Şəkilə reply edib \`.describe bu nə rəngdir?\` — xüsusi sual ver\n\n*Nə edə bilər:*\n• Şəkildəki əşyaları tanıyır\n• İnsanların emosiyasını oxuyur\n• Mətni görür (OCR)\n• Yerləri tanıyır\n• Hər hansı sualı cavablayır`,
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
            // Şəkili yüklə
            const msgForDownload = imageMsg
                ? { message: quoted, key: message.message?.extendedTextMessage?.contextInfo }
                : message;

            const stream = await sock.downloadMediaMessage(msgForDownload);
            const buffer = Buffer.isBuffer(stream) ? stream : Buffer.concat(
                await (async () => { const chunks = []; for await (const c of stream) chunks.push(c); return chunks; })()
            );

            const base64Image = buffer.toString('base64');
            const mimeType = targetImage.mimetype || 'image/jpeg';

            const ai = new GoogleGenAI({ apiKey });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        parts: [
                            {
                                inlineData: {
                                    mimeType,
                                    data: base64Image
                                }
                            },
                            { text: prompt }
                        ]
                    }
                ]
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

            await sock.sendMessage(chatId, {
                text: errMsg,
                ...channelInfo
            }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
