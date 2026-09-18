import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelPath = path.join(root, 'dx4-simulator-model.js');
const source = process.argv[2];
if (source) fs.copyFileSync(path.resolve(source), modelPath);
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
for (const [name, file] of [['MODEL', modelPath], ['SIMULATION', path.join(root, 'dx4-simulation-model.js')]]) {
  const start = `/* BEGIN ${name} */`, end = `/* END ${name} */`;
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < a) throw new Error(`Missing ${name} markers`);
  html = html.slice(0, a + start.length) + '\n' + fs.readFileSync(file, 'utf8') + '\n' + html.slice(b);
}
fs.writeFileSync(htmlPath, html);
console.log('Built standalone index.html');
