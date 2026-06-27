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

        await sock.sendPresenceUpdate('unavailable');
        await sock.presenceSubscribe(targetJid);

        // Subscribe olduğunu təsdiqlə
        await sock.sendMessage(ownerJid, { 
            text: `🔔 Subscribe edildi: ${number}\nİndi həmin nömrədə online ol` 
        });

        sock.ev.on('presence.update', async (data) => {
            // Hər presence event-i göndər (test üçün)
            await sock.sendMessage(ownerJid, { 
                text: `📡 Event gəldi:\n${JSON.stringify(data, null, 2)}` 
            });
        });
    }
};