import axios from 'axios';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const MODELS = {
    'llama':     'meta/llama-3.3-70b-instruct',
    'mistral':   'mistralai/mistral-7b-instruct-v0.3',
    'mixtral':   'mistralai/mixtral-8x7b-instruct-v0.1',
    'deepseek':  'deepseek-ai/deepseek-r1',
    'gemma':     'google/gemma-3-27b-it',
};

const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';
const chatHistory   = new Map();

function getHistory(userId) { return chatHistory.get(userId) || []; }

function saveHistory(userId, userMsg, assistantMsg) {
    const h = getHistory(userId);
    h.push({ role: 'user', content: userMsg }, { role: 'assistant', content: assistantMsg });
    if (h.length > 20) h.splice(0, 2);
    chatHistory.set(userId, h);
}

async function askNvidia(apiKey, model, userMsg, history) {
    const res = await axios.post(
        `${NVIDIA_BASE}/chat/completions`,
        {
            model,
            messages: [
                { role: 'system', content: 'Sən faydalı AI köməkçisisən. Azərbaycan dilində sual gəlirsə Azərbaycan dilində cavab ver. Qısa və aydın ol.' },
                ...history,
                { role: 'user', content: userMsg }
            ],
            max_tokens: 1024,
            temperature: 0.7,
            stream: false
        },
        {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000
        }
    );
    return res.data?.choices?.[0]?.message?.content?.trim();
}

function makePlugin(command, aliases, modelKey, label) {
    const model = MODELS[modelKey] || DEFAULT_MODEL;

    return {
        command,
        aliases,
        category: 'ai',
        description: `${label} ilə söhbət et`,
        usage: `.${command} <sualın> | .${command} reset`,

        async handler(sock, message, args, context) {
            const chatId   = context.chatId || message.key.remoteJid;
            const senderId = context.senderId || message.key.participant || message.key.remoteJid;
            const input    = args.join(' ').trim();

            const apiKey = process.env.NVIDIA_API_KEY;
            if (!apiKey) {
                return sock.sendMessage(chatId,
                    { text: '❌ `NVIDIA_API_KEY` tapılmadı.' },
                    { quoted: message }
                );
            }

            if (!input) {
                return sock.sendMessage(chatId,
                    { text: `🤖 *${label}*\n\n*İstifadə:* \`.${command} sualın\`\n*Sıfırla:* \`.${command} reset\`` },
                    { quoted: message }
                );
            }

            if (input === 'reset') {
                chatHistory.delete(senderId);
                return sock.sendMessage(chatId,
                    { text: '🔄 Söhbət sıfırlandı.' },
                    { quoted: message }
                );
            }

            await sock.sendPresenceUpdate('composing', chatId);

            try {
                const history = getHistory(senderId);
                const reply   = await askNvidia(apiKey, model, input, history);

                if (!reply) throw new Error('Boş cavab gəldi');

                saveHistory(senderId, input, reply);

                const msgCount = Math.floor(getHistory(senderId).length / 2);
                const footer   = msgCount > 1 ? `\n\n_💬 ${msgCount} mesaj | .${command} reset_` : '';

                await sock.sendMessage(chatId,
                    { text: `🤖 *${label}*\n\n${reply}${footer}` },
                    { quoted: message }
                );

            } catch (err) {
                console.error(`[${command.toUpperCase()}]`, err.message);
                let msg = '❌ Xəta: ' + err.message;
                if (err.response?.status === 401) msg = '❌ API açarı yanlışdır.';
                if (err.response?.status === 429) msg = '⚠️ Limit doldu, bir az gözlə.';
                if (err.response?.status === 404) msg = '❌ Model tapılmadı.';
                await sock.sendMessage(chatId, { text: msg }, { quoted: message });
            } finally {
                await sock.sendPresenceUpdate('available', chatId);
            }
        }
    };
}

// ─── Hər model ayrıca komanda ─────────────────────────────────────────────
export const llama    = makePlugin('llama',    ['nv', 'nvidia'],          'llama',    'Llama 3.3 70B');
export const deepseek = makePlugin('deepseek', ['ds', 'think'],           'deepseek', 'DeepSeek R1');
export const mistral  = makePlugin('mistral',  ['ms'],                    'mistral',  'Mistral 7B');
export const mixtral  = makePlugin('mixtral',  ['mx'],                    'mixtral',  'Mixtral 8x7B');
export const gemma    = makePlugin('gemma',    ['gm'],                    'gemma',    'Gemma 3 27B');

export default llama;
