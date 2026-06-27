
// Hər istifadəçi üçün söhbət tarixçəsi saxlanılır (in-memory)
const chatHistory = new Map();

// Tarixçəni 30 dəqiqədən sonra sil (yaddaş idarəsi)
const HISTORY_TTL = 30 * 60 * 1000;
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
    usage: '.gemini <sualın> | .gemini reset (söhbəti sıfırla)',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 3,

    async handler(sock, message, args, context = {}) {
        const {
            chatId,
            senderId,
            config,
            channelInfo
        } = context;

        // ── API açarı yoxla ──────────────────────────────────
        const apiKey = process.env.GEMINI_API_KEY || config?.GEMINI_API_KEY;
        if (!apiKey) {
            return await sock.sendMessage(chatId, {
                text: '❌ *GEMINI_API_KEY* tapılmadı!\n\n📝 Railway → Variables bölməsinə əlavə et:\n`GEMINI_API_KEY` = your_api_key_here\n\n🔗 API açarı al: https://aistudio.google.com/app/apikey',
                ...channelInfo
            }, { quoted: message });
        }

        // ── @google/generative-ai paketi yüklə ──────────────
        let GoogleGenerativeAI;
        try {
            const mod = await import('@google/generative-ai');
            GoogleGenerativeAI = mod.GoogleGenerativeAI;
        } catch {
            return await sock.sendMessage(chatId, {
                text: '❌ Paket tapılmadı. Terminalda çalıştır:\n```\nnpm install @google/generative-ai\n```',
                ...channelInfo
            }, { quoted: message });
        }

        const input = args.join(' ').trim();

        // ── Giriş yoxlanması ─────────────────────────────────
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *Gemini AI*\n\n*İstifadə:*\n• \`.gemini sualın\` — AI ilə söhbət et\n• \`.gemini reset\` — söhbəti sıfırla\n\n*Misal:*\n\`.gemini Azərbaycan haqqında məlumat ver\`\n\n💡 _Söhbət konteksti 30 dəqiqə saxlanılır_`,
                ...channelInfo
            }, { quoted: message });
        }

        // ── Söhbəti sıfırla ──────────────────────────────────
        if (input.toLowerCase() === 'reset') {
            chatHistory.delete(senderId);
            if (historyTimers.has(senderId)) {
                clearTimeout(historyTimers.get(senderId));
                historyTimers.delete(senderId);
            }
            return await sock.sendMessage(chatId, {
                text: '🔄 Söhbət tarixçəsi silindi. Yeni söhbətə başlaya bilərsən!',
                ...channelInfo
            }, { quoted: message });
        }

        // ── "Yazır..." göstər ────────────────────────────────
        await sock.sendPresenceUpdate('composing', chatId);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                systemInstruction: `Sən MEGA-MD WhatsApp botunun AI köməkçisisən. 
Qısa, aydın və faydalı cavablar ver. 
WhatsApp formatlamasından istifadə et: *qalın*, _italic_, \`kod\`.
Azərbaycan dilində sual gəlirsə Azərbaycan dilində cavab ver.`
            });

            // Tarixçəni al və ya yeni başlat
            const history = chatHistory.get(senderId) || [];

            const chat = model.startChat({
                history,
                generationConfig: {
                    maxOutputTokens: 1024,
                    temperature: 0.7,
                }
            });

            const result = await chat.sendMessage(input);
            const response = await result.response;
            const text = response.text();

            // Tarixçəni yenilə
            history.push(
                { role: 'user', parts: [{ text: input }] },
                { role: 'model', parts: [{ text }] }
            );

            // Son 10 mesajı saxla (yaddaş daşmasın)
            if (history.length > 20) history.splice(0, 2);
            chatHistory.set(senderId, history);
            resetTimer(senderId);

            // Cavab göndər
            const msgCount = Math.floor(history.length / 2);
            const footer = msgCount > 1 ? `\n\n_💬 Söhbət: ${msgCount} mesaj | Sıfırla: .gemini reset_` : '';

            await sock.sendMessage(chatId, {
                text: `🤖 *Gemini AI*\n\n${text}${footer}`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Gemini Plugin Error]', err);

            let errMsg = '❌ Xəta baş verdi.';

            if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')) {
                errMsg = '❌ *API açarı yanlışdır!*\n\nRailway → Variables bölməsindəki `GEMINI_API_KEY` dəyərini yoxla.';
            } else if (err.message?.includes('QUOTA_EXCEEDED') || err.message?.includes('quota')) {
                errMsg = '⚠️ *Gemini API limiti doldu.*\nBir az gözləyib yenidən cəhd et.';
            } else if (err.message?.includes('SAFETY')) {
                errMsg = '🚫 Bu mesaj Gemini-nin təhlükəsizlik filtrindən keçmədi.';
            } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
                errMsg = '🌐 Şəbəkə xətası. İnternet bağlantısını yoxla.';
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
