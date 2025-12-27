const { AttachmentBuilder } = require('discord.js');
const { generateRankCard } = require('../../utils/rankCard');

module.exports = {
    name: 'rank',
    aliases: ['seviye', 'level'],
    isAdmin: false,

    async execute(message, args, client, t, db) {
        try {
            // 1. HEDEF KULLANICIYI BELİRLE (User nesnesi olarak)
            const targetUser = message.mentions.users.first() || 
                               client.users.cache.get(args[0]) || 
                               message.author;

            if (targetUser.bot) return message.reply(t('rank.isBot'));

            // 2. VERİLERİ ÇEK
            const userStats = db.getUserStats(message.guild.id, targetUser.id);
            
            // Veri yoksa hata mesajı gönder
            if (!userStats || (userStats.text_xp <= 0 && userStats.voice_xp <= 0)) {
                return message.reply(t('rank.noData'));
            }

            const rank = db.getUserRank(message.guild.id, targetUser.id);

            // 3. KART OLUŞTURMA
            await message.channel.sendTyping();

            // DÜZELTME: Parametreler tam olarak slash komutundaki sırada gönderiliyor
            // (guild, user, stats, rank, t)
            // Doğru GuildMember'ı al
            const member = message.mentions.members.first() || message.guild.members.cache.get(targetUser.id) || message.member;

            // Kartı üret (slash ile AYNI çağrı)
            const attachment = await generateRankCard(member, userStats, rank);

            // Gönder
            return message.reply({ files: [attachment] });

        } catch (error) {
            console.error(error);
            // Dil dosyasındaki 'common.error' anahtarını güvenli şekilde kullan
            const errorMsg = t('common.commandError') || 'An error occurred!';
            return message.reply(errorMsg);
        }
    }
};