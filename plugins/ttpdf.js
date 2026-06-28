import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// ─── Font URL-ləri (sıralı cəhd) ─────────────────────────────────────────
const FONT_URLS = [
    'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/fonts/fontawesome-webfont.ttf', // fallback deyil, aşağıdakı işləyir
    'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/fonts/ttf/Roboto-Regular.ttf',
    'https://github.com/googlefonts/roboto/raw/main/fonts/ttf/Roboto-Regular.ttf',
];

const FONT_CACHE = path.join(process.cwd(), 'temp', 'Roboto-Regular.ttf');

async function getFont() {
    // Cache yoxla
    if (fs.existsSync(FONT_CACHE)) {
        return fs.readFileSync(FONT_CACHE);
    }

    fs.mkdirSync(path.dirname(FONT_CACHE), { recursive: true });

    for (const url of FONT_URLS) {
        try {
            console.log('[TTPDF] Font yüklənir:', url);
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const buf = Buffer.from(res.data);
            if (buf.length < 10000) continue; // keçərsiz fayl
            fs.writeFileSync(FONT_CACHE, buf);
            console.log('[TTPDF] ✅ Font yükləndi:', buf.length, 'bytes');
            return buf;
        } catch (e) {
            console.error('[TTPDF] URL xətası:', url, e.message);
        }
    }

    throw new Error('Font yüklənə bilmədi');
}

// ─── Sətir bölgüsü ────────────────────────────────────────────────────────
function wrapText(text, font, fontSize, maxWidth) {
    const lines = [];
    for (const para of text.split('\n')) {
        if (!para.trim()) { lines.push(''); continue; }
        const words = para.split(' ');
        let cur = '';
        for (const word of words) {
            const test = cur ? cur + ' ' + word : word;
            if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
                lines.push(cur);
                cur = word;
            } else {
                cur = test;
            }
        }
        if (cur) lines.push(cur);
    }
    return lines;
}

// ─── PDF yarat ────────────────────────────────────────────────────────────
async function createPDF(text, title) {
    const fontBytes = await getFont();
    const pdfDoc    = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);

    const W = 595, H = 842, M = 60;
    const FS = 13, TS = 18, LH = FS + 8;
    const CONTENT_W = W - M * 2;

    const C_BG    = rgb(0.98, 0.98, 0.98);
    const C_TEXT  = rgb(0.1,  0.1,  0.1);
    const C_TITLE = rgb(0.15, 0.15, 0.7);
    const C_LINE  = rgb(0.7,  0.7,  0.85);
    const C_GRAY  = rgb(0.5,  0.5,  0.5);

    const headerH    = M + (title ? TS + 24 : 10);
    const footerH    = 45;
    const usableH    = H - headerH - footerH;
    const lpp        = Math.floor(usableH / LH);

    const lines      = wrapText(text, font, FS, CONTENT_W);
    const chunks     = [];
    for (let i = 0; i < lines.length; i += lpp) chunks.push(lines.slice(i, i + lpp));
    if (!chunks.length) chunks.push([]);

    const total = chunks.length;

    for (let p = 0; p < total; p++) {
        const page = pdfDoc.addPage([W, H]);

        // Arxa fon
        page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_BG });

        // Üst rəng zolağı
        page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: C_TITLE });

        // Başlıq
        if (title && p === 0) {
            page.drawText(title, { x: M, y: H - M - TS, size: TS, font, color: C_TITLE });
            page.drawLine({
                start: { x: M, y: H - M - TS - 10 },
                end:   { x: W - M, y: H - M - TS - 10 },
                thickness: 1, color: C_LINE
            });
        }

        // Mətn
        const startY = H - headerH;
        for (let i = 0; i < chunks[p].length; i++) {
            const line = chunks[p][i];
            if (!line) continue;
            page.drawText(line, { x: M, y: startY - i * LH, size: FS, font, color: C_TEXT });
        }

        // Footer xətti
        page.drawLine({ start: { x: M, y: 35 }, end: { x: W - M, y: 35 }, thickness: 0.5, color: C_LINE });

        // Səhifə nömrəsi
        const num = `${p + 1} / ${total}`;
        const nw  = font.widthOfTextAtSize(num, 10);
        page.drawText(num, { x: (W - nw) / 2, y: 18, size: 10, font, color: C_GRAY });

        // Tarix
        page.drawText(new Date().toLocaleDateString('az-AZ'), { x: M, y: 18, size: 9, font, color: C_GRAY });
    }

    return pdfDoc.save();
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default {
    command: 'ttpdf',
    aliases: ['texttopdf', 'txt2pdf'],
    category: 'tools',
    description: 'Mətni PDF sənədinə çevirir',
    usage: '.ttpdf mətn\n.ttpdf Başlıq | mətn',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const input  = args.join(' ').trim();

        if (!input) {
            return sock.sendMessage(chatId, {
                text: '❌ Mətn daxil edin.\n\n*Nümunə:*\n`.ttpdf Salam dünya`\n`.ttpdf Hesabat | Bu ay satışlar artdı`'
            }, { quoted: message });
        }

        let title = '', text = input;
        if (input.includes('|')) {
            const parts = input.split('|');
            title = parts[0].trim();
            text  = parts.slice(1).join('|').trim();
        }

        if (!text) return sock.sendMessage(chatId, { text: '❌ Mətn boş ola bilməz.' }, { quoted: message });

        await sock.sendMessage(chatId, { text: '📄 PDF hazırlanır...' }, { quoted: message });

        try {
            const pdfBytes = await createPDF(text, title);
            const fileName = (title ? title.replace(/[^\w\s]/g, '').trim() : `Document_${Date.now()}`) + '.pdf';

            await sock.sendMessage(chatId, {
                document: Buffer.from(pdfBytes),
                mimetype: 'application/pdf',
                fileName,
                caption: `✅ PDF hazırdır${title ? ` — *${title}*` : ''}!`
            }, { quoted: message });

        } catch (err) {
            console.error('[TTPDF] Xəta:', err.message);
            await sock.sendMessage(chatId, { text: '❌ Xəta: ' + err.message }, { quoted: message });
        }
    }
};
