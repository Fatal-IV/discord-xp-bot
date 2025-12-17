const i18next = require('i18next');
const fs = require('fs'); 
const path = require('path'); 
const logger = require('./logger'); 

/**
 * i18next'i başlatır, çeviri dosyalarını MANUEL yükler
 * ve tam hazır instance'ı (örneği) geri döndürür.
 */
async function initializeI18next() {
  // Düzeltme: i18nStart -> info
  logger.info('Dil sistemi başlatılıyor... (Manuel Yükleme Modu)');

  let resources = {};
  const localesPath = path.join(__dirname, '..', 'locales'); 
  const projectRoot = path.join(__dirname, '..', '..');

  try {
    // 1. İngilizce'yi Yükle
    const enPath = path.join(localesPath, 'en', 'translation.json');
    
    // Düzeltme: i18nLoad -> info
    logger.info(`Yükleniyor: ${path.basename(enPath)}`);
    
    const enFile = fs.readFileSync(enPath, 'utf8');
    resources.en = { translation: JSON.parse(enFile) };
    
    // Düzeltme: i18nSuccess -> success
    logger.success('Dil paketi yüklendi: English (en)');

    // 2. Türkçe'yi Yükle
    const trPath = path.join(localesPath, 'tr', 'translation.json');
    
    // Düzeltme: i18nLoad -> info
    logger.info(`Yükleniyor: ${path.basename(trPath)}`);
    
    const trFile = fs.readFileSync(trPath, 'utf8');
    resources.tr = { translation: JSON.parse(trFile) };
    
    // Düzeltme: i18nSuccess -> success
    logger.success('Dil paketi yüklendi: Türkçe (tr)');

  } catch (err) {
    logger.error(`Çeviri dosyaları okunurken KRİTİK HATA: ${err.message}`);
    throw new Error('Çeviri dosyaları okunamadı. Dosya yapısını kontrol edin.');
  }

  await i18next
    .init({
      debug: false,
      fallbackLng: 'en',
      supportedLngs: ['en', 'tr'],
      resources: resources,
      ns: 'translation',
      defaultNS: 'translation',
      
      // Değişken Tanıtımı (Interpolation)
      interpolation: {
        escapeValue: false, // Discord için XSS korumasını kapat
        prefix: '{{',       
        suffix: '}}'        
      }
    });
    
  // Düzeltme: i18nDone -> success
  logger.success('Çeviri modülleri başarıyla entegre edildi.');
  
  return i18next;
}

module.exports = {
  init: initializeI18next,
};