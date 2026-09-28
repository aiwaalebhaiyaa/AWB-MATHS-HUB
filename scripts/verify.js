const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const required = [
  'backend/server.js','backend/package.json','backend/.env.example','database/schema.sql',
  'frontend/index.html','frontend/api.js','README.md','Dockerfile','docker-compose.yml','render.yaml'
];
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing required file: ${file}`);
for (const file of ['backend/server.js','frontend/api.js']) execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
const html = fs.readFileSync(path.join(root,'frontend/index.html'),'utf8');
for (const marker of ['AWB MATHS HUB','ASK AYAN AI','Module I','Module V','Mistake Book']) if (!html.includes(marker)) throw new Error(`Frontend marker missing: ${marker}`);
console.log('AWB MATHS HUB verification passed.');
