// Polyfill Object.groupBy for Node < 21.
// eslint-flat-config-utils@3 calls Object.groupBy at config load time, which crashes
// `pnpm lint` on Node 20.x. Loaded via `node --require` from the lint script.
if (typeof Object.groupBy !== 'function') {
  Object.groupBy = function groupBy(items, keyFn) {
    const result = Object.create(null);
    let i = 0;
    for (const item of items) {
      const key = keyFn(item, i++);
      if (result[key] === undefined)
        result[key] = [];
      result[key].push(item);
    }
    return result;
  };
}
