const { EmbedBuilder } = require('discord.js');
const db = require('../database/sqlite');
const { getRandomTextXP } = require('./levelSystem');

async function handleTextXP(client, message, guildConfig) {
  const guildId = message.guild.id;
  const userId = message.author.id;
  const now = Date.now();

  // --- 1. KULLANICI VERİSİNİ ÇEK ---
  // Kullanıcının veritabanındaki son XP alma zamanını alıyoruz.
  const userStats = db.getUserStats(guildId, userId);

  // --- 2. DİNAMİK BEKLEME SÜRESİ (SETUP AYARINA GÖRE) ---
  // BURASI KRİTİK: Eğer setup ile 10sn ayarlandıysa guildConfig.cooldown 10 gelir.
  // Eğer ayar yapılmadıysa (null/undefined) varsayılan 60sn olur.
  const cooldownSeconds = guildConfig.cooldown > 0 ? guildConfig.cooldown : 60;
  
  const lastGain = userStats.last_text_xp_gain || 0;
  const timePassed = now - lastGain; // Ms cinsinden geçen süre

  // Eğer geçen süre, sunucunun ayarladığı süreden azsa işlem yapma
  if (timePassed < (cooldownSeconds * 1000)) {
      // İsteğe bağlı debug logu (Test ederken açabilirsiniz)
      // const remaining = Math.ceil((cooldownSeconds * 1000 - timePassed) / 1000);
      // console.log(`[XP-ENGEL] ${message.author.tag} bekleme süresinde. Kalan: ${remaining}sn (Ayar: ${cooldownSeconds}sn)`);
      return;
  }

  // --- 3. XP HESAPLAMA VE VERME ---
  const newXP = getRandomTextXP(userStats.level);
  
  // db.addXP fonksiyonu 'last_text_xp_gain' verisini 'now' (şu an) olarak günceller.
  const { oldLevel, newLevel } = db.addXP(guildId, userId, newXP);
  
  console.log(`[XP-KAZANIM] ${message.author.tag} +${newXP} XP kazandı. (Lvl: ${oldLevel} -> ${newLevel})`);

  // --- 4. SEVİYE ATLAMA İŞLEMLERİ ---
  if (newLevel > oldLevel) {
    await processLevelUp(client, message, newLevel, guildConfig);
  }
}

async function processLevelUp(client, message, newLevel, guildConfig) {
  try {
    const logChannelId = guildConfig.log_channel_id;
    const logChannel = client.channels.cache.get(logChannelId);
    
    if (!logChannel) return;

    const t = client.i18n.getFixedT(message.guild.preferredLocale || 'tr');
    let rawMsg = guildConfig.level_up_message || t('events.levelUp.message');

    const descriptionText = rawMsg
        .replace(/{user}/g, message.author.toString())
        .replace(/{level}/g, `**${newLevel}**`)
        .replace(/{guild}/g, message.guild.name);

    const levelEmbed = new EmbedBuilder()
        .setColor('#FFE082') 
        .setDescription(`*Seviye Atladın*\n> ${descriptionText}`)
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
        .setFooter({ 
            text: `${message.guild.name} • XP Sistemi`, 
            iconURL: message.guild.iconURL() 
        })
        .setTimestamp();

    await logChannel.send({
        content: message.author.toString(),
        embeds: [levelEmbed]
    });
    
    // Rol Ödülleri
    const rolesToAward = db.getLevelRoles(message.guild.id, newLevel);
    if (rolesToAward.length > 0) {
      rolesToAward.forEach(roleData => {
        const role = message.guild.roles.cache.get(roleData.role_id);
        if (role && !message.member.roles.cache.has(role.id)) {
          message.member.roles.add(role).catch(e => console.error(`Rol verilemedi: ${e.message}`));
        }
      });
    }
  } catch (err) {
    console.error(`XP verme hatası: ${err.message}`);
  }
}

module.exports = { handleTextXP };