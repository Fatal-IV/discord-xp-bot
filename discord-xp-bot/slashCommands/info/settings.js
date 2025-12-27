// slashCommands/info/settings.js
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setNameLocalizations({ tr: 'ayarlar' })
    .setDescription('Shows current server XP settings.')
    .setDescriptionLocalizations({ tr: 'Sunucunun mevcut XP ve Seviye ayarlarını gösterir.' }),

    permissions: PermissionsBitField.Flags.ManageGuild,
  async execute(interaction, client, t, db) {

    const guildSettings = db.getGuild(interaction.guild.id);
    const ignores = db.getIgnores(interaction.guild.id);

    // Listeleri formatla
    const formatList = (items) => {
        if (!items || items.length === 0) return `*${t('common.none')}*`; 
        if (items.length <= 5) return items.join(', ');
        const remaining = items.length - 5;
        return items.slice(0, 5).join(', ') + ` ... (+${remaining})`;
    };

    const ignoredChannelsRaw = ignores.filter(i => i.type === 'channel').map(i => `<#${i.target_id}>`);
    const ignoredRolesRaw = ignores.filter(i => i.type === 'role').map(i => `<@&${i.target_id}>`);

    const ignoredChannels = formatList(ignoredChannelsRaw);
    const ignoredRoles = formatList(ignoredRolesRaw);

    const logStatus = guildSettings.log_channel_id ? '✅' : '⚠️';
    const logChannelValue = guildSettings.log_channel_id 
        ? `<#${guildSettings.log_channel_id}>` 
        : `_${t('common.notSet')}_`;

    // --- ÖZEL MESAJ DURUMU ---
    // Eğer veritabanında varsa onu göster, yoksa "Varsayılan" yaz
    const msgStatus = guildSettings.level_up_message ? '✨ Özel' : '📦 Varsayılan';
    const msgPreview = guildSettings.level_up_message 
        ? `"${guildSettings.level_up_message}"` 
        : `"${t('events.levelUp.message', { user: '{user}', level: '{level}' })}"`;

    const embed = new EmbedBuilder()
      .setTitle(t('settings.title', { guildName: interaction.guild.name })) 
      .setColor('#2B2D31')
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        { 
            name: `${logStatus} ${t('settings.logChannel')}`, 
            value: `└ ${logChannelValue}`, 
            inline: true 
        },
        { 
            name: `⏱️ ${t('settings.cooldown')}`, 
            value: `└ ${t('settings.seconds', { sec: guildSettings.cooldown })}`, 
            inline: true 
        },
        { name: '\u200b', value: '\u200b', inline: false },

        { 
            name: `🛡️ ${t('settings.spamProtection')}`, 
            value: `└ ${t('settings.spamDesc', { window: guildSettings.spamWindow, count: guildSettings.spamCount })}`, 
            inline: false 
        },
        // --- YENİ ALAN: MESAJ AYARI ---
        {
            name: `💬 Seviye Mesajı (${msgStatus})`,
            value: `└ \`\`\`${msgPreview}\`\`\``,
            inline: false
        },
        
        { 
            name: `🚫 ${t('settings.ignoredChannels')} (${ignoredChannelsRaw.length})`, 
            value: ignoredChannels, 
            inline: false 
        },
        { 
            name: `🚫 ${t('settings.ignoredRoles')} (${ignoredRolesRaw.length})`, 
            value: ignoredRoles, 
            inline: false 
        }
      )
      .setFooter({ text: t('settings.footer') })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};