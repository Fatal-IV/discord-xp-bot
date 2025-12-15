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
    .setDescription('Lists all available commands.')
    .setDescriptionLocalizations({ tr: 'Mevcut tüm komutları listeler.' }),

  async execute(interaction, client, t) {
    // 1. KATEGORİLERİ BELİRLE
    // Botun 'slashCommands' koleksiyonundaki 'folder' verisine göre grupluyoruz.
    // Index.js dosyasında command.folder = folder ataması yapıldığı varsayılmıştır.
    const commands = client.slashCommands;
    
    // Benzersiz kategorileri bul (admin, public, info vb.)
    const categories = [...new Set(commands.map(cmd => cmd.folder))];

    // Kullanıcının locale'i (tr, en-US, vb.)
    const userLocale = interaction.locale;

    // --- YARDIMCI FONKSİYON: Yerel Komut İsmi ---
    // Eğer kullanıcının dilinde özel bir isim tanımlıysa onu, yoksa varsayılan ismi döndürür.
    const getLocalizedName = (cmd) => {
        const localizations = cmd.data.name_localizations;
        if (localizations && localizations[userLocale]) {
            return localizations[userLocale];
        }
        return cmd.data.name;
    };

    // --- YARDIMCI FONKSİYON: Yerel Açıklama ---
    const getLocalizedDesc = (cmd) => {
        const localizations = cmd.data.description_localizations;
        if (localizations && localizations[userLocale]) {
            return localizations[userLocale];
        }
        return cmd.data.description;
    };

    // 2. AÇILIR MENÜ (SELECT MENU) OLUŞTUR
    const options = categories.map(cat => {
        // Dil dosyasından kategori adını çek (örn: help.categories.admin)
        // Eğer çeviri yoksa klasör adını baş harfi büyük yaz.
        const label = t(`commands.help.categories.${cat}`) !== `commands.help.categories.${cat}` 
            ? t(`commands.help.categories.${cat}`) 
            : cat.charAt(0).toUpperCase() + cat.slice(1);
            
        return {
            label: label,
            // Emoji zaten çeviri stringinin içinde varsa buraya eklemeye gerek yok, 
            // ama temiz görünüm için string'i parse edebilir veya manuel atayabiliriz.
            // Şimdilik value olarak klasör adını tutuyoruz.
            value: cat
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder(t('commands.help.menuPlaceholder'))
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // 3. İLK EMBED MESAJI
    const initialEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(t('commands.help.title'))
        .setDescription(t('commands.help.embedDesc'))
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: t('commands.help.footer'), iconURL: interaction.guild.iconURL() });

    const response = await interaction.reply({
        embeds: [initialEmbed],
        components: [row],
        fetchReply: true
    });

    // 4. COLLECTOR (ETKİLEŞİM DİNLEYİCİ)
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000 // 60 saniye aktif kalır
    });

    collector.on('collect', async (i) => {
        // Sadece komutu kullanan kişi menüyü kullanabilsin
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: t('common.noPermission'), ephemeral: true });
        }

        const selectedCategory = i.values[0]; // 'admin', 'public' vs.
        
        // Seçilen kategorideki komutları filtrele
        const categoryCommands = commands.filter(cmd => cmd.folder === selectedCategory);

        if (categoryCommands.size === 0) {
            return i.reply({ content: t('commands.help.noCommands'), ephemeral: true });
        }

        // Komutları listele (Yerelleştirilmiş İsimleri Kullanarak)
        const commandList = categoryCommands.map(cmd => {
            const localName = getLocalizedName(cmd);
            const localDesc = getLocalizedDesc(cmd);
            return `> </${localName}:${cmd.id || '0'}>  —  *${localDesc}*`; 
            // Not: cmd.id slash komut ID'sidir. Bot yeni başladığında cache'de olmayabilir, 
            // bu yüzden ID yoksa tıklanabilir link çalışmayabilir ama metin görünür.
        }).join('\n');

        const categoryLabel = t(`commands.help.categories.${selectedCategory}`);

        const categoryEmbed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle(`${categoryLabel}`)
            .setDescription(commandList || t('commands.help.noCommands'))
            .setFooter({ text: t('commands.help.footer') });

        await i.update({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on('end', () => {
        // Süre bitince menüyü devre dışı bırak
        const disabledRow = new ActionRowBuilder().addComponents(
            selectMenu.setDisabled(true).setPlaceholder(t('common.timeout'))
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};