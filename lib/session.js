import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import axios from 'axios';
const GITHUB_USERNAME = 'stormfiber';
/**
 * Save credentials from GitHub Gist to session/creds.json
 * @param {string} txt - Gist ID with optional prefix
 */
async function SaveCreds(txt) {
    const __dirname = path.dirname(__filename);
    const sessionId = String(txt || '').trim();
    const gistId = sessionId.replace(/^GlobalTechInfo\/MEGA-MD_/, '');
    if (!gistId || gistId === sessionId) {
        throw new Error('Invalid SESSION_ID format. Expected GlobalTechInfo/MEGA-MD_<gist_id>');
    }
    const gistUrl = `https://gist.githubusercontent.com/${GITHUB_USERNAME}/${gistId}/raw/creds.json?ts=${Date.now()}`;
    try {
        console.log(`[SESSION] Downloading credentials from ${gistUrl}`);
        const response = await axios.get(gistUrl);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const credentials = JSON.parse(data);
        if (!credentials.noiseKey || !credentials.signedIdentityKey || !credentials.signedPreKey) {
            throw new Error('Downloaded session is not a valid Baileys creds.json');
        }
        const sessionDir = path.join(process.cwd(), 'session');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        const credsPath = path.join(sessionDir, 'creds.json');
        fs.writeFileSync(credsPath, JSON.stringify(credentials));
        console.log('[SESSION] Credentials downloaded successfully');
    }
    catch (error) {
        console.error('❌ Error downloading or saving credentials:', error.message);
        if (error.response) {
            console.error('❌ Status:', error.response.status);
            console.error('❌ Response:', error.response.data);
        }
        throw error;
    }
}
export default SaveCreds;
