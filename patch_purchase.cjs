const fs = require('fs');

let file = 'src/components/PurchaseView.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { BarcodeScanner }')) {
  content = content.replace(/import { DBState, PurchaseOrder, PurchaseInvoice, GoodsReceipt, Transaction, BankMutation } from '\.\.\/types';/, match => match + "\nimport { BarcodeScanner } from './BarcodeScanner';");
}
if (!content.includes('ScanBarcode,')) {
  content = content.replace(/import \{\s*/, "import {\n  ScanBarcode, ");
}

if (!content.includes('const [scannerRowIdx, setScannerRowIdx] = useState<number | null>(null);')) {
  content = content.replace(/const \[isModalOpen, setIsModalOpen\] = useState\(false\);/, "const [isModalOpen, setIsModalOpen] = useState(false);\n  const [scannerRowIdx, setScannerRowIdx] = useState<number | null>(null);");
}

// Replace the <select ... > <option>... for stock selection with flex + button
let selRegex = /(<select[^>]*?value=\{item\.itemId \|\| ''\}[^>]*?onChange=\{\(e\) => \{\s*updatePoRow\(index, 'itemId', e\.target\.value\);\s*\}\}[^>]*?>\s*<option value="">-- Pilih Material dari Inventory --<\/option>\s*\{dbState\.inventory\?\.map\(inv => \(\s*<option key=\{inv\.id\} value=\{inv\.id\}>\{inv\.name\} \(\{inv\.code\}\) - \{formatIDR\(inv\.price\)\}<\/option>\s*\)\)\s*<\/select>)/;

if (selRegex.test(content)) {
  content = content.replace(selRegex, 
    `<div className="flex items-center gap-2">
                                  $1
                                  <button type="button" onClick={() => setScannerRowIdx(index)} className="shrink-0 p-2 md:p-1.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer" title="Scan Barcode">
                                    <ScanBarcode className="w-6 h-6 md:w-5 md:h-5 text-indigo-500" />
                                  </button>
                                </div>`
  );
}

// Add modal at the end, right before <Modal isOpen={isSupplierModalOpen}
if (!content.includes('title="Pindai Barcode Item"')) {
  content = content.replace(/(<Modal isOpen=\{isSupplierModalOpen\}[^>]*?>)/, 
    `<Modal isOpen={scannerRowIdx !== null} onClose={() => setScannerRowIdx(null)} title="Pindai Barcode Item" maxWidth="max-w-md">
        {scannerRowIdx !== null && (
          <BarcodeScanner 
            onScanSuccess={(invItem) => {
              updatePoRow(scannerRowIdx, 'itemId', invItem.id);
              setScannerRowIdx(null);
            }}
          />
        )}
      </Modal>\n\n      $1`
  );
}

fs.writeFileSync(file, content);
console.log('PurchaseView pathed');
