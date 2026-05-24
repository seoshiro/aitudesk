import { shouldPolyfill as shouldPolyfillDateTime } from '@formatjs/intl-datetimeformat/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillRelativeTime } from '@formatjs/intl-relativetimeformat/should-polyfill.js';

export async function ensureIntlPolyfills() {
  const needsDateTime = ['ru-RU', 'en-US', 'kk-KZ'].some((locale) => shouldPolyfillDateTime(locale));
  const needsRelativeTime = ['ru-RU', 'en-US', 'kk-KZ'].some((locale) =>
    shouldPolyfillRelativeTime(locale),
  );

  if (needsDateTime) {
    await import('@formatjs/intl-datetimeformat/polyfill-force.js');
    await Promise.all([
      import('@formatjs/intl-datetimeformat/locale-data/ru.js'),
      import('@formatjs/intl-datetimeformat/locale-data/en.js'),
      import('@formatjs/intl-datetimeformat/locale-data/kk.js'),
    ]);
  }

  if (needsRelativeTime) {
    await import('@formatjs/intl-relativetimeformat/polyfill-force.js');
    await Promise.all([
      import('@formatjs/intl-relativetimeformat/locale-data/ru.js'),
      import('@formatjs/intl-relativetimeformat/locale-data/en.js'),
      import('@formatjs/intl-relativetimeformat/locale-data/kk.js'),
    ]);
  }
}
