import axios from 'axios';
import fs from 'fs';
import path from 'path';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const MODELS = {
    'll':   { model: 'meta/llama-3.3-70b-instruct',           label: 'Llama 3.3 70B', maxTokens: 1024  },
    'mx':   { model: 'mistralai/mixtral-8x7b-instruct-v0.1',  label: 'Mixtral 8x7B',  maxTokens: 1024  },
    'kimi': { model: 'moonshotai/kimi-k2.6',                  label: 'Kimi K2.6',      maxTokens: 16384 },
};

const DEFAULT = 'll';
const H = new Map();

const getH  = id => H.get(id) || [];
const saveH = (id, u, a) => {
    const h = getH(id);
    h.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    if (h.length > 20) h.splice(0, 2);
    H.set(id, h);
};

async function ask(apiKey, model, maxTokens, input, history) {
    const res = await axios.post(
        `${NVIDIA_BASE}/chat/completions`,
        {
            model,
            messages: [
                { role: 'system', content: 'Sən faydalı AI köməkçisisən. Azərbaycan dilində sual gəlirsə Azərbaycanca cavab ver. Qısa və aydın ol.' },
                ...history,
                { role: 'user', content: input }
            ],
            max_tokens: maxTokens,
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

export default {
    command: 'nv',
    aliases: ['nvidia'],
    category: 'ai',
    description: 'Nvidia NIM AI modelləri',
    usage: '.nv ll <sual> | .nv mx <sual> | .nv kimi <sual> | .nv reset',

    async handler(sock, message, args, context) {
        const chatId   = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const apiKey   = process.env.NVIDIA_API_KEY;

        if (!apiKey) return sock.sendMessage(chatId,
            { text: '❌ `NVIDIA_API_KEY` tapılmadı.' }, { quoted: message });

        const first    = (args[0] || '').toLowerCase();
        const modelKey = MODELS[first] ? first : DEFAULT;
        const input    = MODELS[first] ? args.slice(1).join(' ').trim() : args.join(' ').trim();

        // Siyahı
        if (!input && !MODELS[first]) {
            const list = Object.entries(MODELS)
                .map(([k, v]) => `• *.nv ${k}* — ${v.label}`)
                .join('\n');
            return sock.sendMessage(chatId, {
                text: `🤖 *Nvidia NIM*\n\n${list}\n\n*Nümunə:* \`.nv ll Salam\`\n*Sıfırla:* \`.nv reset\``
            }, { quoted: message });
        }

        // Reset
        if (input === 'reset' || first === 'reset') {
            H.delete(senderId);
            return sock.sendMessage(chatId, { text: '🔄 Söhbət sıfırlandı.' }, { quoted: message });
        }

        if (!input) return sock.sendMessage(chatId,
            { text: `❌ Mətn daxil et.\n*Nümunə:* \`.nv ${modelKey} sualın\`` }, { quoted: message });

        const { model, label, maxTokens } = MODELS[modelKey];

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            const history = getH(senderId);
            const reply   = await ask(apiKey, model, maxTokens, input, history);
            if (!reply) throw new Error('Boş cavab gəldi');

            saveH(senderId, input, reply);

            const n      = Math.floor(getH(senderId).length / 2);
            const footer = n > 1 ? `\n\n_💬 ${n} mesaj | .nv reset_` : '';

            // Kod bloku yoxla
            const codeMatch = reply.match(/```(\w+)?\n([\s\S]*?)```/);

            if (codeMatch) {
                const ext    = (codeMatch[1] || 'txt').toLowerCase();
                const code   = codeMatch[2].trim();
                const fname  = `output_${Date.now()}.${ext}`;
                const tmpPath = path.join(process.cwd(), 'temp', fname);

                fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
                fs.writeFileSync(tmpPath, code, 'utf-8');

                const textPart = reply.replace(codeMatch[0], '').trim();
                const caption  = `🤖 *${label}*${textPart ? '\n\n' + textPart : ''}${footer}`.slice(0, 1024);

                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(tmpPath),
                    mimetype: 'application/octet-stream',
                    fileName: fname,
                    caption
                }, { quoted: message });

                try { fs.unlinkSync(tmpPath); } catch {}
            } else {
                await sock.sendMessage(chatId, {
                    text: `🤖 *${label}*\n\n${reply}${footer}`
                }, { quoted: message });
            }

        } catch (err) {
            console.error('[NV]', err.response?.data || err.message);
            let msg = '❌ Xəta: ' + err.message;
            if (err.response?.status === 401) msg = '❌ API açarı yanlışdır.';
            if (err.response?.status === 429) msg = '⚠️ Limit doldu, bir az gözlə.';
            if (err.response?.status === 404) msg = '❌ Model tapılmadı.';
            if (err.response?.status === 410) msg = '❌ Bu model artıq mövcud deyil.';
            await sock.sendMessage(chatId, { text: msg }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
