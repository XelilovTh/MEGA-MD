// ============================================================
//  MEGA-MD — Gemini AI Plugin (@google/genai SDK)
//  Fayl: plugins/gemini.js
//  Railway Variables: GEMINI_API_KEY=AIza...
//  package.json-a əlavə et: "@google/genai": "^1.0.0"
// ============================================================

import { GoogleGenAI } from '@google/genai';

const chatHistory   = new Map();
const HISTORY_TTL   = 30 * 60 * 1000;
const historyTimers = new Map();

function resetTimer(userId) {
    if (historyTimers.has(userId)) clearTimeout(historyTimers.get(userId));
    historyTimers.set(userId, setTimeout(() => {
        chatHistory.delete(userId);
        historyTimers.delete(userId);
    }, HISTORY_TTL));
}

export default {
    command: 'gemini',
    aliases: ['ai', 'gemi', 'ask'],
    category: 'ai',
    description: 'Gemini 2.5 Flash AI ilə söhbət et.',
    usage: '.gemini <sualın> | .gemini reset',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 3,

    async handler(sock, message, args, context = {}) {
        const { chatId, senderId, config, channelInfo } = context;

        const apiKey = process.env.GEMINI_API_KEY || config?.GEMINI_API_KEY;
        if (!apiKey) {
            return await sock.sendMessage(chatId, {
                text: '❌ *GEMINI_API_KEY* tapılmadı!\n\nRailway → Variables bölməsinə əlavə et:\n`GEMINI_API_KEY` = AIza...\n\n🔗 https://aistudio.google.com/app/apikey',
                ...channelInfo
            }, { quoted: message });
        }

        const input = args.join(' ').trim();

        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *Gemini 2.5 Flash*\n\n*İstifadə:*\n• \`.gemini sualın\` — AI ilə söhbət et\n• \`.gemini reset\` — söhbəti sıfırla\n\n💡 _Söhbət konteksti 30 dəqiqə saxlanılır_`,
                ...channelInfo
            }, { quoted: message });
        }

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
            const ai = new GoogleGenAI({ apiKey });

            const history = chatHistory.get(senderId) || [];

            // Söhbəti qur
            const chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: 'Sən MEGA-MD WhatsApp botunun AI köməkçisisən. Qısa və aydın cavablar ver. WhatsApp formatlamasından istifadə et: *qalın*, _italic_. Azərbaycan dilində sual gəlirsə Azərbaycan dilində cavab ver.',
                    maxOutputTokens: 1024,
                    temperature: 0.7,
                },
                history
            });

            const response = await chat.sendMessage({ message: input });
            const text = response.text;

            if (!text) throw new Error('Cavab boş gəldi');

            // Tarixçəni yenilə
            history.push(
                { role: 'user',  parts: [{ text: input }] },
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
            console.error('[Gemini Plugin]', err?.message);

            let errMsg = `❌ Xəta: ${err.message}`;

            if (err.message?.includes('API key not valid') || err.message?.includes('INVALID_ARGUMENT')) {
                errMsg = '❌ *API açarı yanlışdır!*\nRailway → Variables → `GEMINI_API_KEY` dəyərini yoxla.';
            } else if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
                errMsg = '⚠️ *Gemini API limiti doldu.* Bir az gözləyib yenidən cəhd et.';
            } else if (err.message?.includes('SAFETY')) {
                errMsg = '🚫 Bu mesaj Gemini-nin təhlükəsizlik filtrindən keçmədi.';
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
