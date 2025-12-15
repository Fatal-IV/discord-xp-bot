const { Events, ActivityType } = require('discord.js');
const { VOICE_XP_INTERVAL_MINUTES } = require('../../config');
const logger = require('../../utils/logger');
const voiceManager = require('../../utils/voiceManager'); 
const chalk = require('chalk');
const Table = require('cli-table3');

module.exports = {
  name: Events.ClientReady,
  once: true,
  
  async execute(client) {
    // --- DASHBOARD ---
    const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const guildCount = client.guilds.cache.size;
    
    const dashboard = new Table({
        head: [chalk.white('İstatistik'), chalk.white('Değer')],
        colWidths: [20, 40]
    });

    dashboard.push(
        [chalk.cyan('Bot Kullanıcısı'), chalk.bold(client.user.tag)],
        [chalk.cyan('Sunucu Sayısı'), guildCount],
        [chalk.cyan('Toplam Kullanıcı'), userCount],
        [chalk.cyan('Ses XP Sistemi'), `${chalk.yellow(VOICE_XP_INTERVAL_MINUTES)} Dakika`],
        [chalk.cyan('Durum'), chalk.bgGreen.black(' AKTİF ')]
    );

    console.log(dashboard.toString());
    logger.success(`${chalk.bold.green(client.user.username)} göreve hazır!`);

    // --- DURUM AYARLAMASI ---
    const activities = [
        { name: "Firuze", type: ActivityType.Listening },
        { name: "Hidra", type: ActivityType.Listening },
        { name: "Fatal'ı", type: ActivityType.Listening }
    ];
    let activityIndex = 0;

    client.user.setPresence({
        activities: [activities[0]],
        status: 'dnd',
    });

    setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        const newActivity = activities[activityIndex];
        client.user.setPresence({
            activities: [{ name: newActivity.name, type: newActivity.type }],
            status: 'dnd',
        });
    }, 3 * 60 * 1000);

    // --- SES XP YÖNETİCİSİNİ BAŞLAT ---
    voiceManager.init(client);
  },
};