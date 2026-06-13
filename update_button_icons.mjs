import fs from 'fs';
import path from 'path';

function addIconsToButtons(content) {
  // Batal -> X
  content = content.replace(/(?<!<(X|Check|Save|Plus|Printer|Trash2|Pencil|Upload|Download|RefreshCcw)[^>]*>\s*)>(\s*)Batal(\s*)<\/button>/ig, 
    `>$2<X className="w-4 h-4 mr-1" /> Batal$3</button>`);
  // Simpan -> Save
  content = content.replace(/(?<!<(X|Check|Save|Plus|Printer|Trash2|Pencil|Upload|Download|RefreshCcw)[^>]*>\s*)>(\s*)Simpan([^<]*)<\/button>/ig, 
    `>$2<Save className="w-4 h-4 mr-1" /> Simpan$3</button>`);
  // Input / Tambah -> Plus
  content = content.replace(/(?<!<(X|Check|Save|Plus|Printer|Trash2|Pencil|Upload|Download|RefreshCcw)[^>]*>\s*)>(\s*)(Input|Tambah)([^<]*)<\/button>/ig, 
    `>$2<Plus className="w-4 h-4 mr-1" /> $3$4</button>`);
  // Cetak -> Printer
  content = content.replace(/(?<!<(X|Check|Save|Plus|Printer|Trash2|Pencil|Upload|Download|RefreshCcw)[^>]*>\s*)>(\s*)Cetak([^<]*)<\/button>/ig, 
    `>$2<Printer className="w-4 h-4 mr-1" /> Cetak$3</button>`);
  // Export -> Download
  content = content.replace(/(?<!<(X|Check|Save|Plus|Printer|Trash2|Pencil|Upload|Download|RefreshCcw)[^>]*>\s*)>(\s*)Export([^<]*)<\/button>/ig, 
    `>$2<Download className="w-4 h-4 mr-1" /> Export$3</button>`);
  
  return content;
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      processDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      let content = fs.readFileSync(filePath, 'utf8');

      const original = content;
      content = addIconsToButtons(content);

      // Handle the cases where the button text is an expression like: >{activeTab === 'customer' ? 'Tambah Customer' : 'Tambah Supplier'}</button>
      // We can replace the 'Tambah ' part inside the string literal, but it's risky.
      // Better to inject an icon right before the JSX expression if it's a known button type.
      // E.g. >\s*\{(.*?(Simpan|Input|Tambah).*?)\}\s*<\/button>
      // content = content.replace(/>(\s*)\{([^}]*(?:Simpan|Input|Tambah|Batal)[^}]*)\}(\s*)<\/button>/ig, (match, p1, expr, p3) => {
      //   ...
      // });
      
      // Update imports if needed
      const iconsToAdd = [];
      if (content.includes('<X className') && !content.includes(' X,')) iconsToAdd.push('X');
      if (content.includes('<Save ') && !content.includes('Save')) iconsToAdd.push('Save');
      if (content.includes('<Plus ') && !content.includes('Plus')) iconsToAdd.push('Plus');
      if (content.includes('<Printer ') && !content.includes('Printer')) iconsToAdd.push('Printer');
      if (content.includes('<Download ') && !content.includes('Download')) iconsToAdd.push('Download');
      if (content.includes('<Check ') && !content.includes('Check')) iconsToAdd.push('Check');
      
      if (iconsToAdd.length > 0) {
        if (content.match(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/)) {
            content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, (m, p1) => {
                const existingIcons = p1.split(',').map(i => i.trim());
                const newIcons = iconsToAdd.filter(i => !existingIcons.includes(i));
                if(newIcons.length === 0) return m;
                return `import { ${existingIcons.join(', ')}, ${newIcons.join(', ')} } from 'lucide-react';`;
            });
        }
      }

      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
}

processDir('./src/components');
console.log("Button icons updated.");
