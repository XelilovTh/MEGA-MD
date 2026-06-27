// ============================================================
//  MEGA-MD — Web Axtarış Plugin
//  Fayl: plugins/search.js
//  DuckDuckGo API istifadə edir — PULSUZ, API key lazım deyil!
// ============================================================

import axios from 'axios';

export default {
    command: 'search',
    aliases: ['axtar', 'google', 'find', 's'],
    category: 'utility',
    description: 'Webdə axtarış et.',
    usage: '.search axtardığın şey',

    ownerOnly: false,
    groupOnly: false,
    adminOnly: false,
    isPrefixless: false,
    cooldown: 5,

    async handler(sock, message, args, context = {}) {
        const { chatId, channelInfo } = context;

        const query = args.join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🔍 *Web Axtarış*\n\n*İstifadə:* \`.search axtardığın şey\`\n\n*Misal:*\n\`.search Azərbaycan paytaxtı\`\n\`.search Python nədir\``,
                ...channelInfo
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `🔍 _"${query}" axtarılır..._`,
            ...channelInfo
        }, { quoted: message });

        await sock.sendPresenceUpdate('composing', chatId);

        try {
            // DuckDuckGo Instant Answer API
            const response = await axios.get('https://api.duckduckgo.com/', {
                params: {
                    q: query,
                    format: 'json',
                    no_html: 1,
                    skip_disambig: 1,
                    no_redirect: 1
                },
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const data = response.data;

            let result = '';

            // Birbaşa cavab
            if (data.AbstractText) {
                result += `📖 *${data.Heading || query}*\n\n${data.AbstractText}`;
                if (data.AbstractURL) result += `\n\n🔗 ${data.AbstractURL}`;
            }

            // Related topics
            if (!result && data.RelatedTopics?.length > 0) {
                const topics = data.RelatedTopics
                    .filter(t => t.Text)
                    .slice(0, 4)
                    .map((t, i) => `${i + 1}. ${t.Text}`)
                    .join('\n\n');

                if (topics) {
                    result = `🔍 *"${query}" üçün nəticələr:*\n\n${topics}`;
                }
            }

            // Cavab yoxdursa Google linki ver
            if (!result) {
                const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                result = `🔍 *"${query}"* üçün birbaşa cavab tapılmadı.\n\n🌐 Google-da aç:\n${googleUrl}`;
            }

            await sock.sendMessage(chatId, {
                text: result,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Search Plugin]', err.message);
            await sock.sendMessage(chatId, {
                text: `❌ Axtarış zamanı xəta: ${err.message}`,
                ...channelInfo
            }, { quoted: message });
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
