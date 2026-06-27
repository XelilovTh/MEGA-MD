// ============================================================
//  MEGA-MD — Gemini AI Plugin (axios versiyası)
//  Fayl: plugins/gemini.js
//  Railway Variables-ə əlavə et: GEMINI_API_KEY=your_api_key
//  Yeni paket lazım DEYİL — axios artıq quraşdırılıb
// ============================================================

import axios from 'axios';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Hər istifadəçi üçün söhbət tarixçəsi (in-memory)
const chatHistory = new Map();
const HISTORY_TTL = 30 * 60 * 1000; // 30 dəqiqə
const historyTimers = new Map();

function resetTimer(userId) {
    if (historyTimers.has(userId)) clearTimeout(historyTimers.get(userId));
    const timer = setTimeout(() => {
        chatHistory.delete(userId);
        historyTimers.delete(userId);
    }, HISTORY_TTL);
    historyTimers.set(userId, timer);
}

export default {
    command: 'gemini',
    aliases: ['ai', 'gemi', 'ask'],
    category: 'ai',
    description: 'Gemini AI ilə söhbət et. Kontekst 30 dəqiqə saxlanılır.',
    usage: '.gemini <sualın> | .gemini reset',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 3,

    async handler(sock, message, args, context = {}) {
        const { chatId, senderId, config, channelInfo } = context;

        // API açarı yoxla
        const apiKey = process.env.GEMINI_API_KEY || config?.GEMINI_API_KEY;
        if (!apiKey) {
            return await sock.sendMessage(chatId, {
                text: '❌ *GEMINI_API_KEY* tapılmadı!\n\nRailway → Variables bölməsinə əlavə et:\n`GEMINI_API_KEY` = AIza...\n\n🔗 https://aistudio.google.com/app/apikey',
                ...channelInfo
            }, { quoted: message });
        }

        const input = args.join(' ').trim();

        // Boş giriş
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *Gemini AI*\n\n*İstifadə:*\n• \`.gemini sualın\` — AI ilə söhbət et\n• \`.gemini reset\` — söhbəti sıfırla\n\n*Misal:*\n\`.gemini Azərbaycan haqqında məlumat ver\`\n\n💡 _Söhbət konteksti 30 dəqiqə saxlanılır_`,
                ...channelInfo
            }, { quoted: message });
        }

        // Söhbəti sıfırla
        if (input.toLowerCase() === 'reset') {
            chatHistory.delete(senderId);
            if (historyTimers.has(senderId)) {
                clearTimeout(historyTimers.get(senderId));
                historyTimers.delete(senderId);
            }
            return await sock.sendMessage(chatId, {
                text: '🔄 Söhbət tarixçəsi silindi!',
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            const history = chatHistory.get(senderId) || [];

            // Sistem promptu + tarixçə + yeni sual
            const contents = [
                {
                    role: 'user',
                    parts: [{ text: `Sən MEGA-MD WhatsApp botunun AI köməkçisisən. Qısa, aydın cavablar ver. WhatsApp formatlamasından istifadə et: *qalın*, _italic_. Azərbaycan dilində sual gəlirsə Azərbaycan dilində cavab ver.` }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Anladım, hazıram!' }]
                },
                ...history,
                {
                    role: 'user',
                    parts: [{ text: input }]
                }
            ];

            const response = await axios.post(
                `${GEMINI_API_URL}?key=${apiKey}`,
                {
                    contents,
                    generationConfig: {
                        maxOutputTokens: 1024,
                        temperature: 0.7
                    }
                },
                {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) throw new Error('Cavab alınmadı');

            // Tarixçəni yenilə
            history.push(
                { role: 'user', parts: [{ text: input }] },
                { role: 'model', parts: [{ text }] }
            );
            if (history.length > 20) history.splice(0, 2);
            chatHistory.set(senderId, history);
            resetTimer(senderId);

            const msgCount = Math.floor(history.length / 2);
            const footer = msgCount > 1
                ? `\n\n_💬 Söhbət: ${msgCount} mesaj | Sıfırla: .gemini reset_`
                : '';

            await sock.sendMessage(chatId, {
                text: `🤖 *Gemini AI*\n\n${text}${footer}`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Gemini Plugin Error]', err?.response?.data || err.message);

            const status = err?.response?.status;
            const errData = err?.response?.data?.error?.message || '';

            let errMsg = `❌ Xəta baş verdi: ${err.message}`;

            if (status === 400 || errData.includes('API key not valid')) {
                errMsg = '❌ *API açarı yanlışdır!*\nRailway → Variables → `GEMINI_API_KEY` dəyərini yoxla.';
            } else if (status === 429 || errData.includes('quota')) {
                errMsg = '⚠️ *Gemini API limiti doldu.*\nBir az gözləyib yenidən cəhd et.';
            } else if (errData.includes('SAFETY')) {
                errMsg = '🚫 Bu mesaj Gemini-nin təhlükəsizlik filtrindən keçmədi.';
            } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                errMsg = '⏱️ Zaman aşımı. Yenidən cəhd et.';
            } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
                errMsg = '🌐 DNS xətası. Railway şəbəkə bağlantısını yoxla.';
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
