import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const pdfSessions = new Map();

function getCmd(message) {
    const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    return text.trim().replace(/^[.!/#]/, '').split(' ')[0].toLowerCase();
}

export default {
    command: 'pdfadd',
    aliases: ['pdfmerge', 'pdfclear'],
    category: 'tools',
    description: 'Şəkilləri PDF-ə çevir',
    usage: '.pdfadd (şəklə reply) | .pdfmerge | .pdfclear',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const cmd    = getCmd(message);

        if (!pdfSessions.has(chatId)) pdfSessions.set(chatId, []);
        const session = pdfSessions.get(chatId);

        // ── .pdfclear ──────────────────────────────────────────────────────
        if (cmd === 'pdfclear') {
            pdfSessions.set(chatId, []);
            return sock.sendMessage(chatId,
                { text: '🗑️ Siyahı təmizləndi.' },
                { quoted: message }
            );
        }

        // ── .pdfmerge ──────────────────────────────────────────────────────
        if (cmd === 'pdfmerge') {
            if (session.length === 0) {
                return sock.sendMessage(chatId,
                    { text: '❌ Siyahı boşdur. Əvvəlcə şəkillərə reply edib `.pdfadd` yazın.' },
                    { quoted: message }
                );
            }

            await sock.sendMessage(chatId,
                { text: `📄 ${session.length} şəkil PDF-ə çevrilir...` },
                { quoted: message }
            );

            try {
                const pdfDoc = await PDFDocument.create();

                for (const buffer of session) {
                    let image;
                    try { image = await pdfDoc.embedJpg(buffer); } catch {
                        try { image = await pdfDoc.embedPng(buffer); } catch { continue; }
                    }
                    const page = pdfDoc.addPage([image.width, image.height]);
                    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                }

                const pdfBytes = await pdfDoc.save();
                const tmpPath  = path.join(process.cwd(), 'temp', `PDF_${Date.now()}.pdf`);
                fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
                fs.writeFileSync(tmpPath, pdfBytes);

                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(tmpPath),
                    mimetype: 'application/pdf',
                    fileName: `Images_${Date.now()}.pdf`,
                    caption: `✅ ${session.length} şəkil PDF-ə çevrildi!`
                }, { quoted: message });

                fs.unlinkSync(tmpPath);
                pdfSessions.set(chatId, []);

            } catch (err) {
                console.error('[PDF-MULTIPIC] Merge xətası:', err.message);
                await sock.sendMessage(chatId,
                    { text: '❌ PDF yaradılarkən xəta baş verdi.' },
                    { quoted: message }
                );
            }
            return;
        }

        // ── .pdfadd ────────────────────────────────────────────────────────
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        let imageMessage = null;
        let isQuoted     = false;

        if (quoted?.imageMessage) {
            imageMessage = quoted.imageMessage;
            isQuoted     = true;
        } else if (message.message?.imageMessage) {
            imageMessage = message.message.imageMessage;
        }

        if (!imageMessage) {
            return sock.sendMessage(chatId,
                { text: '❌ Şəklə reply edib `.pdfadd` yazın.' },
                { quoted: message }
            );
        }

        try {
            const msgToDownload = isQuoted ? { message: { imageMessage } } : message;
            const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {});
            session.push(buffer);

            await sock.sendMessage(chatId,
                { text: `✅ Əlavə edildi! Siyahıda: *${session.length}* şəkil\n\nBitirdikdən sonra *.pdfmerge* yazın.` },
                { quoted: message }
            );
        } catch (err) {
            console.error('[PDF-MULTIPIC] Add xətası:', err.message);
            await sock.sendMessage(chatId,
                { text: '❌ Şəkil yüklənə bilmədi.' },
                { quoted: message }
            );
        }
    }
};
