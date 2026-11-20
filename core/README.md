# Середовище Core v0.1

Спільне ядро платформи: визначення можливостей, діагностичні повідомлення українською та контракт адаптера запуску.

## Принципи

- Одні API та коди помилок на Web, Android, iOS.
- Адаптер платформи відповідає за фактичний запуск і доступ до системних ресурсів.
- Ядро не обіцяє доступу до можливостей, яких немає.
- Жодного послаблення sandbox або доступу до чужого IndexedDB.
- Жодних міграцій, видалення чи переміщення даних без резервного експорту.

## Стан

Це **перший незалежний модуль ядра**, а не готовий рушій. Він ще не підключений до інтерфейсу v0.1.18.3 і не вирішує проблему модулів або сховища «Гаража».

## Контракт адаптера

```js
const adapter = {
  name: 'web',
  capabilities: {},
  async launch(project) {
    return { ok: true };
  }
};
```

Використання:

```js
import { createCore, DIAGNOSTIC_CODES } from './core/index.js';
const core = createCore();
core.diagnostics.subscribe(event => console.log(event.title, event.action));
core.report(DIAGNOSTIC_CODES.STORAGE_BLOCKED, { appId: 'garage' });
```
