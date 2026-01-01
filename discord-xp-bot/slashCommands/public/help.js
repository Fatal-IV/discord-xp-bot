const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setNameLocalizations({ tr: 'yardım' })
    .setDescription('Lists all commands or shows details for a specific command.')
    .setDescriptionLocalizations({ tr: 'Komutları listeler veya bir komut hakkında detaylı bilgi verir.' })
    .addStringOption(option => 
      option.setName('command')
        .setNameLocalizations({ tr: 'komut' })
        .setDescription('Get detailed info about a specific command')
        .setDescriptionLocalizations({ tr: 'Detaylı bilgi almak istediğiniz komut' })
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async execute(interaction, client, t) {
    const { options } = interaction;
    const commandNameArg = options.getString('command');

    // --- SENARYO 1: Belirli bir komut arandı (/help resetxp) ---
    if (commandNameArg) {
      // Komut adını bul (İngilizce isim üzerinden)
      let cmd = client.slashCommands.get(commandNameArg);
      
      // Bulamazsa alias/localize kontrol et (Opsiyonel güvenlik)
      if (!cmd) {
         cmd = client.slashCommands.find(c => c.data.name === commandNameArg);
      }

      if (!cmd) {
        return interaction.reply({ 
          content: t('commands.help.ui.errors.commandNotFound', { cmd: commandNameArg }), 
          ephemeral: true 
        });
      }

      const rawName = cmd.data.name; // Örn: resetxp (İngilizce)
      
      // Açıklamayı dilden çek
      const descKey = `commands.${rawName}.description`;
      const desc = t(descKey) !== descKey ? t(descKey) : cmd.data.description;
        
      // Kullanım bilgisini dilden çek
      const usageKey = `commands.${rawName}.usage`;
      const usage = t(usageKey) !== usageKey ? t(usageKey) : `/${rawName}`;

      // Parametreler
      let paramsField = "";
      if (cmd.data.options && cmd.data.options.length > 0) {
        paramsField = cmd.data.options.map(opt => {
          const paramKey = `commands.${rawName}.params.${opt.name}`;
          const paramDesc = t(paramKey) !== paramKey ? t(paramKey) : opt.description;
            
          const requiredTag = opt.required 
            ? `**[${t('commands.help.ui.labels.mandatory')}]**` 
            : `*[${t('commands.help.ui.labels.optional')}]*`;

          return `• \`${opt.name}\`: ${paramDesc} ${requiredTag}`;
        }).join('\n');
      } else {
        paramsField = t('common.none') || "Yok";
      }

      const detailEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🔹 /${rawName}`) // Başlık: İngilizce Komut Adı
        .setDescription(desc)       // Açıklama: Türkçe
        .addFields(
          { name: t('commands.help.ui.headers.usage'), value: `\`${usage}\``, inline: false },
          { name: t('commands.help.ui.headers.params'), value: paramsField, inline: false },
          { 
            name: t('commands.help.ui.headers.perms'), 
            value: cmd.folder === 'admin' || cmd.folder === 'owner' 
              ? `🚫 \`${t('commands.help.ui.labels.adminOnly')}\`` 
              : `✅ \`${t('commands.help.ui.labels.noPerms')}\``,
            inline: true 
          }
        )
        .setFooter({ text: t('commands.help.ui.footer', { user: interaction.user.tag }) });

      return interaction.reply({ embeds: [detailEmbed] });
    }

    // --- SENARYO 2: Genel Menü (/help) ---
    const commands = client.slashCommands;
    const categories = [...new Set(commands.map(cmd => cmd.folder))]
      .filter(c => c !== undefined && c !== 'owner');

    const menuOptions = categories.map(cat => {
      const labelKey = `commands.help.ui.categories.${cat}`;
      const label = t(labelKey) !== labelKey ? t(labelKey) : cat.charAt(0).toUpperCase() + cat.slice(1);
      
      return {
        label: label,
        value: cat,
        description: t(`commands.help.ui.menuDesc`, { count: commands.filter(c => c.folder === cat).size })
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder(t('commands.help.ui.menuPlaceholder'))
      .addOptions(menuOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const mainEmbed = new EmbedBuilder()
      .setColor('#2B2D31')
      .setTitle(t('commands.help.ui.title'))
      .setDescription(t('commands.help.ui.description'))
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '📂 ' + t('commands.help.ui.categories.public'), value: '`rank`, `top`...', inline: true },
        { name: '🛡️ ' + t('commands.help.ui.categories.admin'), value: '`setup`, `setlevel`...', inline: true }
      )
      .setFooter({ text: t('commands.help.ui.footer', { user: interaction.user.tag }), iconURL: interaction.guild.iconURL() });

    const response = await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: t('common.noPermission'), ephemeral: true });
      }

      const selectedCat = i.values[0];
      const categoryCommands = commands.filter(cmd => cmd.folder === selectedCat);

      const list = categoryCommands.map(cmd => {
        // İngilizce İsim
        const rawName = cmd.data.name;
        
        // Türkçe Açıklama
        const descKey = `commands.${rawName}.description`;
        const desc = t(descKey) !== descKey ? t(descKey) : cmd.data.description;
        
        return `> **/${rawName}**\n> └ ${desc}`;
      }).join('\n\n');

      const catLabelKey = `commands.help.ui.categories.${selectedCat}`;
      const catLabel = t(catLabelKey) !== catLabelKey ? t(catLabelKey) : selectedCat;

      const categoryEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(catLabel)
        .setDescription(list || t('commands.help.ui.noCommands'))
        .setFooter({ text: t('commands.help.ui.footer', { user: interaction.user.tag }) });

      await i.update({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on('end', () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        selectMenu.setDisabled(true).setPlaceholder(t('common.timeout'))
      );
      interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};