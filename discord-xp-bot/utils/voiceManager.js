const db = require('../database/sqlite');
const { VOICE_XP_INTERVAL_MINUTES } = require('../config');
const { getRandomVoiceXP } = require('./levelSystem');
const logger = require('./logger');
const { ChannelType } = require('discord.js');
const chalk = require('chalk');

// Config'den gelen dakikayı ms'ye çevir veya varsayılan 2.5 dk kullan
const INTERVAL_MS = (VOICE_XP_INTERVAL_MINUTES || 2.5) * 60 * 1000;
const PRE = chalk.bold.cyan('[VoiceManager]');

async function distributeVoiceXP(client) {
    let processedUsers = 0;

    for (const guild of client.guilds.cache.values()) {
        try {
            // --- 1. SETUP KOMUT KONTROLÜ ---
            // Sunucu veritabanında yoksa veya log kanalı ayarlanmamışsa XP verme
            const guildConfig = db.getGuild(guild.id);
            if (!guildConfig || !guildConfig.log_channel_id) continue;

            const ignores = db.getIgnores(guild.id);
            const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);

            for (const channel of voiceChannels.values()) {
                
                // --- 2. AFK KANAL KORUMASI ---
                // Eğer kanal, sunucunun AFK kanalı ise atla
                if (channel.id === guild.afkChannelId) continue;

                // Yasaklı Kanal Kontrolü
                if (ignores.some(i => i.type === 'channel' && i.target_id === channel.id)) continue;

                for (const member of channel.members.values()) {
                    // --- 3. KANAL GİRİŞİ / DEĞİŞİMİ KONTROLÜ ---
                    // Polling mantığında kullanıcı o an hangi kanaldaysa orada işlem görür.
                    // Kanal değiştirse bile döngü sırasında bulunduğu yerde yakalanır.

                    if (member.user.bot) continue;

                    // Kulaklık (Sağırlaştırma) Kontrolü
                    if (member.voice.selfDeaf || member.voice.serverDeaf) continue;

                    // Rol Yasağı Kontrolü
                    if (ignores.some(i => i.type === 'role' && member.roles.cache.has(i.target_id))) continue;

                    // XP Verme İşlemi
                    try {
                        const userStats = db.getUserStats(guild.id, member.id);
                        const xpAmount = getRandomVoiceXP(userStats.level);
                        
                        db.addVoiceXP(guild.id, member.id, xpAmount);
                        processedUsers++;

                    } catch (err) {
                        logger.error(`${PRE} ${chalk.red('XP Hatası')} (${chalk.yellow(member.user.tag)}): ${err.message}`);
                    }
                }
            }
        } catch (guildError) {
            logger.error(`${PRE} ${chalk.red('Sunucu Tarama Hatası')} (${chalk.yellow(guild.name)}): ${guildError.message}`);
        }
    }
    
    if (processedUsers > 0) {
        logger.info(`${PRE} Tarama tamamlandı. ${chalk.bold.green(processedUsers)} kullanıcıya XP verildi.`);
    }
}

function init(client) {
    logger.success(`${PRE} Ses XP sistemi başlatıldı. Aralık: ${chalk.bold.yellow(VOICE_XP_INTERVAL_MINUTES + ' dk')}`);
    
    setInterval(() => {
        distributeVoiceXP(client);
    }, INTERVAL_MS);
}

module.exports = { init };