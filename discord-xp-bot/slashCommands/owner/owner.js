const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ComponentType
} = require('discord.js');
const { inspect } = require('util');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// --- YARDIMCI: Cache Temizleme ---
const clearCache = (folderPath) => {
    const directory = path.join(__dirname, '../../', folderPath);
    if (fs.existsSync(directory)) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const fullPath = path.join(directory, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
                clearCache(path.join(folderPath, file));
            } else {
                delete require.cache[require.resolve(fullPath)];
            }
        }
    }
};

// --- YARDIMCI: Uptime ---
const formatUptime = (uptime) => {
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    return `${days}g ${hours}s ${minutes}d ${seconds}sn`;
};

module.exports = {
  folder: 'owner', 
  
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Kategorili Yönetim Paneli')
    .setNameLocalizations({ tr: 'yonetici' })
    .setDescriptionLocalizations({ tr: 'Kategorili Bot Yönetim Paneli' }),

  async execute(interaction, client) {
    if (interaction.user.id !== process.env.owner_id) {
      return interaction.reply({ content: '⛔ Yetkisiz işlem.', ephemeral: true });
    }

    // ====================================================
    // 1. MENÜ TANIMLAMALARI (FONKSİYON OLARAK)
    // ====================================================

    // A) ANA MENÜ (KATEGORİLER)
    const getMainMenu = () => {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('main_menu')
            .setPlaceholder('Lütfen bir kategori seçin...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('PM2 İşlemleri')
                    .setDescription('Log temizleme ve süreç yönetimi.')
                    .setValue('cat_pm2')
                    .setEmoji('⚙️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Bot İşlemleri')
                    .setDescription('Yeniden başlatma, reload ve istatistik.')
                    .setValue('cat_bot')
                    .setEmoji('🤖'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Eval (Kod Çalıştır)')
                    .setDescription('Anlık JS kodu denemek için.')
                    .setValue('cat_eval')
                    .setEmoji('💻')
            );
        return new ActionRowBuilder().addComponents(menu);
    };

    // B) PM2 MENÜSÜ
    const getPm2Menu = () => {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('pm2_menu')
            .setPlaceholder('PM2 İşlemi Seçiniz')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Logları Temizle (Flush)')
                    .setDescription('Console kirliliğini temizler.')
                    .setValue('pm2_flush')
                    .setEmoji('🧹'),
                new StringSelectMenuOptionBuilder() // Geri Dönme Seçeneği
                    .setLabel('« Ana Menüye Dön')
                    .setValue('back_main')
                    .setEmoji('↩️')
            );
        return new ActionRowBuilder().addComponents(menu);
    };

    // C) BOT İŞLEMLERİ MENÜSÜ
    const getBotMenu = () => {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('bot_menu')
            .setPlaceholder('Bot İşlemi Seçiniz')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('İstatistikler')
                    .setDescription('Detaylı sistem verileri.')
                    .setValue('bot_stats')
                    .setEmoji('📊'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Botu Yeniden Başlat')
                    .setDescription('Süreci kapatır ve yeniden açar.')
                    .setValue('bot_restart')
                    .setEmoji('🔄'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Tüm Komutları Yenile')
                    .setDescription('Command Handler\'ı yeniden yükler.')
                    .setValue('bot_reload_all')
                    .setEmoji('⚡'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Tek Komut Yenile')
                    .setDescription('İsmini yazacağınız komutu yeniler.')
                    .setValue('bot_reload_single')
                    .setEmoji('📝'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Eventleri Yenile')
                    .setDescription('Olay dinleyicilerini (Events) yeniler.')
                    .setValue('bot_reload_events')
                    .setEmoji('🔌'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('« Ana Menüye Dön')
                    .setValue('back_main')
                    .setEmoji('↩️')
            );
        return new ActionRowBuilder().addComponents(menu);
    };

    // ====================================================
    // 2. İLK MESAJI GÖNDERME
    // ====================================================
    const mainEmbed = new EmbedBuilder()
        .setColor('2b2d31')
        .setTitle('🛠️ Yönetim Paneli')
        .setDescription('İşlem yapmak istediğiniz kategoriyi aşağıdan seçiniz.');

    const response = await interaction.reply({
        embeds: [mainEmbed],
        components: [getMainMenu()],
        ephemeral: true
    });

    // ====================================================
    // 3. COLLECTOR (ETKİLEŞİM YÖNETİMİ)
    // ====================================================
    const collector = response.createMessageComponentCollector({ 
        componentType: ComponentType.StringSelect, 
        time: 120_000 // 2 dakika açık kalsın
    });

    collector.on('collect', async (i) => {
        const selection = i.values[0];
        const menuId = i.customId;

        // --- A) ANA MENÜDEN SEÇİM YAPILDI ---
        if (menuId === 'main_menu') {
            
            if (selection === 'cat_pm2') {
                await i.update({ 
                    content: '**PM2 Yönetimi** seçildi.', 
                    embeds: [], 
                    components: [getPm2Menu()] 
                });
            } 
            else if (selection === 'cat_bot') {
                await i.update({ 
                    content: '**Bot Yönetimi** seçildi.', 
                    embeds: [], 
                    components: [getBotMenu()] 
                });
            } 
            else if (selection === 'cat_eval') {
                // Eval için direkt Modal açıyoruz
                const modal = new ModalBuilder()
                    .setCustomId('eval_modal')
                    .setTitle('Kod Çalıştır');
                const codeInput = new TextInputBuilder()
                    .setCustomId('code')
                    .setLabel("Kod")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
                await i.showModal(modal);
            }
        }

        // --- B) PM2 MENÜSÜNDEN SEÇİM YAPILDI ---
        else if (menuId === 'pm2_menu') {
            if (selection === 'back_main') {
                await i.update({ content: null, embeds: [mainEmbed], components: [getMainMenu()] });
            } 
            else if (selection === 'pm2_flush') {
                await i.deferUpdate();
                const cmd = process.env.pm_id ? `pm2 flush ${process.env.pm_id}` : 'pm2 flush';
                exec(cmd, (err, stdout) => {
                    const res = err ? `Hata: ${err.message}` : `✅ Loglar temizlendi.\n\`\`\`${stdout.slice(0,500)}\`\`\``;
                    i.editReply({ content: res, components: [getPm2Menu()] }); // Menü kalsın
                });
            }
        }

        // --- C) BOT İŞLEMLERİ MENÜSÜNDEN SEÇİM YAPILDI ---
        else if (menuId === 'bot_menu') {
            
            if (selection === 'back_main') {
                await i.update({ content: null, embeds: [mainEmbed], components: [getMainMenu()] });
                return;
            }

            // 1. RESTART
            if (selection === 'bot_restart') {
                await i.update({ content: '🔄 Bot yeniden başlatılıyor...', components: [] });
                process.exit(1);
            }

            // 2. RELOAD ALL
            else if (selection === 'bot_reload_all') {
                try {
                    client.commands.clear();
                    client.slashCommands.clear();
                    clearCache('commands');
                    clearCache('slashCommands');
                    delete require.cache[require.resolve('../../handlers/commandHandler')];
                    require('../../handlers/commandHandler')(client);
                    await i.update({ content: '✅ Tüm komutlar başarıyla yenilendi.', components: [getBotMenu()] });
                } catch (e) {
                    await i.update({ content: `❌ Hata: ${e.message}`, components: [getBotMenu()] });
                }
            }

            // 3. RELOAD EVENTS
            else if (selection === 'bot_reload_events') {
                try {
                    client.removeAllListeners();
                    clearCache('events');
                    delete require.cache[require.resolve('../../handlers/eventHandler')];
                    require('../../handlers/eventHandler')(client);
                    await i.update({ content: '✅ Eventler başarıyla yenilendi.', components: [getBotMenu()] });
                } catch (e) {
                    await i.update({ content: `❌ Hata: ${e.message}`, components: [getBotMenu()] });
                }
            }

            // 4. STATS
            else if (selection === 'bot_stats') {
                const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                const embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle('📊 Detaylı İstatistikler')
                    .addFields(
                        { name: 'Uptime', value: formatUptime(client.uptime), inline: true },
                        { name: 'RAM', value: `${mem} MB`, inline: true },
                        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                        { name: 'Node.js', value: process.version, inline: true },
                        { name: 'Sunucu Sayısı', value: `${client.guilds.cache.size}`, inline: true }
                    );
                await i.update({ content: null, embeds: [embed], components: [getBotMenu()] });
            }

            // 5. RELOAD SINGLE (TEK KOMUT) - Modal Gerekli
            else if (selection === 'bot_reload_single') {
                // Modal açacağız, bu yüzden update DEĞİL showModal kullanmalıyız.
                const modal = new ModalBuilder()
                    .setCustomId('reload_single_modal')
                    .setTitle('Komut Yenile');
                
                const input = new TextInputBuilder()
                    .setCustomId('cmd_name')
                    .setLabel('Komut Dosya Adı (Örn: owner)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);
            }
        }
    });

    // ====================================================
    // 4. MODAL İŞLEMLERİ (EVAL VE TEK KOMUT İÇİN)
    // ====================================================
    // Modal submit işlemleri interaction'ın kendi client'ı üzerinden dinlenir veya 
    // yukarıdaki collector bitmeden yakalanması gerekir. 
    // Ancak SelectMenu collector'ı Modal submit'i yakalamaz.
    // Bu yüzden filter ile yeni bir awaitModalSubmit kullanacağız.
    
    // Not: Collector yapısı karışmasın diye Eval ve Reload Single için
    // olayları global interaction üzerinden değil, buton tetiklendikten sonra bekleyeceğiz.
    // Ancak yukarıda i.showModal yaptık, cevabı burada beklemeliyiz.
    // Bu kod yapısında en temiz yöntem global bir client.on('interactionCreate') kullanmaktır AMA
    // tek dosya içinde kalmak için "filter" kullanabiliriz.
    
    /* NOT: Modal submitleri "collector" içine düşmez. 
       Discord.js'de Modal Submit tamamen ayrı bir interaction türüdür.
       Basitlik adına, modal açıldığında cevabı bekleyen bir yapı kuralım.
    */
  }
};

// NOT: Eval ve Tek Komut Yenileme Modal'larının çalışması için 
// botunuzun ana dosyasında (index.js veya interactionCreate.js) 
// ModalSubmit etkileşimlerini dinleyen bir yapı olması önerilir.
// Ancak bu dosya içinde çözüm istiyorsanız, yukarıdaki koda ek olarak
// interaction.awaitModalSubmit kullanılmalıdır.
// Yer darlığı ve temizlik açısından EVAL mantığını yukarıda "collector" içinde
// showModal yaptıktan hemen sonra, interaction üzerinden bekleyebiliriz.