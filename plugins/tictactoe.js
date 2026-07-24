import TicTacToe from '../lib/tictactoe.js';
const games = {};
export async function handleTicTacToeMove(sock, chatId, senderId, text) {
    try {
        const room = Object.values(games).find((room) => room.id.startsWith('tictactoe') &&
            [room.game.playerX, room.game.playerO].includes(senderId) &&
            room.state === 'PLAYING');
        if (!room)
            return;
        const isSurrender = /^(təslim|təslim ol|hec hece)$/i.test(text);
        if (!isSurrender && !/^[1-9]$/.test(text))
            return;
        if (senderId !== room.game.currentTurn && !isSurrender) {
            await sock.sendMessage(chatId, {
                text: '❌ Sıra səndə deyil!'
            });
            return;
        }
        const ok = isSurrender ? true : room.game.turn(senderId === room.game.playerO, parseInt(text, 10) - 1);
        if (!ok) {
            await sock.sendMessage(chatId, {
                text: '❌ Keçərli gediş deyil! Həmin xana artıq tutulub.'
            });
            return;
        }
        let winner = room.game.winner;
        const isTie = room.game.turns === 9;
        const arr = room.game.render().map((v) => ({
            'X': '❎',
            'O': '⭕',
            '1': '1️⃣',
            '2': '2️⃣',
            '3': '3️⃣',
            '4': '4️⃣',
            '5': '5️⃣',
            '6': '6️⃣',
            '7': '7️⃣',
            '8': '8️⃣',
            '9': '9️⃣',
        }[v] || v));
        if (isSurrender) {
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            await sock.sendMessage(chatId, {
                text: `🏳️ @${senderId.split('@')[0]} təslim oldu! @${winner.split('@')[0]} oyunu qazandı!`,
                mentions: [senderId, winner]
            });
            delete games[room.id];
            return;
        }
        let gameStatus;
        if (winner) {
            gameStatus = `🎉 @${winner.split('@')[0]} oyunu qazandı! 🏆`;
        }
        else if (isTie) {
            gameStatus = `🤝 Oyun heç-heçə ilə bitdi!`;
        }
        else {
            gameStatus = `🎲 Sıra: @${room.game.currentTurn.split('@')[0]} (${senderId === room.game.playerX ? '❎' : '⭕'})`;
        }
        const str = `
🎮 *XO Oyunu*

${gameStatus}

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ ❎ Oyunçu: @${room.game.playerX.split('@')[0]}
▢ ⭕ Oyunçu: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? '📌 *Gediş etmək üçün:* 1-9 arası nömrə yaz\n📌 *Təslim olmaq üçün:* `təslim` yaz' : ''}
`;
        const mentions = [
            room.game.playerX,
            room.game.playerO,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];
        await sock.sendMessage(room.x, {
            text: str,
            mentions
        });
        if (room.x !== room.o) {
            await sock.sendMessage(room.o, {
                text: str,
                mentions
            });
        }
        if (winner || isTie) {
            delete games[room.id];
        }
    }
    catch (error) {
        console.error('TicTacToe xətası:', error);
    }
}
export default {
    command: 'tictactoe',
    aliases: ['ttt', 'xo'],
    category: 'games',
    description: 'Başqa bir istifadəçi ilə TicTacToe oynayın',
    usage: '.xo [otaq adı]',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const text = args.join(' ').trim();
        try {
            if (Object.values(games).find((room) => room.id.startsWith('tictactoe') &&
                [room.game.playerX, room.game.playerO].includes(senderId))) {
                await sock.sendMessage(chatId, {
                    text: '*Sən artıq oyundasan*\n\nÖncəki oyunu təslim olmaq üçün *təslim* yaz.'
                }, { quoted: message });
                return;
            }
            let room = Object.values(games).find((room) => room.state === 'WAITING' &&
                (text ? room.name === text : true));
            if (room) {
                room.o = chatId;
                room.game.playerO = senderId;
                room.state = 'PLAYING';
                const arr = room.game.render().map((v) => ({
                    'X': '❎',
                    'O': '⭕',
                    '1': '1️⃣',
                    '2': '2️⃣',
                    '3': '3️⃣',
                    '4': '4️⃣',
                    '5': '5️⃣',
                    '6': '6️⃣',
                    '7': '7️⃣',
                    '8': '8️⃣',
                    '9': '9️⃣',
                }[v] || v));
                const str = `
🎮 *XO Oyunu Başladı!*

@${room.game.currentTurn.split('@')[0]} oynamaq üçün gözlənilir...

${arr.slice(0, 3).join('')}
${arr.slice(3, 6).join('')}
${arr.slice(6).join('')}

▢ *Otaq:* ${room.id}
▢ *Qaydalar:*
• Üfüqi, şaquli və ya diaqonal 3 simvol düzəlt
• Gediş etmək üçün 1-9 arası nömrə yaz
• Təslim olmaq üçün *təslim* yaz
`;
                await sock.sendMessage(chatId, {
                    text: str,
                    mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
                }, { quoted: message });
            }
            else {
                room = {
                    id: `tictactoe-${ +new Date}`,
                    x: chatId,
                    o: '',
                    game: new TicTacToe(senderId, 'o'),
                    state: 'WAITING'
                };
                if (text)
                    room.name = text;
                await sock.sendMessage(chatId, {
                    text: `🎯 *Rəqib gözlənilir...*

Oyuna qoşulmaq üçün \`.xo ${text || ''}\` yaz!

❎ Oyunçu: @${senderId.split('@')[0]}

💡 *Məsləhət:* Otaq adı yazarsan, yalnız həmin otağa qoşula bilər`,
                    mentions: [senderId]
                }, { quoted: message });
                games[room.id] = room;
            }
        }
        catch (error) {
            console.error('TicTacToe əmr xətası:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Oyun başladıla bilmədi*\n\nZəhmət olmasa bir az sonra yenidən cəhd et.'
            }, { quoted: message });
        }
    },
    handleTicTacToeMove,
    games
};
