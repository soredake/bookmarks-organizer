'use strict';

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', '_locales');

const localeTranslations = {
  cs: 'Nastavení',
  de: 'Einstellungen',
  dsb: 'Nastajenja',
  en: 'Settings',
  es: 'Configuración',
  fr: 'Paramètres',
  hsb: 'Nastajenja',
  it: 'Impostazioni',
  ja: '設定',
  nl: 'Instellingen',
  pl: 'Ustawienia',
  'pt-BR': 'Configurações',
  ru: 'Настройки',
  'sv-SE': 'Inställningar',
  tr_TR: 'Ayarlar',
  uk: 'Налаштування',
  'zh-CN': '设置',
  'zh-TW': '設定',
};

for (const locale of fs.readdirSync(localesDir)) {
  const fp = path.join(localesDir, locale, 'messages.json');

  if (!fs.existsSync(fp)) {
    continue;
  }

  let data;

  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }
  catch (e) {
    console.error(`Cannot parse ${locale}: ${e.message}`);
    continue;
  }

  if ('settings_button_title' in data) {
    console.log(`Already has key: ${locale}`);
    continue;
  }

  const translation = localeTranslations[locale] || 'Settings';
  const newData = {};
  let inserted = false;

  for (const [k, v] of Object.entries(data)) {
    if (k === 'option_max_concurrent_requests' && !inserted) {
      newData.settings_button_title = { message : translation };
      inserted = true;
    }

    newData[k] = v;
  }

  if (!inserted) {
    newData.settings_button_title = { message : translation };
  }

  fs.writeFileSync(fp, JSON.stringify(newData, null, 2) + '\n', { encoding : 'utf8' });
  console.log(`Updated: ${locale}`);
}
