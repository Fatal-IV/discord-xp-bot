const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setNameLocalizations({ tr: 'gunluk' })
    .setDescription('Claim your daily XP reward!')
    .setDescriptionLocalizations({ tr: 'Günlük XP ödülünü al!' }),

  async execute(interaction, client, t, db) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownAmount = 24 * 60 * 60 * 1000; // 24 Saat

    try {
      // 1. Kullanıcı verisini çek
      const userData = db.getUserStats(guildId, userId);
      
      // last_daily kontrolü
      const lastDaily = userData ? (userData.last_daily || 0) : 0;

      // 2. Cooldown Kontrolü
      if (now - lastDaily < cooldownAmount) {
        // Zaman damgasını saniye cinsinden hesapla
        const expiresAt = Math.floor((lastDaily + cooldownAmount) / 1000);
        
        // DÜZELTME: :R (Göreli) yerine :F (Tam Tarih ve Saat) kullanıldı.
        // Bu sayede "X zaman sonra" eki oluşmaz, net tarih gösterilir.
        return interaction.reply({
          content: t('commands.daily.cooldown', { time: `<t:${expiresAt}:F>` }),
          flags: MessageFlags.Ephemeral
        });
      }

      // 3. Rastgele XP (50 - 100 arası)
      const minXP = 50;
      const maxXP = 100;
      const xpAmount = Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;

      // 4. XP Ekleme
      db.addXP(guildId, userId, xpAmount);

      // 5. Tarihçeyi Güncelleme
      if (typeof db.setDaily === 'function') {
        db.setDaily(guildId, userId, now);
      } else {
        console.warn('Daily: db.setDaily fonksiyonu bulunamadı! Lütfen sqlite.js dosyasını güncelleyin.');
      }

      // 6. Başarılı Yanıt
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(t('commands.daily.title'))
        .setDescription(t('commands.daily.success', { amount: xpAmount }))
        .setThumbnail(interaction.user.displayAvatarURL());

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Daily Command Error:', error);
      await interaction.reply({
        content: t('errors.generic', { error: error.message }),
        flags: MessageFlags.Ephemeral
      });
    }
  },
};