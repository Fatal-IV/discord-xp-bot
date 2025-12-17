const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder,
    ComponentType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('../../config');
const db = require('../../database/sqlite');
const Database = require('better-sqlite3'); 

// --- YARDIMCI: Cache Temizleme Fonksiyonu ---
const clearCache = (folderPath) => {
    try {
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
    } catch (err) {
        console.error(`Cache temizleme hatası (${folderPath}):`, err);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Bot Sahibi Merkezi Yönetim Sistemi')
        // 1. ANA PANEL (İstatistikler, Yedek, Restart)
        .addSubcommand(sub => 
            sub.setName('panel')
               .setDescription('Merkezi yönetim panelini ve detaylı istatistikleri açar.')
        )
        // 2. SİSTEM YÖNETİMİ (Reload işlemleri)
        .addSubcommandGroup(group =>
            group.setName('sistem')
                .setDescription('Botun teknik altyapısını yönetir.')
                .addSubcommand(sub =>
                    sub.setName('komut-yenile')
                       .setDescription('Belirli bir komutu veya tüm komutları yeniler.')
                       .addStringOption(opt => 
                           opt.setName('hedef')
                              .setDescription('Komut adı veya "hepsi"')
                              .setRequired(true)
                       )
                )
                .addSubcommand(sub =>
                    sub.setName('event-yenile')
                       .setDescription('Tüm event dinleyicilerini (listeners) yeniden başlatır.')
                )
        )
        // 3. LOW-XP YÖNETİMİ
        .addSubcommandGroup(group =>
            group.setName('low-xp')
                .setDescription('Az XP kazanacak kullanıcıları yönet.')
                .addSubcommand(sub =>
                    sub.setName('ekle')
                       .setDescription('Listeye kullanıcı ekler.')
                       .addUserOption(opt => opt.setName('kullanıcı').setDescription('Hedef kullanıcı').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('çıkar')
                       .setDescription('Listeden kullanıcı çıkarır.')
                       .addUserOption(opt => opt.setName('kullanıcı').setDescription('Hedef kullanıcı').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('liste')
                       .setDescription('Kısıtlı kullanıcıları listeler.')
                )
        ),

    async execute(interaction, client) {
        // --- GÜVENLİK DUVARI ---
        if (interaction.user.id !== config.owner_id) {
            return interaction.reply({ 
                content: '⛔ **Erişim Engellendi:** Bu komut sadece sistem yöneticisi içindir.', 
                ephemeral: true 
            });
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand(false);

        // ====================================================
        // BÖLÜM 1: MERKEZİ PANEL (Dashboard)
        // ====================================================
        if (sub === 'panel') {
            await interaction.deferReply({ ephemeral: true });

            const generateDashboard = () => {
                const uptime = process.uptime();
                const d = Math.floor(uptime / (3600 * 24));
                const h = Math.floor(uptime % (3600 * 24) / 3600);
                const m = Math.floor(uptime % 3600 / 60);
                
                const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
                
                let userCount = 0;
                let totalXP = 0;
                let lowXpCount = 0;
                
                try {
                    const dbPath = path.join(__dirname, '../../db.sqlite');
                    const statsDb = new Database(dbPath, { readonly: true });
                    
                    const users = statsDb.prepare('SELECT COUNT(*) as count FROM users').get();
                    const xp = statsDb.prepare('SELECT SUM(total_xp) as total FROM users').get();
                    const ignored = statsDb.prepare("SELECT COUNT(*) as count FROM xp_ignores WHERE type='user_low_xp'").get();
                    
                    userCount = users.count;
                    totalXP = xp.total || 0;
                    lowXpCount = ignored.count;
                    
                    statsDb.close();
                } catch (e) {
                    console.error("İstatistik okuma hatası:", e);
                }

                const embed = new EmbedBuilder()
                    .setColor('#2B2D31')
                    .setTitle('🎛️ Sistem Yönetim Konsolu')
                    .setDescription(`**Bot Sahibi:** <@${config.owner_id}>\n**Node.js:** ${process.version} | **Discord.js:** v14`)
                    .addFields(
                        { name: '⏱️ Uptime', value: `\`${d}g ${h}sa ${m}dk\``, inline: true },
                        { name: '💾 Bellek (RSS)', value: `\`${memUsage} MB\``, inline: true },
                        { name: '📡 Ping', value: `\`${client.ws.ping}ms\``, inline: true },
                        { name: '👥 Takip Edilen', value: `\`${userCount} Üye\``, inline: true },
                        { name: '✨ Toplam XP', value: `\`${new Intl.NumberFormat('tr-TR').format(totalXP)}\``, inline: true },
                        { name: '📉 Kısıtlı Üye', value: `\`${lowXpCount} Kişi\``, inline: true },
                    )
                    .setFooter({ text: 'Aşağıdaki menüden işlem seçiniz.', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('owner_actions')
                    .setPlaceholder('⚡ Hızlı İşlemler...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Veritabanı Yedeği Al').setValue('backup').setEmoji('📦').setDescription('DB dosyasını yedekler ve DM atar.'),
                        new StringSelectMenuOptionBuilder().setLabel('PM2 Loglarını Temizle').setValue('flush').setEmoji('🧹').setDescription('Konsol kirliliğini temizler.'),
                        new StringSelectMenuOptionBuilder().setLabel('Sistemi Yeniden Başlat').setValue('restart').setEmoji('🔄').setDescription('Bot sürecini güvenli şekilde yeniden başlatır.')
                    );

                const refreshBtn = new ButtonBuilder().setCustomId('refresh_stats').setLabel('Yenile').setStyle(ButtonStyle.Secondary).setEmoji('🔃');

                return { embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu), new ActionRowBuilder().addComponents(refreshBtn)] };
            };

            const msg = await interaction.editReply(generateDashboard());

            const collector = msg.createMessageComponentCollector({ time: 300_000 });

            collector.on('collect', async (i) => {
                if (i.customId === 'refresh_stats') {
                    await i.update(generateDashboard());
                    return;
                }

                if (i.customId === 'owner_actions') {
                    const action = i.values[0];

                    if (action === 'backup') {
                        await i.deferUpdate();
                        try {
                            const dbPath = path.join(__dirname, '../../db.sqlite');
                            const backupFolder = path.join(__dirname, '../../backups');
                            if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder);

                            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
                            const backupFileName = `backup-${dateStr}.sqlite`;
                            const backupPath = path.join(backupFolder, backupFileName);

                            fs.copyFileSync(dbPath, backupPath);

                            const file = new AttachmentBuilder(dbPath, { name: 'db_backup.sqlite' });
                            try {
                                await interaction.user.send({ 
                                    content: `📦 **Veritabanı Yedeği**\n📅 Tarih: \`${new Date().toLocaleString('tr-TR')}\``, 
                                    files: [file] 
                                });
                                await i.followUp({ content: `✅ **Yedek Başarılı!**\n📂 Yerel: \`/backups/${backupFileName}\`\n📨 DM: Gönderildi.`, ephemeral: true });
                            } catch (dmErr) {
                                await i.followUp({ content: `✅ **Yerel Yedek Alındı** fakat DM gönderilemedi.\n📂 Yol: \`${backupPath}\``, ephemeral: true });
                            }
                        } catch (err) {
                            await i.followUp({ content: `❌ Yedekleme Hatası: \`${err.message}\``, ephemeral: true });
                        }
                    }

                    else if (action === 'flush') {
                        await i.deferUpdate();
                        exec('pm2 flush', (err) => {
                            if (err) i.followUp({ content: `❌ PM2 Hatası: \`${err.message}\``, ephemeral: true });
                            else i.followUp({ content: '✅ **PM2 Konsol Logları Temizlendi.**', ephemeral: true });
                        });
                    }

                    else if (action === 'restart') {
                        const confirmBtn = new ButtonBuilder().setCustomId('yes_restart').setLabel('ONAYLA VE BAŞLAT').setStyle(ButtonStyle.Danger);
                        const cancelBtn = new ButtonBuilder().setCustomId('no_restart').setLabel('İptal').setStyle(ButtonStyle.Secondary);
                        
                        const reply = await i.reply({
                            content: '⚠️ **KRİTİK İŞLEM:** Bot tamamen yeniden başlatılacak. Kesinti yaşanabilir. Onaylıyor musunuz?',
                            components: [new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)],
                            ephemeral: true,
                            fetchReply: true
                        });

                        const confirmCol = reply.createMessageComponentCollector({ time: 10000, max: 1 });
                        confirmCol.on('collect', async (c) => {
                            if (c.customId === 'yes_restart') {
                                await c.update({ content: '💀 **Sistem Yeniden Başlatılıyor...**', components: [] });
                                process.exit(1);
                            } else {
                                await c.update({ content: 'ℹ️ İşlem iptal edildi.', components: [] });
                            }
                        });
                    }
                }
            });
            return;
        }

        // ====================================================
        // BÖLÜM 2: SİSTEM YÖNETİMİ
        // ====================================================
        if (group === 'sistem') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'event-yenile') {
                try {
                    client.removeAllListeners();
                    clearCache('events');
                    require('../../handlers/eventHandler')(client);
                    return interaction.editReply('✅ **Tüm event dinleyicileri başarıyla yeniden yüklendi.**');
                } catch (e) {
                    return interaction.editReply(`❌ Event Hatası: \`${e.message}\``);
                }
            }

            if (sub === 'komut-yenile') {
                const target = interaction.options.getString('hedef').toLowerCase();
                try {
                    client.slashCommands.clear();
                    clearCache('slashCommands');
                    require('../../handlers/commandHandler')(client);
                    return interaction.editReply(`✅ **"${target}"** (ve diğer tüm komutlar) sistemde güncellendi.`);
                } catch (e) {
                    return interaction.editReply(`❌ Komut Hatası: \`${e.message}\``);
                }
            }
        }

        // ====================================================
        // BÖLÜM 3: LOW-XP YÖNETİMİ
        // ====================================================
        if (group === 'low-xp') {
            const guildId = interaction.guild.id;
            
            if (sub === 'liste') {
                const ignores = db.getIgnores(guildId);
                const list = ignores.filter(i => i.type === 'user_low_xp');
                
                const embed = new EmbedBuilder()
                    .setColor('#F44336')
                    .setTitle('📉 Düşük XP Listesi')
                    .setDescription(list.length > 0 
                        ? list.map((l, i) => `**${i+1}.** <@${l.target_id}> (\`${l.target_id}\`)`).join('\n')
                        : '✅ Listede hiç kullanıcı yok.')
                    .setFooter({ text: `${list.length} kullanıcı kısıtlandı.` });
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // HATA DÜZELTMESİ BURADA:
            // Discord eski komut yapısını ('hedef') cachelemiş olabilir, biz 'kullanıcı' istiyoruz.
            // Bu yüzden her ikisini de kontrol ediyoruz.
            const targetUser = interaction.options.getUser('kullanıcı') || interaction.options.getUser('hedef');
            
            // Eğer yine de bulunamazsa kullanıcıyı uyar:
            if (!targetUser) {
                return interaction.reply({ 
                    content: '❌ **Hata:** Hedef kullanıcı bulunamadı. Lütfen konsolda `node deploy-commands.js` komutunu çalıştırarak komutları güncelleyin.', 
                    ephemeral: true 
                });
            }
            
            if (sub === 'ekle') {
                const ignores = db.getIgnores(guildId);
                if (ignores.find(i => i.target_id === targetUser.id && i.type === 'user_low_xp')) {
                    return interaction.reply({ content: `⚠️ **${targetUser.tag}** zaten listede.`, ephemeral: true });
                }
                db.addIgnore(guildId, targetUser.id, 'user_low_xp');
                return interaction.reply({ content: `✅ **${targetUser.tag}** listeye eklendi.`, ephemeral: true });
            }

            if (sub === 'çıkar') {
                db.removeIgnore(guildId, targetUser.id);
                return interaction.reply({ content: `✅ **${targetUser.tag}** listeden çıkarıldı.`, ephemeral: true });
            }
        }
    }
};