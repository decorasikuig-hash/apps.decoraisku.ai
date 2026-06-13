const fs = require('fs');

const fileNames = [
  'src/components/MasterDataView.tsx',
  'src/components/FinanceView.tsx',
  'src/components/PurchaseView.tsx',
  'src/components/SalesView.tsx',
  'src/components/EsdmView.tsx',
  'src/components/StockView.tsx',
  'src/components/BankModuleView.tsx',
  'src/components/AttendanceView.tsx'
];

fileNames.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Ensure table td and th have whitespace-nowrap
    content = content.replace(/<td className="([^"]*)"/g, (match, classes) => {
      if (!classes.includes('whitespace-nowrap')) {
        return `<td className="${classes} whitespace-nowrap"`;
      }
      return match;
    });
    content = content.replace(/<th className="([^"]*)"/g, (match, classes) => {
      if (!classes.includes('whitespace-nowrap')) {
        return `<th className="${classes} whitespace-nowrap"`;
      }
      return match;
    });
    fs.writeFileSync(file, content);
  }
});
console.log('done whitespace replace');
