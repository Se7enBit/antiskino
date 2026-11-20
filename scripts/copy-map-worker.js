// Copies MapLibre's web worker next to the website's files (public/ is served
// as is), because Metro can't bundle it: maplibre-gl 6 loads it as a separate
// module file. Runs after every npm install (postinstall).
const fs = require('fs');
const path = require('path');

const source = require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs');
// npm runs install scripts from the package root.
const target = path.join(process.cwd(), 'public', 'maplibre-gl-worker.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
