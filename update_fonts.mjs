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

      // 1. Judul Utama (h1/h2) should be font-bold text-slate-800
      content = content.replace(/<(h1|h2)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
          let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, '').trim();
          newClasses = newClasses.replace(/text-slate-[0-9]+/g, '').trim();
          // Remove uppercase if we want standard casing, but user says "KAPITAL dan huruf kecil harus sama smua". Let's enforce standard capitalize or just remove text-transform overrides to let the raw text dictate.
          newClasses = newClasses.replace(/\buppercase\b/g, '').trim();
          newClasses = newClasses.replace(/\bcapitalize\b/g, '').trim();
          newClasses = `${newClasses} font-bold text-slate-800 font-sans tracking-tight capitalize`.replace(/\s+/g, ' ').trim();
          return `<${tag}${beforeClass}className="${newClasses}"`;
      });

      // 2. Sub-judul / H3/H4 is font-semibold
      content = content.replace(/<(h3|h4)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
          let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, '').trim();
          newClasses = newClasses.replace(/\buppercase\b/g, '').trim();
          newClasses = `${newClasses} font-semibold font-sans tracking-tight capitalize`.replace(/\s+/g, ' ').trim();
          return `<${tag}${beforeClass}className="${newClasses}"`;
      });

      // 3. Inputs / Textareas / Selects: font-medium
      content = content.replace(/<(input|textarea|select)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
          let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, '').trim();
          newClasses = `${newClasses} font-medium font-sans`.replace(/\s+/g, ' ').trim();
          return `<${tag}${beforeClass}className="${newClasses}"`;
      });

      // 4. Sidebar links / buttons are mainly handled in App.tsx directly, so no blanket override for all buttons.

      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

processDir('./src/components');
processDir('./src/modules');
processDir('./src');

console.log("Fonts updated via script.");
