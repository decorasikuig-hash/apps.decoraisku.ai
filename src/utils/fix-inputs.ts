import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'components', 'PurchaseView.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Goods Receipt Qty input type
content = content.replace(
  /type="number"\s*\r?\n\s*placeholder="Qty"/,
  'type="text"\r\n                                  placeholder="Qty"'
);

// 2. Row Qty input type
content = content.replace(
  /type="number"\s*\r?\n\s*className="w-full bg-white border border-slate-200 rounded-xl py-2\.5 px-2 text-center text-xs font-semibold focus:ring-2 focus:ring-emerald-500\/20 focus:border-emerald-500 outline-none transition-all"/,
  'type="text"\r\n                                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-2 text-center text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"'
);

// 3. Row Price input type
content = content.replace(
  /type="number"\s*\r?\n\s*className="w-full bg-white border border-slate-200 rounded-xl py-2\.5 px-3 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500\/20 focus:border-emerald-500 outline-none transition-all"/,
  'type="text"\r\n                                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully formatted inputs to type text!');
