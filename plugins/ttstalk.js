import axios from 'axios';

async function getUserInfo(username) {
    const { data } = await axios.get(`https://tikwm.com/api/user/info?unique_id=${username}`, { timeout: 15000 });
    if (data.code !== 0 || !data.data?.user) return null;
    return data.data;
}

async function getFollowing(userId) {
    const { data } = await axios.post('https://tikwm.com/api/user/following',
        `user_id=${userId}&count=50&cursor=0`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );
    if (data.code !== 0) return null;
    return data.data;
}

export default {
    command: 'ttstalk',
    aliases: ['tikstalk', 'ttprofile'],
    category: 'stalk',
    description: 'TikTok istifadəçi profilinə baxış',
    usage: '.ttstalk <istifadəçi adı> | .ttstalk following <istifadəçi adı>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *TikTok Stalk Komandaları*

/profile <ad> — Profil məlumatı
/following <ad> — İzlənilənlər siyahısı

Nümunə:
.ttstalk xelilov_th
.ttstalk following put1f`
            }, { quoted: message });
        }

        const sub = args[0].toLowerCase();
        const username = (sub === 'following' ? args[1] : args[0])?.replace('@', '');

        if (!username) {
            return await sock.sendMessage(chatId, {
                text: '*Zəhmət olmasa istifadəçi adı yazın.*\nNümunə: .ttstalk following put1f'
            }, { quoted: message });
        }

        try {
            const userData = await getUserInfo(username);
            if (!userData) {
                return await sock.sendMessage(chatId, { text: '❌ TikTok istifadəçisi tapılmadı.' }, { quoted: message });
            }
            const user = userData.user;
            const stats = userData.stats;

            if (sub === 'following') {
                if (user.privateAccount) {
                    return await sock.sendMessage(chatId, {
                        text: `🔒 *@${user.uniqueId}* hesab gizlidir. İzlənilənlər siyahısı görünmür.`
                    }, { quoted: message });
                }
                await sock.sendMessage(chatId, { text: '⏳ İzlənilənlər siyahısı yüklənir...' }, { quoted: message });

                const followingData = await getFollowing(user.id);
                if (!followingData || !followingData.followings?.length) {
                    return await sock.sendMessage(chatId, {
                        text: `➡️ *@${user.uniqueId}* heç kimi izləmir.`
                    }, { quoted: message });
                }

                let text = `➡️ *@${user.uniqueId}* izlənilənlər (${followingData.total} nəfər):\n\n`;
                followingData.followings.forEach((u, i) => {
                    const uid = u.unique_id || u.uniqueId || 'unknown';
                    text += `${i + 1}. @${uid} — ${u.nickname}${u.verified ? ' ✅' : ''}\n`;
                });
                text += `\n🔗 https://www.tiktok.com/@${user.uniqueId}`;

                const mentions = followingData.followings.map(u => (u.unique_id || u.uniqueId || '') + '@s.whatsapp.net');
                await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
                return;
            }

            const profileImage = user.avatarLarger || user.avatarMedium || user.avatarThumb;
            const verifiedMark = user.verified ? ' ✅ Təsdiqlənmiş' : '';
            const privateMark = user.privateAccount ? '🔒 Hesab gizli' : '🔓 Hesab açıq';
            const caption = `🎵 *TikTok Profil Məlumatı*\n\n` +
                `👤 Ad: ${user.nickname || 'N/A'}${verifiedMark}\n` +
                `🆔 İstifadəçi adı: @${user.uniqueId || 'N/A'}\n` +
                `📝 Bio: ${user.signature || 'Boş'}\n` +
                `🔒 Status: ${privateMark}\n\n` +
                `👥 İzləyicilər: ${stats?.followerCount || 0}\n` +
                `➡️ İzlənilənlər: ${stats?.followingCount || 0}\n` +
                `❤️ Bəyənmələr: ${stats?.heartCount || 0}\n` +
                `🎥 Videolar: ${stats?.videoCount || 0}\n\n` +
                `💡 *İzlənilənlər siyahısı:* .ttstalk following ${user.uniqueId}\n` +
                `🔗 Profil: https://www.tiktok.com/@${user.uniqueId}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        }
        catch (err) {
            console.error('TikTok plugin xətası:', err);
            await sock.sendMessage(chatId, { text: '❌ TikTok profili yüklənə bilmədi.' }, { quoted: message });
        }
    }
};
