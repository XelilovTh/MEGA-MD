// ============================================================
//  MEGA-MD — Anonim Mesaj Plugini (Variant C)
//  Fayl: plugins/anonymous.js
//  WhatsApp-da olmayan xüsusiyyət: Anonim mesaj göndərmə
//  Xüsusiyyət: Qrupdakı komanda mesajı avtomatik silinir
// ============================================================

export default {
    command: 'anon',
    aliases: ['anonymous', 'gizli', 'anonim'],
    category: 'fun',
    description: 'Anonim mesaj göndər (qrupda heç bir iz qalmaz)',
    usage: '.anon @istifadeci mesajin',

    ownerOnly: false,
    groupOnly: true,      // Yalnız qruplarda işləyir
    adminOnly: false,
    isPrefixless: false,
    cooldown: 15,

    async handler(sock, message, args, context = {}) {
        const { chatId, senderId, channelInfo } = context;

        // ── Arqumentləri yoxla ──────────────────────────────
        if (args.length < 2) {
            // Kömək mesajı da silinəcək (qrupda iz qalmasın deyə)
            const helpMsg = await sock.sendMessage(chatId, {
                text: `🕵️ *Anonim Mesaj Plugini*\n\n*İstifadə:*\n\`.anon @istifadeci mesajin\`\n\n*Nümunə:*\n\`.anon @Ali Səni çox sevirəm!\`\n\n*Qeyd:*\n• Komanda mesajınız avtomatik silinəcək\n• Yalnız qruplarda işləyir`,
                ...channelInfo
            }, { quoted: message });

            // 5 saniyə sonra kömək mesajını sil
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: true,
                            id: helpMsg.key.id
                        }
                    });
                } catch (e) {}
            }, 5000);
            
            return;
        }

        // ── Qrup iştirakçılarını əldə et ─────────────────────
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Mention edilən istifadəçini tap
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentionedJids.length === 0) {
                const errorMsg = await sock.sendMessage(chatId, {
                    text: '❌ Zəhmət olmasa, mesajı göndərəcəyiniz istifadəçini @ ilə qeyd edin.',
                    ...channelInfo
                }, { quoted: message });
                
                // Xəta mesajını da sil
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: true,
                                id: errorMsg.key.id
                            }
                        });
                    } catch (e) {}
                }, 3000);
                
                return;
            }

            const targetJid = mentionedJids[0];
            
            // İstifadəçinin qrupda olub-olmadığını yoxla
            const isParticipant = participants.some(p => p.id === targetJid);
            if (!isParticipant) {
                const errorMsg = await sock.sendMessage(chatId, {
                    text: '❌ Bu istifadəçi qrupda yoxdur!',
                    ...channelInfo
                }, { quoted: message });
                
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: true,
                                id: errorMsg.key.id
                            }
                        });
                    } catch (e) {}
                }, 3000);
                
                return;
            }

            // Göndərənin özünə mesaj göndərməsinin qarşısını al
            if (targetJid === senderId) {
                const errorMsg = await sock.sendMessage(chatId, {
                    text: '😄 Özünə anonim mesaj göndərə bilməzsən!',
                    ...channelInfo
                }, { quoted: message });
                
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: true,
                                id: errorMsg.key.id
                            }
                        });
                    } catch (e) {}
                }, 3000);
                
                return;
            }

            // ── Qrupdakı komanda mesajını SİL ──────────────────
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: true,
                        id: message.key.id
                    }
                });
            } catch (e) {
                console.log('[Anonymous] Mesaj silinə bilmədi, amma davam edirik...');
            }

            // ── Mesajı hazırla ──────────────────────────────────
            const messageText = args.slice(1).join(' ');
            
            // Adminlər üçün görünən məlumat (təhlükəsizlik jurnalı)
            const senderName = message.pushName || 'Naməlum';
            console.log(`🕵️ [ADMIN LOG] ${senderName} (${senderId}) → ${targetJid}: ${messageText}`);

            // ── Anonim mesajı alıcıya göndər (şəxsi söhbət) ──
            await sock.sendMessage(targetJid, {
                text: `🕵️ *Anonim Mesaj*\n\n"${messageText}"\n\n_— Sizə anonim mesaj göndərilib_`,
                ...channelInfo
            });

            // ── Göndərənə təsdiq mesajı (şəxsi söhbət) ──────
            await sock.sendMessage(senderId, {
                text: `✅ Anonim mesajınız göndərildi!\n\n📝 Mesaj: "${messageText}"\n👤 Alıcı: @${targetJid.split('@')[0]}`,
                mentions: [targetJid],
                ...channelInfo
            });

            // ── Qrupa qısa bildiriş (opsional) ──────────────
            const notification = await sock.sendMessage(chatId, {
                text: `✅ Bir istifadəçi anonim mesaj göndərdi.`,
                ...channelInfo
            });

            // Bildirişi də 3 saniyə sonra sil
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: true,
                            id: notification.key.id
                        }
                    });
                } catch (e) {}
            }, 3000);

        } catch (err) {
            console.error('[Anonymous Plugin]', err.message);
            
            const errorMsg = await sock.sendMessage(chatId, {
                text: `❌ Xəta: ${err.message}`,
                ...channelInfo
            }, { quoted: message });
            
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: true,
                            id: errorMsg.key.id
                        }
                    });
                } catch (e) {}
            }, 5000);
        }
    }
};