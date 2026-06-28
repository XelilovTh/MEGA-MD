import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, '..', 'fonts', 'Roboto-Regular.ttf');

if (fs.existsSync(dest)) {
    console.log('✅ Font artıq mövcuddur');
    process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });

const url = 'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/fonts/ttf/Roboto-Regular.ttf';

console.log('📥 Font yüklənir...');
const file = fs.createWriteStream(dest);
https.get(url, res => {
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('✅ Font yükləndi:', dest);
    });
}).on('error', err => {
    fs.unlinkSync(dest);
    console.error('❌ Font xətası:', err.message);
});
