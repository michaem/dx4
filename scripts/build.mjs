import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelPath = path.join(root, 'dx4-simulator-model.js');
const source = process.argv[2];
if (source) fs.copyFileSync(path.resolve(source), modelPath);
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = '/* BEGIN MODEL */';
const end = '/* END MODEL */';
const a = html.indexOf(start), b = html.indexOf(end);
if (a < 0 || b < a) throw new Error('Missing model markers');
fs.writeFileSync(htmlPath, html.slice(0, a + start.length) + '\n' + fs.readFileSync(modelPath, 'utf8') + '\n' + html.slice(b));
console.log('Built standalone index.html');
