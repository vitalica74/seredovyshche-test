// Seredovyshche Core v0.1 — non-destructive capability detection.
// Reports observed capabilities; does not request permissions or mutate user data.
export function detectCapabilities(context = globalThis) {
  const nav = context.navigator || {};
  const android = !!(context.SeredovyshcheAndroid && typeof context.SeredovyshcheAndroid.postMessage === 'function');
  const ios = !!(context.webkit && context.webkit.messageHandlers && context.webkit.messageHandlers.seredovyshche);
  const platform = android ? 'android' : ios ? 'ios' : 'web';
  const caps = {
    platform,
    runtime: { supported: !!context.document, detail: 'HTML/CSS/JS' },
    files: { supported: !!(context.Blob && context.FileReader), detail: 'Browser file APIs' },
    zip: { supported: typeof context.JSZip !== 'undefined', detail: 'ZIP library availability' },
    storage: { supported: false, detail: 'Not verified' },
    notifications: { supported: !!context.Notification, detail: 'Permission not requested' },
    share: { supported: typeof nav.share === 'function', detail: 'Web Share API' },
    nearby: { supported: false, detail: 'Not implemented' }
  };
  try {
    const store = context.localStorage;
    if (store) { void store.length; caps.storage = { supported: true, detail: 'localStorage accessible (not a durability guarantee)' }; }
  } catch (error) {
    caps.storage = { supported: false, detail: error.name + ': ' + error.message };
  }
  return Object.freeze(caps);
}
