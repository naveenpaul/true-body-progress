// Use the local polyfill shim so ESLint runs on Node 20 (eslint-flat-config-utils
// uses Object.groupBy, which is Node 21+).
const eslintCmd = 'node --require ./scripts/polyfill-object-groupby.js ./node_modules/eslint/bin/eslint.js --fix';

module.exports = {
  '**/*.{js,jsx,ts,tsx}': filenames => [
    `${eslintCmd} ${filenames.map(f => `"${f}"`).join(' ')}`,
  ],
  '**/*.json': filenames => [
    `${eslintCmd} ${filenames.map(f => `"${f}"`).join(' ')}`,
  ],
};
