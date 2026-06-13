const fs = require('fs');
let content = fs.readFileSync('src/components/PurchaseView.tsx', 'utf8');

// Replace grid grid-cols-12
content = content.replace(/className="grid grid-cols-12 gap-3/g, 'className="grid grid-cols-1 md:grid-cols-12 gap-3');
content = content.replace(/className="group hover:bg-white transition-colors grid grid-cols-12/g, 'className="group hover:bg-white transition-colors grid grid-cols-1 md:grid-cols-12');

// Fix col-span-3, 7, 2, 1
content = content.replace(/className="col-span-1 /g, 'className="col-span-1 md:col-span-1 ');
content = content.replace(/className="col-span-1"/g, 'className="col-span-1 md:col-span-1"');

content = content.replace(/className="col-span-7 /g, 'className="col-span-1 md:col-span-7 ');
content = content.replace(/className="col-span-7"/g, 'className="col-span-1 md:col-span-7"');

content = content.replace(/className="col-span-3 /g, 'className="col-span-1 md:col-span-3 ');
content = content.replace(/className="col-span-3"/g, 'className="col-span-1 md:col-span-3"');

content = content.replace(/className="col-span-2 /g, 'className="col-span-1 md:col-span-2 ');
content = content.replace(/className="col-span-2"/g, 'className="col-span-1 md:col-span-2"');

fs.writeFileSync('src/components/PurchaseView.tsx', content);
console.log('done grid replacements in PurchaseView');
