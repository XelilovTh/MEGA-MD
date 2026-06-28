import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── Font tap ─────────────────────────────────────────────────────────────
function getFontBuffer() {
    const candidates = [
        // 1. Repo-dakı font
        path.join(process.cwd(), 'fonts', 'Roboto-Regular.ttf'),
        // 2. dejavu-fonts-ttf npm paketi
        (() => { try { return path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', 'DejaVuSans.ttf'); } catch { return null; } })(),
        // 3. Railway/Ubuntu sistem fontları
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
    ].filter(Boolean);

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log('[TTPDF] Font tapıldı:', p);
            return fs.readFileSync(p);
        }
    }

    throw new Error('TTF font tapılmadı. package.json-a "dejavu-fonts-ttf" əlavə edin.');
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
            try {
                if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
                    lines.push(cur); cur = word;
                } else { cur = test; }
            } catch { cur = test; }
        }
        if (cur) lines.push(cur);
    }
    return lines;
}

// ─── PDF yarat ────────────────────────────────────────────────────────────
async function createPDF(text, title) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontBytes = getFontBuffer();
    const font = await pdfDoc.embedFont(fontBytes);

    const W = 595, H = 842, M = 60;
    const FS = 13, TS = 18, LH = FS + 8;
    const CONTENT_W = W - M * 2;

    const C_BG    = rgb(0.98, 0.98, 0.98);
    const C_TEXT  = rgb(0.1,  0.1,  0.1);
    const C_TITLE = rgb(0.15, 0.15, 0.7);
    const C_LINE  = rgb(0.7,  0.7,  0.85);
    const C_GRAY  = rgb(0.5,  0.5,  0.5);

    const headerH = M + (title ? TS + 24 : 10);
    const footerH = 45;
    const lpp     = Math.floor((H - headerH - footerH) / LH);
    const lines   = wrapText(text, font, FS, CONTENT_W);
    const chunks  = [];
    for (let i = 0; i < lines.length; i += lpp) chunks.push(lines.slice(i, i + lpp));
    if (!chunks.length) chunks.push([]);

    const total = chunks.length;

    for (let p = 0; p < total; p++) {
        const page = pdfDoc.addPage([W, H]);

        page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C_BG });
        page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: C_TITLE });

        if (title && p === 0) {
            page.drawText(title, { x: M, y: H - M - TS, size: TS, font, color: C_TITLE });
            page.drawLine({
                start: { x: M, y: H - M - TS - 10 },
                end:   { x: W - M, y: H - M - TS - 10 },
                thickness: 1, color: C_LINE
            });
        }

        const startY = H - headerH;
        for (let i = 0; i < chunks[p].length; i++) {
            const line = chunks[p][i];
            if (!line) continue;
            page.drawText(line, { x: M, y: startY - i * LH, size: FS, font, color: C_TEXT });
        }

        page.drawLine({ start: { x: M, y: 35 }, end: { x: W - M, y: 35 }, thickness: 0.5, color: C_LINE });

        const num = `${p + 1} / ${total}`;
        const nw  = font.widthOfTextAtSize(num, 10);
        page.drawText(num, { x: (W - nw) / 2, y: 18, size: 10, font, color: C_GRAY });
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
