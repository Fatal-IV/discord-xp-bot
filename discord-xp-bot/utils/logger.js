// utils/logger.js
const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// --- LOG KLASÖRÜ OLUŞTURMA ---
// Bu dosya 'utils' içinde olduğu için bir üst dizine çıkıp 'logs' klasörüne bakıyoruz.
const logDir = path.join(__dirname, '../logs');

// Eğer logs klasörü yoksa oluştur
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function timestamp() {
  return moment().format('DD-MM-YYYY HH:mm:ss');
}

// Dosyaya yazma yardımcısı (Renk kodlarını temizler)
function writeLogToFile(filename, level, message) {
  const cleanMessage = message.replace(/\u001b\[[0-9]{1,2}m/g, ''); // Renk kodlarını sil
  const logText = `[${timestamp()}] [${level}] ${cleanMessage}\n`;
  
  // Dosyaya ekleme yap (append)
  fs.appendFileSync(path.join(logDir, filename), logText, 'utf8');
}

module.exports = {
  success: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.green.bold('[BAŞARILI]')} ${message}`);
    // İstersen başarılı işlemleri de genel bir loga kaydedebilirsin:
    // writeLogToFile('combined.log', 'BAŞARILI', message);
  },

  error: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.red.bold('[HATA]')} ${message}`);
    // Hataları mutlaka kaydediyoruz:
    writeLogToFile('error.log', 'HATA', message);
  },

  warn: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.yellow.bold('[UYARI]')} ${message}`);
    writeLogToFile('error.log', 'UYARI', message); // Uyarıları da hata loguna eklemek iyi olabilir
  },

  info: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.cyan.bold('[BİLGİ]')} ${message}`);
  },

  event: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[EVENT]')} ${message}`);
  },
  
  // --- i18n İşlem Logları ---
  i18nStart: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${message}`);
  },
  i18nLoad: (path) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.gray('-> Okunuyor:')} ${chalk.white(path)}`);
  },
  i18nSuccess: (lang) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.green.bold(`[${lang}]`)} Başarıyla yüklendi.`);
  },
  i18nDone: (message) => {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.yellow(message)}`);
  },

  loader: (type, name, status) => {
    const icon = status ? chalk.green('✔') : chalk.red('✘');
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.blue.bold(`[${type}]`)} ${name} ${icon}`);
    
    // Yükleme hatalarını da loga düşelim
    if (!status) {
        writeLogToFile('error.log', 'LOADER_HATA', `${type} - ${name} yüklenemedi.`);
    }
  }
};