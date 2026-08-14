import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { GoogleGenAI } from '@google/genai';

export default {
    command: 'stt',
    aliases: ['totext', 'transcribe'],
    category: 'ai',
    description: 'Convert voice note or audio to text using Gemini API',
    usage: '.stt (reply to an audio message)',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted?.audioMessage) {
            return await sock.sendMessage(chatId, { text: '❌ Please reply to a voice note or audio message with `.stt`' }, { quoted: message });
        }
        
        // Use config.GEMINI_API_KEY if available in context, otherwise fallback to process.env
        const apiKey = process.env.GEMINI_API_KEY || context.config?.GEMINI_API_KEY;
        if (!apiKey) {
            return await sock.sendMessage(chatId, { text: '❌ `GEMINI_API_KEY` is missing. Please add it to your Railway Variables.' }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, { text: '🎧 Audio is being transcribed via Gemini, please wait...' }, { quoted: message });
            
            // Download the audio buffer
            const quotedMsg = { message: { audioMessage: quoted.audioMessage } };
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            
            // For Railway (Serverless), in-memory Buffer to Base64 is the best approach (No temp files needed)
            const base64Audio = buffer.toString('base64');
            
            // Initialize Gemini
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // Make API request to Gemini 1.5 Flash (or gemini-2.5-flash if available)
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: quoted.audioMessage.mimetype || 'audio/ogg',
                                    data: base64Audio
                                }
                            },
                            { text: 'Səsdəki danışığı tam və dəqiq şəkildə mətnə çevir. Yalnız və yalnız deyilənləri yaz, əlavə heç bir şey yazma. Dilini avtomatik təyin et.' }
                        ]
                    }
                ]
            });
            
            if (response.text) {
                await sock.sendMessage(chatId, { text: `🗣️ *Gemini STT (Transkripsiya):*\n\n${response.text}` }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Failed to transcribe the audio via Gemini.' }, { quoted: message });
            }
            
        } catch (error) {
            console.error('STT Plugin Error (Gemini):', error);
            await sock.sendMessage(chatId, { text: `❌ Error: ${error.message}` }, { quoted: message });
        }
    }
};