/**
 * Lazy proxies for window.* trip modules — safe under Vite ESM (no frozen undefined).
 */
export function lazyGlobal(key) {
  return new Proxy(
    {},
    {
      get(_, prop) {
        const mod = globalThis[key];
        if (mod == null) {
          throw new Error(`${key} not loaded — check js/bootstrap.js import order`);
        }
        const val = mod[prop];
        return typeof val === 'function' ? val.bind(mod) : val;
      },
    }
  );
}
