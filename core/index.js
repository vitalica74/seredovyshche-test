// Seredovyshche Core v0.1 — shared contracts, not a replacement runtime yet.
import { detectCapabilities } from './capabilities.js';
import { makeDiagnostic, createDiagnosticBus, DIAGNOSTIC_CODES } from './diagnostics.js';

export function createCore({ adapter = null, context = globalThis } = {}) {
  const diagnostics = createDiagnosticBus();
  const capabilities = detectCapabilities(context);
  const platform = adapter || {
    name: capabilities.platform,
    capabilities,
    async launch() {
      const diagnostic = diagnostics.emit(makeDiagnostic(DIAGNOSTIC_CODES.CAPABILITY_UNAVAILABLE, {
        detail: 'No platform runtime adapter has been connected.'
      }));
      return { ok: false, diagnostic };
    }
  };
  return Object.freeze({
    version: '0.1.0',
    platform: platform.name,
    capabilities,
    diagnostics,
    report(code, options) { return diagnostics.emit(makeDiagnostic(code, options)); },
    async launch(project) {
      try { return await platform.launch(project); }
      catch (error) {
        return { ok: false, diagnostic: diagnostics.emit(makeDiagnostic(DIAGNOSTIC_CODES.UNKNOWN, {
          appId: project && project.id, detail: error && (error.stack || error.message) || String(error)
        })) };
      }
    }
  });
}
export { detectCapabilities, makeDiagnostic, DIAGNOSTIC_CODES };
