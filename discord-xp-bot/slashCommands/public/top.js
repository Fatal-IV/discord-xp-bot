const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setNameLocalizations({
      tr: 'sıralama',
      'en-US': 'top'
    })
    .setDescription('Displays the server leaderboard with a visually rich interface.')
    .setDescriptionLocalizations({
      tr: 'Sunucu liderlik tablosunu görsel açıdan zengin bir arayüzle gösterir.',
      'en-US': 'Displays the server leaderboard with a visually rich interface.'
    }),

  async execute(interaction, client) {
    const { guild, locale, user } = interaction;
    const t = client.i18n.getFixedT(locale);

    await interaction.deferReply();

    let currentPeriod = 'all';

    // --- YARDIMCI: FORMATLAYICI ---
    // Örn: 21,4 B XP (Boşluksuz ve inline code için hazır string döner)
    const formatter = new Intl.NumberFormat(locale, { 
        notation: "compact", 
        maximumFractionDigits: 1 
    });
    
    // XP Metnini formatlar: "21,4B XP"
    const formatXP = (num) => {
        return formatter.format(num).replace(/\s/g, '') + " XP";
    };

    // İsim kısaltma
    const truncateText = (text, maxLength) => {
        return text.length > maxLength ? text.substring(0, maxLength - 1) + '…' : text;
    };

    // --- CANVAS OLUŞTURUCU (PODYUM) ---
    const generatePodiumImage = async (top3Users) => {
        const width = 900;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Arkaplan (Modern Gradient)
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1c2c');
        gradient.addColorStop(1, '#0d0e15');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Dekoratif Çizgiler
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.05;
        ctx.lineWidth = 2;
        for(let i=0; i<width; i+=40) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i - 100, height);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Podyum Pozisyonları (x, y, scale, rank)
        const positions = [
            { x: 450, y: 140, scale: 1.2, rank: 1, color: '#FFD700', label: '👑' }, // Orta (1.)
            { x: 200, y: 180, scale: 1.0, rank: 2, color: '#C0C0C0', label: '🥈' }, // Sol (2.)
            { x: 700, y: 180, scale: 1.0, rank: 3, color: '#CD7F32', label: '🥉' }  // Sağ (3.)
        ];

        // Kullanıcıları Çiz
        for (let i = 0; i < 3; i++) {
            const entry = top3Users[i];
            const pos = positions[i];
            
            if (!entry) continue; // Eğer kullanıcı yoksa atla

            const member = guild.members.cache.get(entry.user_id);
            const username = member ? member.displayName : (client.users.cache.get(entry.user_id)?.username || 'Unknown');
            const avatarURL = member ? member.displayAvatarURL({ extension: 'png', size: 256 }) : (client.users.cache.get(entry.user_id)?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png');
            
            const xpVal = entry.gained_xp !== undefined ? entry.gained_xp : entry.total_xp;

            ctx.save();
            
            // Avatar Çerçevesi (Yuvarlak)
            const avatarSize = 100 * pos.scale;
            const centerX = pos.x;
            const centerY = pos.y;

            ctx.beginPath();
            ctx.arc(centerX, centerY, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.save();
            ctx.clip();
            try {
                const avatar = await loadImage(avatarURL);
                ctx.drawImage(avatar, centerX - avatarSize / 2, centerY - avatarSize / 2, avatarSize, avatarSize);
            } catch (e) {
                // Avatar yüklenemezse fallback renk
                ctx.fillStyle = '#333';
                ctx.fill();
            }
            ctx.restore();

            // Çerçeve Kenarlığı
            ctx.lineWidth = 5;
            ctx.strokeStyle = pos.color;
            ctx.stroke();

            // Rütbe Rozeti (Daire içinde sayı/ikon)
            ctx.beginPath();
            ctx.arc(centerX, centerY + (avatarSize/2) + 15, 15, 0, Math.PI * 2);
            ctx.fillStyle = pos.color;
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = '20px Sans-Serif'; // Standart font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pos.rank.toString(), centerX, centerY + (avatarSize/2) + 15);

            // İsim
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${24 * pos.scale}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.fillText(truncateText(username, 15), centerX, centerY + (avatarSize/2) + 50);

            // Level ve XP
            ctx.fillStyle = '#aaa';
            ctx.font = `${18 * pos.scale}px Sans-Serif`;
            ctx.fillText(`Lv. ${entry.level} • ${formatXP(xpVal)}`, centerX, centerY + (avatarSize/2) + 75);

            ctx.restore();
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: 'leaderboard.png' });
    };

    // --- ANA FONKSİYON ---
    const generateLeaderboardMessage = async (period) => {
        // 1. Veri Çekme (Değiştirilemez Kural)
        const fullLeaderboard = client.db.getLeaderboard(guild.id, period, 100); 
        const top10 = fullLeaderboard.slice(0, 10);
        const top3 = top10.slice(0, 3);
        const rest = top10.slice(3, 10);

        // Kullanıcı verilerini önbelleğe al
        const userIds = top10.map(entry => entry.user_id);
        if (!userIds.includes(user.id)) userIds.push(user.id);
        await guild.members.fetch({ user: userIds }).catch(() => {});

        // Başlıklar
        let periodTitle;
        switch(period) {
            case 'day': periodTitle = t('top.daily'); break;
            case 'week': periodTitle = t('top.weekly'); break;
            case 'month': periodTitle = t('top.monthly'); break;
            default: periodTitle = t('top.alltime');
        }

        // 2. Canvas Oluştur
        const attachment = await generatePodiumImage(top3);

        // 3. Embed Oluştur
        const embed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setAuthor({ name: `${guild.name} • ${periodTitle}`, iconURL: guild.iconURL() })
            .setImage('attachment://leaderboard.png') // Canvas'ı embed içine göm
            .setFooter({ text: `${t('top.footer', { rank: '---', name: user.displayName })}`, iconURL: user.displayAvatarURL() })
            .setTimestamp();

        // 4. Liste Tasarımı (4-10. Sıralar)
        let description = "";
        
        if (top10.length === 0) {
            description = `>>> 🚫 **${t('top.noData')}**\n*${t('rank.noData')}*`;
        } else if (rest.length > 0) {
            // Başlık satırı
            description += `### 📜 ${t('top.title')} (4 - 10)\n`;
            
            rest.forEach((entry, index) => {
                const globalIndex = index + 4; // 4'ten başla
                const member = guild.members.cache.get(entry.user_id);
                const name = member ? member.displayName : (client.users.cache.get(entry.user_id)?.username || 'Unknown');
                const safeName = truncateText(name.replace(/[*_`~]/g, ''), 20);
                const xpVal = entry.gained_xp !== undefined ? entry.gained_xp : entry.total_xp;

                // Yeni Hiyerarşik Tasarım
                // 4. Kullanıcı Adı
                // ╰ Lv. 12 • 21,4B XP (Inline Code)
                description += `**${globalIndex}.** ${safeName}\n╰ 🛡️ \`Lv.${entry.level}\` • ✨ \`${formatXP(xpVal)}\`\n`;
            });
        } else {
            // Eğer sadece ilk 3 kişi varsa veya daha az
            description = `*${t('top.textInfo')}*`; // Boş kalmaması için ufak bir bilgi texti veya boş
        }

        embed.setDescription(description);

        // Kendi Sıralamanı Footer'a Güncelle
        const userRankIndex = fullLeaderboard.findIndex(u => u.user_id === user.id);
        const userRank = userRankIndex !== -1 ? `#${userRankIndex + 1}` : '100+';
        const userEntry = fullLeaderboard[userRankIndex];
        const myXP = userEntry ? (userEntry.gained_xp !== undefined ? userEntry.gained_xp : userEntry.total_xp) : 0;
        
        embed.setFooter({ 
            text: `${t('top.yourStatsTitle')}: ${userRank} • Lv.${userEntry ? userEntry.level : 0} • ${formatXP(myXP)}`, 
            iconURL: user.displayAvatarURL() 
        });

        // 5. Butonlar
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('top_all').setLabel(t('top.alltime')).setEmoji('🏆').setStyle(period === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(period === 'all'),
            new ButtonBuilder().setCustomId('top_month').setLabel(t('top.monthly')).setEmoji('📅').setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(period === 'month'),
            new ButtonBuilder().setCustomId('top_week').setLabel(t('top.weekly')).setEmoji('🗓️').setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(period === 'week'),
            new ButtonBuilder().setCustomId('top_day').setLabel(t('top.daily')).setEmoji('⏰').setStyle(period === 'day' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(period === 'day')
        );

        return { embeds: [embed], components: [row], files: [attachment] };
    };

    // İlk Yanıt
    const data = await generateLeaderboardMessage(currentPeriod);
    const msg = await interaction.editReply(data);

    // Collector
    const collector = msg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 120000 
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== user.id) return i.reply({ content: t('common.noPermission'), ephemeral: true });

        if (i.customId === 'top_all') currentPeriod = 'all';
        if (i.customId === 'top_month') currentPeriod = 'month';
        if (i.customId === 'top_week') currentPeriod = 'week';
        if (i.customId === 'top_day') currentPeriod = 'day';

        await i.deferUpdate();
        const newData = await generateLeaderboardMessage(currentPeriod);
        
        // Files array'ini güncellemek attachment'ı yeniden gönderir
        await interaction.editReply(newData);
    });

    collector.on('end', () => {
        // Butonları devre dışı bırak
        const disabledRow = new ActionRowBuilder().addComponents(
            msg.components[0].components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};