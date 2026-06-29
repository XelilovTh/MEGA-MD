import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// In-memory storage for images per chat (optimized for Railway, but will reset on restart)
const pdfSessions = new Map();

export default {
    command: 'pdfadd',
    aliases: ['addpdf', 'pdfmerge', 'pdfclear'],
    category: 'tools',
    description: 'Bir neçə şəkli birləşdirib tək PDF etmək üçün alət',
    usage: '.pdfadd (şəklə reply) | .pdfmerge | .pdfclear',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const cmd = context.command; // The command that triggered this

        if (!pdfSessions.has(chatId)) {
            pdfSessions.set(chatId, []);
        }

        const session = pdfSessions.get(chatId);

        if (cmd === 'pdfclear') {
            pdfSessions.set(chatId, []);
            return await sock.sendMessage(chatId, { text: '🗑️ PDF yaddaşı təmizləndi! Yenidən şəkillər əlavə edə bilərsiniz.' }, { quoted: message });
        }

        if (cmd === 'pdfmerge') {
            if (session.length === 0) {
                return await sock.sendMessage(chatId, { text: '❌ Hələ heç bir şəkil əlavə etməmisiniz. Öncə şəkillərə reply verib `.pdfadd` yazın.' }, { quoted: message });
            }

            try {
                await sock.sendMessage(chatId, { text: `📄 ${session.length} şəkil PDF-ə çevrilir, zəhmət olmasa gözləyin...` }, { quoted: message });
                
                const pdfDoc = await PDFDocument.create();

                for (const buffer of session) {
                    let image;
                    try {
                        image = await pdfDoc.embedJpg(buffer);
                    } catch (e) {
                        try {
                            image = await pdfDoc.embedPng(buffer);
                        } catch (err) {
                            continue; // Skip unsupported image
                        }
                    }
                    
                    const page = pdfDoc.addPage([image.width, image.height]);
                    page.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: image.width,
                        height: image.height,
                    });
                }

                const pdfBytes = await pdfDoc.save();
                const tempFile = path.join(process.cwd(), 'temp', `MultiPDF_${Date.now()}.pdf`);
                fs.writeFileSync(tempFile, pdfBytes);
                
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(tempFile),
                    mimetype: 'application/pdf',
                    fileName: 'Merged_Images.pdf',
                    caption: '✅ Şəkilləriniz tək bir PDF sənədində birləşdirildi!'
                }, { quoted: message });
                
                fs.unlinkSync(tempFile);
                pdfSessions.set(chatId, []); // Clear session after success
                
            } catch (error) {
                console.error('MultiPDF Plugin Error:', error);
                await sock.sendMessage(chatId, { text: '❌ PDF yaradılarkən xəta baş verdi.' }, { quoted: message });
            }
            return;
        }

        // pdfadd command logic
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        let imageMessage = null;
        let isQuoted = false;
        if (quoted?.imageMessage) {
            imageMessage = quoted.imageMessage;
            isQuoted = true;
        } else if (message.message?.imageMessage) {
            imageMessage = message.message.imageMessage;
        }

        if (!imageMessage) {
            return await sock.sendMessage(chatId, { text: '❌ Zəhmət olmasa, əlavə etmək istədiyiniz şəklə reply verib `.pdfadd` yazın.' }, { quoted: message });
        }

        try {
            const msgToDownload = isQuoted ? { message: { imageMessage } } : message;
            const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {});
            
            session.push(buffer);
            await sock.sendMessage(chatId, { text: `✅ Şəkil yaddaşa əlavə edildi! (Cəmi: ${session.length})\n\nBütün şəkilləri əlavə etdikdən sonra PDF-i yaratmaq üçün *.pdfmerge* yazın.` }, { quoted: message });
        } catch (error) {
            console.error('PDF Add Error:', error);
            await sock.sendMessage(chatId, { text: '❌ Şəkil yüklənə bilmədi.' }, { quoted: message });
        }
    }
};