import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

const client = new textToSpeech.TextToSpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

export default {
    command: 'tts',
    aliases: ['texttospeech', 'speak'],
    category: 'tools',
    description: 'Mətni səsə çevir (Google Cloud)',
    usage: '.tts Salam dünya',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return sock.sendMessage(chatId,
                { text: '❌ Mətn daxil edin.\n\n*Nümunə:* `.tts Salam dünya`' },
                { quoted: message }
            );
        }

        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            return sock.sendMessage(chatId,
                { text: '❌ Google Cloud TTS konfiqure edilməyib.' },
                { quoted: message }
            );
        }

        await sock.sendPresenceUpdate('recording', chatId);

        try {
            const request = {
                input: { text },
                voice: {
                    languageCode: 'az-AZ',
                    name: 'az-AZ-Standard-A',
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: { audioEncoding: 'MP3' }
            };

            const [response] = await client.synthesizeSpeech(request);
            const audioBuffer = response.audioContent;

            const tmpPath = path.join(process.cwd(), 'temp', `tts_${Date.now()}.mp3`);
            fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
            fs.writeFileSync(tmpPath, audioBuffer);

            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(tmpPath),
                mimetype: 'audio/mpeg',
                ptt: true
            }, { quoted: message });

            fs.unlinkSync(tmpPath);

        } catch (err) {
            console.error('[TTS-GOOGLE]', err.message);
            await sock.sendMessage(chatId,
                { text: `❌ Xəta: ${err.message}` },
                { quoted: message }
            );
        } finally {
            await sock.sendPresenceUpdate('available', chatId);
        }
    }
};
