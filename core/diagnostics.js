// Seredovyshche Core v0.1 — structured, user-facing diagnostics.
export const DIAGNOSTIC_CODES = Object.freeze({
  STORAGE_BLOCKED: 'STORAGE_BLOCKED',
  MODULE_LOAD_FAILED: 'MODULE_LOAD_FAILED',
  RESOURCE_MISSING: 'RESOURCE_MISSING',
  CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN'
});
const messages = {
  STORAGE_BLOCKED: {
    title: 'Сховище недоступне',
    description: 'Програма не може зберігати дані в поточному режимі запуску.',
    action: 'Не вводьте важливі дані. Потрібен безпечний адаптер сховища.'
  },
  MODULE_LOAD_FAILED: {
    title: 'Не вдалося запустити модуль',
    description: 'Один із JavaScript-модулів програми не завантажився.',
    action: 'Перевірте шлях модуля та спосіб його завантаження.'
  },
  RESOURCE_MISSING: {
    title: 'Не знайдено файл програми',
    description: 'Потрібний ресурс відсутній або недоступний.',
    action: 'Перевірте структуру пакета й відносні шляхи.'
  },
  CAPABILITY_UNAVAILABLE: {
    title: 'Можливість недоступна',
    description: 'Ця система або поточний адаптер не підтримує запитану дію.',
    action: 'Спробуйте підтримуваний спосіб або іншу платформу.'
  },
  UNKNOWN: {
    title: 'Помилка програми',
    description: 'Під час виконання сталася непередбачена помилка.',
    action: 'Скопіюйте технічні деталі для діагностики.'
  }
};
export function makeDiagnostic(code, { appId = null, detail = '', severity = 'error' } = {}) {
  const safeCode = Object.hasOwn(messages, code) ? code : 'UNKNOWN';
  return Object.freeze({
    code: safeCode, severity, appId,
    ...messages[safeCode],
    detail: String(detail).slice(0, 2000),
    timestamp: new Date().toISOString()
  });
}
export function createDiagnosticBus() {
  const listeners = new Set();
  return Object.freeze({
    emit(event) { for (const listener of listeners) { try { listener(event); } catch (_) {} } return event; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
}
