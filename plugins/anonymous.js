// ============================================================
//  MEGA-MD — Anonim Mesaj Plugini
//  Fayl: plugins/anonymous.js
//  WhatsApp-da olmayan xüsusiyyət: Anonim mesaj göndərmə
// ============================================================

export default {
    command: 'anon',
    aliases: ['anonymous', 'gizli', 'anonim'],
    category: 'fun',
    description: 'Anonim mesaj göndər (göndərən gizli qalır)',
    usage: '.anon @istifadəçi mesajın',

    ownerOnly: false,
    groupOnly: true,      // Yalnız qruplarda işləyir
    adminOnly: false,
    isPrefixless: false,
    cooldown: 10,

    async handler(sock, message, args, context = {}) {
        const { chatId, senderId, channelInfo } = context;

        // ── Arqumentləri yoxla ──────────────────────────────
        if (args.length < 2) {
            return await sock.sendMessage(chatId, {
                text: `🕵️ *Anonim Mesaj Plugini*\n\n*İstifadə:*\n\`.anon @istifadəçi mesajın\`\n\n*Nümunə:*\n\`.anon @Ali Səni çox sevirəm!\`\n\n*Qeyd:*\n• Yalnız qruplarda işləyir\n• Qrup adminləri kimin göndərdiyini görə bilər (sistem təhlükəsizliyi üçün)`,
                ...channelInfo
            }, { quoted: message });
        }

        // ── Qrup iştirakçılarını əldə et ─────────────────────
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Mention edilən istifadəçini tap
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentionedJids.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Zəhmət olmasa, mesajı göndərəcəyiniz istifadəçini @ ilə qeyd edin.',
                    ...channelInfo
                }, { quoted: message });
            }

            const targetJid = mentionedJids[0];
            
            // İstifadəçinin qrupda olub-olmadığını yoxla
            const isParticipant = participants.some(p => p.id === targetJid);
            if (!isParticipant) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Bu istifadəçi qrupda yoxdur!',
                    ...channelInfo
                }, { quoted: message });
            }

            // Göndərənin özünə mesaj göndərməsinin qarşısını al
            if (targetJid === senderId) {
                return await sock.sendMessage(chatId, {
                    text: '😄 Özünə anonim mesaj göndərə bilməzsən!',
                    ...channelInfo
                }, { quoted: message });
            }

            // ── Mesajı hazırla ──────────────────────────────────
            const messageText = args.slice(1).join(' ');
            
            // Adminlər üçün görünən məlumat (təhlükəsizlik jurnalı)
            const senderName = message.pushName || 'Naməlum';
            const adminLog = `[ADMIN LOG] ${senderName} (${senderId}) → ${targetJid}: ${messageText}`;
            console.log(`🕵️ ${adminLog}`);

            // ── Anonim mesajı göndər ──────────────────────────
            await sock.sendMessage(targetJid, {
                text: `🕵️ *Anonim Mesaj*\n\n"${messageText}"\n\n_— Sizə anonim mesaj göndərilib_`,
                ...channelInfo
            });

            // ── Göndərənə təsdiq mesajı ──────────────────────
            await sock.sendMessage(chatId, {
                text: `✅ Mesajınız anonim olaraq @${targetJid.split('@')[0]} istifadəçisinə göndərildi.`,
                mentions: [targetJid],
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[Anonymous Plugin]', err.message);
            
            let errMsg = `❌ Xəta: ${err.message}`;
            if (err.message?.includes('groupMetadata')) {
                errMsg = '❌ Qrup məlumatları alınmadı. Zəhmət olmasa, botun qrup admini olduğundan əmin olun.';
            }
            
            await sock.sendMessage(chatId, {
                text: errMsg,
                ...channelInfo
            }, { quoted: message });
        }
    }
};