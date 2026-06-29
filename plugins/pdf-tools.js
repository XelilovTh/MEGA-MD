import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export default {
    command: 'topdf',
    aliases: ['imgtopdf', 'pdf'],
    category: 'tools',
    description: 'Convert an image to a PDF file',
    usage: '.topdf (reply to an image or send image with caption)',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
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
            return await sock.sendMessage(chatId, { text: '❌ Please reply to an image or send an image with caption `.topdf`' }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, { text: '📄 Converting to PDF...' }, { quoted: message });
            
            // Download image buffer
            const msgToDownload = isQuoted ? { message: { imageMessage } } : message;
            const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {});
            
            // Create PDF Document
            const pdfDoc = await PDFDocument.create();
            
            let image;
            try {
                image = await pdfDoc.embedJpg(buffer);
            } catch (e) {
                try {
                    // Try PNG if JPG fails
                    image = await pdfDoc.embedPng(buffer);
                } catch (err) {
                    return await sock.sendMessage(chatId, { text: '❌ Unsupported image format. Only JPG and PNG are supported.' }, { quoted: message });
                }
            }
            
            // Add page matching image dimensions
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });
            
            // Save PDF to temp folder
            const pdfBytes = await pdfDoc.save();
            const tempFile = path.join(process.cwd(), 'temp', `Converted_${Date.now()}.pdf`);
            fs.writeFileSync(tempFile, pdfBytes);
            
            // Send back to user
            await sock.sendMessage(chatId, {
                document: fs.readFileSync(tempFile),
                mimetype: 'application/pdf',
                fileName: 'converted.pdf',
                caption: '✅ Here is your PDF document!'
            }, { quoted: message });
            
            // Cleanup temp file
            fs.unlinkSync(tempFile);
            
        } catch (error) {
            console.error('ToPDF Plugin Error:', error);
            await sock.sendMessage(chatId, { text: '❌ Failed to convert image to PDF.' }, { quoted: message });
        }
    }
};