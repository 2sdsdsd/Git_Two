/* 无需 npm 安装：node tools/build.js，生成可独立打开的 HTML。 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const html = read('index.html').replace('/*__CSS__*/',()=>read('styles.css')).replace('/*__PLAYFUL__*/',()=>read('playful.css')).replace('/*__CITIES__*/',()=>read('cities.js')).replace('/*__ATMOSPHERE__*/',()=>read('atmosphere.js')).replace('/*__APP__*/',()=>read('app.js'));
fs.writeFileSync(path.join(root,'天气查询系统.html'),html);
fs.mkdirSync(path.join(root,'web'),{recursive:true});
fs.writeFileSync(path.join(root,'web','index.html'),html);
console.log('Built: 天气查询系统.html + web/index.html ('+Buffer.byteLength(html)+' bytes)');
// Windows PowerShell 5.1 需要 BOM 才能正确读取脚本中的中文。
for (const name of ['build.ps1','public.ps1','stop-public.ps1']) {
 const target=path.join(root,'tools',name),script=fs.readFileSync(target,'utf8');
 if (!script.startsWith('\uFEFF')) fs.writeFileSync(target,'\uFEFF'+script);
}
