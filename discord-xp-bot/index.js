require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, REST } = require('discord.js');
const { init: i18nInit } = require('./utils/i18n'); 
const db = require('./database/sqlite');
const { CooldownManager } = require('./utils/cooldown');
const chalk = require('chalk');
const logger = require('./utils/logger');

// İstemci Ayarları
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Global Değişkenler
client.commands = new Collection();
client.slashCommands = new Collection();
client.voiceXPIntervals = new Map();
client.cooldownManager = new CooldownManager(); 
client.db = db; 

// 1. Yakalanmamış Promise Hataları (Async hatalar)
process.on('unhandledRejection', (reason, p) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    // Detaylı stack trace varsa onu da string'e çevirip yazabilirsin
    if (reason instanceof Error) {
        logger.error(`Stack: ${reason.stack}`);
    }
});

// 2. Yakalanmamış Exception'lar (Kod hataları)
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    // Kritik hata olduğu için process'i kapatmak genellikle daha güvenlidir ama
    // botun kapanmamasını istiyorsan exit yapmayabilirsin.
    // process.exit(1); 
});

// Banner
console.clear();
console.log(chalk.yellow(`
██████╗  ██████╗ ████████╗
██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝██║   ██║   ██║   
██╔══██╗██║   ██║   ██║   
██████╔╝╚██████╔╝   ██║   
╚═════╝  ╚═════╝    ╚═╝   
`));
logger.info('Bot başlatma protokolü devrede...');

// --- Handlers Yükleme ---
require('./handlers/commandHandler')(client);
require('./handlers/eventHandler')(client);

// --- Bot Başlatma ---
(async () => {
  try {
    const i18nInstance = await i18nInit();
    client.i18n = i18nInstance;
    
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('Bot başlatılırken kritik hata!');
    console.error(error);
  }
})();