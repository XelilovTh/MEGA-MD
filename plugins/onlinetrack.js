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

        const targetJid = number + '@s.whatsapp.net';

        // Online görünməyi söndür
        await sock.sendPresenceUpdate('unavailable');

        // Hədəfi izləməyə başla
        await sock.presenceSubscribe(targetJid);

        await sock.sendMessage(chatId, { text: `✅ İzlənilir: ${number}\n👻 Sən invisible oldun` }, { quoted: message });

        // Presence dəyişikliyini dinlə
        sock.ev.on('presence.update', async ({ id, presences }) => {
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