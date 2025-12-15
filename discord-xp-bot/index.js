require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
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