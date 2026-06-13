/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Layers, 
  Home, 
  FileText, 
  ShoppingCart, 
  ArrowLeftRight, 
  Barcode, 
  Check, 
  X,
  Save,
  HelpCircle,
  Package,
  Grid,
  List,
  Eye,
  AlertTriangle,
  Image as ImageIcon,
  MoreHorizontal,
  Download,
  Upload,
  Printer,
  Camera,
  Sliders,
  Lock,
  FileSpreadsheet
} from 'lucide-react';
import { DBState, InventoryItem, MaterialRequest } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { Modal } from './Modal';
import { CategoryCrudTab } from './CategoryCrudTab';
import { WarehouseCrudTab } from './WarehouseCrudTab';
import { compressImageFile } from '../utils/imageCompressor';

interface StockViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  activeTab: 'goods' | 'card' | 'request' | 'report';
  triggerPoCreation?: () => void;
}

export const StockView: React.FC<StockViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole,
  activeTab,
  triggerPoCreation
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Under "Nama Barang" we have sub-tabs
  const [subTab, setSubTab] = useState<'goods' | 'category' | 'warehouse'>('goods');

  // Display style: default is grid (cards with photos) or high density table
  const [displayStyle, setDisplayStyle] = useState<'grid' | 'table'>('grid');
  const [cardCategoryFilter, setCardCategoryFilter] = useState('');
  const [cardModeFilter, setCardModeFilter] = useState<'all' | 'stock' | 'manual'>('all');

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleOutsideClick = () => setActiveDropdownId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Barcode 2D printing states
  const [printingBarcodeItem, setPrintingBarcodeItem] = useState<InventoryItem | null>(null);
  const [printingBarcodeList, setPrintingBarcodeList] = useState<InventoryItem[] | null>(null);
  const [isPrintBarcodeModalOpen, setIsPrintBarcodeModalOpen] = useState(false);
  const [isPrintReportModalOpen, setIsPrintReportModalOpen] = useState(false);
  const [isPrintLedgerModalOpen, setIsPrintLedgerModalOpen] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedForBarcodePrint, setSelectedForBarcodePrint] = useState<Record<string, boolean>>({});

  // New states for Report Selection & Printing Modals
  const [isReportSelectorModalOpen, setIsReportSelectorModalOpen] = useState(false);
  const [isPrintAdjustmentReportModalOpen, setIsPrintAdjustmentReportModalOpen] = useState(false);
  const [isPrintClosePeriodReportModalOpen, setIsPrintClosePeriodReportModalOpen] = useState(false);

  // New: Stock Adjustment Modal & Form States
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjItemId, setAdjItemId] = useState('');
  const [adjType, setAdjType] = useState<'Inflow' | 'Outflow' | 'Correction'>('Inflow');
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjPhysicalQty, setAdjPhysicalQty] = useState<number>(0);
  const [adjNote, setAdjNote] = useState('');
  const [adjDate, setAdjDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // New: Tutup Buku (Close Period) Modal & Form States
  const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false);
  const [closePeriodName, setClosePeriodName] = useState(() => {
    const d = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [closePeriodDate, setClosePeriodDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closePeriodNotes, setClosePeriodNotes] = useState('');

  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    if (dbState.settings?.reportStartDate) return dbState.settings.reportStartDate;
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => {
    if (dbState.settings?.reportEndDate) return dbState.settings.reportEndDate;
    return new Date().toISOString().split('T')[0];
  });
  const [signerName, setSignerName] = useState(dbState.settings?.reportSignerName || '');
  const [signerTitle, setSignerTitle] = useState(dbState.settings?.reportSignerTitle || '');

  const updateReportDates = (start: string, end: string) => {
    saveCollection('settings', { ...dbState.settings, reportStartDate: start, reportEndDate: end, reportSignerName: signerName, reportSignerTitle: signerTitle });
    setReportStartDate(start);
    setReportEndDate(end);
  };
  
  const updateSigner = (name: string, title: string) => {
    saveCollection('settings', { ...dbState.settings, reportStartDate, reportEndDate, reportSignerName: name, reportSignerTitle: title });
    setSignerName(name);
    setSignerTitle(title);
  };

  const getPeriodStats = (item: InventoryItem) => {
    const approvedLedgers = dbState.stockLedgers || [];
    const itemLedgers = approvedLedgers.filter(l => l.itemId === item.id || l.itemId === item.code);
    
    const startStr = reportStartDate || '1970-01-01';
    const endStr = reportEndDate || '2099-12-31';

    // Reconstruct start of period stock
    const ledgersOnOrAfterStart = itemLedgers.filter(l => l.date >= startStr);
    const inflowsOnOrAfterStart = ledgersOnOrAfterStart.filter(l => l.type === 'Inflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
    const outflowsOnOrAfterStart = ledgersOnOrAfterStart.filter(l => l.type === 'Outflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
    const initial = item.stock - inflowsOnOrAfterStart + outflowsOnOrAfterStart;

    // Filter within selected period
    const ledgersInPeriod = itemLedgers.filter(l => l.date >= startStr && l.date <= endStr);
    const inflowInPeriod = ledgersInPeriod.filter(l => l.type === 'Inflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
    const outflowInPeriod = ledgersInPeriod.filter(l => l.type === 'Outflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);

    const ending = initial + inflowInPeriod - outflowInPeriod;
    const totalNilaiPeriod = (item.price || 0) * ending;

    return {
      initial,
      inflow: inflowInPeriod,
      outflow: outflowInPeriod,
      ending,
      totalNilai: totalNilaiPeriod
    };
  };

  const downloadReportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const companyName = dbState.settings?.companyName || 'Dutasari ERP';
      const companyAddress = dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209';

      // Header Kop Surat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 75); // deep indigo
      doc.text(companyName.toUpperCase(), 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      
      const addrLines = doc.splitTextToSize(companyAddress, 110);
      doc.text(addrLines, 14, 20);

      const rightOffset = 196; // margin kanan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 27, 75);
      doc.text('LAPORAN BULANAN', rightOffset, 15, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const printDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(printDateStr, rightOffset, 20, { align: 'right' });

      // Garis pemisah kop surat
      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.5);
      doc.line(14, 28, rightOffset, 28);

      // Judul Laporan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('LAPORAN REKAPITULASI & ESTIMASI NILAI STOK GUDANG UTAMA', 105, 36, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 140);
      doc.text(`DICETAK OLEH SISTEM | Periode: ${reportStartDate ? new Date(reportStartDate).toLocaleDateString('id-ID') : 'Awal'} s.d. ${reportEndDate ? new Date(reportEndDate).toLocaleDateString('id-ID') : 'Kini'}`, 105, 40, { align: 'center' });

      // Kotak Info Laporan
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 44, 182, 18, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('Klasifikasi:', 18, 49);
      doc.text('Filter Kategori:', 18, 54);
      doc.text('Periode Laporan:', 18, 59);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text('Inventaris Stok Utama', 42, 49);
      doc.text(cardCategoryFilter || 'Semua Kategori', 42, 54);
      doc.text(`${reportStartDate || 'Awal'} s.d. ${reportEndDate || 'Kini'}`, 42, 59);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Varian Barang:', 110, 49);
      doc.text('Estimasi Nilai Aset:', 110, 54);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${filteredItems.length} Item`, 145, 49);
      
      const totalAsetVal = filteredItems.reduce((sum, item) => sum + getPeriodStats(item).totalNilai, 0);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 27, 75);
      doc.text(`Rp ${totalAsetVal.toLocaleString('id-ID')}`, 145, 54);

      // Data Tabular
      const tableHeaders = [[
        'Barcode',
        'Nama Barang',
        'Kategori',
        'Awal',
        'Masuk',
        'Keluar',
        'Sisa Stok',
        'Harga Satuan',
        'Total Nilai'
      ]];

      const tableRows = filteredItems.map((item: InventoryItem) => {
        const stats = getPeriodStats(item);

        return [
          item.code || '-',
          item.name,
          item.category,
          `${stats.initial} ${item.unit || 'Unit'}`,
          `+${stats.inflow}`,
          `-${stats.outflow}`,
          `${stats.ending} ${item.unit || 'Unit'}`,
          `Rp ${item.price?.toLocaleString('id-ID') || 0}`,
          `Rp ${stats.totalNilai.toLocaleString('id-ID')}`
        ];
      });

      // Baris Total
      tableRows.push([
        { content: 'TOTAL ESTIMASI NILAI INVENTARIS (ASET):', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rp ${totalAsetVal.toLocaleString('id-ID')}`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }
      ]);

      // Cetak Tabel dengan autoTable
      autoTable(doc, {
        startY: 67,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica' },
        headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 47 },
          2: { cellWidth: 20 },
          3: { halign: 'right' },
          4: { halign: 'right', textColor: [16, 124, 65] }, // Ijo
          5: { halign: 'right', textColor: [186, 12, 47] }, // Merah
          6: { halign: 'right', fontStyle: 'bold', textColor: [30, 27, 75] },
          7: { halign: 'right' },
          8: { halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: (data: any) => {
          const str = "Halaman " + doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(str, rightOffset, 287, { align: 'right' });
        }
      });

      // Tanda Tangan
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      let signatureY = finalY + 15;

      if (signatureY > 255) {
        doc.addPage();
        signatureY = 30;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);

      doc.text('Dipersiapkan Oleh,', 35, signatureY, { align: 'center' });
      doc.text('Disetujui Oleh,', 160, signatureY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(signerName || 'Staff Logistik & Gudang', 35, signatureY + 20, { align: 'center' });
      doc.text('Direktur / Kepala Cabang', 160, signatureY + 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(signerTitle || 'Departemen Operasional', 35, signatureY + 24, { align: 'center' });
      doc.text(companyName, 160, signatureY + 24, { align: 'center' });

      // Save PDF
      doc.save(`Laporan_Stok_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Laporan PDF berhasil diunduh!', 'success');

    } catch (e: any) {
      console.error(e);
      showToast('Gagal mengunduh PDF: ' + e.message, 'error');
    }
  };

  const downloadLedgerPDF = (filteredLedgers: any[]) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const companyName = dbState.settings?.companyName || 'Dutasari ERP';
      const companyAddress = dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209';

      // Header Kop Surat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 75); // deep indigo
      doc.text(companyName.toUpperCase(), 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      
      const addrLines = doc.splitTextToSize(companyAddress, 110);
      doc.text(addrLines, 14, 20);

      const rightOffset = 196; // margin kanan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 27, 75);
      doc.text('LAPORAN JURNAL LEDGER', rightOffset, 15, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const printDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(printDateStr, rightOffset, 20, { align: 'right' });

      // Garis pemisah kop surat
      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.5);
      doc.line(14, 28, rightOffset, 28);

      // Judul Laporan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('LAPORAN JURNAL AUDIT LEDGER KARTU STOK MATERIAL', 105, 36, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 140);
      doc.text(`DICETAK OLEH SISTEM | Periode: ${ledgerStartDate ? new Date(ledgerStartDate).toLocaleDateString('id-ID') : 'Awal'} s.d. ${ledgerEndDate ? new Date(ledgerEndDate).toLocaleDateString('id-ID') : 'Kini'}`, 105, 40, { align: 'center' });

      // Kotak Info Laporan
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 44, 182, 18, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('Klasifikasi:', 18, 49);
      doc.text('Kategori Filter:', 18, 54);
      doc.text('Periode Laporan:', 18, 59);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text('Audit Trail Aliran Stok (Ledger)', 42, 49);
      doc.text(cardCategoryFilter || 'Semua Kategori (Katalog & Manual)', 42, 54);
      doc.text(`${ledgerStartDate || 'Awal'} s.d. ${ledgerEndDate || 'Kini'}`, 42, 59);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Log Transaksi:', 110, 49);
      doc.text('Gudang Asal:', 110, 54);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${filteredLedgers.length} Aliran`, 145, 49);
      doc.text('Gudang Utama Dutasari', 145, 54);

      // Data Tabular
      const tableHeaders = [[
        'Tanggal Audit',
        'Nama Material / Barang',
        'Sifat / Mode',
        'Jenis Aliran',
        'Sisa Stok Ledger'
      ]];

      const tableRows = filteredLedgers.map((ledger) => {
        const isManualEntry = ledger.itemMode === 'manual' || 
                              ledger.itemId?.startsWith('manual-') || 
                              ledger.itemCategory === 'Item Manual (STB)' ||
                              ledger.itemCategory === 'Item Manual (RMR)';
        return [
          `${ledger.date}\n(${ledger.source})`,
          ledger.itemName,
          isManualEntry ? 'Manual' : 'Stok (Katalog)',
          ledger.type === 'Inflow' ? `+${ledger.qty}` : `-${ledger.qty}`,
          isManualEntry ? '-' : `${ledger.remainingStock} ${ledger.unit || 'Unit'}`
        ];
      });

      // Cetak Tabel dengan autoTable
      autoTable(doc, {
        startY: 67,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 65 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25, halign: 'right' }
        },
        didDrawPage: (data: any) => {
          const str = "Halaman " + doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(str, rightOffset, 287, { align: 'right' });
        }
      });

      // Add signature at the end
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      let signatureY = finalY + 15;

      if (signatureY > 255) {
        doc.addPage();
        signatureY = 30;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);

      doc.text('Dipersiapkan Oleh,', 35, signatureY, { align: 'center' });
      doc.text('Disetujui Oleh,', 160, signatureY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(signerName || 'Staff Logistik & Gudang', 35, signatureY + 20, { align: 'center' });
      doc.text('Direktur / Kepala Cabang', 160, signatureY + 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(signerTitle || 'Departemen Operasional', 35, signatureY + 24, { align: 'center' });
      doc.text(companyName, 160, signatureY + 24, { align: 'center' });

      doc.save(`Laporan_Ledger_Stok_${ledgerStartDate || 'all'}_to_${ledgerEndDate || 'all'}.pdf`);
      showToast('Laporan Ledger berhasil diunduh sebagai PDF!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Gagal mengunduh PDF: ' + e.message, 'error');
    }
  };

  // Modals controllers
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);

  // Image upload and compressor state
  const [compressing, setCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const processAndSetPhoto = async (file: File) => {
    setCompressing(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setFormData(prev => ({ ...prev, photoUrl: compressedDataUrl }));
      showToast('Gambar berhasil dikompres dan diunggah!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses gambar.', 'error');
    } finally {
      setCompressing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndSetPhoto(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAndSetPhoto(file);
    }
  };

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  // Master lists
  const itemsList = dbState.inventory || [];
  const requestList = dbState.materialRequests || [];
  const categoriesList = dbState.categories || [];
  const warehousesList = dbState.warehouses || [];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = subTab === 'goods' ? 6 : 8;

  // Fallback photography presets
  const getFallbackPhoto = (categoryName: string) => {
    const norm = (categoryName || '').toLowerCase();
    if (norm.includes('wood') || norm.includes('kayu')) {
      return 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop&q=60';
    }
    if (norm.includes('wall') || norm.includes('hpl') || norm.includes('paper')) {
      return 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&auto=format&fit=crop&q=60';
    }
    if (norm.includes('sofa') || norm.includes('fabric') || norm.includes('kain')) {
      return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop&q=60';
    }
    if (norm.includes('lamp') || norm.includes('light') || norm.includes('fitting')) {
      return 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60';
    }
    return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60'; // Paku & Logam / Hardware
  };

  // Preset material image links
  const PHOTO_PRESETS = [
    { label: 'Solid Wood Oak/Teak', url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop&q=60' },
    { label: 'Taco HPL Wallpaper', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&auto=format&fit=crop&q=60' },
    { label: 'Velvet Sofa Upholstery', url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&auto=format&fit=crop&q=60' },
    { label: 'LED Lighting Fitting', url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60' },
    { label: 'Hardware Hardware Besi', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60' }
  ];

  // Helper dynamic ID Creator / Barcode Maker
  const generateBarcodeRandom = () => `BAR-${Math.floor(100000 + Math.random() * 900000)}`;

  // Rupiah display helper
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Handler for Saving Stock Adjustment (Penyesuaian)
  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjItemId) {
      showToast('Pilih material barang terlebih dahulu!', 'error');
      return;
    }

    const selectedItem = itemsList.find(item => item.id === adjItemId);
    if (!selectedItem) {
      showToast('Material barang tidak ditemukan!', 'error');
      return;
    }

    let finalStock = selectedItem.stock;
    let actualType: 'Inflow' | 'Outflow' = 'Inflow';
    let qtyDiff = 0;

    if (adjType === 'Inflow') {
      qtyDiff = Number(adjQty) || 0;
      if (qtyDiff <= 0) {
        showToast('Kuantitas penyesuaian harus lebih dari 0!', 'error');
        return;
      }
      finalStock = selectedItem.stock + qtyDiff;
      actualType = 'Inflow';
    } else if (adjType === 'Outflow') {
      qtyDiff = Number(adjQty) || 0;
      if (qtyDiff <= 0) {
        showToast('Kuantitas penyesuaian harus lebih dari 0!', 'error');
        return;
      }
      if (selectedItem.stock < qtyDiff) {
        showToast(`Stok tidak mencukupi! Sisa stok saat ini adalah ${selectedItem.stock} ${selectedItem.unit}`, 'error');
        return;
      }
      finalStock = selectedItem.stock - qtyDiff;
      actualType = 'Outflow';
    } else if (adjType === 'Correction') {
      const targetPhysical = Number(adjPhysicalQty) || 0;
      if (targetPhysical < 0) {
        showToast('Stok fisik tidak boleh kurang dari 0!', 'error');
        return;
      }
      qtyDiff = Math.abs(targetPhysical - selectedItem.stock);
      finalStock = targetPhysical;
      actualType = targetPhysical >= selectedItem.stock ? 'Inflow' : 'Outflow';
    }

    // Update item stock in inventory list
    const updatedInventory = itemsList.map(item => {
      if (item.id === selectedItem.id) {
        return { ...item, stock: finalStock };
      }
      return item;
    });

    // Create a new Stock Ledger Entry
    const ledgerEntry = {
      id: `ldg-adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemCategory: selectedItem.category,
      type: actualType,
      source: `Penyesuaian: ${adjNote || 'Penyesuaian Manual'}`,
      date: adjDate || new Date().toISOString().split('T')[0],
      qty: qtyDiff,
      unit: selectedItem.unit,
      remainingStock: finalStock,
      itemMode: 'stock' as const
    };

    saveCollection('inventory', updatedInventory);
    saveCollection('stockLedgers', [...(dbState.stockLedgers || []), ledgerEntry]);

    showToast(`Sukses merekam penyesuaian untuk: ${selectedItem.name}`, 'success');
    
    // Notify WhatsApp update
    sendWhatsAppNotification({
      phone: '0812345678',
      recipientName: 'Gudang Logistik',
      message: `*PENYESUAIAN STOK*: [${selectedItem.code || '-'}] ${selectedItem.name} disesuaikan menjadi ${finalStock} ${selectedItem.unit}. Catatan: ${adjNote || '-'}`
    });

    // Reset components & close modal
    setIsAdjustmentModalOpen(false);
    setAdjItemId('');
    setAdjQty(0);
    setAdjPhysicalQty(0);
    setAdjNote('');
  };

  // Handler for saving period close (Tutup Buku)
  const handleSaveClosePeriod = (e: React.FormEvent) => {
    e.preventDefault();

    if (!closePeriodName.trim()) {
      showToast('Mohon tentukan Nama Periode!', 'error');
      return;
    }

    const newClosedPeriod = {
      id: `cp-${Date.now()}`,
      periodName: closePeriodName.trim(),
      closingDate: closePeriodDate,
      closedBy: currentUserRole || 'Staff',
      notes: closePeriodNotes,
      totalItems: itemsList.length
    };

    const updatedClosedPeriods = [...(dbState.closedPeriods || []), newClosedPeriod];
    saveCollection('closedPeriods', updatedClosedPeriods);

    showToast(`Buku periode ${closePeriodName} berhasil ditutup!`, 'success');

    // Notify Whatsapp
    sendWhatsAppNotification({
      phone: '0812345678',
      recipientName: 'Manajemen Logistik',
      message: `*TUTUP BUKU BERHASIL*: Periode ${closePeriodName.trim()} resmi ditutup pada ${closePeriodDate}. Total ${itemsList.length} jenis material barang terkonsolidasi.`
    });

    setIsClosePeriodModalOpen(false);
    setClosePeriodNotes('');
  };

  // Helper functions to get filtered data for reports
  const getFilteredAdjustments = () => {
    const ledgers = dbState.stockLedgers || [];
    return ledgers
      .filter(l => l.source && l.source.startsWith('Penyesuaian:'))
      .filter(l => {
        if (!reportStartDate || !reportEndDate) return true;
        return l.date >= reportStartDate && l.date <= reportEndDate;
      });
  };

  const getFilteredClosedPeriods = () => {
    const periods = dbState.closedPeriods || [];
    return periods.filter(p => {
      if (!reportStartDate || !reportEndDate) return true;
      return p.closingDate >= reportStartDate && p.closingDate <= reportEndDate;
    });
  };

  // PDF Generator for Laporan Penyesuaian
  const downloadAdjustmentReportPDF = () => {
    const adjData = getFilteredAdjustments();
    if (adjData.length === 0) {
      showToast('Tidak ada data penyesuaian stok dalam periode yang dipilih!', 'error');
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const companyName = dbState.settings?.companyName || 'Dutasari ERP';
      const companyAddress = dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209';

      // Header Kop Surat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 75);
      doc.text(companyName.toUpperCase(), 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const addrLines = doc.splitTextToSize(companyAddress, 110);
      doc.text(addrLines, 14, 20);

      const rightOffset = 196;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 27, 75);
      doc.text('LAPORAN PENYESUAIAN STOK', rightOffset, 15, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const printDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(printDateStr, rightOffset, 20, { align: 'right' });

      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.5);
      doc.line(14, 28, rightOffset, 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('BUKTI REKAPITULASI STOCK OPNAME / PENYESUAIAN STOK', 105, 36, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 140);
      doc.text(`Periode Audit: ${reportStartDate || 'Semua'} s.d. ${reportEndDate || 'Kini'}`, 105, 40, { align: 'center' });

      const tableHeaders = [[
        'Tanggal',
        'Nama Barang',
        'Kategori',
        'Aliran/Sifat',
        'Kuantitas',
        'Keterangan / Alasan'
      ]];

      const tableRows = adjData.map((lg: any) => {
        const isWordInflow = lg.type === 'Inflow';
        return [
          lg.date || '-',
          lg.itemName || '-',
          lg.itemCategory || '-',
          isWordInflow ? '➕ Inflow' : '➖ Outflow',
          `${lg.qty || 0} ${lg.unit || 'Unit'}`,
          (lg.source || '').replace('Penyesuaian: ', '')
        ];
      });

      autoTable(doc, {
        startY: 46,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
        didDrawPage: (data: any) => {
          const str = "Halaman " + doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(str, rightOffset, 287, { align: 'right' });
        }
      });

      // Signature Block
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      let signatureY = finalY + 15;
      if (signatureY > 255) {
        doc.addPage();
        signatureY = 30;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text('Audit Gudang Oleh,', 35, signatureY, { align: 'center' });
      doc.text('Disetujui Manajer,', 160, signatureY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(signerName || 'Staff Logistik', 35, signatureY + 20, { align: 'center' });
      doc.text('Manajer Gudang', 160, signatureY + 20, { align: 'center' });

      doc.save(`Laporan_Penyesuaian_Stok_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Laporan Penyesuaian berhasil diunduh!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Gagal unduh PDF: ' + e.message, 'error');
    }
  };

  // PDF Generator for Laporan Tutup Buku
  const downloadClosePeriodReportPDF = () => {
    const periods = getFilteredClosedPeriods();
    if (periods.length === 0) {
      showToast('Tidak ada data tutup buku periode dlm filter yang dipilih!', 'error');
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const companyName = dbState.settings?.companyName || 'Dutasari ERP';
      const companyAddress = dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209';

      // Header Kop Surat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 75);
      doc.text(companyName.toUpperCase(), 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const addrLines = doc.splitTextToSize(companyAddress, 110);
      doc.text(addrLines, 14, 20);

      const rightOffset = 196;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 27, 75);
      doc.text('LAPORAN TUTUP BUKU LOGISTIK', rightOffset, 15, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      const printDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(printDateStr, rightOffset, 20, { align: 'right' });

      doc.setDrawColor(30, 27, 75);
      doc.setLineWidth(0.5);
      doc.line(14, 28, rightOffset, 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('HISTORI DAN REKAPITULASI PENUTUPAN BUKU PERIODE', 105, 36, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 140);
      doc.text(`Tercatat pada Database Logistik Dutasari ERP`, 105, 40, { align: 'center' });

      const tableHeaders = [[
        'ID Tutup Buku',
        'Nama Periode',
        'Tanggal Penyegelan',
        'Penyegel (Oleh)',
        'Varian Terkonsolidasi',
        'Catatan'
      ]];

      const tableRows = periods.map((cp: any) => {
        return [
          cp.id || '-',
          cp.periodName || '-',
          cp.closingDate || '-',
          cp.closedBy || 'super_admin',
          `${cp.totalItems || 0} Barang`,
          cp.notes || '-'
        ];
      });

      autoTable(doc, {
        startY: 46,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        didDrawPage: (data: any) => {
          const str = "Halaman " + doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(str, rightOffset, 287, { align: 'right' });
        }
      });

      // Signature Block
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      let signatureY = finalY + 15;
      if (signatureY > 255) {
        doc.addPage();
        signatureY = 30;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text('Divalidasi Oleh,', 35, signatureY, { align: 'center' });
      doc.text('Disetujui Manajer,', 160, signatureY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(signerName || 'Staff Logistik', 35, signatureY + 20, { align: 'center' });
      doc.text('Direktur Keuangan', 160, signatureY + 20, { align: 'center' });

      doc.save(`Laporan_Tutup_Buku_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Laporan Tutup Buku berhasil diunduh!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('Gagal unduh PDF: ' + e.message, 'error');
    }
  };

  // Save Inventory Material
  const handleSaveGoods = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.location) {
      showToast('Mohon lengkapi Detail Material Barang!', 'error');
      return;
    }

    const priceNum = Number(formData.price) || 0;
    const stockNum = Number(formData.stock) || 0;

    // "id bsa d gunakan untuk barcode jika tidak di isi ter creat otomatis"
    const customIdOrCode = formData.customCode?.trim();
    const resolvedCode = customIdOrCode || formData.code || generateBarcodeRandom();
    const resolvedId = isEditingId || customIdOrCode || `inv-${Date.now()}`;

    const newItem: InventoryItem = {
      id: resolvedId,
      code: resolvedCode,
      name: formData.name.trim(),
      category: formData.category,
      stock: stockNum,
      unit: formData.unit || 'Pcs',
      price: priceNum,
      location: formData.location,
      description: formData.description || '',
      lastUpdated: new Date().toISOString().split('T')[0],
      initialStock: Number(formData.initialStock) || stockNum, // inisial stok = stok awal
      hasMinStock: !!formData.hasMinStock,
      minStockLimit: formData.hasMinStock ? (Number(formData.minStockLimit) || 0) : undefined,
      photoUrl: formData.photoUrl || ''
    };

    const isExisting = itemsList.find(i => i.id === isEditingId);
    let ledgerEntry = null;

    if (!isExisting && stockNum > 0) {
      ledgerEntry = {
        id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        itemId: newItem.id,
        itemName: newItem.name,
        itemCategory: newItem.category,
        type: 'Inflow',
        source: 'Pendaftaran Barang Baru',
        date: new Date().toISOString().split('T')[0],
        qty: stockNum,
        unit: newItem.unit,
        remainingStock: stockNum
      };
    } else if (isExisting && isExisting.stock !== stockNum) {
      const diff = stockNum - isExisting.stock;
      ledgerEntry = {
        id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        itemId: newItem.id,
        itemName: newItem.name,
        itemCategory: newItem.category,
        type: diff > 0 ? 'Inflow' : 'Outflow',
        source: 'Update Stok Manual',
        date: new Date().toISOString().split('T')[0],
        qty: Math.abs(diff),
        unit: newItem.unit,
        remainingStock: stockNum
      };
    }

    const updated = isEditingId 
      ? itemsList.map(item => item.id === isEditingId ? newItem : item)
      : [...itemsList, newItem];

    saveCollection('inventory', updated);
    
    if (ledgerEntry) {
      saveCollection('stockLedgers', [...(dbState.stockLedgers || []), ledgerEntry]);
    }
    showToast(`Sukses merekam katalog material: ${newItem.name}`, 'success');
    setModalOpen(false);

    // Notify Whatsapp Gateway (Fonnte)
    sendWhatsAppNotification({
      phone: '0812345678',
      recipientName: 'Gudang Logistik',
      message: `*CATATAN BARANG BARU/EDIT*: [${newItem.code}] ${newItem.name} terekam di ${newItem.location} dengan stok awal: ${newItem.stock} ${newItem.unit}.`
    });
  };

  const handleDownloadTemplate = () => {
    const header = "Kode Barcode (Opsional),Nama Barang,Kategori,Stok Awal,Satuan,Harga Estimasi,Loker Gudang,Deskripsi\n";
    const sample1 = "BAR-501235,Taco HPL Woodgrain Oak,Premium Wood,45,Pcs,185000,Gudang Utama Kayu Kemang,HPL tebal serat kayu halus 0.8mm\n";
    const sample2 = ",Paku Sekrup Kayu 3cm,Paku & Logam,150,Dus,25000,Gudang Aksesoris Margonda,Paku ulir kualitas tinggi antikarat\n";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + sample1 + sample2);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", "template_import_barang.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    showToast('Template Unduh Sukses!', 'success');
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split('\n');
        if (lines.length <= 1) {
          showToast('File CSV kosong atau tidak valid.', 'error');
          return;
        }

        const cleanString = (str: string) => (str || '').trim().replace(/^["']|["']$/g, '');

        const newlyImported: InventoryItem[] = [];
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Split by comma taking into account values surrounded by quotes
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          
          if (cols.length < 2 || !cleanString(cols[1])) {
            skippedCount++;
            continue;
          }

          const customBarcode = cleanString(cols[0]);
          const name = cleanString(cols[1]);
          const category = cleanString(cols[2]) || getActiveCategories()[0];
          const stock = Number(cleanString(cols[3])) || 0;
          const unit = cleanString(cols[4]) || 'Pcs';
          const price = Number(cleanString(cols[5])) || 0;
          const location = cleanString(cols[6]) || getActiveWarehouses()[0];
          const description = cleanString(cols[7]) || '';

          const generatedId = customBarcode ? `inv-${customBarcode}` : `inv-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
          const generatedCode = customBarcode || `BAR-${Math.floor(100000 + Math.random() * 900000)}`;

          // check dup
          const itemExists = itemsList.some(itm => itm.code === generatedCode || itm.id === generatedId);
          if (itemExists) {
            skippedCount++;
            continue;
          }

          newlyImported.push({
            id: generatedId,
            code: generatedCode,
            name,
            category,
            stock,
            unit,
            price,
            location,
            description,
            lastUpdated: new Date().toISOString().split('T')[0],
            initialStock: stock,
            hasMinStock: false,
            minStockLimit: 5,
            photoUrl: ''
          });
        }

        if (newlyImported.length === 0) {
          showToast(`Gagal mengimpor barang masal. ${skippedCount} baris bermasalah atau duplikat.`, 'error');
          return;
        }

        const mergedList = [...itemsList, ...newlyImported];
        saveCollection('inventory', mergedList);
        showToast(`Sukses mendaftarkan ${newlyImported.length} barang baru masal! ${skippedCount ? `${skippedCount} baris dilewati.` : ''}`, 'success');
        
        e.target.value = ''; // reset
      } catch (err) {
        showToast('Terjadi kesalahan memproses berkas CSV.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const generate2DBarcodeSVG = (code: string) => {
    const size = 12;
    const grid: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
    
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }

    const getHashBit = (r: number, c: number) => {
      const val = Math.abs(hash ^ (r * 137 + c * 401));
      return (val % 3) === 0 || (val % 5) === 0;
    };

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        grid[r][c] = getHashBit(r, c);
      }
    }

    // Positions trackers in corners
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const isBorder = r === 0 || r === 3 || c === 0 || c === 3;
        const isInner = (r === 1 || r === 2) && (c === 1 || c === 2);
        grid[r][c] = isBorder || isInner;
      }
    }
    for (let r = 0; r < 4; r++) {
      for (let c = size - 4; c < size; c++) {
        const isBorder = r === 0 || r === 3 || c === size - 4 || c === size - 1;
        const isInner = (r === 1 || r === 2) && (c === size - 3 || c === size - 2);
        grid[r][c] = isBorder || isInner;
      }
    }
    for (let r = size - 4; r < size; r++) {
      for (let c = 0; c < 4; c++) {
        const isBorder = r === size - 4 || r === size - 1 || c === 0 || c === 3;
        const isInner = (r === size - 3 || r === size - 2) && (c === 1 || c === 2);
        grid[r][c] = isBorder || isInner;
      }
    }

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-16 h-16 bg-white p-0.5 rounded border border-slate-200 inline-block">
        {grid.map((row, r) =>
          row.map((active, c) => (
            active && (
              <rect
                key={`${r}-${c}`}
                x={c}
                y={r}
                width={1}
                height={1}
                className="fill-slate-900"
                shapeRendering="crispEdges"
              />
            )
          ))
        )}
      </svg>
    );
  };

  // Save RMR Request
  const handleSaveRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectName || !formData.requesterName || !formData.itemsList) {
      showToast('Wajib mengisi Proyek, Mandor Pengaju, dan Daftar material!', 'error');
      return;
    }

    const codeStr = formData.code || `RMR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newItem: MaterialRequest = {
      id: isEditingId || `rmr-${Date.now()}`,
      code: codeStr,
      projectName: formData.projectName,
      requesterName: formData.requesterName,
      itemsList: formData.itemsList,
      date: formData.date || new Date().toISOString().split('T')[0],
      status: formData.status || 'Pending'
    };

    const updated = isEditingId 
      ? requestList.map(item => item.id === isEditingId ? newItem : item)
      : [...requestList, newItem];

    saveCollection('materialRequests', updated);
    showToast(`Sukses merekam draf RMR: ${newItem.code}`, 'success');
    setModalOpen(false);
  };

  const handleSetRmrStatus = (id: string, status: 'Approved' | 'Rejected' | 'Purchased') => {
    if (currentUserRole !== 'super_admin' && currentUserRole !== 'admin') {
      showToast('Otoritas Direksi Utama dibutuhkan untuk persetujuan material RMR.', 'error');
      return;
    }

    const matched = requestList.find(r => r.id === id);
    if (!matched) return;

    const updated = requestList.map(r => r.id === id ? { ...r, status } : r);
    saveCollection('materialRequests', updated);
    showToast(`RMR [${matched.code}] berstatus ${status}!`, 'info');

    sendWhatsAppNotification({
      phone: '0812345555',
      recipientName: matched.requesterName,
      message: `Pemberitahuan LuxeLiving ERP: Pengajuan material *${matched.code}* untuk Proyek *${matched.projectName}* telah di-*${status.toUpperCase()}* oleh Direksi.`
    });
  };

  // Delete inventory item
  const handleDeleteItem = (id: string) => {
    const item = 
      activeTab === 'goods' ? itemsList.find(i => i.id === id) :
      requestList.find(r => r.id === id);

    const displayName = item ? (('name' in item) ? item.name : ('projectName' in item) ? item.projectName : id) : id;

    setDeleteConfirm({
      id,
      description: `Apakah Anda yakin ingin menghapus material/request [${displayName}] dari records gudang?`
    });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;

    if (activeTab === 'goods') {
      saveCollection('inventory', itemsList.filter(i => i.id !== id));
      showToast('Barang berhasil dibuang dari katalog.', 'info');
    } else if (activeTab === 'request') {
      saveCollection('materialRequests', requestList.filter(r => r.id !== id));
      showToast('Draf RMR berhasil dibuang.', 'info');
    }

    setDeleteConfirm(null);
  };

  const getFilteredItems = () => {
    const term = searchTerm.toLowerCase();
    if (activeTab === 'goods' || activeTab === 'report') {
      return itemsList.filter(i => 
        i.name.toLowerCase().includes(term) || 
        i.category.toLowerCase().includes(term) ||
        (i.code && i.code.toLowerCase().includes(term))
      );
    } else if (activeTab === 'request') {
      return requestList.filter(r => 
        r.projectName.toLowerCase().includes(term) || 
        r.requesterName.toLowerCase().includes(term)
      );
    }
    return [];
  };

  const filteredItems = getFilteredItems();

  // Pagination Logic
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getActiveCategories = () => {
    if (categoriesList.length > 0) return categoriesList.map(c => c.name);
    return ['Premium Wood', 'Wallpaper HPL', 'Sofa & Fabric', 'Lighting Fitting', 'Paku & Logam'];
  };

  const getActiveWarehouses = () => {
    if (warehousesList.length > 0) return warehousesList.map(w => w.name);
    return ['Gudang Utama Kayu Kemang', 'Gudang Aksesoris Margonda', 'Workshop Perakitan Cikarang'];
  };

  React.useEffect(() => {
    setActiveDropdownId(null);
    setCurrentPage(1);
  }, [activeTab, subTab, searchTerm]);

  // Dynamically compute manual ledgers from goodsReceipts and materialRequests so they appear instantly
  const computedStockLedgers = [...(dbState.stockLedgers || [])];

  if (dbState.goodsReceipts) {
    dbState.goodsReceipts.forEach(receipt => {
      try {
        const items = JSON.parse(receipt.itemsReceived || '[]');
        const manualItems = items.filter((i: any) => i && i.type !== 'stock');
        manualItems.forEach((rItem: any, iIdx: number) => {
          const sourceName = `Approval STB ${receipt.code}`;
          const isDuplicate = computedStockLedgers.some(lg => lg.source === sourceName && lg.itemId === (rItem.itemId || `manual-${rItem.id}`));
          
          if (!isDuplicate) {
             computedStockLedgers.push({
               id: `ldg-stb-dyn-${receipt.id}-${iIdx}`,
               itemId: rItem.itemId || `manual-${rItem.id || Math.random().toString(36).substring(2, 9)}`,
               itemName: rItem.description || 'Penerimaan Manual',
               itemCategory: 'Item Manual (STB)',
               type: 'Inflow',
               source: `Draft STB ${receipt.code}`,
               date: receipt.date,
               qty: Number(rItem.qty) || 0,
               unit: rItem.unit || 'Pcs',
               remainingStock: Number(rItem.qty) || 0,
               itemMode: 'manual'
             });
          }
        });
      } catch(e) {}
    });
  }

  if (dbState.materialRequests) {
    dbState.materialRequests.forEach(rmr => {
      if (rmr.items) {
        const manualItems = rmr.items.filter((i: any) => i.source !== 'stok');
        manualItems.forEach((rItem: any, iIdx: number) => {
          const sourceName = `Approval RMR ${rmr.code}`;
          const isDuplicate = computedStockLedgers.some(lg => lg.source === sourceName && lg.itemId === (rItem.itemId || `manual-rmr-${rItem.id}`));
          
          if (!isDuplicate) {
             computedStockLedgers.push({
               id: `ldg-rmr-dyn-${rmr.id}-${iIdx}`,
               itemId: rItem.itemId || `manual-rmr-${rItem.id || Math.random().toString(36).substring(2, 9)}`,
               itemName: rItem.name || 'Kebutuhan Manual (RMR)',
               itemCategory: 'Item Manual (RMR)',
               type: 'Inflow',
               source: `Draft RMR ${rmr.code}`,
               date: rmr.date,
               qty: Number(rItem.qty) || 0,
               unit: rItem.unit || 'Pcs',
               remainingStock: 0,
               itemMode: 'manual'
             });
          }
        });
      }
    });
  }

  const getFilteredLedgers = () => {
    return computedStockLedgers
      .filter(ledger => cardCategoryFilter === '' || ledger.itemCategory === cardCategoryFilter)
      .filter(ledger => {
        const isStbManual = ledger.itemCategory === 'Item Manual (STB)';
        const isRmrManual = ledger.itemCategory === 'Item Manual (RMR)';
        const isAnyManual = ledger.itemMode === 'manual' || ledger.itemId?.startsWith('manual-') || isStbManual || isRmrManual;
        
        if (cardModeFilter === 'manual') return isAnyManual;
        if (cardModeFilter === 'stock') return !isAnyManual;
        return true; 
      })
      .filter(ledger => {
        if (!ledger.date) return true;
        const start = ledgerStartDate || '1970-01-01';
        const end = ledgerEndDate || '2099-12-31';
        return ledger.date >= start && ledger.date <= end;
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.id || '').localeCompare(a.id || '');
      });
  };

  return (
    <div className="bg-white   -3xl p-6  space-y-6 animate-fadeIn min-h-[calc(100vh-120px)] flex flex-col h-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h3 className="text-lg text-slate-900 tracking-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
            {activeTab === 'goods' ? 'Nama Barang & Gudang' : activeTab === 'card' ? 'Kartu Stok Ledger' : activeTab === 'report' ? 'Laporan Stok' : 'Manajemen Stok'}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            {activeTab === 'goods' ? 'Kelola sediaan barang fungsional dan penyimpanan gudang.' : activeTab === 'card' ? 'Pantau log histori penambahan dan pengurangan kuantitas barang.' : activeTab === 'report' ? 'Laporan rekapitulasi nilai barang dan arus stok.' : 'Pantau aktivitas.'}
          </p>
        </div>

        {/* Action Button Section in Header */}
        <div className="flex items-center gap-2">
          {activeTab === 'report' && (
            <>
              {/* Button Penyesuaian */}
              <button
                type="button"
                onClick={() => {
                  if (itemsList.length === 0) {
                    showToast('Katalog material barang kosong!', 'error');
                    return;
                  }
                  setAdjItemId(itemsList[0]?.id || '');
                  setAdjType('Inflow');
                  setAdjQty(0);
                  setAdjPhysicalQty(0);
                  setAdjNote('');
                  setIsAdjustmentModalOpen(true);
                }}
                className="flex items-center justify-center bg-[#f59e0b] text-white rounded-xl w-10 h-10 hover:bg-[#d97706] transition-all duration-200 shadow-md shadow-amber-500/20 border-none cursor-pointer"
                title="Penyesuaian Stok (Stock Adjustment)"
              >
                <Sliders className="w-5 h-5 font-bold" />
              </button>

              {/* Button Tutup Buku */}
              <button
                type="button"
                onClick={() => {
                  setIsClosePeriodModalOpen(true);
                }}
                className="flex items-center justify-center bg-[#4f46e5] text-white rounded-xl w-10 h-10 hover:bg-[#4338ca] transition-all duration-200 shadow-md shadow-indigo-500/20 border-none cursor-pointer"
                title="Tutup Buku Periode (Close Books)"
              >
                <Lock className="w-5 h-5 font-bold" />
              </button>

              {/* Button Seleksi Laporan */}
              <button
                type="button"
                onClick={() => setIsReportSelectorModalOpen(true)}
                className="flex items-center justify-center bg-[#10b981] text-white rounded-xl w-10 h-10 hover:bg-[#059669] transition-all duration-200 shadow-md shadow-emerald-500/20 border-none cursor-pointer"
                title="Pilih & Cetak Laporan Pasca-Audit"
              >
                <FileSpreadsheet className="w-5 h-5 font-bold" />
              </button>

              {/* Button Cetak */}
              <button
                type="button"
                onClick={() => setIsPrintReportModalOpen(true)}
                className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                title="Pratinjau & Cetak A4 / PDF"
              >
                <Printer className="w-5 h-5 font-bold" />
              </button>
            </>
          )}

          {activeTab !== 'card' && activeTab !== 'report' && (subTab === 'goods' || activeTab === 'request') && (
            <div className="flex items-center gap-2">
              {activeTab === 'goods' && subTab === 'goods' && (
                <div className="flex items-center gap-1.5">
                  {Object.values(selectedForBarcodePrint).filter(Boolean).length > 0 && (
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-100 font-mono transition-all animate-fadeIn">
                      {Object.values(selectedForBarcodePrint).filter(Boolean).length} terpilih
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const checkedItems = filteredItems.filter(itm => selectedForBarcodePrint[itm.id]);
                      if (checkedItems.length === 0) {
                        setPrintingBarcodeList(filteredItems);
                      } else {
                        setPrintingBarcodeList(checkedItems);
                      }
                      setPrintingBarcodeItem(null);
                      setIsPrintBarcodeModalOpen(true);
                    }}
                    className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer flex items-center justify-center hover:text-slate-900 transition"
                    title="Cetak Barcode Label Massal"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setFormData({
                    category: getActiveCategories()[0],
                    location: getActiveWarehouses()[0],
                    hasMinStock: false,
                    minStockLimit: 5,
                    unit: 'Pcs',
                    stock: 0,
                    price: 0,
                    photoUrl: ''
                  });
                  setIsEditingId(null);
                  setModalOpen(true);
                }}
                className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                title={activeTab === 'goods' ? 'Input data barang' : 'Ajukan Permintaan RMR'}
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER SEARCH INPUT BAR AND DISPLAY PREFERENCE TOGGLER with SUB-TABS */}
      {activeTab === 'goods' && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
          {subTab === 'goods' ? (
            <div className="flex items-center gap-2 w-full sm:max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, kategori, atau barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={handleDownloadTemplate}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer hover:text-slate-900 transition flex items-center justify-center"
                  title="Unduh Template CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <label className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer hover:text-slate-900 transition flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleUploadCSV} 
                    className="hidden font-medium font-sans" 
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="w-full sm:max-w-md invisible lg:block h-9"></div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
            {/* Display Switcher (Only for goods) */}
            {subTab === 'goods' && (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDisplayStyle('grid')}
                  title="Tampilan Kartu Foto"
                  className={`p-1.5 rounded-lg cursor-pointer border-none flex items-center gap-1 text-[11px] font-bold ${displayStyle === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Kartu Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayStyle('table')}
                  title="Tampilan Daftar Rinci"
                  className={`p-1.5 rounded-lg cursor-pointer border-none flex items-center gap-1 text-[11px] font-bold ${displayStyle === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Daftar</span>
                </button>
              </div>
            )}

            {/* THREE SUB-TABS INTERFACE */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setSubTab('goods')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  subTab === 'goods'
                    ? 'bg-white shadow text-indigo-700'
                    : 'bg-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                Nama Barang
              </button>
              <button
                type="button"
                onClick={() => setSubTab('category')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  subTab === 'category'
                    ? 'bg-white shadow text-indigo-700'
                    : 'bg-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                Kategori
              </button>
              <button
                type="button"
                onClick={() => setSubTab('warehouse')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  subTab === 'warehouse'
                    ? 'bg-white shadow text-indigo-700'
                    : 'bg-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                Gudang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONDITIONAL PORTAL BODY RENDERING */}
      {activeTab === 'goods' && subTab === 'goods' && (
        <div className="flex-grow flex flex-col">
          {displayStyle === 'grid' ? (
            /* CARDS GRID THEMATIC VIEW WITH PHOTO */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-start">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item: InventoryItem) => {
                  const isLowStock = item.hasMinStock && (item.stock < (item.minStockLimit || 0));

                  return (
                    <div 
                      key={item.id} 
                      className="relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between group overflow-visible animate-fadeIn"
                    >
                      {/* Top Visual Component */}
                      <div className="relative h-44 bg-slate-50 overflow-hidden rounded-t-2xl">
                        <img 
                          src={item.photoUrl || getFallbackPhoto(item.category)} 
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-40">
                          <input
                            type="checkbox"
                            checked={!!selectedForBarcodePrint[item.id]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setSelectedForBarcodePrint(prev => ({
                                ...prev,
                                [item.id]: e.target.checked
                              }));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 bg-slate-50/90 shadow border-slate-300 focus:ring-0 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                          />
                          <span className="bg-slate-900/80 backdrop-blur-sm text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">
                            {item.category}
                          </span>
                        </div>

                        {/* Barcode Tag */}
                        <div className="absolute bottom-3 right-3 bg-white/95 text-indigo-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-40">
                          <Barcode className="w-3 h-3" />
                          <span>{item.code}</span>
                        </div>

                        {isLowStock && (
                          <div className="absolute bottom-3 left-3 bg-rose-600/90 text-white font-sans text-[10px] font-bold px-2.5 py-1 rounded-xl shadow-sm flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-white" />
                            <span>Stok Minimum! (Batas: {item.minStockLimit})</span>
                          </div>
                        )}
                      </div>

                      {/* Top-Right Triple Dot Dropdown (Moved outside to card-level overflow-visible wrapper) */}
                      <div className="absolute top-3 right-3 z-50">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                          className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-sm hover:bg-white text-slate-700 hover:text-indigo-600 shadow-md flex items-center justify-center transition-all duration-200 border-none cursor-pointer"
                          title="Opsi Barang"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Popover */}
                        {activeDropdownId === item.id && (
                          <div 
                            className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-100/80 z-[100] py-1 text-left animate-fadeIn" 
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setViewingItem(item);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" /> Detail Barang
                            </button>

                            <button
                              onClick={() => {
                                setPrintingBarcodeItem(item);
                                setIsPrintBarcodeModalOpen(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-500" /> Cetak Barcode 2D
                            </button>

                            <button
                              onClick={() => {
                                setFormData(item);
                                setIsEditingId(item.id);
                                setModalOpen(true);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Edit className="w-3.5 h-3.5 text-indigo-500" /> Ubah Data
                            </button>

                            <div className="h-[1px] bg-slate-100 my-1"></div>

                            <button
                              onClick={() => {
                                handleDeleteItem(item.id);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Hapus Barang
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Content details */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-slate-800 text-sm tracking-tight group-hover:text-indigo-600 transition-colors leading-snug tracking-tight capitalize font-semibold font-sans">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold font-sans">
                            <Home className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.location}</span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-medium">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Inventory specifications */}
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-bold">
                            <div className="bg-slate-50 p-2 rounded-xl text-center">
                              <span className="text-[10px] text-slate-400 block mb-0.5 uppercase">Ketersediaan</span>
                              <span className={`font-mono text-xs ${item.stock < 10 ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.stock} {item.unit}
                              </span>
                            </div>
                            <div className="bg-indigo-50/50 p-2 rounded-xl text-center">
                              <span className="text-[10px] text-slate-400 block mb-0.5 uppercase">Harga Satuan</span>
                              <span className="font-mono text-xs text-indigo-700 block">
                                {formatIDR(item.price)}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-2">
                  Tidak ditemukan barang logistik mebel kustom.
                </div>
              )}
            </div>
          ) : (
            /* HIGH DENSITY TABLE VIEW */
            <div className="overflow-x-auto flex-grow scrollbar-hide">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase">
                    <th className="px-4 py-3 w-10 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={paginatedItems.length > 0 && paginatedItems.every(itm => selectedForBarcodePrint[itm.id])}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const nextSelect = { ...selectedForBarcodePrint };
                          paginatedItems.forEach(itm => {
                            nextSelect[itm.id] = val;
                          });
                          setSelectedForBarcodePrint(nextSelect);
                        }}
                        className="bg-slate-50 rounded border-slate-300 text-indigo-650 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                      />
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">Kode Barcode</th>
                    <th className="px-4 py-3 whitespace-nowrap">Nama Material</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kategori</th>
                    <th className="px-4 py-3 whitespace-nowrap">Unit Stok</th>
                    <th className="px-4 py-3 whitespace-nowrap">Harga Estimasi (IDR)</th>
                    <th className="px-4 py-3 whitespace-nowrap">Loker Gudang</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium font-sans">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item: InventoryItem) => {
                      const isLowStock = item.hasMinStock && (item.stock < (item.minStockLimit || 0));
                      return (
                        <tr key={item.id} className="hover:bg-amber-500 hover:text-slate-950/40">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!selectedForBarcodePrint[item.id]}
                              onChange={(e) => {
                                setSelectedForBarcodePrint(prev => ({
                                  ...prev,
                                  [item.id]: e.target.checked
                                }));
                              }}
                              className="bg-slate-50 rounded border-slate-300 text-indigo-600 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-600 font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-indigo-400" />
                              {item.code}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-sans font-bold whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {item.name}
                              {isLowStock && (
                                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Minimum
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{item.category}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold ${item.stock < 10 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
                              {item.stock} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">{formatIDR(item.price)}</td>
                          <td className="px-4 py-3 text-slate-600 font-bold whitespace-nowrap">{item.location}</td>
                          <td className="px-4 py-3 text-right relative whitespace-nowrap">
                            <div className="inline-block relative font-sans">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors border-none cursor-pointer"
                                title="Pilihan Aksi"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
 
                              {/* Dropdown Menu Popup - Bahasa Indonesia */}
                              <AnimatePresence>
                                {activeDropdownId === item.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="absolute right-0 mt-1 w-44 bg-white z-[100] overflow-hidden text-left rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] border-none"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="py-1 col-span-1">
                                      <button
                                        onClick={() => {
                                          setViewingItem(item);
                                          setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-slate-400" /> Detail Barang
                                      </button>

                                      <button
                                        onClick={() => {
                                          setPrintingBarcodeItem(item);
                                          setIsPrintBarcodeModalOpen(true);
                                          setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-705 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                      >
                                        <Printer className="w-4 h-4 mr-2 text-slate-400" /> Cetak Barcode 2D
                                      </button>
 
                                      <button
                                        onClick={() => {
                                          setFormData(item);
                                          setIsEditingId(item.id);
                                          setModalOpen(true);
                                          setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-indigo-500" /> Ubah Data
                                      </button>
 
                                      <button
                                        onClick={() => {
                                          handleDeleteItem(item.id);
                                          setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Hapus Barang
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Tidak ditemukan kecocokan barang logistik.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION UI */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Menampilkan <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari <span className="text-slate-900">{totalItems}</span> data
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    currentPage === 1 
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
                  }`}
                >
                  Sebelumnya
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      totalPages <= 5 || 
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border ${
                            currentPage === pageNum 
                              ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm border-indigo-600 shadow-md shadow-indigo-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      (pageNum === 2 && currentPage > 3) || 
                      (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    currentPage === totalPages 
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
                  }`}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MASTER TAB KATEGORI VIEW VIA DETACHED MODULE */}
      {activeTab === 'goods' && subTab === 'category' && (
        <CategoryCrudTab 
          dbState={dbState} 
          saveCollection={saveCollection} 
          showToast={showToast} 
          currentUserRole={currentUserRole} 
        />
      )}

      {/* MASTER TAB GUDANG VIEW VIA DETACHED MODULE */}
      {activeTab === 'goods' && subTab === 'warehouse' && (
        <WarehouseCrudTab 
          dbState={dbState} 
          saveCollection={saveCollection} 
          showToast={showToast} 
          currentUserRole={currentUserRole} 
        />
      )}

      {/* TAB: KARTU STOK ledger */}
      {activeTab === 'card' && (
        <div className="space-y-4 modal-container">

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-3.5 text-xs text-indigo-850 leading-relaxed print:hidden">
            <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold shrink-0">i</span>
            <div>
              <strong>Audit Ledger Kartu Stok:</strong> Catatan ini mendokumentasikan log aliran material keluar/masuk secara real-time yang dipicu oleh input manual barcode, checkout barang, and approval PO pemasok.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={cardCategoryFilter}
                onChange={(e) => setCardCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-550/20 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              >
                <option value="">Semua Kategori</option>
                {categoriesList.map((cat, idx) => (
                  <option key={idx} value={cat.name}>{cat.name}</option>
                ))}
                <option value="Item Manual (STB)">Item Manual (STB)</option>
                <option value="Item Manual (RMR)">Item Manual (RMR)</option>
              </select>

              {/* Segmented Filter: All vs Stock Catalog vs Manual STB */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setCardModeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-none leading-none ${
                    cardModeFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                  }`}
                >
                  Semua Aliran
                </button>
                <button
                  type="button"
                  onClick={() => setCardModeFilter('stock')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-none leading-none flex items-center gap-1 ${
                    cardModeFilter === 'stock'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                  }`}
                >
                  <span>📦</span> Stok Katalog
                </button>
                <button
                  type="button"
                  onClick={() => setCardModeFilter('manual')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-none leading-none flex items-center gap-1 ${
                    cardModeFilter === 'manual'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                  }`}
                >
                  <span>✏️</span> Manual
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPrintLedgerModalOpen(true)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition duration-200 cursor-pointer border border-slate-300 shadow-sm flex items-center justify-center"
              title="Cetak & Unduh Laporan Kartu Stok Ledger"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase">
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp Audit</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nama Material</th>
                  <th className="px-4 py-3 whitespace-nowrap">Sifat / Mode</th>
                  <th className="px-4 py-3 whitespace-nowrap">Jenis Aliran</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Sisa Stok Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {computedStockLedgers && computedStockLedgers.length > 0 ? (
                  computedStockLedgers
                    .filter(ledger => cardCategoryFilter === '' || ledger.itemCategory === cardCategoryFilter)
                    .filter(ledger => {
                      if (cardModeFilter === 'all') return true;
                      const isStbManual = ledger.itemCategory === 'Item Manual (STB)';
                      const isRmrManual = ledger.itemCategory === 'Item Manual (RMR)';
                      const isAnyManual = ledger.itemMode === 'manual' || ledger.itemId?.startsWith('manual-') || isStbManual || isRmrManual;
                      
                      if (cardModeFilter === 'manual') return isAnyManual;
                      return !isAnyManual; // this means 'stock' filter
                    })
                    .sort((a, b) => {
                      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                      if (dateDiff !== 0) return dateDiff;
                      return (b.id || '').localeCompare(a.id || '');
                    })
                    .map((ledger, idx) => {
                      const isManualEntry = ledger.itemMode === 'manual' || 
                                            ledger.itemId?.startsWith('manual-') || 
                                            ledger.itemCategory === 'Item Manual (STB)' ||
                                            ledger.itemCategory === 'Item Manual (RMR)';
                      return (
                        <tr key={ledger.id || idx} className="hover:bg-amber-500 hover:text-slate-950/50">
                          <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                            {ledger.date}
                            <br/>
                            <span className="text-[9px] font-sans">{ledger.source}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{ledger.itemName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              isManualEntry 
                                ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {isManualEntry ? '✏️ Manual' : '📦 Stok'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${ledger.type === 'Inflow' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                              {ledger.type === 'Inflow' ? `+${ledger.qty} (Inflow)` : `-${ledger.qty} (Outflow)`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {isManualEntry ? '-' : `${ledger.remainingStock} ${ledger.unit}`}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-semibold text-xs">
                      Belum ada aliran stok material yang tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: LAPORAN STOK */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 print:bg-transparent border-b border-slate-100 text-[10px] font-bold text-slate-400 print:text-slate-900 font-mono uppercase">
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap border-b border-slate-300">Barcode</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap border-b border-slate-300">Nama Barang</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap border-b border-slate-300">Kategori</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right border-b border-slate-300">Stok Awal</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right text-emerald-600 print:text-slate-900 border-b border-slate-300">Terima (STB)</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right text-rose-500 print:text-slate-900 border-b border-slate-300">Keluar (RMR)</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right text-indigo-700 print:text-slate-900 border-b border-slate-300">Sisa Stok</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right border-b border-slate-300">Harga Satuan</th>
                  <th className="px-4 py-3 print:px-2 print:py-2 whitespace-nowrap text-right border-b border-slate-300">Total Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium print:hidden">
                {paginatedItems.map((item: InventoryItem) => {
                  const approvedLedgers = dbState.stockLedgers || [];
                  const itemLedgers = approvedLedgers.filter(l => l.itemId === item.id || l.itemId === item.code);
                  
                  const inflow = itemLedgers.filter(l => l.type === 'Inflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
                  const outflow = itemLedgers.filter(l => l.type === 'Outflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
                  
                  const initial = item.stock - inflow + outflow;

                  return (
                    <tr key={item.id} className="hover:bg-amber-500 hover:text-slate-950/40">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-400 text-[10px]">{item.code || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-bold">{item.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{item.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">{initial} {item.unit || 'Unit'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-600 font-bold text-right">+{inflow}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-rose-500 font-bold text-right">-{outflow}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-indigo-700 font-black text-right">{item.stock} {item.unit || 'Unit'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">Rp {item.price?.toLocaleString('id-ID') || 0}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-black">
                        Rp {((item.price || 0) * (item.stock || 0)).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data item stok.
                    </td>
                  </tr>
                )}
              </tbody>
              <tbody className="divide-y divide-slate-100 font-medium hidden print:table-row-group">
                {filteredItems.map((item: InventoryItem) => {
                  const approvedLedgers = dbState.stockLedgers || [];
                  const itemLedgers = approvedLedgers.filter(l => l.itemId === item.id || l.itemId === item.code);
                  
                  const inflow = itemLedgers.filter(l => l.type === 'Inflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
                  const outflow = itemLedgers.filter(l => l.type === 'Outflow').reduce((acc, curr) => acc + (curr.qty || 0), 0);
                  
                  const initial = item.stock - inflow + outflow;

                  return (
                    <tr key={item.id} className="hover:bg-amber-500 hover:text-slate-950/40">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-400 text-[10px] border-b">{item.code || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-bold border-b">{item.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 border-b">{item.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right border-b">{initial} {item.unit || 'Unit'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-600 font-bold text-right border-b">+{inflow}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-rose-500 font-bold text-right border-b">-{outflow}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-indigo-700 font-black text-right border-b">{item.stock} {item.unit || 'Unit'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right border-b">Rp {item.price?.toLocaleString('id-ID') || 0}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-black border-b">
                        Rp {((item.price || 0) * (item.stock || 0)).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-900">
                  <td colSpan={8} className="px-4 py-4 text-right uppercase">Estimasi Total Nilai Aset:</td>
                  <td className="px-4 py-4 text-right text-sm">
                    Rp {filteredItems.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PAGINATION UI */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans print:hidden">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Menampilkan <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari <span className="text-slate-900">{totalItems}</span> data
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    currentPage === 1 
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
                  }`}
                >
                  Sebelumnya
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      totalPages <= 5 || 
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border ${
                            currentPage === pageNum 
                              ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm border-indigo-600 shadow-md shadow-indigo-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === currentPage - 2 || 
                      pageNum === currentPage + 2
                    ) {
                      return <span key={pageNum} className="text-slate-400 text-xs px-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    currentPage === totalPages 
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
                  }`}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB: MATERIAL REQUEST RMR */}
      {activeTab === 'request' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase">
                <th className="px-4 py-3 whitespace-nowrap">Kode RMR</th>
                <th className="px-4 py-3 whitespace-nowrap">Nama Konstruksi Proyek</th>
                <th className="px-4 py-3 whitespace-nowrap">Pengaju Lapangan</th>
                <th className="px-4 py-3 whitespace-nowrap">Tanggal Pengajuan</th>
                <th className="px-4 py-3 whitespace-nowrap">Spesifikasi BoQ Mebel</th>
                <th className="px-4 py-3 whitespace-nowrap">Status Kontrol</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Otoritas Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredItems.length > 0 ? (
                filteredItems.map((req: any) => (
                  <tr key={req.id} className="hover:bg-amber-500 hover:text-slate-950/40">
                    <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">{req.code}</td>
                    <td className="px-4 py-3.5 text-slate-850 font-sans font-bold whitespace-nowrap">{req.projectName}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{req.requesterName}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-500 whitespace-nowrap">{req.date}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] max-w-xs truncate whitespace-nowrap">{req.itemsList}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' :
                        req.status === 'Rejected' ? 'bg-rose-50 text-rose-500 border border-rose-150' :
                        req.status === 'Purchased' ? 'bg-blue-50 text-blue-600 border border-blue-150' :
                        'bg-slate-100 text-slate-500 animate-pulse'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                      {req.status === 'Pending' && isSuperOrAdmin && (
                        <>
                          <button
                            onClick={() => handleSetRmrStatus(req.id, 'Approved')}
                            className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => handleSetRmrStatus(req.id, 'Rejected')}
                            className="p-1 px-1.5 bg-rose-500 text-white rounded hover:bg-rose-600 font-bold cursor-pointer border-none text-[10px]"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      
                      {req.status === 'Approved' && currentUserRole === 'accounting' && triggerPoCreation && (
                        <button
                          onClick={() => {
                            handleSetRmrStatus(req.id, 'Purchased');
                            triggerPoCreation();
                          }}
                          className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                        >
                          Tarik ke Draf PO
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteItem(req.id)}
                        className="p-1 .5 text-rose-600 hover:bg-rose-50  text-[10px] font-bold cursor-pointer border-none w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"
                      ><Trash2 className="w-4 h-4"/>&nbsp;Hapus</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada pengajuan material logistik saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAILED MATERIAL POPUP VIEW (READ-ONLY) */}
      <Modal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        title="Detail Katalog Material Mebel"
        maxWidth="max-w-md"
      >
        {viewingItem && (
          <div className="space-y-4 text-xs font-sans text-left">
            <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <img 
                src={viewingItem.photoUrl || getFallbackPhoto(viewingItem.category)} 
                alt={viewingItem.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {viewingItem.category}
              </div>
              <div className="absolute bottom-3 right-3 bg-white px-2.5 py-1   font-mono text-[9px] font-bold text-slate-700 flex items-center gap-1 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <Barcode className="w-3.5 h-3.5" />
                <span>{viewingItem.code}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">ID Barang / Referensi Kunci</span>
                <strong className="text-slate-800 font-mono mt-0.5 block">{viewingItem.id}</strong>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Nama Material</span>
                <strong className="text-slate-900 font-black text-sm block mt-0.5 leading-snug">{viewingItem.name}</strong>
              </div>
              <hr className="border-slate-150" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Stok Saat Ini (Sisa)</span>
                  <strong className="text-slate-800 text-xs block mt-0.5">{viewingItem.stock} {viewingItem.unit}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Stok Awal (Inisial)</span>
                  <strong className="text-slate-600 text-xs block mt-0.5 font-mono">{viewingItem.initialStock ?? viewingItem.stock} {viewingItem.unit}</strong>
                </div>
              </div>
              <hr className="border-slate-150" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Estimasi Harga Satuan</span>
                  <strong className="text-indigo-600 font-mono text-xs block mt-0.5">{formatIDR(viewingItem.price)}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Penyimpanan Gudang</span>
                  <strong className="text-slate-700 text-xs block mt-0.5 font-sans font-black">{viewingItem.location}</strong>
                </div>
              </div>
              {viewingItem.hasMinStock && (
                <>
                  <hr className="border-slate-150" />
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 flex items-center justify-between">
                    <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      Alert Stok Minimum Aktif
                    </span>
                    <strong className="text-rose-800 font-mono text-xs bg-rose-100/30 px-2 py-0.5 rounded-md">
                      Batas: {viewingItem.minStockLimit || 0} {viewingItem.unit}
                    </strong>
                  </div>
                </>
              )}
              {viewingItem.description && (
                <>
                  <hr className="border-slate-150" />
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Spesifikasi <Plus className="w-4 h-4 mr-1" /> Tambahan</span>
                    <p className="text-slate-650 mt-1 sm:mt-0.5 leading-relaxed font-semibold">{viewingItem.description}</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingItem(null)}
                className="bg-indigo-600 col-span-1 border-none cursor-pointer hover:bg-indigo-700 text-white font-bold p-2 px-6 rounded-xl text-xs shadow"
              >
                <X className="w-4 h-4 mr-1.5" /> Tutup Detail
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* POPUP SOURCING ENTRY FORM MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={activeTab === 'goods' ? 'Input data barang' : 'Form Pengajuan Kebutuhan Bahan (RMR)'}
        maxWidth={activeTab === 'goods' ? 'max-w-4xl' : 'max-w-md'}
      >
        <p className="text-[10px] text-slate-400 font-sans -mt-2 mb-4">Mempengaruhi pencatatan master aliran logistik pusat.</p>

        <form onSubmit={activeTab === 'goods' ? handleSaveGoods : handleSaveRequest} className="space-y-4 text-xs font-sans text-left font-bold text-slate-700">
          
          {activeTab === 'goods' && (
            <div className="space-y-6 pt-1 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 font-sans">
                {/* KOLOM PERTAMA (KIRI): PHOTO & BARCODE */}
                <div className="space-y-6">
                    {/* PHOTO UPLOAD */}
                    <div>
                     <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                       <span>Unggah Foto Barang:</span>
                       {formData.photoUrl && (
                         <button type="button" onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))} className="text-[10px] text-rose-500 hover:underline border-none bg-transparent cursor-pointer font-bold">Hapus</button>
                       )}
                     </label>
                     {formData.photoUrl ? (
                       <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-40 w-full bg-slate-50 flex items-center justify-center">
                         <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                       </div>
                     ) : (
                       <div
                         onDragEnter={handleDrag}
                         onDragOver={handleDrag}
                         onDragLeave={handleDrag}
                         onDrop={handleDrop}
                         className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all h-40 flex flex-col items-center justify-center ${
                           dragActive 
                             ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
                             : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-amber-500 hover:text-slate-950/50'
                         }`}
                         onClick={() => document.getElementById('item-file-upload')?.click()}
                       >
                         <input
                           id="item-file-upload"
                           type="file"
                           accept="image/*"
                           className="hidden font-medium font-sans"
                           onChange={handleFileChange}
                         />
                         {compressing ? (
                           <div className="space-y-2 py-2">
                             <div className="w-6 h-6 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
                             <span className="text-[10px] text-indigo-700 font-bold block animate-pulse">Compressing...</span>
                           </div>
                         ) : (
                           <>
                             <Camera className="w-8 h-8 text-indigo-500 mb-2" />
                             <span className="text-[11px] text-slate-500 font-bold">Upload / Drop Foto Barang</span>
                           </>
                         )}
                       </div>
                     )}
                    </div>

                    {/* BARCODE SECTION */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-row items-center gap-4">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0">
                            <QRCode value={formData.customCode || formData.code || 'ID BARCODE'} size={60} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-semibold text-[#8fa0be] uppercase tracking-wider block">ID Barcode / Custom (Opsional):</label>
                          <input
                            type="text"
                            placeholder="(Otomatis acak)"
                            className="w-full bg-[#f1f5f9] text-slate-800 rounded-lg p-2 text-xs font-mono font-bold border-none"
                            defaultValue={formData.customCode || formData.code || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, customCode: e.target.value }))}
                          />
                        </div>
                    </div>
                </div>

                {/* KOLOM KEDUA (TENGAH): Kategori Barang, Nama Alat/Barang, Lokasi Penyimpanan, dan Kebutuhan Minimal */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                      Kategori Bahan: <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      defaultValue={formData.category || (getActiveCategories()[0] || 'Premium Wood')}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {getActiveCategories().map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">Nama Barang / Mebel Kustom: <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      defaultValue={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Penyimpanan Gudang:</label>
                    <select
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      defaultValue={formData.location || (getActiveWarehouses()[0] || 'Gudang Utama Kayu Kemang')}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    >
                      {getActiveWarehouses().map((wh, idx) => (
                        <option key={idx} value={wh}>{wh}</option>
                      ))}
                    </select>
                  </div>

                  {/* Checkbox box stok minimum bisa input */}
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 space-y-2.5">
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between cursor-pointer">
                      <input
                        type="checkbox"
                        className="bg-slate-50 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer transition-all duration-200"
                        checked={!!formData.hasMinStock}
                        onChange={(e) => setFormData(prev => ({ ...prev, hasMinStock: e.target.checked }))}
                      />
                      <span className="text-[11px] text-slate-700 font-semibold flex-1 pl-2 font-sans">Aktifkan limitasi alarm stok minimum</span>
                    </label>

                    {!!formData.hasMinStock && (
                      <div className="flex items-center gap-2 animate-fadeIn pl-6">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase font-sans">Batas Minimum:</span>
                        <input
                          type="number"
                          className="w-24 bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-center focus:outline-none"
                          value={formData.minStockLimit ?? 5}
                          onChange={(e) => setFormData(prev => ({ ...prev, minStockLimit: Number(e.target.value) }))}
                          min={0}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* KOLOM KETIGA (KANAN): Stok Awal, Satuan Unit, Estimasi Harga, Deskripsi */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Stok Awal (Inisial):</label>
                    <input
                      type="number"
                      className="w-full bg-[#f1f5f9] text-[#1e293b] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-semibold font-sans"
                      defaultValue={formData.stock || 0}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        stock: Number(e.target.value),
                        initialStock: Number(e.target.value)
                      }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Satuan Unit:</label>
                    <input
                      type="text"
                      placeholder="e.g. Batang / Pcs"
                      className="w-full bg-[#f1f5f9] text-[#1e293b] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-semibold font-sans"
                      defaultValue={formData.unit || 'Pcs'}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Estimasi Harga (Satuan):</label>
                    <input
                      type="number"
                      className="w-full bg-[#f1f5f9] text-[#1e293b] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-semibold font-sans"
                      defaultValue={formData.price || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Spesifikasi / Deskripsi Detail:</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. ketebalan Komposit 12mm motif Walnut Taco kustom"
                      className="w-full bg-[#f1f5f9] text-[#1e293b] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-semibold font-sans"
                      defaultValue={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Sektor Proyek Interior:</label>
                <input
                  type="text"
                  placeholder="e.g. Apartemen Kemang - Sektor B"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.projectName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Mandor Pengaju (Requester):</label>
                <input
                  type="text"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.requesterName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, requesterName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">BoQ Spesifikasi Bahan yang Dibutuhkan:</label>
                <textarea
                  rows={3}
                  placeholder="e.g. 10 Batang Kayu Jati, 2 Roll Lem Wallpaper..."
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.itemsList || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemsList: e.target.value }))}
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="submit"
              className="flex items-center justify-center bg-[#2563eb] hover:bg-blue-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-blue-500/20"
              title="Simpan"
            >
              <Save className="w-5 h-5" />
            </button>
          </div>

        </form>
      </Modal>

      {/* CUSTOM CONFIRMATION DELETE MODAL */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Konfirmasi Hapus Data"
        maxWidth="max-w-sm"
      >
        <div className="text-center pb-4 select-none">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-slate-600 text-[11px] font-sans mt-2.5 leading-relaxed">
            {deleteConfirm?.description}
          </p>
          <div className="mt-3 p-2.5 bg-amber-50 rounded-2xl text-amber-800 text-[10px] font-sans font-bold leading-relaxed border border-amber-100 text-left">
            ⚠️ Catatan: Peng<Trash2 className="w-4 h-4 mr-1" /> hapusan bersifat permanen dan otomatis disinkronisasikan ke Cloud database.
          </div>
        </div>
        
        <div className="flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => setDeleteConfirm(null)}
            className="bg-slate-150 hover:bg-amber-500 hover:text-slate-950 text-slate-705 font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
          >
            <X className="w-4 h-4 mr-1" /> Batal
          </button>
          <button
            type="button"
            onClick={executeDelete}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
          ><Trash2 className="w-4 h-4"/>&nbsp;Hapus</button>
        </div>
      </Modal>

      {/* POPUP PRINT 2D BARCODE MODAL */}
      <Modal
        isOpen={isPrintBarcodeModalOpen}
        onClose={() => {
          setIsPrintBarcodeModalOpen(false);
          setPrintingBarcodeItem(null);
          setPrintingBarcodeList(null);
        }}
        title="Cetak Label Barcode 2D Satuan / Massal"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs font-sans text-left">
          <p className="text-[10px] text-slate-400 font-sans -mt-2">
            Desain label siap cetak dengan barcode model 2D (vektor berkepadatan tinggi) & detail loker gudang.
          </p>

          {/* Action Row inside modal */}
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
            <div className="font-extrabold text-slate-700">
              Total: {(printingBarcodeItem ? [printingBarcodeItem] : (printingBarcodeList || [])).length} Barcode Label
            </div>
            <button
              onClick={() => {
                window.print();
              }}
              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-2" /> Cetak Label Sekarang
            </button>
          </div>

          {/* PRINT VIEW AREA GRID */}
          <div id="print-area-section" className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1 max-h-96 overflow-y-auto bg-slate-100 p-4 rounded-3xl">
            {(printingBarcodeItem ? [printingBarcodeItem] : (printingBarcodeList || [])).map((item) => (
              <div 
                key={item.id} 
                className="bg-white p-4 -2xl flex items-center gap-3.5  print: print: print: print: select-none relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
                style={{ breakInside: 'avoid' }}
              >
                {/* 2D Barcode Generator */}
                <div className="shrink-0 flex items-center justify-center">
                  {generate2DBarcodeSVG(item.code)}
                </div>

                {/* Meta details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h5 className="font-black text-slate-805 text-[11px] truncate leading-tight uppercase tracking-tight">{item.name}</h5>
                  <div className="text-[9.5px] font-mono font-bold text-indigo-600 tracking-wide">{item.code}</div>
                  <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</div>
                  
                  {/* Loker Gudang */}
                  <div className="text-[9px] font-black font-sans text-slate-700 bg-slate-50 p-1 px-2 rounded-lg inline-block leading-none truncate max-w-full">
                    📍 {item.location}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Styling block for print control */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Hide all other elements */
              body > div:not(#root), #root > div > *:not(main), main > *:not(#print-area-section) {
                display: none !important;
              }
              body * {
                visibility: hidden;
              }
              #print-area-section, #print-area-section * {
                visibility: visible;
              }
              #print-area-section {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                background: white !important;
                border: none !important;
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 15px !important;
                padding: 0 !important;
                max-height: none !important;
                overflow: visible !important;
              }
              #print-area-section > div {
                border: 1px solid #333 !important;
                border-radius: 8px !important;
                padding: 12px !important;
                background: white !important;
                page-break-inside: avoid !important;
              }
            }
          `}} />
        </div>
      </Modal>

      {/* POPUP PRINT LAPORAN STOK MODAL (A4 READY) */}
      <Modal
        isOpen={isPrintReportModalOpen}
        onClose={() => setIsPrintReportModalOpen(false)}
        title="Cetak & Unduh Laporan Rekapitulasi Stok"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6 text-xs font-sans text-left print:p-0">
          
          {/* Action Row Inside Modal (will hide on actual print output) */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden">
            <span className="text-xs font-bold text-slate-800">Tindakan Dokumen Laporan:</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadReportPDF}
                title="Instan Unduh PDF"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Cetak via Browser"
                className="bg-indigo-900 hover:bg-indigo-950 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PERIODE SELECTOR (PRINT:HIDDEN) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 print:hidden">
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="text-base">📅</span>
              <h4 className="text-slate-800 text-xs tracking-wider tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                Tentukan Periode Laporan Rekap Stok
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Mulai Tanggal
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => updateReportDates(e.target.value, reportEndDate)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => updateReportDates(reportStartDate, e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>
            </div>

            {/* SIGNER INPUTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200/60">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Nama Penanggung Jawab
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => updateSigner(e.target.value, signerTitle)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                  placeholder="Nama lengkap penanggung jawab"
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Jabatan
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => updateSigner(signerName, e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                  placeholder="Jabatan"
                />
              </div>
            </div>

            {/* QUICK PRESETS */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
              <span className="text-[10px] text-slate-400 font-bold mr-1">Preset Cepat:</span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  updateReportDates(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-150 hover:bg-indigo-200 text-indigo-900 border-none cursor-pointer transition"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  updateReportDates(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0], new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 border-none cursor-pointer transition"
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  updateReportDates(new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0], new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 border-none cursor-pointer transition"
              >
                Tahun Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  updateReportDates('', '');
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border-none cursor-pointer transition"
              >
                Semua Periode
              </button>
            </div>
          </div>

          {/* Letterhead & Official A4 Report Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 print:border-none print:p-0 space-y-6">
            
            {/* Kop Surat / Letterhead */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div>
                {dbState.settings?.reportLetterheadUrl ? (
                   <img src={dbState.settings.reportLetterheadUrl} alt="Kop Surat" className="h-16 object-contain mb-2" />
                ) : (
                  <>
                    <h2 className="text-xl tracking-tight tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">
                      {dbState.settings?.companyName || 'Dutasari ERP'}
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-sm whitespace-pre-line">
                      {dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209'}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <span className="text-[9px] bg-indigo-950 text-indigo-100 border border-indigo-900 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  LAPORAN REKAP STOK
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-2 bg-slate-50 border border-slate-100 rounded-xl print:bg-transparent print:border-none">
              <h3 className="text-sm text-slate-950 tracking-wide tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                LAPORAN REKAPITULASI & ESTIMASI NILAI STOK GUDANG UTAMA
              </h3>
              <p className="font-mono text-[9px] text-slate-500 mt-0.5">DICETAK OLEH SISTEM: ERP INTEGRITY LOGISTICS</p>
            </div>

            {/* Metadata Ringkas */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border border-slate-100 print:border-slate-300 p-3 rounded-xl">
              <div>
                <table className="w-full text-slate-600">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-24">Klasifikasi:</td>
                      <td className="text-slate-900">Inventaris Stok Utama</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Filter Kategori:</td>
                      <td className="text-slate-900">{cardCategoryFilter || 'Semua Kategori'}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Masa Laporan:</td>
                      <td className="font-bold text-slate-900">
                        {reportStartDate ? new Date(reportStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awal'} s.d. {reportEndDate ? new Date(reportEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Kini'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="w-full text-slate-600">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 text-right w-36">Total Varian Barang:</td>
                      <td className="text-right font-mono font-bold text-slate-900">{filteredItems.length} Item</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5 text-right">Estimasi Nilai Aset:</td>
                      <td className="text-right font-bold text-indigo-700 font-mono">
                        Rp {filteredItems.reduce((sum, item) => sum + getPeriodStats(item).totalNilai, 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabular A4 Data */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-500 font-bold font-mono uppercase">
                    <th className="px-2 py-2 w-16">Barcode</th>
                    <th className="px-2 py-2">Nama Barang</th>
                    <th className="px-2 py-2">Kategori</th>
                    <th className="px-2 py-2 text-right">Awal</th>
                    <th className="px-2 py-2 text-right text-emerald-600 font-bold">Masuk (STB)</th>
                    <th className="px-2 py-2 text-right text-rose-500 font-bold">Keluar (RMR)</th>
                    <th className="px-2 py-2 text-right font-bold text-indigo-700">Sisa Stok</th>
                    <th className="px-2 py-2 text-right">Harga Satuan</th>
                    <th className="px-2 py-2 text-right">Total Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {filteredItems.map((item: InventoryItem) => {
                    const stats = getPeriodStats(item);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 print:hover:bg-transparent page-break-inside-avoid">
                        <td className="px-2 py-2 font-mono text-slate-400 text-[9px] border-b border-slate-100">{item.code || '-'}</td>
                        <td className="px-2 py-2 text-slate-900 font-bold border-b border-slate-100 whitespace-normal max-w-xs">{item.name}</td>
                        <td className="px-2 py-2 text-slate-500 border-b border-slate-100">{item.category}</td>
                        <td className="px-2 py-2 text-right border-b border-slate-100">{stats.initial} {item.unit || 'Unit'}</td>
                        <td className="px-2 py-2 text-emerald-600 font-bold text-right border-b border-slate-100">+{stats.inflow}</td>
                        <td className="px-2 py-2 text-rose-500 font-bold text-right border-b border-slate-100">-{stats.outflow}</td>
                        <td className="px-2 py-2 text-indigo-700 font-black text-right border-b border-slate-100">{stats.ending} {item.unit || 'Unit'}</td>
                        <td className="px-2 py-2 text-right border-b border-slate-100 font-mono">Rp {item.price?.toLocaleString('id-ID') || 0}</td>
                        <td className="px-2 py-2 text-right font-black border-b border-slate-100 font-mono">
                          Rp {stats.totalNilai.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-2 py-8 text-center text-slate-400">
                        Tidak ada data item stok yang dapat dicetak.
                      </td>
                    </tr>
                  )}
                  {/* Totals Summary Row inside printable area */}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-900 leading-normal font-sans">
                    <td colSpan={7} className="px-2 py-3 text-right uppercase text-[9px] tracking-wider">Total Estimasi Nilai Inventaris (Aset):</td>
                    <td colSpan={2} className="px-2 py-3 text-right text-xs text-indigo-950 font-bold font-mono">
                      Rp {filteredItems.reduce((sum, item) => sum + getPeriodStats(item).totalNilai, 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature Area for Validation */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-center text-[10px] leading-relaxed select-none">
              <div className="space-y-12">
                <p className="font-bold text-slate-500 uppercase tracking-widest text-[8px] font-sans">Dipersiapkan Oleh,</p>
                <div className="space-y-1 font-sans">
                  <p className="font-bold underline text-slate-900">Staff Logistik & Gudang</p>
                  <p className="text-slate-400">Departemen Operasional</p>
                </div>
              </div>
              <div className="space-y-12">
                <p className="font-bold text-slate-500 uppercase tracking-widest text-[8px] font-sans">Disetujui Oleh,</p>
                <div className="space-y-1 font-sans">
                  <p className="font-bold underline text-slate-900 font-sans">Direktur / Kepala Cabang</p>
                  <p className="text-slate-400 font-sans">{dbState.settings?.companyName || 'Dutasari ERP'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Modal>

      {/* POPUP PRINT LAPORAN KARTU STOK LEDGER MODAL (A4 READY) */}
      <Modal
        isOpen={isPrintLedgerModalOpen}
        onClose={() => setIsPrintLedgerModalOpen(false)}
        title="Cetak & Unduh Laporan Kartu Stok Ledger"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6 text-xs font-sans text-left print:p-0">
          
          {/* Action Row Inside Modal (will hide on actual print output) */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden">
            <span className="text-xs font-bold text-slate-800">Tindakan Dokumen Laporan:</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadLedgerPDF(getFilteredLedgers())}
                title="Instan Unduh PDF"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Cetak via Browser"
                className="bg-indigo-900 hover:bg-indigo-950 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PERIODE SELECTOR (PRINT:HIDDEN) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 print:hidden">
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="text-base">📅</span>
              <h4 className="text-slate-800 text-xs font-semibold font-sans tracking-tight capitalize">
                Tentukan Periode Laporan Kartu Stok Ledger
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Mulai Tanggal
                </label>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>
            </div>

            {/* QUICK PRESETS */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
              <span className="text-[10px] text-slate-400 font-bold mr-1">Preset Cepat:</span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setLedgerStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
                  setLedgerEndDate(new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-150 hover:bg-indigo-200 text-indigo-900 border-none cursor-pointer transition"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setLedgerStartDate(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]);
                  setLedgerEndDate(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 border-none cursor-pointer transition"
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setLedgerStartDate(new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]);
                  setLedgerEndDate(new Date().toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-150 hover:bg-slate-200 text-slate-700 border-none cursor-pointer transition"
              >
                Tahun Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setLedgerStartDate('');
                  setLedgerEndDate('');
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border-none cursor-pointer transition"
              >
                Semua Periode
              </button>
            </div>
          </div>

          {/* Letterhead & Official A4 Report Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 print:border-none print:p-0 space-y-6">
            
            {/* Kop Surat / Letterhead */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div>
                {dbState.settings?.reportLetterheadUrl ? (
                   <img src={dbState.settings.reportLetterheadUrl} alt="Kop Surat" className="h-16 object-contain mb-2" />
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-slate-800 font-sans tracking-tight capitalize">
                      {dbState.settings?.companyName || 'Dutasari ERP'}
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-sm whitespace-pre-line">
                      {dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209'}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <span className="text-[9px] bg-indigo-950 text-indigo-100 border border-indigo-900 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  LAPORAN LEDGER KARTU STOK
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-2 bg-slate-50 border border-slate-100 rounded-xl print:bg-transparent print:border-none">
              <h3 className="text-sm text-slate-950 font-semibold font-sans tracking-tight capitalize">
                LAPORAN JURNAL AUDIT LEDGER KARTU STOK
              </h3>
              <p className="font-mono text-[9px] text-slate-500 mt-0.5">DICETAK OLEH SISTEM: ERP INTEGRITY LOGISTICS</p>
            </div>

            {/* Metadata Ringkas */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border border-slate-100 print:border-slate-300 p-3 rounded-xl">
              <div>
                <table className="w-full text-slate-600">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-24">Klasifikasi:</td>
                      <td className="py-0.5 text-slate-900">Audit Trail Aliran Material</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Filter Kategori:</td>
                      <td className="py-0.5 text-slate-900">{cardCategoryFilter || 'Semua Kategori (Katalog & Manual)'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="w-full text-slate-600">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-32">Periode Laporan:</td>
                      <td className="py-0.5 text-slate-900">
                        {ledgerStartDate && ledgerEndDate 
                          ? `${new Date(ledgerStartDate).toLocaleDateString('id-ID')} s.d. ${new Date(ledgerEndDate).toLocaleDateString('id-ID')}` 
                          : 'Semua Periode'}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Total Aliran Log:</td>
                      <td className="py-0.5 text-indigo-900 font-bold">{getFilteredLedgers().length} Baris Transaksi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabular A4 Data */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-500 font-bold font-mono uppercase">
                    <th className="px-2 py-2 w-32">Timestamp Audit & Source</th>
                    <th className="px-2 py-2">Nama Material / Barang</th>
                    <th className="px-2 py-2 w-24">Sifat / Mode</th>
                    <th className="px-2 py-2 w-24">Jenis Aliran</th>
                    <th className="px-2 py-2 text-right w-28">Sisa Stok Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {getFilteredLedgers().length > 0 ? (
                    getFilteredLedgers().map((ledger, idx) => {
                      const isManualEntry = ledger.itemMode === 'manual' || 
                                            ledger.itemId?.startsWith('manual-') || 
                                            ledger.itemCategory === 'Item Manual (STB)' ||
                                            ledger.itemCategory === 'Item Manual (RMR)';
                      return (
                        <tr key={ledger.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent page-break-inside-avoid">
                          <td className="px-2 py-2 font-mono text-slate-400 text-[9px] border-b border-slate-100">
                            {ledger.date}
                            <div className="font-sans text-[8px] text-indigo-600 font-medium">{ledger.source}</div>
                          </td>
                          <td className="px-2 py-2 text-slate-900 font-bold border-b border-slate-100 max-w-xs">{ledger.itemName}</td>
                          <td className="px-2 py-2 border-b border-slate-100">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              isManualEntry ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isManualEntry ? '✏️ Manual' : '📦 Stok'}
                            </span>
                          </td>
                          <td className="px-2 py-2 border-b border-slate-100">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              ledger.type === 'Inflow' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {ledger.type === 'Inflow' ? `+${ledger.qty}` : `-${ledger.qty}`}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right border-b border-slate-100 font-mono text-slate-900">
                            {isManualEntry ? '-' : `${ledger.remainingStock} ${ledger.unit || 'Unit'}`}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-2 py-8 text-center text-slate-400">
                        Tidak ada log aliran material yang terekam dalam periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Penandatangan Report */}
            <div className="pt-8 flex justify-end print:pt-4">
              <div className="text-center w-64">
                <p className="text-[10px] text-slate-500">Penanggung Jawab Logistik,</p>
                <div className="h-16"></div>
                <p className="text-[10px] font-bold text-slate-900 border-b border-slate-900 pb-0.5">{signerName || 'Gudang Logistik'}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">{signerTitle || 'Kepala Logistik'}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL PENYESUAIAN STOK */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title="Form Penyesuaian / Koreksi Stok (Stock Adjustment)"
        maxWidth="max-w-2xl"
      >
        <p className="text-[10px] text-slate-400 font-sans -mt-2 mb-4">
          Sesuaikan sisa stok material barang secara bebas untuk koreksi fisik (Stock Opname) atau selisih audit.
        </p>

        <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs font-sans text-left font-bold text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pilih Barang */}
            <div className="md:col-span-2">
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Material Barang:</label>
              <select
                value={adjItemId}
                onChange={(e) => {
                  setAdjItemId(e.target.value);
                  const selected = itemsList.find(i => i.id === e.target.value);
                  if (selected) {
                    setAdjQty(0);
                    setAdjPhysicalQty(selected.stock);
                  }
                }}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-bold font-sans border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              >
                {itemsList.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.code || 'TANPA KODE'}] {item.name} - Stok Saat Ini: {item.stock} {item.unit} ({item.location})
                  </option>
                ))}
              </select>
            </div>

            {/* Panel Detail Singkat Barang Terpilih */}
            {adjItemId && (
              <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap gap-4 text-[11px] font-medium text-slate-600">
                {(() => {
                  const selected = itemsList.find(i => i.id === adjItemId);
                  if (!selected) return null;
                  return (
                    <>
                      <div>Kategori: <span className="font-bold text-slate-900">{selected.category}</span></div>
                      <div>Gudang: <span className="font-bold text-slate-900">{selected.location}</span></div>
                      <div>Stok Komputer: <span className="font-bold text-slate-900 font-mono text-xs">{selected.stock} {selected.unit}</span></div>
                      <div>Harga Pokok: <span className="font-bold text-slate-900">{formatIDR(selected.price || 0)}</span></div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Jenis Penyesuaian */}
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Sifat Penyesuaian:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjType('Inflow')}
                  className={`py-2 px-1 rounded-xl text-center font-bold text-[10px] cursor-pointer border transition-all ${
                    adjType === 'Inflow'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-350 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ➕ Penambahan
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('Outflow')}
                  className={`py-2 px-1 rounded-xl text-center font-bold text-[10px] cursor-pointer border transition-all ${
                    adjType === 'Outflow'
                      ? 'bg-rose-50 text-rose-800 border-rose-350 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ➖ Pengurangan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjType('Correction');
                    const selected = itemsList.find(i => i.id === adjItemId);
                    if (selected) {
                      setAdjPhysicalQty(selected.stock);
                    }
                  }}
                  className={`py-2 px-1 rounded-xl text-center font-bold text-[10px] cursor-pointer border transition-all ${
                    adjType === 'Correction'
                      ? 'bg-amber-55 bg-amber-50 text-amber-800 border-amber-350 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ⚖️ Set Stok Fisik
                </button>
              </div>
            </div>

            {/* Tanggal Penyesuaian */}
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Audit:</label>
              <input
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-2.5 text-xs font-bold font-sans border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>

            {/* Input Nilai */}
            {adjType !== 'Correction' ? (
              <div className="md:col-span-2">
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kuantitas Penyesuaian ({adjType === 'Inflow' ? 'Tambah' : 'Kurang'}):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={adjQty || ''}
                    onChange={(e) => setAdjQty(Number(e.target.value))}
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-bold text-slate-900 border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                    placeholder="Contoh: 10"
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold">
                    {itemsList.find(i => i.id === adjItemId)?.unit || 'Unit'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Target Jumlah Fisik Sebenarnya:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={adjPhysicalQty === 0 && adjPhysicalQty !== null ? '0' : adjPhysicalQty || ''}
                    onChange={(e) => setAdjPhysicalQty(Number(e.target.value))}
                    className="w-full bg-[#f1f5f9] text-amber-900 rounded-xl p-3 text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Masukkan sisa stok nyata di rak/gudang"
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold">
                    {itemsList.find(i => i.id === adjItemId)?.unit || 'Unit'}
                  </span>
                </div>
                <p className="text-[10px] text-amber-700 font-medium mt-1">
                  Sistem otomatis menghitung selisih dan mencatat jenis aliran (Inflow/Outflow) sesuai sisa stok fisik di atas.
                </p>
              </div>
            )}

            {/* Catatan / Alasan Penyesuaian */}
            <div className="md:col-span-2">
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alasan / Catatan Penyesuaian:</label>
              <textarea
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Misal: Selisih stock opname Juni, Koreksi kemasukan air, Rusak di jalan..."
                rows={3}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-medium font-sans border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-150">
            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-5 py-3 font-semibold transition cursor-pointer border-none"
            >
              Batalkan
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl px-6 py-3 font-bold transition shadow-md shadow-amber-500/20 cursor-pointer border-none"
            >
              Simpan Penyesuaian
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL TUTUP BUKU */}
      <Modal
        isOpen={isClosePeriodModalOpen}
        onClose={() => setIsClosePeriodModalOpen(false)}
        title="Form Penutupan Buku Periode (Period Closing)"
        maxWidth="max-w-2xl"
      >
        <p className="text-[10px] text-slate-400 font-sans -mt-2 mb-4">
          Tutup buku periode menstabilkan saldo stok akhir dan menyegel audit. Ini adalah tindakan pencatatan historis logistik resmi.
        </p>

        <form onSubmit={handleSaveClosePeriod} className="space-y-5 text-xs font-sans text-left font-bold text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama / Label Periode:</label>
              <input
                type="text"
                placeholder="Contoh: Juni 2026"
                value={closePeriodName}
                onChange={(e) => setClosePeriodName(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Tutup Buku:</label>
              <input
                type="date"
                value={closePeriodDate}
                onChange={(e) => setClosePeriodDate(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-bold border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Catatan / Deklarasi Penutupan:</label>
              <textarea
                value={closePeriodNotes}
                onChange={(e) => setClosePeriodNotes(e.target.value)}
                placeholder="Misal: Penutupan buku tengah tahun berjalan lancar, semua stok fisik disinkronkan..."
                rows={2}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-xs font-medium font-sans border-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          {/* Quick Metrics for the period */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-[11px] font-medium text-slate-600">
            <span className="font-bold text-slate-800 text-xs block mb-1">Informasi Konsolidasi Stok Saat Ini:</span>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>Total Varian Material: <span className="font-bold text-slate-900">{itemsList.length} Barang</span></div>
              <div>Total Stok Unit: <span className="font-bold text-slate-900">{itemsList.reduce((acc, i) => acc + i.stock, 0)} Pcs/Unit</span></div>
              <div>Nilai Investasi Stok: <span className="font-bold text-emerald-700">{formatIDR(itemsList.reduce((acc, i) => acc + ((i.price || 0) * i.stock), 0))}</span></div>
              <div>Tanggal Konsolidasi: <span className="font-bold text-slate-900">{closePeriodDate}</span></div>
            </div>
          </div>

          {/* Table history of previous tutup buku logs */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 block">Riwayat Penutupan Buku Terakhir:</span>
            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-40 overflow-y-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-500 font-mono text-[9px] uppercase">
                    <th className="px-3 py-2 w-32 border-b border-slate-200">Nama Periode</th>
                    <th className="px-3 py-2 border-b border-slate-200">Tanggal Selesai</th>
                    <th className="px-3 py-2 border-b border-slate-200">Petugas</th>
                    <th className="px-3 py-2 border-b border-slate-200 text-right">Konsolidasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbState.closedPeriods && dbState.closedPeriods.length > 0 ? (
                    dbState.closedPeriods.map((cp) => (
                      <tr key={cp.id} className="hover:bg-slate-50 text-slate-700 font-medium">
                        <td className="px-3 py-2 font-bold text-slate-900 border-none flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{cp.periodName}</span>
                        </td>
                        <td className="px-3 py-2 border-none">{cp.closingDate}</td>
                        <td className="px-3 py-2 border-none capitalize">{cp.closedBy || 'super_admin'}</td>
                        <td className="px-3 py-2 text-right border-none font-bold text-indigo-700">{cp.totalItems || 0} Barang</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-400 font-medium">
                        Belum ada riwayat penutupan buku sebelumnya.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-150">
            <button
              type="button"
              onClick={() => setIsClosePeriodModalOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-5 py-3 font-semibold transition cursor-pointer border-none"
            >
              Batalkan
            </button>
            <button
              type="submit"
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl px-6 py-3 font-bold transition shadow-md shadow-indigo-500/20 cursor-pointer border-none"
            >
              Lakukan Tutup Buku
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL PILIH JENIS LAPORAN */}
      <Modal
        isOpen={isReportSelectorModalOpen}
        onClose={() => setIsReportSelectorModalOpen(false)}
        title="Pusat Laporan & Rekapitulasi Logistik"
        maxWidth="max-w-xl"
      >
        <p className="text-[10px] text-slate-400 font-sans -mt-2 mb-4">
          Silakan pilih jenis dokumen laporan logistik pasca-audit yang ingin Anda buat, pratinjau, atau unduh sebagai PDF.
        </p>

        <div className="space-y-3 font-sans">
          {/* OPSI 1: LAPORAN STOK */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition duration-200 cursor-pointer"
            onClick={() => {
              setIsReportSelectorModalOpen(false);
              setIsPrintReportModalOpen(true);
            }}
          >
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <Package className="w-5 h-5 font-bold" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-slate-900 text-sm">Laporan Rekapitulasi Stok (Stok & Nilai Aset)</h4>
              <p className="text-[10px] text-slate-500 mt-1">
                Laporan menyeluruh barang di gudang utama, nilai beli per item, perbandingan stok awal, masuk, keluar, sisa stok, beserta estimasi total investasi inventaris.
              </p>
            </div>
            <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg font-bold">A4 Ready</span>
          </div>

          {/* OPSI 2: LAPORAN PENYESUAIAN STOK */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 transition duration-200 cursor-pointer"
            onClick={() => {
              setIsReportSelectorModalOpen(false);
              setIsPrintAdjustmentReportModalOpen(true);
            }}
          >
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
              <Sliders className="w-5 h-5 font-bold" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-slate-900 text-sm">Laporan Penyesuaian Stok (Manual Audit & Koreksi)</h4>
              <p className="text-[10px] text-slate-500 mt-1">
                Rekap log koreksi deviasi stok berdasarkan audit fisik (Stock Opname) berkala, dilengkapi dengan rincian aliran barang keluar/masuk, alasan penyesuaian, dan tanda tangan petugas.
              </p>
            </div>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg font-bold">PDF Ready</span>
          </div>

          {/* OPSI 3: LAPORAN TUTUP BUKU */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-205 hover:border-indigo-400 hover:bg-indigo-50/20 transition duration-200 cursor-pointer"
            onClick={() => {
              setIsReportSelectorModalOpen(false);
              setIsPrintClosePeriodReportModalOpen(true);
            }}
          >
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <Lock className="w-5 h-5 font-bold" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-slate-900 text-sm">Laporan Riwayat Tutup Buku (Period Closing)</h4>
              <p className="text-[10px] text-slate-500 mt-1">
                Bukti konsolidasi penutupan periode keuangan. Menyimpan dokumentasi resmi varian barang terhitung, tanggal kunci data, dan catatan persetujuan manajerial.
              </p>
            </div>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg font-bold">Histori</span>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-slate-150 flex justify-end">
          <button
            type="button"
            onClick={() => setIsReportSelectorModalOpen(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-5 py-2.5 font-bold text-xs cursor-pointer border-none"
          >
            Tutup Window
          </button>
        </div>
      </Modal>

      {/* POPUP PRINT LAPORAN PENYESUAIAN MODAL (A4 READY) */}
      <Modal
        isOpen={isPrintAdjustmentReportModalOpen}
        onClose={() => setIsPrintAdjustmentReportModalOpen(false)}
        title="Cetak & Unduh Laporan Penyesuaian Stok"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6 text-xs font-sans text-left print:p-0">
          
          {/* Action Row Inside Modal */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden">
            <span className="text-xs font-bold text-slate-800">Tindakan Dokumen Laporan:</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadAdjustmentReportPDF}
                title="Unduh Laporan Penyesuaian PDF"
                className="bg-amber-500 hover:bg-amber-600 text-[#1e293b] font-black transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Cetak via Browser"
                className="bg-indigo-900 hover:bg-indigo-955 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PERIODE SELECTOR */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 print:hidden">
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="text-base">📅</span>
              <h4 className="text-slate-800 text-xs font-semibold uppercase tracking-wider">
                Tentukan Periode Penyesuaian Stok
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Mulai Tanggal
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => updateReportDates(e.target.value, reportEndDate)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] border-none"
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => updateReportDates(reportStartDate, e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] border-none"
                />
              </div>
            </div>
          </div>

          {/* Letterhead & Official A4 Preview Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 print:border-none print:p-0 space-y-6">
            
            {/* Kop Surat */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-sans tracking-tight uppercase">
                  {dbState.settings?.companyName || 'Dutasari ERP'}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-sm whitespace-pre-line">
                  {dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[9px] bg-amber-500 text-[#1e293b] px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  LAPORAN PENYESUAIAN STOK
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-2 bg-slate-50 border border-slate-100 rounded-xl print:bg-transparent print:border-none">
              <h3 className="text-sm text-slate-955 font-bold uppercase tracking-wider">
                BUKTI REKAPITULASI STOCK OPNAME / PENYESUAIAN STOK
              </h3>
              <p className="font-mono text-[9px] text-slate-500 mt-0.5">DICETAK OLEH SISTEM: AUDIT TRAIL LOGISTICS ERP</p>
            </div>

            {/* Metadata Ringkas */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border border-slate-100 print:border-slate-300 p-3 rounded-xl">
              <div>
                <table className="w-full text-slate-600 font-sans">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-24">Klasifikasi:</td>
                      <td className="py-0.5 text-slate-900">Audit Koreksi Sisa Fisik</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Sifat Laporan:</td>
                      <td className="py-0.5 text-slate-900">Pencocokan Deviasi (Stock Opname)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="w-full text-slate-600 font-sans">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-32">Periode Filter:</td>
                      <td className="py-0.5 text-slate-900">
                        {reportStartDate ? new Date(reportStartDate).toLocaleDateString('id-ID') : 'Mulai'} s.d. {reportEndDate ? new Date(reportEndDate).toLocaleDateString('id-ID') : 'Akhir'}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Total Penyesuaian:</td>
                      <td className="py-0.5 text-[#d97706] font-bold">{getFilteredAdjustments().length} Log Terdeteksi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabular Data Preview */}
            <div className="overflow-x-auto print:overflow-visible font-sans">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-500 font-bold font-mono uppercase">
                    <th className="px-2 py-2 w-28">Tanggal Audit</th>
                    <th className="px-2 py-2">Nama Material / Barang</th>
                    <th className="px-2 py-2 w-28">Kategori</th>
                    <th className="px-2 py-2 w-24">Aliran Sifat</th>
                    <th className="px-2 py-2 text-right w-24">Keterangan/Qty</th>
                    <th className="px-2 py-2 max-w-xs">Alasan Penyesuaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {getFilteredAdjustments().length > 0 ? (
                    getFilteredAdjustments().map((lg, idx) => {
                      const isWordInflow = lg.type === 'Inflow';
                      return (
                        <tr key={lg.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent page-break-inside-avoid">
                          <td className="px-2 py-2 font-mono text-slate-400 text-[9px] border-b border-slate-100">{lg.date}</td>
                          <td className="px-2 py-2 text-slate-900 font-bold border-b border-slate-100">{lg.itemName}</td>
                          <td className="px-2 py-2 text-slate-400 border-b border-slate-100">{lg.itemCategory || '-'}</td>
                          <td className="px-2 py-2 border-b border-slate-100">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              isWordInflow ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {isWordInflow ? '➕ Inflow' : '➖ Outflow'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right border-b border-slate-100 font-bold font-mono text-amber-600">
                            {lg.qty} {lg.unit || 'Unit'}
                          </td>
                          <td className="px-2 py-2 border-b border-slate-100 text-slate-500 italic text-[9.5px]">
                            {(lg.source || '').replace('Penyesuaian: ', '')}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-2 py-8 text-center text-slate-400">
                        Tidak ada log penyesuaian stok yang terekam dalam rentang tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Penandatangan Report */}
            <div className="pt-8 flex justify-between print:pt-4">
              <div className="text-center w-64">
                <p className="text-[10px] text-slate-500">Audit Gudang Oleh,</p>
                <div className="h-16"></div>
                <p className="text-[10px] font-bold text-slate-900 border-b border-slate-900 pb-0.5">{signerName || 'Staff Logistik'}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">{signerTitle || 'Kepala Logistik'}</p>
              </div>
              <div className="text-center w-64">
                <p className="text-[10px] text-slate-500">Disetujui Manajer,</p>
                <div className="h-16"></div>
                <p className="text-[10px] font-bold text-slate-900 border-b border-slate-900 pb-0.5">Manager Operasional</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">{dbState.settings?.companyName || 'Dutasari ERP'}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* POPUP PRINT LAPORAN TUTUP BUKU MODAL (A4 READY) */}
      <Modal
        isOpen={isPrintClosePeriodReportModalOpen}
        onClose={() => setIsPrintClosePeriodReportModalOpen(false)}
        title="Cetak & Unduh Laporan Tutup Buku"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6 text-xs font-sans text-left print:p-0">
          
          {/* Action Row Inside Modal */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden">
            <span className="text-xs font-bold text-slate-800">Tindakan Dokumen Laporan:</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadClosePeriodReportPDF}
                title="Unduh Laporan Tutup Buku PDF"
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-black transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Cetak via Browser"
                className="bg-indigo-900 hover:bg-indigo-955 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm w-10 h-10 rounded-xl flex items-center justify-center border-none"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PERIODE SELECTOR */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 print:hidden">
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="text-base">📅</span>
              <h4 className="text-slate-800 text-xs font-semibold uppercase tracking-wider font-sans">
                Filter Tanggal Histori Tutup Buku
              </h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Mulai Tanggal
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => updateReportDates(e.target.value, reportEndDate)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] border-none"
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => updateReportDates(reportStartDate, e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] border-none"
                />
              </div>
            </div>
          </div>

          {/* Letterhead & Official A4 Preview Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 print:border-none print:p-0 space-y-6">
            
            {/* Kop Surat */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-sans tracking-tight uppercase">
                  {dbState.settings?.companyName || 'Dutasari ERP'}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-sm whitespace-pre-line">
                  {dbState.settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[9px] bg-[#4f46e5] text-white px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  LAPORAN TUTUP BUKU
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center py-2 bg-slate-50 border border-slate-100 rounded-xl print:bg-transparent print:border-none">
              <h3 className="text-sm text-slate-955 font-bold uppercase tracking-wider">
                HISTORI DAN REKAPITULASI PENUTUPAN BUKU PERIODE
              </h3>
              <p className="font-mono text-[9px] text-slate-500 mt-0.5">DICETAK OLEH SISTEM: FINANCIAL PERIOD CONSOLIDATION LOGS</p>
            </div>

            {/* Metadata Ringkas */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border border-slate-100 print:border-slate-300 p-3 rounded-xl col-span-2">
              <div>
                <table className="w-full text-slate-600 font-sans">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-24">Klasifikasi:</td>
                      <td className="py-0.5 text-slate-900">Saldo Penyegelan Akhir</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Sifat Laporan:</td>
                      <td className="py-0.5 text-slate-900">Saksi Kualitatif Penutupan Periode</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="w-full text-slate-600 font-sans">
                  <tbody>
                    <tr>
                      <td className="font-bold py-0.5 w-32">Filter Periode:</td>
                      <td className="py-0.5 text-slate-900">
                        {reportStartDate ? new Date(reportStartDate).toLocaleDateString('id-ID') : 'Mulai'} s.d. {reportEndDate ? new Date(reportEndDate).toLocaleDateString('id-ID') : 'Akhir'}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Jumlah Periode:</td>
                      <td className="py-0.5 text-[#4f46e5] font-bold">{getFilteredClosedPeriods().length} Tutup Buku Terdeteksi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabular Data Preview */}
            <div className="overflow-x-auto print:overflow-visible font-sans">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-slate-500 font-bold font-mono uppercase">
                    <th className="px-2 py-2 w-32">ID Tutup Buku</th>
                    <th className="px-2 py-2">Nama / Label Periode</th>
                    <th className="px-2 py-2 w-28">Tanggal Penyegelan</th>
                    <th className="px-2 py-2 w-24">Penyegel (Oleh)</th>
                    <th className="px-2 py-2 text-right w-32">Varian Terkonsolidasi</th>
                    <th className="px-2 py-2 max-w-xs">Deklarasi Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {getFilteredClosedPeriods().length > 0 ? (
                    getFilteredClosedPeriods().map((cp, idx) => (
                      <tr key={cp.id || idx} className="hover:bg-slate-50 print:hover:bg-transparent page-break-inside-avoid">
                        <td className="px-2 py-2 font-mono text-slate-400 text-[9px] border-b border-slate-100">{cp.id}</td>
                        <td className="px-2 py-2 text-slate-900 font-bold border-b border-slate-100">{cp.periodName}</td>
                        <td className="px-2 py-2 font-mono text-slate-600 border-b border-slate-100">{cp.closingDate}</td>
                        <td className="px-2 py-2 border-b border-slate-100 shrink-0 text-slate-600 font-semibold uppercase">{cp.closedBy || 'super_admin'}</td>
                        <td className="px-2 py-2 text-right border-b border-slate-100 font-bold text-indigo-700">
                          {cp.totalItems || 0} Material Barang
                        </td>
                        <td className="px-2 py-2 border-b border-slate-100 text-slate-505 italic">
                          {cp.notes || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-2 py-8 text-center text-slate-400">
                        Tidak ada histori penutupan buku dalam periode saringan saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Penandatangan Report */}
            <div className="pt-8 flex justify-between print:pt-4">
              <div className="text-center w-64 font-sans">
                <p className="text-[10px] text-slate-500">Divalidasi Oleh,</p>
                <div className="h-16"></div>
                <p className="text-[10px] font-bold text-slate-900 border-b border-slate-900 pb-0.5">{signerName || 'Staff Logistik'}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">{signerTitle || 'Kepala Logistik'}</p>
              </div>
              <div className="text-center w-64 font-sans">
                <p className="text-[10px] text-slate-500">Disetujui Manajer,</p>
                <div className="h-16"></div>
                <p className="text-[10px] font-bold text-slate-900 border-b border-slate-900 pb-0.5 font-sans">Direktur Keuangan</p>
                <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-widest">{dbState.settings?.companyName || 'Dutasari ERP'}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};
