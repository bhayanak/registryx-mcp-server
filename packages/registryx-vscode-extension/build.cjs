const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Extension host (CJS, vscode external)
esbuild.buildSync({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
});

// MCP server (CJS — NOT ESM)
esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../registryx-server/src/index.ts')],
  bundle: true,
  outfile: 'dist/server/index.js',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
});

// Strip shebang — esbuild CJS prepends "use strict"; BEFORE the shebang,
// so content.startsWith('#!') is WRONG. Use a regex that handles line 1 or 2.
const serverFile = path.resolve(__dirname, 'dist/server/index.js');
let content = fs.readFileSync(serverFile, 'utf8');
content = content.replace(/^(?:[^\n]*\n)?#![^\n]*\n/, '');
fs.writeFileSync(serverFile, content);

console.log('✅ Extension and server bundled successfully');
