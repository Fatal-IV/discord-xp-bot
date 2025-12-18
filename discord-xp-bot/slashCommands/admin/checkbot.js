const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkbot')
        .setNameLocalizations({
            tr: 'bot-kontrol',
            'en-US': 'checkbot'
        })
        .setDescription('Checks the bot\'s permissions and hierarchy status.')
        .setDescriptionLocalizations({
            tr: 'Botun yetkilerini ve hiyerarşi durumunu analiz eder.',
            'en-US': 'Checks the bot\'s permissions and hierarchy status.'
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const { guild, locale } = interaction;
        
        // i18n fonksiyonunu başlat
        const t = client.i18n.getFixedT(locale);

        // 1. AŞAMA: Yükleniyor Mesajı
        await interaction.reply({ content: `⏳ **${t('commands.checkbot.loading')}**`, fetchReply: true });

        // Botun bu sunucudaki üye objesi (GuildMember)
        const me = guild.members.me;

        // --- ANALİZ MANTIĞI ---
        
        // A. Yönetici Kontrolü
        const hasAdmin = me.permissions.has(PermissionFlagsBits.Administrator);
        
        // B. Kritik Yetki Listesi ve Kontrolü
        const requiredPerms = [
            { flag: PermissionFlagsBits.SendMessages, key: 'sendMessages' },
            { flag: PermissionFlagsBits.EmbedLinks, key: 'embedLinks' },
            { flag: PermissionFlagsBits.AttachFiles, key: 'attachFiles' },
            { flag: PermissionFlagsBits.ManageRoles, key: 'manageRoles' },
            { flag: PermissionFlagsBits.UseExternalEmojis, key: 'externalEmojis' },
            { flag: PermissionFlagsBits.ViewChannel, key: 'viewChannel' }
        ];

        let permStatusText = "";
        let missingCritical = false;

        requiredPerms.forEach(perm => {
            const hasPerm = me.permissions.has(perm.flag);
            const icon = hasPerm ? "✅" : "❌";
            const permName = t(`commands.checkbot.permissions.${perm.key}`);
            permStatusText += `${icon} **${permName}**\n`;
            
            if (!hasPerm) missingCritical = true;
        });

        // C. Hiyerarşi ve Rol Analizi
        const highestRole = me.roles.highest;
        const roleStatus = `${t('commands.checkbot.labels.highestRole')}: ${highestRole} \n(Pos: \`${highestRole.position}\`)`;

        // D. Genel Değerlendirme (Sonuç)
        let overallStatus = "";
        let color = "";

        if (hasAdmin) {
            overallStatus = t('commands.checkbot.status.perfect');
            color = "#00FF00"; // Yeşil
        } else if (!missingCritical) {
            overallStatus = t('commands.checkbot.status.good');
            color = "#FFFF00"; // Sarı
        } else {
            overallStatus = t('commands.checkbot.status.critical');
            color = "#FF0000"; // Kırmızı
        }

        // Embed Oluşturma
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🛡️ ${t('commands.checkbot.embedTitle')}`)
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(t('commands.checkbot.embedDesc', { guildName: guild.name }))
            .addFields(
                { 
                    name: `👑 ${t('commands.checkbot.headers.adminStatus')}`, 
                    value: hasAdmin ? `✅ **${t('common.active')}**` : `⚠️ **${t('common.inactive')}**`, 
                    inline: false 
                },
                { 
                    name: `📊 ${t('commands.checkbot.headers.hierarchy')}`, 
                    value: roleStatus, 
                    inline: false 
                },
                { 
                    name: `🛠️ ${t('commands.checkbot.headers.permDetail')}`, 
                    value: permStatusText, 
                    inline: false 
                },
                { 
                    name: `📝 ${t('commands.checkbot.headers.result')}`, 
                    value: `> ${overallStatus}`, 
                    inline: false 
                }
            )
            .setFooter({ text: t('commands.checkbot.footer'), iconURL: guild.iconURL() })
            .setTimestamp();

        // 2. AŞAMA: Mesajı Güncelle (Loading -> Sonuç)
        // content: null yaparak "Yükleniyor" yazısını siliyoruz.
        await interaction.editReply({ content: null, embeds: [embed] });
    }
};