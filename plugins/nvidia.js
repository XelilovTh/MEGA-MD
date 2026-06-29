import axios from 'axios';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const MODELS = {
    'llama': 'meta/llama-3.3-70b-instruct',
    'mistral': 'mistralai/mistral-7b-instruct-v0.3',
    'mixtral': 'mistralai/mixtral-8x7b-instruct-v0.1',
    'deepseek': 'deepseek-ai/deepseek-r1',
    'gemma': 'google/gemma-3-27b-it',
};

const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

const chatHistory = new Map();

function getHistory(userId) {
    return chatHistory.get(userId) || [];
}

function saveHistory(userId, userMsg, assistantMsg) {
    const history = getHistory(userId);
    history.push(
        { role: 'user',      content: userMsg },
        { role: 'assistant', content: assistantMsg }
    );
    if (history.length > 20) history.splice(0, 2);
    chatHistory.set(userId, history);
}

export default {
    command: 'nvidia',
    aliases: ['nv', 'llama', 'nim'],
    category: 'ai',
    description: 'Nvidia NIM AI ilə söhbət et',
    usage: '.nvidia <sual>\n.nvidia model:<ad> <sual>\n.nvidia reset\n.nvidia models',

    async handler(sock, message, args, context) {
        const chatId   = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const input    = args.join(' ').trim();

        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
            return sock.sendMessage(chatId,
                { text: '❌ `NVIDIA_API_KEY` tapılmadı. `.env`-a əlavə et.' },
                { quoted: message }
            );
        }

        if (!input) {
            return sock.sendMessage(chatId, {
                text: `🤖 *Nvidia NIM AI*\n\n*İstifadə:*\n• \`.nvidia sualın\` — AI ilə danış\n• \`.nvidia model:mistral sualın\` — model seç\n• \`.nvidia reset\` — söhbəti sıfırla\n• \`.nvidia models\` — mövcud modellər\n\n_Default model: Llama 3.3 70B_`
            }, { quoted: message });
        }

        // Model siyahısı
        if (input === 'models') {
            const list = Object.entries(MODELS)
                .map(([k, v]) => `• \`.nvidia model:${k}\` → ${v}`)
                .join('\n');
            return sock.sendMessage(chatId,
                { text: `🧠 *Mövcud modellər:*\n\n${list}` },
                { quoted: message }
            );
        }

        // Sıfırla
        if (input === 'reset') {
            chatHistory.delete(senderId);
            return sock.sendMessage(chatId,
                { text: '🔄 Söhbət sıfırlandı.' },
                { quoted: message }
            );
        }

        // Model seç
        let model   = DEFAULT_MODEL;
        let userMsg = input;

        const modelMatch = input.match(/^model:(\w+)\s+/i);
        if (modelMatch) {
            const key = modelMatch[1].toLowerCase();
            model   = MODELS[key] || DEFAULT_MODEL;
            userMsg = input.replace(modelMatch[0], '').trim();
        }

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            const history = getHistory(senderId);

            const messages = [
                {
                    role: 'system',
                    content: 'Sən faydalı bir AI köməkçisisən. İstifadəçi Azərbaycan dilində yazırsa Azərbaycan dilində cavab ver. Qısa və aydın ol.'
                },
                ...history,
                { role: 'user', content: userMsg }
            ];

            const res = await axios.post(
                `${NVIDIA_BASE}/chat/completions`,
                {
                    model,
                    messages,
                    max_tokens: 1024,
                    temperature: 0.7,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const reply = res.data?.choices?.[0]?.message?.content?.trim();

            if (!reply) throw new Error('Boş cavab gəldi');

            saveHistory(senderId, userMsg, reply);

            const modelShort = Object.keys(MODELS).find(k => MODELS[k] === model) || 'llama';
            const msgCount   = Math.floor(getHistory(senderId).length / 2);
            const footer     = msgCount > 1
                ? `\n\n_💬 ${msgCount} mesaj | Sıfırla: .nvidia reset_`
                : '';

            await sock.sendMessage(chatId, {
                text: `🤖 *Nvidia NIM (${modelShort})*\n\n${reply}${footer}`
            }, { quoted: message });

        } catch (err) {
            console.error('[NVIDIA]', err.message);

            let errMsg = '❌ Xəta baş verdi: ' + err.message;
            if (err.response?.status === 401) errMsg = '❌ API açarı yanlışdır.';
            if (err.response?.status === 429) errMsg = '⚠️ Limit doldu, bir az gözlə.';
            if (err.response?.status === 404) errMsg = '❌ Model tapılmadı. `.nvidia models` ilə siyahıya bax.';

            await sock.sendMessage(chatId, { text: errMsg }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
