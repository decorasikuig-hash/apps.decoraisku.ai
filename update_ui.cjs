var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// update_ui.mjs
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
function processDir(dir) {
  if (!import_fs.default.existsSync(dir)) return;
  const files = import_fs.default.readdirSync(dir);
  for (const file of files) {
    const filePath = import_path.default.join(dir, file);
    if (import_fs.default.statSync(filePath).isDirectory()) {
      processDir(filePath);
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
      let content = import_fs.default.readFileSync(filePath, "utf8");
      content = content.replace(/<label\s+className="([^"]*)"/g, (match, p1) => {
        const hasFlex = p1.includes("flex");
        const flexClasses = hasFlex ? " flex items-center justify-between" : " block";
        return `<label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider${flexClasses}"`;
      });
      content = content.replace(
        /className="w-full bg-[^"]*border[^"]*rounded-[^"]*p-[^"]*(?:focus:[^"]*|hover:[^"]*)*"/g,
        `className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"`
      );
      content = content.replace(
        /className="[^"]*bg-\[#1e1b4b\][^"]*"/g,
        `className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"`
      );
      content = content.replace(/className="([^"]*bg-white[^"]*shadow[^"]*)"/g, (match, p1) => {
        if (p1.includes("rounded-full")) return match;
        let newClasses = p1.replace(/border(-[a-z]+-?[0-9]*\/?[0-9]*)?/g, "").trim();
        newClasses = newClasses.replace(/shadow(-[a-z]+)?/g, "").trim();
        newClasses = newClasses.replace(/rounded(-[a-z]+)?/g, "").trim();
        return `className="${newClasses} bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"`;
      });
      content = content.replace(
        /className="[^"]*text-slate-500 hover:bg-rose-50[^"]*"/g,
        `className="flex items-center justify-center gap-1.5 bg-[#f1f5f9] text-slate-600 rounded-xl py-3 px-5 font-semibold hover:bg-slate-200 transition-all duration-200 border-none cursor-pointer"`
      );
      content = content.replace(/>\s*Hapus\s*<\/button>/g, `><Trash2 className="w-4 h-4"/>&nbsp;Hapus</button>`);
      content = content.replace(/>\s*Hapus Alat\s*<\/button>/g, `><Trash2 className="w-4 h-4"/>&nbsp;Hapus Alat</button>`);
      content = content.replace(/>\s*Edit\s*<\/button>/g, `><Pencil className="w-4 h-4"/>&nbsp;Edit</button>`);
      content = content.replace(/className="([^"]*text-indigo-600 hover:bg-indigo-50[^"]*)"/g, (match, p1) => {
        if (p1.includes("w-") || p1.includes("px-")) {
          let cleaned = p1.replace(/px-[a-z0-9]+/g, "").replace(/py-[a-z0-9]+/g, "").replace(/rounded-[a-z0-9]+/g, "");
          return `className="${cleaned} w-8 h-8 rounded-full flex gap-1 items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"`;
        }
        return match;
      });
      content = content.replace(/className="([^"]*text-rose-600 hover:bg-rose-50[^"]*)"/g, (match, p1) => {
        if (p1.includes("w-") || p1.includes("px-")) {
          let cleaned = p1.replace(/px-[a-z0-9]+/g, "").replace(/py-[a-z0-9]+/g, "").replace(/rounded-[a-z0-9]+/g, "");
          return `className="${cleaned} w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"`;
        }
        return match;
      });
      content = content.replace(/Alat Kerja Kayu/g, "Equipment");
      import_fs.default.writeFileSync(filePath, content, "utf8");
    }
  }
}
function injectIcons(dir) {
  if (!import_fs.default.existsSync(dir)) return;
  const files = import_fs.default.readdirSync(dir);
  for (const file of files) {
    const filePath = import_path.default.join(dir, file);
    if (import_fs.default.statSync(filePath).isDirectory()) {
      injectIcons(filePath);
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
      let content = import_fs.default.readFileSync(filePath, "utf8");
      if (content.includes("<Trash2") && !content.includes("Trash2")) {
        content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, (m, p1) => {
          return `import {${p1}, Trash2} from 'lucide-react';`;
        });
        import_fs.default.writeFileSync(filePath, content, "utf8");
      }
      if (content.includes("<Pencil") && !content.includes("Pencil")) {
        let c2 = import_fs.default.readFileSync(filePath, "utf8");
        c2 = c2.replace(/import\s+\{([^}]+)\}\s+from\s+'lucide-react';/, (m, p1) => {
          return `import {${p1}, Pencil} from 'lucide-react';`;
        });
        import_fs.default.writeFileSync(filePath, c2, "utf8");
      }
    }
  }
}
processDir("./src/components");
processDir("./src/modules");
injectIcons("./src/components");
injectIcons("./src/modules");
console.log("UI updated.");
