const fs = require('fs');

const fileNames = [
  'src/components/MasterDataView.tsx',
  'src/components/FinanceView.tsx',
  'src/components/PurchaseView.tsx',
  'src/components/SalesView.tsx',
  'src/components/EsdmView.tsx',
  'src/components/StockView.tsx',
  'src/components/BankModuleView.tsx'
];

fileNames.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace "grid grid-cols-2" with "grid grid-cols-1 md:grid-cols-2"
    // Also "grid-cols-3" -> "grid-cols-1 md:grid-cols-3"
    content = content.replace(/className="([^"]*)grid grid-cols-2([^"]*)"/g, 'className="$1grid grid-cols-1 md:grid-cols-2$2"');
    content = content.replace(/className="([^"]*)grid grid-cols-3([^"]*)"/g, 'className="$1grid grid-cols-1 md:grid-cols-3$2"');
    content = content.replace(/className="([^"]*)grid grid-cols-4([^"]*)"/g, 'className="$1grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4$2"');
    fs.writeFileSync(file, content);
  }
});
console.log('done grid replace');
