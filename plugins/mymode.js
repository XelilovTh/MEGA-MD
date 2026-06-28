const COMMANDS = [
    '.autoreact off',
    '.autoread off',
    '.autotyping off',
    '.autostatus off',
    '.autoview off',
    '.mode private'
];

function getBotJid(sock) {
    const raw = sock.user?.id || '';
    const num = raw.split(':')[0].split('@')[0];
    return `${num}@s.whatsapp.net`;
}

export default {
    command: 't',
    aliases: ['stealth', 'gizli'],
    category: 'owner',
    ownerOnly: true,

    async handler(sock, message, args, context) {
        const myJid = getBotJid(sock);

        for (const cmd of COMMANDS) {
            await sock.sendMessage(myJid, { text: cmd });
            await new Promise(r => setTimeout(r, 800));
        }

        console.log('[STEALTH] ✅ Bütün əmrlər göndərildi');
    }
};
