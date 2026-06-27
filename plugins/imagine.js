// ============================================================
//  MEGA-MD — AI Şəkil Generatoru Plugin
//  Fayl: plugins/imagine.js
//  Pollinations.ai istifadə edir — PULSUZ, API key lazım deyil!
// ============================================================

import axios from 'axios';

export default {
    command: 'imagine',
    aliases: ['image', 'gen', 'draw'],
    category: 'ai',
    description: 'AI ilə şəkil yarat. Pollinations.ai (pulsuz).',
    usage: '.imagine <təsvir> | .imagine --model <model adı> <təsvir>',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 10,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        const input = args.join(' ').trim();

        // ── Boş giriş ────────────────────────────────────────
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `🎨 *AI Şəkil Generatoru*\n\n*İstifadə:*\n• \`.imagine təsvirin\`\n• \`.imagine --model flux <təsvir>\`\n\n*Mövcud modellər:*\n• \`flux\` — ən keyfiyyətli (default)\n• \`flux-realism\` — real fotoya bənzər\n• \`flux-anime\` — anime stili\n• \`flux-3d\` — 3D render\n• \`turbo\` — sürətli\n\n*Misal:*\n\`.imagine a futuristic city in Azerbaijan at sunset\`\n\`.imagine --model flux-anime a samurai cat\``,
                ...channelInfo
            }, { quoted: message });
        }

        // ── Model seçimi ──────────────────────────────────────
        let model = 'flux';
        let prompt = input;

        if (input.startsWith('--model ')) {
            const parts = input.slice(8).split(' ');
            model = parts[0].toLowerCase();
            prompt = parts.slice(1).join(' ').trim();

            const validModels = ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo'];
            if (!validModels.includes(model)) {
                return await sock.sendMessage(chatId, {
                    text: `❌ Yanlış model: *${model}*\n\nMövcud modellər: ${validModels.map(m => `\`${m}\``).join(', ')}`,
                    ...channelInfo
                }, { quoted: message });
            }

            if (!prompt) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Təsvir boş ola bilməz! `.imagine --model flux <təsvirin>`',
                    ...channelInfo
                }, { quoted: message });
            }
        }

        // ── "Şəkil çəkilir..." bildirişi ─────────────────────
        await sock.sendMessage(chatId, {
            text: `🎨 *Şəkil yaradılır...*\n\n📝 Prompt: _${prompt}_\n🤖 Model: \`${model}\`\n\n⏳ _10-20 saniyə gözləyin..._`,
            ...channelInfo
        }, { quoted: message });

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            // URL encode
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 999999);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

            // Şəkli yüklə
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const imageBuffer = Buffer.from(response.data);

            // Şəkli göndər
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `🎨 *AI Şəkil Generatoru*\n\n📝 *Prompt:* ${prompt}\n🤖 *Model:* \`${model}\`\n\n_Powered by Pollinations.ai_`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Imagine Plugin]', err.message);

            let errMsg = `❌ Şəkil yaradılmadı: ${err.message}`;

            if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                errMsg = '⏱️ Zaman aşımı. Pollinations.ai cavab vermədi.\nYenidən cəhd et.';
            } else if (err.response?.status === 429) {
                errMsg = '⚠️ Çox tez-tez sorğu. 30 saniyə gözləyib yenidən cəhd et.';
            } else if (err.response?.status >= 500) {
                errMsg = '🔧 Pollinations.ai serveri müvəqqəti işləmir. Bir az sonra cəhd et.';
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
