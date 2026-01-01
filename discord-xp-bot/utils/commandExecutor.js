const { checkPermissions } = require('./permissionCheck.js');

/**
 * @param {Object} client - Discord Client
 * @param {Object} message - Mesaj Nesnesi
 * @param {Object} command - Bulunan Komut Nesnesi
 * @param {Array} args - Komut Argümanları
 * @param {Object} db - Veritabanı Bağlantısı
 */
async function executeCommand(client, message, command, args, db) {
    const t = client.i18n?.getFixedT(message.guild.id) || ((key) => key);

    // 1. Yetki Kontrolünü Çağır
    const errorMsg = checkPermissions(message.member, command, t);
    
    // Eğer yetki eksikse mesaj gönder ve dur
    if (errorMsg) {
        return message.reply(errorMsg);
    }

    // 2. Komutu Çalıştır
    try {
        await command.execute(message, args, client, t, db);
    } catch (err) {
        console.error(`[Komut Hatası: ${command.name}]`, err);
    }
}

module.exports = { executeCommand };