export default {
    command: 'onlinetrack',
    aliases: ['ot'],
    category: 'utility',
    description: 'Birinin online olduğunu izlə',
    usage: '.onlinetrack <nömrə>',
    isPrefixless: false,
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const { chatId, config } = context;

        const ownerJid = (config?.OWNER_NUMBER || process.env.OWNER_NUMBER) + '@s.whatsapp.net';

        const number = args[0]?.replace(/[^0-9]/g, '');
        if (!number) {
            await sock.sendMessage(chatId, { text: '❌ Nömrə yaz: .onlinetrack 994XXXXXXXXX' }, { quoted: message });
            return;
        }

        const targetJidS = number + '@s.whatsapp.net';

        // LID-i tap
        let targetJid = targetJidS;
        try {
            const [result] = await sock.onWhatsApp(targetJidS);
            if (result?.lid) {
                targetJid = result.lid;
                await sock.sendMessage(ownerJid, { text: `🔍 LID tapıldı: ${targetJid}` });
            }
        } catch (e) {
            await sock.sendMessage(ownerJid, { text: `⚠️ LID tapılmadı, @s.whatsapp.net ilə davam` });
        }

        await sock.sendPresenceUpdate('unavailable');
        await sock.presenceSubscribe(targetJid);

        await sock.sendMessage(chatId, { 
            text: `✅ İzlənilir: ${number}\n👻 Sən invisible oldun` 
        });

        sock.ev.on('presence.update', async (data) => {
            const { id, presences } = data;
            if (id !== targetJid) return;

            const presence = presences[targetJid]?.lastKnownPresence;
            if (!presence) return;

            const statusMap = {
                available: '🟢 Online oldu',
                unavailable: '⚫ Offline oldu',
                composing: '✏️ Yazır...',
                recording: '🎤 Səs yazır...',
                paused: '⏸ Yazmağı dayandırdı'
            };

            const text = statusMap[presence] || `❓ ${presence}`;
            const time = new Date().toLocaleTimeString('az-AZ');

            await sock.sendMessage(ownerJid, {
                text: `👤 *${number}*\n${text}\n🕐 ${time}`
            });
        });
    }
};