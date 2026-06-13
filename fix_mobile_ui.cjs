const fs = require('fs');

['src/components/PurchaseView.tsx', 'src/components/RmrView.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Make the dropdown options bigger & readable
  
  // From: <span className="text-[9px] font-mono font-bold text-indigo-505 bg-indigo-50 px-2 py-0.5 rounded-full">{i.code}</span>
  // To: <span className="text-xs md:text-[9px] ... 
  content = content.replace(/text-\[9px\] font-mono/g, 'text-xs md:text-[9px] font-mono');
  
  // From: <span className="text-slate-900">{i.name}</span>
  // Should ideally be text-sm on mobile, but wrapping container has text-xs. Let's find: `cursor-pointer text-xs mb-1`
  content = content.replace(/cursor-pointer text-xs mb-1/g, 'cursor-pointer text-sm md:text-xs mb-1');
  
  // RmrView specific
  // From: className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
  content = content.replace(/className="w-full text-left px-3 py-2\.5 hover:bg-slate-50 transition-colors flex flex-col gap-0\.5"/g, 'className="w-full text-left px-3 py-3 md:py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-1 text-sm"');
  
  // PurchaseView select elements
  // replace md:h-9 with md:h-10 to expand inputs slightly on mobile
  content = content.replace(/h-9 text-xs/g, 'h-11 md:h-9 text-sm md:text-xs');
  content = content.replace(/h-10 md:h-9 text-xs md:text-\[10px\]/g, 'h-11 md:h-9 text-sm md:text-xs text-xs');
  
  // RmrView styling: change base inputs on mobile to be bigger
  content = content.replace(/text-\[10px\] text-slate-500 font-medium/g, 'text-xs md:text-[10px] text-slate-500 font-medium');
  content = content.replace(/lg:text-xs text-\[10px\]/g, 'lg:text-xs text-sm');

  // Any leftover tiny labels like text-[8.5px] -> text-xs md:text-[8.5px]
  content = content.replace(/text-\[8\.5px\]/g, 'text-xs md:text-[8.5px]');
  content = content.replace(/text-\[8px\]/g, 'text-xs md:text-[8px]');
  
  // RmrView grids to card on mobile
  content = content.replace(/className={`py-2\.5 first:pt-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-transparent/g, 'className={`py-4 md:py-2.5 first:pt-4 md:first:pt-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:items-center bg-white md:bg-transparent rounded-xl md:rounded-none border border-slate-200 md:border-transparent shadow-sm md:shadow-none p-4 md:p-0 my-3 md:my-0');
  
  // Fix RmrView divider
  content = content.replace(/divide-y divide-slate-100 p-4/g, 'p-4 md:divide-y md:divide-slate-100');

  fs.writeFileSync(file, content);
  console.log('Fixed ', file);
});
