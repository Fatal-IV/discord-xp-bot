const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp') // Komut adı İNGİLİZCE (Varsayılan)
    // setNameLocalizations KALDIRILDI -> Komut adı her dilde resetxp olacak
    .setDescription('Resets all XP and level data for this server.')
    .setDescriptionLocalizations({
      tr: 'Bu sunucudaki TÜM XP ve seviye verilerini sıfırlar.',
      'en-US': 'Resets all XP and level data for this server.'
    }),
    
  isAdmin: true,

  async execute(interaction, client) {
    const { guild, locale, user } = interaction;
    const t = client.i18n && client.i18n.getFixedT ? client.i18n.getFixedT(locale) : (key) => key;

    const confirmEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`⚠️ ${t('common.reset') || 'Reset'}`)
      .setDescription(t('commands.resetxp.confirmMessage') || 'Tüm veriler silinecek. Emin misiniz?')
      .setFooter({ text: guild.name, iconURL: guild.iconURL() });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel(t('commands.resetxp.confirmButton') || 'EVET')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel(t('common.cancel') || 'İptal')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      embeds: [confirmEmbed],
      components: [row],
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== user.id) {
        return i.reply({ content: t('common.noPermission'), ephemeral: true });
      }

      if (i.customId === 'confirm_reset') {
        try {
          if (client.db && client.db.resetGuild) {
            client.db.resetGuild(guild.id);
          }
          await i.update({
            content: `✅ **${t('commands.resetxp.success')}**`,
            embeds: [],
            components: []
          });
        } catch (error) {
          console.error(error);
          await i.update({ content: `❌ ${t('commands.resetxp.error')}`, embeds: [], components: [] });
        }
      } else if (i.customId === 'cancel_reset') {
        await i.update({ content: `ℹ️ ${t('commands.resetxp.cancelled')}`, embeds: [], components: [] });
      }
    });

    collector.on('end', (c, reason) => {
      if (reason === 'time') {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('x').setLabel(t('common.timeout')).setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      }
    });
  },
};