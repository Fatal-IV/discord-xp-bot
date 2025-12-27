const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, 
    UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ComponentType, MessageFlags, AttachmentBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../database/sqlite');
const Database = require('better-sqlite3'); 

const clearCache = (f) => {
    const d = path.join(__dirname, '../../', f);
    if (fs.existsSync(d)) {
        fs.readdirSync(d).forEach(file => {
            const p = path.join(d, file);
            if (fs.lstatSync(p).isDirectory()) clearCache(path.join(f, file));
            else delete require.cache[require.resolve(p)];
        });
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Bot Sahibi Yönetim Paneli')
        .addSubcommand(sub => sub.setName('panel').setDescription('Tüm araçları tek merkezden yönetin.')),

    async execute(interaction, client) {
        // --- YETKİ KONTROLÜ (GÜNCELLENDİ) ---
        const authorizedIds = ['712202911958171748', '784577184420986900'];
        if (!authorizedIds.includes(interaction.user.id)) {
            return interaction.reply({ content: '⛔ **Yetki Yetersiz.**', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild.id;

        const getPanelData = () => {
            const uptime = process.uptime();
            const d = Math.floor(uptime / (3600 * 24)), h = Math.floor(uptime % (3600 * 24) / 3600), m = Math.floor(uptime % 3600 / 60);
            const dbPath = path.join(__dirname, '../../db.sqlite');
            const statsDb = new Database(dbPath, { readonly: true });
            const userCount = statsDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
            statsDb.close();

            const embed = new EmbedBuilder()
                .setColor('#2B2D31')
                .setAuthor({ name: 'Sistem Yönetim Paneli', iconURL: client.user.displayAvatarURL() })
                .addFields(
                    { name: '📊 Durum', value: `\`Uptime: ${d}g ${h}s ${m}d\`\n\`RAM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                    { name: '👥 Veri', value: `\`Kullanıcı: ${userCount}\`\n\`Gecikme: ${client.ws.ping}ms\``, inline: true }
                );

            const categoryRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('panel_category')
                    .setPlaceholder('📂 Bir kategori seçin...')
                    .addOptions(
                        { label: 'Sistem Araçları', value: 'cat_sys', emoji: '🛠️' },
                        { label: 'Dosya & Veri', value: 'cat_file', emoji: '📂' },
                        { label: 'Kullanıcı Yönetimi', value: 'cat_user', emoji: '👥' }
                    )
            );

            return { embeds: [embed], components: [categoryRow] };
        };

        const msg = await interaction.editReply(getPanelData());
        const collector = msg.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'panel_category') {
                const cat = i.values[0];
                const actionRow = new ActionRowBuilder();
                const menu = new StringSelectMenuBuilder().setCustomId('panel_action').setPlaceholder('⚡ İşlem Seçin...');

                if (cat === 'cat_sys') {
                    menu.addOptions(
                        { label: 'Komutları Yenile', value: 'ref_cmd', emoji: '📜' },
                        { label: 'Eventleri Yenile', value: 'ref_evt', emoji: '🔔' },
                        { label: 'Botu Yeniden Başlat', value: 'bot_res', emoji: '🔄' }
                    );
                } else if (cat === 'cat_file') {
                    menu.addOptions(
                        { label: 'DB Yedeği Al (FS + DM)', value: 'db_bak', emoji: '📦' },
                        { label: 'Logları Temizle', value: 'log_flu', emoji: '🧹' }
                    );
                } else if (cat === 'cat_user') {
                    const lowList = db.getIgnores(guildId).filter(x => x.type === 'user_low_xp');
                    const listText = lowList.map((x, idx) => `${idx + 1}. <@${x.target_id}>`).join('\n') || 'Liste boş.';
                    const userSelectRow = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('user_toggle_lowxp').setPlaceholder('Ekle/Çıkar için kullanıcı seçin...'));
                    const giftBtnRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('panel_action').addOptions({ label: 'Toplu Hediye XP', value: 'gift_xp', emoji: '🎁' }, { label: 'Panele Dön', value: 'back_main', emoji: '⬅️' }));
                    return i.update({ content: `📉 **Low-XP Listesi:**\n${listText}`, components: [userSelectRow, giftBtnRow], embeds: [] });
                }
                await i.update({ components: [i.message.components[0], actionRow.addComponents(menu)] });
            }

            if (i.customId === 'user_toggle_lowxp') {
                const targetId = i.values[0];
                const exists = db.getIgnores(guildId).find(x => x.target_id === targetId && x.type === 'user_low_xp');
                if (exists) db.removeIgnore(guildId, targetId); else db.addIgnore(guildId, targetId, 'user_low_xp');
                await i.reply({ content: `✅ İşlem başarılı.`, flags: MessageFlags.Ephemeral });
                return interaction.editReply(getPanelData());
            }

            if (i.customId === 'panel_action') {
                const action = i.values[0];
                if (action === 'back_main') return i.update(getPanelData());
                if (action === 'gift_xp') {
                    const modal = new ModalBuilder().setCustomId('m_gift').setTitle('Hediye XP');
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m_amt').setLabel('Miktar').setStyle(TextInputStyle.Short).setRequired(true)));
                    return i.showModal(modal);
                }

                await i.deferUpdate();
                if (action === 'ref_cmd') {
                    client.slashCommands.clear(); clearCache('slashCommands');
                    require('../../handlers/commandHandler')(client);
                    return i.followUp({ content: '✅ Komutlar yenilendi.', flags: MessageFlags.Ephemeral });
                }
                if (action === 'ref_evt') {
                    client.removeAllListeners(); clearCache('events');
                    require('../../handlers/eventHandler')(client);
                    return i.followUp({ content: '✅ Eventler yenilendi.', flags: MessageFlags.Ephemeral });
                }
                if (action === 'db_bak') {
                    const timestamp = Date.now();
                    const dateStr = new Date(timestamp).toLocaleString('tr-TR');
                    const fileName = `backup-${timestamp}.sqlite`;
                    const dbPath = path.join(__dirname, '../../db.sqlite');
                    const bakDir = path.join(__dirname, '../../backups');
                    if (!fs.existsSync(bakDir)) fs.mkdirSync(bakDir);
                    const bakPath = path.join(bakDir, fileName);

                    try {
                        fs.copyFileSync(dbPath, bakPath);
                        const attachment = new AttachmentBuilder(bakPath);
                        await interaction.user.send({
                            content: `📦 **Veritabanı Yedeği Alındı**\n📅 Tarih: \`${dateStr}\`\n📂 Dosya: \`${fileName}\``,
                            files: [attachment]
                        });
                        return i.followUp({ content: `✅ Yedek alındı ve DM ile gönderildi: \`${fileName}\``, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        return i.followUp({ content: `❌ Hata: ${err.message}`, flags: MessageFlags.Ephemeral });
                    }
                }
                if (action === 'log_flu') {
                    const p = path.join(__dirname, '../../logs.txt');
                    if (fs.existsSync(p)) fs.writeFileSync(p, '');
                    return i.followUp({ content: '🧹 Loglar temizlendi.', flags: MessageFlags.Ephemeral });
                }
                if (action === 'bot_res') process.exit(0);
            }
        });

        // Modal İşleyici
        const modalListener = async (m) => {
            if (!m.isModalSubmit() || m.customId !== 'm_gift') return;
            client.off('interactionCreate', modalListener);
            await m.deferReply({ flags: MessageFlags.Ephemeral });
            const amt = parseInt(m.fields.getTextInputValue('m_amt'));
            if (isNaN(amt) || amt <= 0) return m.editReply('❌ Geçersiz miktar.');
            const sDb = new Database('./db.sqlite');
            const users = sDb.prepare('SELECT user_id FROM users WHERE guild_id = ? AND level > 0').all(m.guild.id);
            sDb.close();
            if (users.length === 0) return m.editReply('⚠️ Aktif üye yok.');
            users.forEach(u => db.addXP(m.guild.id, u.user_id, amt));
            return m.editReply(`✅ **${users.length}** üyeye **${amt} XP** verildi.`);
        };
        client.on('interactionCreate', modalListener);
    }
};