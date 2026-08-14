import fs from 'fs';
import path from 'path';
import axios from 'axios';
export default {
    command: 'savesession',
    aliases: ['saveses', 'savesessionid', 'getsessionid'],
    category: 'owner',
    description: 'Save session to GitHub Gist and get SESSION_ID',
    usage: '.savesession',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId } = context;
        const credsPath = path.join(process.cwd(), 'session', 'creds.json');
        if (!fs.existsSync(credsPath)) {
            return await sock.sendMessage(chatId, {
                text: '❌ No session found. Connect the bot first via QR code.'
            }, { quoted: message });
        }
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            if (!creds.noiseKey || !creds.signedIdentityKey) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Invalid session file.'
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: '⏳ Uploading session to GitHub Gist...'
            }, { quoted: message });
            const credsContent = JSON.stringify(creds, null, 2);
            const githubToken = process.env.GITHUB_TOKEN;
            const githubUser = process.env.GITHUB_USERNAME || 'XelilovTh';
            if (!githubToken) {
                return await sock.sendMessage(chatId, {
                    text: '❌ GITHUB_TOKEN not set in environment variables.\n\nManual method:\n1. Copy session/creds.json content\n2. Go to https://gist.github.com/\n3. Create new secret gist with filename: creds.json\n4. Paste the content\n5. Copy the Gist ID from URL\n6. Set SESSION_ID in .env'
                }, { quoted: message });
            }
            const response = await axios.post('https://api.github.com/gists', {
                description: 'MEGA-MD Session - Auto generated',
                public: false,
                files: {
                    'creds.json': {
                        content: credsContent
                    }
                }
            }, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const gistId = response.data.id;
            const gistUrl = response.data.html_url;
            await sock.sendMessage(chatId, {
                text: `✅ *Session saved successfully!*\n\n*Gist URL:* ${gistUrl}\n*Session ID (GIST_ID):* ${gistId}\n\nNow add this to your .env:\n\`\`\`\nSESSION_ID=${gistId}\n\`\`\`\n\nThis session will be auto-loaded on each deploy.`
            }, { quoted: message });
        }
        catch (error) {
            console.error('Save session error:', error.message);
            let errorMsg = '❌ Failed to save session.\n';
            if (error.response?.status === 401) {
                errorMsg += 'Invalid GITHUB_TOKEN.';
            }
            else {
                errorMsg += `Error: ${error.message}`;
            }
            await sock.sendMessage(chatId, {
                text: errorMsg
            }, { quoted: message });
        }
    }
};
