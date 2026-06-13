import fs from 'fs';
import path from 'path';

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      processDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 1. Labels
      content = content.replace(/<label\s+className="([^"]*)"/g, (match, p1) => {
        // Keep flex items if they exist
        const hasFlex = p1.includes('flex');
        const flexClasses = hasFlex ? ' flex items-center justify-between' : ' block';
        return `<label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider${flexClasses}"`;
      });

      // 2. Inputs, Selects, Textareas
      content = content.replace(/className="w-full bg-[^"]*border[^"]*rounded-[^"]*p-[^"]*(?:focus:[^"]*|hover:[^"]*)*"/g, 
        `className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"`);
      
      // 3. Primary Buttons "Simpan", "Input", etc.
      content = content.replace(/className="[^"]*bg-\[#1e1b4b\][^"]*"/g, 
        `className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"`);
        
      // 4. Cards
      content = content.replace(/className="([^"]*bg-white[^"]*shadow[^"]*)"/g, (match, p1) => {
        if(p1.includes('rounded-full')) return match; // exclude icon wrappers
        let newClasses = p1.replace(/border(-[a-z]+-?[0-9]*\/?[0-9]*)?/g, '').trim();
        newClasses = newClasses.replace(/shadow(-[a-z]+)?/g, '').trim();
        newClasses = newClasses.replace(/rounded(-[a-z]+)?/g, '').trim();
        return `className="${newClasses} bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"`;
      });

      // 5. Cancel buttons (text-slate-500 hover:bg-rose-50 etc) -> icons or minimalistic
      content = content.replace(/className="[^"]*text-slate-500 hover:bg-rose-50[^"]*"/g, 
        `className="flex items-center justify-center gap-1.5 bg-[#f1f5f9] text-slate-600 rounded-xl py-3 px-5 font-semibold hover:bg-slate-200 transition-all duration-200 border-none cursor-pointer"`);

      // 6. Action dots/buttons on tables
      // Edit button text -> icon only
      // Usually "Edit" -> <Pencil className="w-4 h-4"/>
      // Instead of replacing the content (which is hard via regex without AST wrapper),
      // we just style the wrapper button as a circle, and the text will be hidden if we use font-size 0 or CSS.
      // But better: we can rewrite exact strings "Edit Data", "Edit", "Hapus" if they are inside buttons.
      content = content.replace(/>\s*Hapus\s*<\/button>/g, `><Trash2 className="w-4 h-4"/>&nbsp;Hapus</button>`);
      content = content.replace(/>\s*Hapus Alat\s*<\/button>/g, `><Trash2 className="w-4 h-4"/>&nbsp;Hapus Alat</button>`);
      content = content.replace(/>\s*Edit\s*<\/button>/g, `><Pencil className="w-4 h-4"/>&nbsp;Edit</button>`);
      
      // Update action buttons to have circle classes if they had text-indigo-600 and are small
      content = content.replace(/className="([^"]*text-indigo-600 hover:bg-indigo-50[^"]*)"/g, (match, p1) => {
        if(p1.includes('w-') || p1.includes('px-')) {
          let cleaned = p1.replace(/px-[a-z0-9]+/g, '').replace(/py-[a-z0-9]+/g, '').replace(/rounded-[a-z0-9]+/g, '');
          return `className="${cleaned} w-8 h-8 rounded-full flex gap-1 items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"`;
        }
        return match;
      });

      content = content.replace(/className="([^"]*text-rose-600 hover:bg-rose-50[^"]*)"/g, (match, p1) => {
         if(p1.includes('w-') || p1.includes('px-')) {
          let cleaned = p1.replace(/px-[a-z0-9]+/g, '').replace(/py-[a-z0-9]+/g, '').replace(/rounded-[a-z0-9]+/g, '');
          return `className="${cleaned} w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"`;
        }
        return match;
      });

      // Rename Alat Kerja Kayu -> Equipment text
      content = content.replace(/Alat Kerja Kayu/g, 'Equipment');

      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

// Ensure lucide-react imports have Trash2 and Pencil if needed
function injectIcons(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        injectIcons(filePath);
      } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if(content.includes('<Trash2') && !content.includes('Trash2')) {
            content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, (m, p1) => {
                return `import {${p1}, Trash2} from 'lucide-react';`
            });
            fs.writeFileSync(filePath, content, 'utf8');
        }
        if(content.includes('<Pencil') && !content.includes('Pencil')) {
             let c2 = fs.readFileSync(filePath, 'utf8');
            c2 = c2.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, (m, p1) => {
                return `import {${p1}, Pencil} from 'lucide-react';`
            });
            fs.writeFileSync(filePath, c2, 'utf8');
        }
      }
    }
}

processDir('./src/components');
processDir('./src/modules');
injectIcons('./src/components');
injectIcons('./src/modules');

console.log("UI updated.");
