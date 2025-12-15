const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setNameLocalizations({
      tr: 'sıralama',
      'en-US': 'top'
    })
    .setDescription('Displays the server leaderboard with a modern design.')
    .setDescriptionLocalizations({
      tr: 'Sunucu liderlik tablosunu modern bir tasarımla gösterir.',
      'en-US': 'Displays the server leaderboard with a modern design.'
    }),

  async execute(interaction, client) {
    const { guild, locale, user } = interaction;
    const t = client.i18n.getFixedT(locale);

    await interaction.deferReply();

    let currentPeriod = 'all';

    // Sayı formatlayıcı (Örn: 1.2k)
    const formatter = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    const formatNum = (num) => formatter.format(num);

    // --- ANA FONKSİYON: LİSTE OLUŞTURUCU ---
    const generateLeaderboardMessage = async (period) => {
        // 1. Verileri Çek
        // getLeaderboard fonksiyonundaki hatayı düzelttiğin için artık day/week verisi gelecektir.
        const fullLeaderboard = client.db.getLeaderboard(guild.id, period, 100); 
        const top10 = fullLeaderboard.slice(0, 10);

        // Periyot Başlığı Ayarla
        let periodTitle;
        switch(period) {
            case 'day': periodTitle = t('top.daily'); break;
            case 'week': periodTitle = t('top.weekly'); break;
            case 'month': periodTitle = t('top.monthly'); break;
            default: periodTitle = t('top.alltime');
        }

        // 2. Kullanıcı Verilerini Çözümle (Cache veya Fetch)
        // Sadece listedeki kullanıcıların ID'lerini topla
        const userIds = top10.map(entry => entry.user_id);
        if (!userIds.includes(user.id)) userIds.push(user.id); // Seni de listeye ekleyelim ki fetch edelim
        
        await guild.members.fetch({ user: userIds }).catch(() => {});

        // 3. Sıralama Listesini Oluştur (String Builder)
        let description = "";

        if (top10.length === 0) {
            description = `\n\n🚫 **${t('top.noData')}**\n*${t('rank.noData')}*`;
        } else {
            top10.forEach((entry, index) => {
                const member = guild.members.cache.get(entry.user_id);
                // İsim güvenliği (Markdown karakterlerini kaçır)
                const name = member ? member.displayName : (client.users.cache.get(entry.user_id)?.username || 'Unknown');
                const safeName = name.replace(/[*_`~]/g, ''); 
                
                // XP Değeri (Tüm zamanlar için total_xp, diğerleri için gained_xp)
                const xpVal = entry.gained_xp !== undefined ? entry.gained_xp : entry.total_xp;
                
                // Madalya Seçimi
                let rankStr = `\`${index + 1}.\``;
                let highlight = "";
                if (index === 0) { rankStr = "🥇"; highlight = "**"; }
                if (index === 1) { rankStr = "🥈"; highlight = "**"; }
                if (index === 2) { rankStr = "🥉"; highlight = "**"; }

                // Satır Oluşturma
                // Örnek: 🥇 **Ahmet** • Lv. 5 • 1.2k XP
                description += `${rankStr} ${highlight}${safeName}${highlight} \n└ ${t('top.levelShort')} \`${entry.level || 0}\` • \`${formatNum(xpVal)} XP\`\n`;
            });
        }

        // 4. Kendi Sıralamanı Bul
        const userRankIndex = fullLeaderboard.findIndex(u => u.user_id === user.id);
        const userRank = userRankIndex !== -1 ? `#${userRankIndex + 1}` : '100+';
        const userEntry = fullLeaderboard[userRankIndex];
        
        // Eğer veritabanında kaydın yoksa varsayılan 0
        const myXP = userEntry ? (userEntry.gained_xp !== undefined ? userEntry.gained_xp : userEntry.total_xp) : 0;
        const myLevel = userEntry ? userEntry.level : 0;

        // 5. Embed Tasarımı
        const embed = new EmbedBuilder()
            .setColor('#2B2D31') // Modern Koyu Tema
            .setAuthor({ 
                name: `${guild.name} - ${t('top.title')}`, 
                iconURL: guild.iconURL() 
            })
            .setTitle(`📅 ${periodTitle} ${t('top.title')}`)
            .setDescription(description)
            .setThumbnail(guild.iconURL({ dynamic: true })) // Sağ üstte sunucu logosu
            .addFields({
                // ALT KISIM: Kendi İstatistiklerin (Sticky Footer)
                name: `👤 ${t('top.yourStatsTitle')}`,
                value: `📊 **${t('top.footer', { rank: userRank, name: user.displayName })}**\n⭐ **XP:** ${formatNum(myXP)}  |  🆙 **${t('top.levelShort')}:** ${myLevel}`,
                inline: false
            })
            .setTimestamp()
            .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() });

        // 6. Butonlar (Aktif olan buton sönük ve yeşil olsun)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('top_all')
                .setLabel(t('top.alltime'))
                .setStyle(period === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(period === 'all'), // Seçiliyse tıklanamasın
            
            new ButtonBuilder()
                .setCustomId('top_month') // period ismi 'month'
                .setLabel(t('top.monthly'))
                .setStyle(period === 'month' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(period === 'month'),

            new ButtonBuilder()
                .setCustomId('top_week')
                .setLabel(t('top.weekly'))
                .setStyle(period === 'week' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(period === 'week'),

            new ButtonBuilder()
                .setCustomId('top_day')
                .setLabel(t('top.daily'))
                .setStyle(period === 'day' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(period === 'day')
        );

        return { embeds: [embed], components: [row] };
    };

    // İlk Mesajı Gönder
    const msg = await interaction.editReply(await generateLeaderboardMessage(currentPeriod));

    // Collector Başlat
    const collector = msg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 120000 // 2 dakika
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== user.id) {
            return i.reply({ content: t('common.noPermission'), ephemeral: true });
        }

        // Buton ID'sine göre periyodu belirle
        if (i.customId === 'top_all') currentPeriod = 'all';
        if (i.customId === 'top_month') currentPeriod = 'month';
        if (i.customId === 'top_week') currentPeriod = 'week';
        if (i.customId === 'top_day') currentPeriod = 'day';

        // Butona tıklandığını hemen bildir (Loading state)
        await i.deferUpdate();
        
        // Yeni tasarımı oluştur ve mesajı düzenle
        const newData = await generateLeaderboardMessage(currentPeriod);
        await interaction.editReply(newData);
    });

    collector.on('end', () => {
        // Süre bitince butonları kaldır
        interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};