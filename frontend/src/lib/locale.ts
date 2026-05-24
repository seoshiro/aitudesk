import type { TFunction } from 'i18next';
import type { SupportedLanguage } from '@/i18n';

export const localeByLanguage: Record<SupportedLanguage, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
};

export function normalizeLanguage(language: string | undefined): SupportedLanguage {
  const code = language?.split('-')[0];
  if (code === 'en' || code === 'kk' || code === 'ru') return code;
  return 'ru';
}

export function getIntlLocale(language: string | undefined): string {
  return localeByLanguage[normalizeLanguage(language)];
}

export function formatDate(
  value: string | Date,
  language: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(date);
}

export function formatDateTime(value: string | Date, language: string | undefined): string {
  return formatDate(value, language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value: string | Date, language: string | undefined, t?: Translate): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const normalized = normalizeLanguage(language);

  const localRelative = (amount: number, unit: 'minute' | 'hour' | 'day'): string | null => {
    if (!t || normalized === 'en') return null;
    const abs = Math.abs(amount);
    const isFuture = amount > 0;
    return t(`common.relative.${isFuture ? 'future' : 'past'}.${unit}`, { count: abs });
  };

  if (absSeconds < 45) {
    if (t && normalized !== 'en') return t('common.relative.now');
  }
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(language), { numeric: 'auto' });
  if (absSeconds < 45) return rtf.format(0, 'second');
  const minutes = Math.round(diffSeconds / 60);
  if (Math.abs(minutes) < 60) return localRelative(minutes, 'minute') ?? rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return localRelative(hours, 'hour') ?? rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return localRelative(days, 'day') ?? rtf.format(days, 'day');

  return formatDate(date, language, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCount(value: number, language: string | undefined): string {
  return new Intl.NumberFormat(getIntlLocale(language)).format(value);
}

export function getRequiredMark(required?: boolean): string {
  return required ? '*' : '';
}

export type Translate = TFunction<'translation', undefined>;
