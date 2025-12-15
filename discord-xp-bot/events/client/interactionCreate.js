const { Events, MessageFlags, PermissionsBitField } = require('discord.js');
const config = require('../../config');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    const t = client.i18n.getFixedT(interaction.locale || 'tr');
    const db = client.db;

    // --- 1. AUTOCOMPLETE ---
    if (interaction.isAutocomplete()) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;
      try {
        if (command.autocomplete) await command.autocomplete(interaction, client, t, db);
      } catch (error) {
        console.error(`Autocomplete Hatası (${interaction.commandName}):`, error);
      }
      return;
    }

    // --- 2. SLASH KOMUTLARI ---
    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;

      // A) YETKİ KONTROLÜ
      if (command.isAdmin) {
        const isOwner = interaction.user.id === config.owner_id;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isAdmin && !isOwner) {
        //  console.log(`[YETKI-RED] ${interaction.user.tag} yetkisiz komut denemesi: ${command.data.name}`);
          return interaction.reply({ 
            content: t('common.noPermission'), 
            flags: MessageFlags.Ephemeral 
          });
        }
      }

      // B) SETUP KONTROLÜ
      const guildSettings = db.getGuild(interaction.guild.id);
      const isSetupDone = guildSettings && guildSettings.log_channel_id;
      if (!isSetupDone && command.data.name !== 'setup' && command.data.name !== 'help') {
         return interaction.reply({
             content: t('common.setupRequired'),
             flags: MessageFlags.Ephemeral
         });
      }

      // C) KOMUT BEKLEME SÜRESİ (COOLDOWN)
      const isOwner = interaction.user.id === config.owner_id;
      const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      
      if (!isOwner && !isAdmin) {
          const cooldownTime = command.cooldown || 10; 
          const cooldownKey = `cmd:${interaction.commandName}`;
          
          const remaining = client.cooldownManager.getRemaining(cooldownKey, interaction.user.id);
          
          if (remaining > 0) {
          //  console.log(`[CMD-COOLDOWN] ${interaction.user.tag} komut engeli: ${command.data.name} (Kalan: ${remaining}sn)`);
            return interaction.reply({ 
              content: t('common.cooldown', { seconds: remaining }), 
              flags: MessageFlags.Ephemeral 
            });
          }
          
          client.cooldownManager.setCooldown(cooldownKey, interaction.user.id, cooldownTime);
      }

      // D) KOMUTU ÇALIŞTIR
      try {
      //  console.log(`[CMD-EXEC] ${interaction.user.tag} komutu çalıştırdı: ${command.data.name}`);
        await command.execute(interaction, client, t, db);
      } catch (error) {
        console.error(`Komut Hatası (${interaction.commandName}):`, error);
        // Hata mesajı işlemleri...
        const errorContent = t('common.commandError');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorContent, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: errorContent, flags: MessageFlags.Ephemeral });
        }
      }
    }
  },
};