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

// update_fonts.mjs
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
      content = content.replace(/<(h1|h2)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
        let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, "").trim();
        newClasses = newClasses.replace(/text-slate-[0-9]+/g, "").trim();
        newClasses = newClasses.replace(/\buppercase\b/g, "").trim();
        newClasses = newClasses.replace(/\bcapitalize\b/g, "").trim();
        newClasses = `${newClasses} font-bold text-slate-800 font-sans tracking-tight capitalize`.replace(/\s+/g, " ").trim();
        return `<${tag}${beforeClass}className="${newClasses}"`;
      });
      content = content.replace(/<(h3|h4)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
        let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, "").trim();
        newClasses = newClasses.replace(/\buppercase\b/g, "").trim();
        newClasses = `${newClasses} font-semibold font-sans tracking-tight capitalize`.replace(/\s+/g, " ").trim();
        return `<${tag}${beforeClass}className="${newClasses}"`;
      });
      content = content.replace(/<(input|textarea|select)([^>]*)className="([^"]*)"/g, (match, tag, beforeClass, classes) => {
        let newClasses = classes.replace(/font-[a-z]+((-[0-9]+)?)/g, "").trim();
        newClasses = `${newClasses} font-medium font-sans`.replace(/\s+/g, " ").trim();
        return `<${tag}${beforeClass}className="${newClasses}"`;
      });
      import_fs.default.writeFileSync(filePath, content, "utf8");
    }
  }
}
processDir("./src/components");
processDir("./src/modules");
processDir("./src");
console.log("Fonts updated via script.");
