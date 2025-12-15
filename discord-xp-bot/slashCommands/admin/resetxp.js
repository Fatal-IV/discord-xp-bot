const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpreset')
    .setNameLocalizations({
      tr: 'sıfırla-xp',
      'en-US': 'xpreset'
    })
    .setDescription('Resets all XP and level data for this server.')
    .setDescriptionLocalizations({
      tr: 'Bu sunucudaki TÜM XP ve seviye verilerini sıfırlar.',
      'en-US': 'Resets all XP and level data for this server.'
    }),

    isAdmin: true,

  async execute(interaction, client) {
    const { guild, locale, user, member } = interaction;
    const t = client.i18n.getFixedT(locale);

    // --- ONAY MEKANİZMASI ---
    const confirmEmbed = new EmbedBuilder()
      .setColor('#FF0000') // Tehlike rengi
      .setTitle(`⚠️ ${t('common.reset')}`)
      .setDescription(t('commands.resetxp.confirmMessage'))
      .setFooter({ text: guild.name, iconURL: guild.iconURL() });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel(t('commands.resetxp.confirmButton'))
        .setStyle(ButtonStyle.Danger), // Kırmızı Buton
      
      new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel(t('common.cancel'))
        .setStyle(ButtonStyle.Secondary) // Gri Buton
    );

    // Onay mesajını sadece komutu kullanan kişiye göster (ephemeral)
    const response = await interaction.reply({
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    // Collector Tanımlama (15 saniye süre)
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000
    });

    collector.on('collect', async (i) => {
      // Güvenlik: Sadece komutu başlatan kişi butona basabilir
      if (i.user.id !== user.id) return;

      if (i.customId === 'confirm_reset') {
        try {
          // --- VERİTABANI İŞLEMİ ---
          // Sadece bu sunucunun verilerini siler (database/sqlite.js -> resetGuild)
          client.db.resetGuild(guild.id);
          
          await i.update({
            content: `✅ **${t('commands.resetxp.success')}**`,
            embeds: [],
            components: []
          });

        } catch (error) {
          console.error(`[ResetXP Error] Guild: ${guild.id}`, error);
          await i.update({
            content: `❌ ${t('commands.resetxp.error')}`,
            embeds: [],
            components: []
          });
        }
      } else if (i.customId === 'cancel_reset') {
        await i.update({
          content: `ℹ️ ${t('commands.resetxp.cancelled')}`,
          embeds: [],
          components: []
        });
      }
    });

    collector.on('end', (collected, reason) => {
      // Süre dolduğunda işlem yapılmadıysa butonları sil
      if (reason === 'time') {
         interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};