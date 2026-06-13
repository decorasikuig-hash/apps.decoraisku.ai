const fs = require('fs');

function patchFile(file, isSelect) {
  let content = fs.readFileSync(file, 'utf8');

  // Add barcode scanner import if not present
  if (!content.includes('BarcodeScanner')) {
    content = content.replace(/import \{.*\} from '\.\.\/types';/, match => match + "\nimport { BarcodeScanner } from './BarcodeScanner';");
  }

  // Add ScanBarcode to lucide-react import
  if (!content.includes('ScanBarcode,')) {
    content = content.replace(/import \{\s*/, match => match + 'ScanBarcode, ');
  }

  // Add state for scanner target row
  if (!content.includes('const [scannerTargetRow, setScannerTargetRow] = useState<number | null>(null);')) {
    content = content.replace(/const \[isModalOpen, setIsModalOpen\] = useState\(false\);/g, match => 
      "const [scannerTargetRow, setScannerTargetRow] = useState<number | null>(null);\n  " + match
    );
    if (!content.includes('scannerTargetRow')) {
       // mostly for RmrView
       content = content.replace(/const \[activeTab, setActiveTab\] = useState/g, match =>
          "const [scannerTargetRow, setScannerTargetRow] = useState<number | null>(null);\n  " + match
       );
    }
  }

  // Add BarcodeScanner Modal somewhere at the end before closing div
  if (!content.includes('title="Pindai Barcode Item"')) {
    const modalCode = `
      <Modal isOpen={scannerTargetRow !== null} onClose={() => setScannerTargetRow(null)} title="Pindai Barcode Item" maxWidth="max-w-md">
        {scannerTargetRow !== null && (
          <BarcodeScanner 
            onScanSuccess={(item) => {
              // will be handled differently depending on the view
            }}
          />
        )}
      </Modal>
    `;
    // We'll insert it manually using specific replaces per file...
  }
}
