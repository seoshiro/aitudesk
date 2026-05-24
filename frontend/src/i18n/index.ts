import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import kk from './locales/kk.json';

export const supportedLanguages = ['ru', 'en', 'kk'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageStorageKey = 'aitudesk_language';

function isSupportedLanguage(language: string | null): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage);
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'ru';
  const storedLanguage = window.localStorage.getItem(languageStorageKey);
  return isSupportedLanguage(storedLanguage) ? storedLanguage : 'ru';
}

void i18n
  .use(initReactI18next)
  .init({
    lng: getInitialLanguage(),
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      kk: { translation: kk },
    },
    fallbackLng: 'ru',
    supportedLngs: supportedLanguages,
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (language) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    languageStorageKey,
    isSupportedLanguage(language) ? language : 'ru',
  );
});

export default i18n;
