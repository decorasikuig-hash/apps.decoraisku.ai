const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/onClick=\{\(\) => setActiveMenuId\(/g, 'onClick={() => handleMenuClick(');
fs.writeFileSync('src/App.tsx', code);
console.log('done');
