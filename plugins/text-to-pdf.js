import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export default {
    command: 'ttpdf',
    aliases: ['texttopdf', 'metinpdf'],
    category: 'tools',
    description: 'Yazdığınız mətni PDF sənədinə çevirir',
    usage: '.ttpdf <mətniniz>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return await sock.sendMessage(chatId, { text: '❌ Zəhmət olmasa PDF-ə çevirmək istədiyiniz mətni yazın.\nMisal: `.ttpdf Salam bu mənim yeni PDF sənədimdir`' }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, { text: '📄 Mətn PDF-ə çevrilir...' }, { quoted: message });
            
            const pdfDoc = await PDFDocument.create();
            // Using standard Helvetica font (Note: might not support all complex Unicode/emojis)
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            const fontSize = 14;
            const margin = 50;

            // Simple text wrapping logic
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const widthOfCurrentLine = font.widthOfTextAtSize(currentLine + ' ' + word, fontSize);
                if (widthOfCurrentLine < width - 2 * margin) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);

            // Draw text line by line
            let y = height - margin;
            for (const line of lines) {
                if (y < margin) {
                    // Page full, but for simplicity we assume it fits one page, or we could add new page
                    break;
                }
                page.drawText(line, {
                    x: margin,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                y -= (fontSize + 10);
            }

            const pdfBytes = await pdfDoc.save();
            const tempFile = path.join(process.cwd(), 'temp', `TextPDF_${Date.now()}.pdf`);
            fs.writeFileSync(tempFile, pdfBytes);
            
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(tempFile),
                mimetype: 'application/pdf',
                fileName: 'Text_Document.pdf',
                caption: '✅ Mətniniz PDF olaraq hazırdır!'
            }, { quoted: message });
            
            fs.unlinkSync(tempFile);
            
        } catch (error) {
            console.error('TextToPDF Plugin Error:', error);
            await sock.sendMessage(chatId, { text: '❌ PDF yaradılarkən xəta baş verdi.' }, { quoted: message });
        }
    }
};