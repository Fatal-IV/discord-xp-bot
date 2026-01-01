const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage-xp')
    .setNameLocalizations({ tr: 'xp-yonet' })
    .setDescription('Manage user XP points (Add/Remove).')
    .setDescriptionLocalizations({ tr: 'Kullanıcı XP puanlarını yönetir (Ekle/Sil).' })
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setNameLocalizations({ tr: 'ekle' })
        .setDescription('Add XP to a user.')
        .setDescriptionLocalizations({ tr: 'Bir kullanıcıya XP ekler.' })
        .addUserOption(option =>
          option
            .setName('user')
            .setNameLocalizations({ tr: 'kullanici' })
            .setDescription('The user to add XP to.')
            .setDescriptionLocalizations({ tr: 'XP eklenecek kullanıcı.' })
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setNameLocalizations({ tr: 'miktar' })
            .setDescription('The amount of XP to add.')
            .setDescriptionLocalizations({ tr: 'Eklenecek XP miktarı.' })
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setNameLocalizations({ tr: 'sil' })
        .setDescription('Remove XP from a user.')
        .setDescriptionLocalizations({ tr: 'Bir kullanıcıdan XP siler.' })
        .addUserOption(option =>
          option
            .setName('user')
            .setNameLocalizations({ tr: 'kullanici' })
            .setDescription('The user to remove XP from.')
            .setDescriptionLocalizations({ tr: 'XP silinecek kullanıcı.' })
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setNameLocalizations({ tr: 'miktar' })
            .setDescription('The amount of XP to remove.')
            .setDescriptionLocalizations({ tr: 'Silinecek XP miktarı.' })
            .setRequired(true)
            .setMinValue(1)
        )
    ),

    isAdmin: true,

  async execute(interaction, client, t, db) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guild.id;

    try {
      // 1. Kullanıcı verilerini helper fonksiyon ile çek
      const userData = db.getUserStats(guildId, targetUser.id);

      let actualChange = 0;

      if (subcommand === 'add') {
        actualChange = amount;
        // db.addXP fonksiyonu hem XP ekler, hem seviyeyi günceller, hem de log tutar.
        db.addXP(guildId, targetUser.id, amount);
      } 
      else if (subcommand === 'remove') {
        const currentXp = userData.total_xp || 0;
        
        // Eksiye düşmeyi engelle
        const amountToRemove = Math.min(currentXp, amount);
        
        if (amountToRemove > 0) {
            actualChange = amountToRemove;
            // Çıkarma işlemi için negatif değer gönderiyoruz
            db.addXP(guildId, targetUser.id, -amountToRemove);
        } else {
            actualChange = 0;
        }
      }

      // 2. Güncel verileri tekrar çek
      const updatedData = db.getUserStats(guildId, targetUser.id);

      // 3. Yanıt Embed'ini oluştur
      const successKey = subcommand === 'add' ? 'commands.managexp.addSuccess' : 'commands.managexp.removeSuccess';
      
      const embed = new EmbedBuilder()
        .setColor(subcommand === 'add' ? 0x00FF00 : 0xFF0000)
        .setDescription(t(successKey, { 
            user: targetUser.toString(), 
            amount: actualChange, 
            // Düzeltme: Çeviri dosyasındaki {totalXP} değişkeni ile eşleşmesi için her iki isimlendirme de gönderiliyor.
            totalXP: updatedData.total_xp,
            xp: updatedData.total_xp,
            level: updatedData.level 
        }));

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.reply({ 
          content: t('errors.generic', { error: error.message }) || '❌ Bir hata oluştu.', 
          flags: MessageFlags.Ephemeral 
      });
    }
  },
};