import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// ─── Font URL (Roboto — tam Unicode dəstəyi) ──────────────────────────────
const FONT_URL = 'https://github.com/google/fonts/raw/main/apache/roboto/Roboto%5Bwdth%2Cwght%5D.ttf';

// ─── Fontу yüklə (cache ilə) ──────────────────────────────────────────────
let cachedFont = null;

async function getFont() {
    if (cachedFont) return cachedFont;

    const fontPath = path.join(process.cwd(), 'temp', 'Roboto.ttf');

    if (fs.existsSync(fontPath)) {
        cachedFont = fs.readFileSync(fontPath);
        return cachedFont;
    }

    console.log('[TTPDF] Font yüklənir...');
    const res = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 30000 });
    fs.mkdirSync(path.dirname(fontPath), { recursive: true });
    fs.writeFileSync(fontPath, Buffer.from(res.data));
    cachedFont = Buffer.from(res.data);
    console.log('[TTPDF] Font yükləndi ✅');
    return cachedFont;
}

// ─── Mətn sətirlərinə böl ─────────────────────────────────────────────────
function wrapText(text, font, fontSize, maxWidth) {
    const paragraphs = text.split('\n');
    const lines = [];

    for (const para of paragraphs) {
        if (para.trim() === '') {
            lines.push('');
            continue;
        }

        const words = para.split(' ');
        let current = '';

        for (const word of words) {
            const test = current ? current + ' ' + word : word;
            const testWidth = font.widthOfTextAtSize(test, fontSize);

            if (testWidth > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }

        if (current) lines.push(current);
    }

    return lines;
}

// ─── PDF yarat ────────────────────────────────────────────────────────────
async function createPDF(text, title) {
    const fontBytes  = await getFont();
    const pdfDoc     = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const customFont = await pdfDoc.embedFont(fontBytes);
    const boldFont   = customFont; // eyni font, bold weight yoxdur

    // Səhifə parametrləri
    const PAGE_W     = 595;   // A4 genişlik (pt)
    const PAGE_H     = 842;   // A4 hündürlük (pt)
    const MARGIN     = 60;
    const CONTENT_W  = PAGE_W - MARGIN * 2;
    const FONT_SIZE  = 13;
    const TITLE_SIZE = 18;
    const LINE_H     = FONT_SIZE + 8;
    const TITLE_H    = TITLE_SIZE + 16;

    // Rənglər
    const COLOR_BG    = rgb(0.98, 0.98, 0.98);
    const COLOR_TEXT  = rgb(0.1,  0.1,  0.1);
    const COLOR_TITLE = rgb(0.15, 0.15, 0.7);
    const COLOR_LINE  = rgb(0.7,  0.7,  0.85);

    // Sətirləri hazırla
    const lines = wrapText(text, customFont, FONT_SIZE, CONTENT_W);

    // Neçə səhifə lazımdır?
    const headerH    = MARGIN + TITLE_H + 20;
    const footerH    = 40;
    const usableH    = PAGE_H - headerH - footerH;
    const linesPerPage = Math.floor(usableH / LINE_H);

    // Səhifələrə böl
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
        pages.push(lines.slice(i, i + linesPerPage));
    }
    if (pages.length === 0) pages.push([]);

    const totalPages = pages.length;

    for (let p = 0; p < totalPages; p++) {
        const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

        // Arxa fon
        page.drawRectangle({
            x: 0, y: 0,
            width: PAGE_W, height: PAGE_H,
            color: COLOR_BG
        });

        // Header xətti
        page.drawRectangle({
            x: 0, y: PAGE_H - 8,
            width: PAGE_W, height: 8,
            color: COLOR_TITLE
        });

        // Başlıq (yalnız ilk səhifədə)
        if (p === 0 && title) {
            page.drawText(title, {
                x: MARGIN,
                y: PAGE_H - MARGIN - TITLE_SIZE,
                size: TITLE_SIZE,
                font: boldFont,
                color: COLOR_TITLE
            });

            // Başlıq altında xətt
            page.drawLine({
                start: { x: MARGIN,          y: PAGE_H - MARGIN - TITLE_H },
                end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - TITLE_H },
                thickness: 1,
                color: COLOR_LINE
            });
        }

        // Mətn sətirləri
        const startY = PAGE_H - headerH;
        const pageLines = pages[p];

        for (let i = 0; i < pageLines.length; i++) {
            const line = pageLines[i];
            if (!line) continue;

            page.drawText(line, {
                x: MARGIN,
                y: startY - i * LINE_H,
                size: FONT_SIZE,
                font: customFont,
                color: COLOR_TEXT
            });
        }

        // Footer — səhifə nömrəsi
        page.drawLine({
            start: { x: MARGIN,          y: 35 },
            end:   { x: PAGE_W - MARGIN, y: 35 },
            thickness: 0.5,
            color: COLOR_LINE
        });

        const pageNum = `${p + 1} / ${totalPages}`;
        const numW    = customFont.widthOfTextAtSize(pageNum, 10);
        page.drawText(pageNum, {
            x: (PAGE_W - numW) / 2,
            y: 18,
            size: 10,
            font: customFont,
            color: rgb(0.5, 0.5, 0.5)
        });

        // Sol alt küncdə tarix
        const date = new Date().toLocaleDateString('az-AZ');
        page.drawText(date, {
            x: MARGIN,
            y: 18,
            size: 9,
            font: customFont,
            color: rgb(0.6, 0.6, 0.6)
        });
    }

    return await pdfDoc.save();
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default {
    command: 'ttpdf',
    aliases: ['texttopdf', 'txt2pdf'],
    category: 'tools',
    description: 'Mətni peşəkar PDF sənədinə çevirir',
    usage: '.ttpdf [başlıq | mətn]\n.ttpdf mətn (başlıqsız)',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const input  = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(chatId, {
                text: '❌ Mətn daxil edin.\n\n*İstifadə:*\n`.ttpdf Salam dünya`\n`.ttpdf Başlıq | Bu mətnin içindədir`'
            }, { quoted: message });
        }

        // Başlıq | Mətn formatını ayır
        let title = '';
        let text  = input;

        if (input.includes('|')) {
            const parts = input.split('|');
            title = parts[0].trim();
            text  = parts.slice(1).join('|').trim();
        }

        if (!text) {
            return sock.sendMessage(chatId, {
                text: '❌ Mətn boş ola bilməz.'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: '📄 PDF hazırlanır...'
        }, { quoted: message });

        try {
            const pdfBytes = await createPDF(text, title);

            const fileName = title
                ? `${title.replace(/[^a-zA-Z0-9\u0400-\u04FF ]/g, '').trim()}.pdf`
                : `Document_${Date.now()}.pdf`;

            await sock.sendMessage(chatId, {
                document: Buffer.from(pdfBytes),
                mimetype: 'application/pdf',
                fileName,
                caption: `✅ PDF hazırdır${title ? ` — *${title}*` : ''}!\n📄 ${text.length} simvol · ${Math.ceil(text.split('\n').length / 40) || 1} səhifə`
            }, { quoted: message });

        } catch (err) {
            console.error('[TTPDF] Xəta:', err.message);
            await sock.sendMessage(chatId, {
                text: '❌ PDF yaradılarkən xəta baş verdi: ' + err.message
            }, { quoted: message });
        }
    }
};
