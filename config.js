import 'dotenv/config';

const env = (name, fallback = '') => process.env[name] ?? fallback;
const _prefixes = env('PREFIXES') ? env('PREFIXES').split(',') : ['.', '!', '/', '#'];
const config = {
    // Bot Identity
    botName: env('BOT_NAME', 'MEGA-MD'),
    botOwner: env('BOT_OWNER', 'Qasim Ali'),
    ownerNumber: env('OWNER_NUMBER', '923051391007'),
    author: env('AUTHOR', 'GlobalTechInfo'),
    packname: env('PACKNAME', 'MEGA-MD'),
    description: env('DESCRIPTION', 'High performance multi-device WhatsApp bot'),
    version: '6.0.0',
    // Bot Config
    prefixes: _prefixes,
    prefix: _prefixes[0],
    commandMode: env('COMMAND_MODE', 'public'),
    timeZone: env('TIMEZONE', 'Asia/Karachi'),
    // Links
    channelLink: env('CHANNEL_LINK', 'https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07'),
    updateZipUrl: env('UPDATE_URL', 'https://github.com/GlobalTechInfo/MEGA-MD/archive/refs/heads/main.zip'),
    ytChannel: env('YT_CHANNEL', 'GlobalTechInfo'),
    // Session
    sessionId: env('SESSION_ID').trim(),
    pairingNumber: env('PAIRING_NUMBER').trim(),
    // Performance
    port: Number(env('PORT', 5000)) || 5000,
    maxStoreMessages: Number(env('MAX_STORE_MESSAGES', 20)) || 20,
    tempCleanupInterval: Number(env('CLEANUP_INTERVAL', 1 * 60 * 60 * 1000)) || 1 * 60 * 60 * 1000,
    storeWriteInterval: Number(env('STORE_WRITE_INTERVAL', 10000)) || 10000,
    // API Keys
    giphyApiKey: env('GIPHY_API_KEY', 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq'),
    removeBgKey: env('REMOVEBG_KEY'),
    geminiApiKey: env('GEMINI_API_KEY'),
    nvidiaApiKey: env('NVIDIA_API_KEY'),
    auddApiKey: env('AUDD_API_KEY'),
    GEMINI_API_KEY: env('GEMINI_API_KEY'),
    NVIDIA_API_KEY: env('NVIDIA_API_KEY'),
    AUDD_API_KEY: env('AUDD_API_KEY'),
    DC_GEMINI_API: env('DC_GEMINI_API', env('DC_GEMINI_API_KEY')),
    // Warn system
    warnCount: 3,
    // External APIs
    APIs: {
        xteam: 'https://api.xteam.xyz',
        dzx: 'https://api.dhamzxploit.my.id',
        lol: 'https://api.lolhuman.xyz',
        violetics: 'https://violetics.pw',
        neoxr: 'https://api.neoxr.my.id',
        zenzapis: 'https://zenzapis.xyz',
        akuari: 'https://api.akuari.my.id',
        akuari2: 'https://apimu.my.id',
        nrtm: 'https://fg-nrtm.ddns.net',
        fgmods: 'https://api-fgmods.ddns.net'
    },
    APIKeys: {
        'https://api.xteam.xyz': env('XTEAM_API_KEY', 'd90a9e986e18778b'),
        'https://api.lolhuman.xyz': env('LOLHUMAN_API_KEY', '85faf717d0545d14074659ad'),
        'https://api.neoxr.my.id': env('NEOXR_KEY', 'yourkey'),
        'https://violetics.pw': 'beta',
        'https://zenzapis.xyz': env('ZENZAPIS_KEY', 'yourkey'),
        'https://api-fgmods.ddns.net': 'fg-dylux'
    }
};
export default config;
