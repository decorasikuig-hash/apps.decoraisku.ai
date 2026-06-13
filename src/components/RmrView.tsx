import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit, Search, FileText, Check, X, MoreHorizontal, Eye, Printer, CheckCircle, XCircle, Users, Barcode, ChevronRight, AlertTriangle, ScanBarcode, Save } from 'lucide-react';
import { DBState, MaterialRequest, RmrItem, Employee, InventoryItem, Supplier } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { Modal } from './Modal';
import { BarcodeScanner } from './BarcodeScanner';
import { PrintPdfModal } from './PrintPdfModal';

interface RmrViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
}

export const RmrView: React.FC<RmrViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Lists
  const rmrList = dbState.materialRequests || [];
  const employees = dbState.employees || [];
  const inventory = dbState.inventory || [];

  // Modals & Action States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedRmr, setSelectedRmr] = useState<MaterialRequest | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form States
  const [formCode, setFormCode] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [giverName, setGiverName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [formItems, setFormItems] = useState<RmrItem[]>([]);
  const [searchInventoryTerm, setSearchInventoryTerm] = useState<Record<string, string>>({}); // track search text per row
  const [openSearchId, setOpenSearchId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [scannerRowIdx, setScannerRowIdx] = useState<string | null>(null);
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierContactPerson, setNewSupplierContactPerson] = useState('');

  const handleSaveNewSupplier = () => {
    if (!newSupplierName.trim()) {
      showToast('Mohon masukkan nama supplier!', 'error');
      return;
    }
    const newSupplier: Supplier = {
      id: `spl-${Date.now()}`,
      code: `SPL-${Date.now().toString().slice(-4)}`,
      name: newSupplierName,
      phone: newSupplierPhone || '-',
      contactPerson: newSupplierContactPerson || '-',
      address: '-',
    };
    saveCollection('suppliers', [...(dbState.suppliers || []), newSupplier]);
    setSupplierName(newSupplierName);
    setIsAddSupplierModalOpen(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierContactPerson('');
    showToast(`Supplier ${newSupplierName} berhasil ditambahkan!`, 'success');
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
      setOpenSearchId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Set default Giver name based on session
  useEffect(() => {
    const userRoleLabel = currentUserRole.toUpperCase().replace('_', ' ');
    setGiverName(`STAF ${userRoleLabel}`);
  }, [currentUserRole]);

  // Generate unique sequential document code
  const generateRmrCode = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RMR-${dateStr}-`;
    const todayRequests = rmrList.filter(r => r.code?.startsWith(prefix));
    const nextSeq = String(todayRequests.length + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  };

  const formatNumberWithDots = (num: number | string) => {
    if (num === undefined || num === null || num === '') return '';
    const numStr = String(num).replace(/\./g, ''); // remove any existing dots
    if (isNaN(Number(numStr))) return '';
    return Number(numStr).toLocaleString('id-ID'); // format with dots
  };

  const parseDotsToNumber = (str: string): number => {
    const cleaned = str.replace(/\./g, '').replace(/,/g, '');
    return cleaned === '' ? 0 : Number(cleaned) || 0;
  };

  const handleOpenNewForm = () => {
    setEditingId(null);
    setFormCode(generateRmrCode());
    setRequesterName('');
    setProjectName('');
    setSupplierName('');
    
    // Default 1 blank manual item
    setFormItems([{
      id: `item-${Date.now()}-0`,
      source: 'stok',
      name: '',
      qty: 1,
      unit: 'Pcs',
      price: 0,
      subTotal: 0,
      notes: ''
    }]);
    setSearchInventoryTerm({});
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (rmr: MaterialRequest) => {
    let targetRmr = rmr;
    if (rmr.status === 'Approved') {
      handleChangeStatus(rmr.id, 'Pending');
      targetRmr = { ...rmr, status: 'Pending' };
    }
    setEditingId(targetRmr.id);
    setFormCode(targetRmr.code);
    setRequesterName(targetRmr.requesterName);
    setGiverName(targetRmr.giverName || 'Pemberi Sistem');
    setProjectName(targetRmr.projectName);
    setSupplierName(targetRmr.supplierName || '');
    
    if (targetRmr.items && targetRmr.items.length > 0) {
      setFormItems([...targetRmr.items]);
    } else {
      // Fallback parse if only string exist
      setFormItems([{
        id: `item-${Date.now()}`,
        source: 'manual',
        name: rmr.itemsList || '',
        qty: 1,
        unit: 'Pcs',
        price: rmr.totalAmount || 0,
        subTotal: rmr.totalAmount || 0,
        notes: ''
      }]);
    }
    
    setIsFormOpen(true);
  };

  // Repeater form handlers
  const handleAddItemRow = () => {
    const newId = `item-${Date.now()}-${formItems.length}`;
    setFormItems(prev => [
      ...prev,
      {
        id: newId,
        source: 'stok',
        name: '',
        qty: 1,
        unit: 'Pcs',
        price: 0,
        subTotal: 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    if (formItems.length === 1) {
      showToast('Minimal harus ada 1 item barang yang diminta!', 'error');
      return;
    }
    setFormItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItemField = (rowId: string, updates: Partial<RmrItem>) => {
    setFormItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      
      const updated = { ...item, ...updates };
      
      // Auto compute subtotal
      if ('qty' in updates || 'price' in updates) {
        updated.subTotal = (updated.qty || 0) * (updated.price || 0);
      }
      
      return updated;
    }));
  };

  const handleSelectInventoryItem = (rowId: string, invItem: InventoryItem) => {
    setFormItems(prev => prev.map(item => {
      if (item.id !== rowId) return item;
      return {
        ...item,
        itemId: invItem.id,
        name: invItem.name,
        unit: invItem.unit || 'Pcs',
        price: invItem.price || 0,
        subTotal: (item.qty || 1) * (invItem.price || 0)
      };
    }));
    // Clear search term
    setSearchInventoryTerm(prev => ({ ...prev, [rowId]: '' }));
  };

  const calculateGrandTotal = () => {
    return formItems.reduce((acc, item) => acc + (item.subTotal || 0), 0);
  };

  // Automated WhatsApp Fonnte Trigger
  const triggerWhatsappForRmrCreation = async (newRmr: MaterialRequest) => {
    try {
      // Build details text
      const itemsDetailText = newRmr.items?.map((it, idx) => 
        `  ${idx + 1}. [${it.source.toUpperCase()}] ${it.name} - Qty: ${it.qty} ${it.unit} @ Rp ${it.price.toLocaleString('id-ID')} (Sub: Rp ${it.subTotal.toLocaleString('id-ID')})`
      ).join('\n') || `  - ${newRmr.itemsList}`;

      const grandTotalText = `*GRAND TOTAL ESTIMASI:* Rp ${(newRmr.totalAmount || 0).toLocaleString('id-ID')}`;

      const messageText = `NOTIFIKASI PERMINTAAN BAHAN BALU RMR BARU!\n\n` +
                          `No. Dokumen: *${newRmr.code}*\n` +
                          `Sektor Proyek: *${newRmr.projectName}*\n` +
                          `Peminta Lapangan: *${newRmr.requesterName}*\n` +
                          `Pemberi (Otoritas): *${newRmr.giverName || '-'}*\n` +
                          `Tanggal: *${newRmr.date}*\n` +
                          `Status: *DRAFT / PENDING APPROVAL*\n\n` +
                          `*Rincian BoQ Bahan:*\n${itemsDetailText}\n\n` +
                          `${grandTotalText}\n\n` +
                          `Mohon verifikasi & persetujuan segera di sistem ERP LuxeLiving.`;

      // Recipient Groups
      // 1. Peminta (requester)
      const matchedRequester = employees.find(e => e.name === newRmr.requesterName);
      
      // 2. Accounting
      const accountingStaffs = employees.filter(e => e.role && (e.role.toLowerCase().includes('account') || e.role.toLowerCase().includes('keu')));
      
      // 3. Manager/Management
      const managers = employees.filter(e => e.role && (e.role.toLowerCase().includes('manag') || e.role.toLowerCase().includes('pimpin') || e.role.toLowerCase().includes('direks')));
      
      // 4. Super Admin
      const admins = employees.filter(e => e.role && e.role.toLowerCase().includes('admin'));

      // Send to Requester
      if (matchedRequester?.phone) {
        await sendWhatsAppNotification({
          phone: matchedRequester.phone,
          message: messageText,
          recipientName: matchedRequester.name
        });
      }

      // Send to Accounting
      for (const st of accountingStaffs) {
        if (st.phone) {
          await sendWhatsAppNotification({
            phone: st.phone,
            message: messageText,
            recipientName: st.name
          });
        }
      }

      // Send to Managers
      for (const mgr of managers) {
        if (mgr.phone) {
          await sendWhatsAppNotification({
            phone: mgr.phone,
            message: messageText,
            recipientName: mgr.name
          });
        }
      }

      // Send to Super Admin Fallbacks
      if (admins.length > 0) {
        for (const adm of admins) {
          if (adm.phone) {
            await sendWhatsAppNotification({
              phone: adm.phone,
              message: messageText,
              recipientName: adm.name
            });
          }
        }
      } else if (!matchedRequester?.phone && accountingStaffs.length === 0 && managers.length === 0) {
        // Fallback simulate to show beautiful floating notification bubbles
        await sendWhatsAppNotification({
          phone: '081234567890',
          message: messageText,
          recipientName: 'Tim Manajemen Utama'
        });
      }

      showToast(`Notifikasi WA berhasil disebarkan ke tim terkait (Fonnte Gateway)!`, 'info');
    } catch (e) {
      console.error("Gagal mengirim WA RMR Baru:", e);
    }
  };

  const triggerWhatsappForRmrStatusChange = async (rmr: MaterialRequest, newStatus: string) => {
    try {
      const itemsDetailText = rmr.items?.map((it, idx) => 
        `  - ${it.name} (${it.qty} ${it.unit})`
      ).join('\n') || `  - ${rmr.itemsList}`;

      const statusBadge = newStatus === 'Approved' ? '✅ DI-SETUJUI (APPROVED)' : (newStatus === 'Rejected' ? '❌ DI-TOLAK (REJECTED)' : '🔄 DISETEL ULANG KE DRAFT');
      const messageText = `UPDATE STATUS DOKUMEN RMR!\n\n` +
                          `No. Dokumen: *${rmr.code}*\n` +
                          `Sektor Proyek: *${rmr.projectName}*\n` +
                          `Peminta Lapangan: *${rmr.requesterName}*\n` +
                          `Status Terbaru: *${statusBadge}*\n\n` +
                          `*Detail Barang yang Diajukan:*\n${itemsDetailText}\n\n` +
                          `Pihak Berwenang telah memperbarui status berkas ini. Hubungi Administrasi Sourcing jika ada pertanyaan.`;

      // 1. Send warning to requester
      const matchedRequester = employees.find(e => e.name === rmr.requesterName);
      if (matchedRequester?.phone) {
        await sendWhatsAppNotification({
          phone: matchedRequester.phone,
          message: messageText,
          recipientName: matchedRequester.name
        });
      }

      // 2. Also cascade to accounting for immediate order draft creation if approved
      if (newStatus === 'Approved') {
        const accountingStaffs = employees.filter(e => e.role && (e.role.toLowerCase().includes('account') || e.role.toLowerCase().includes('keu')));
        for (const st of accountingStaffs) {
          if (st.phone) {
            await sendWhatsAppNotification({
              phone: st.phone,
              message: messageText,
              recipientName: st.name
            });
          }
        }
      }
    } catch (e) {
      console.error("Gagal mengirim WA RMR status:", e);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!requesterName) {
      showToast('Mohon pilih Nama Peminta dari database Karyawan!', 'error');
      return;
    }
    // projectName is now optional, so remove validation check

    // Validate form items
    const invalidItem = formItems.find(it => !it.name.trim() || it.qty <= 0);
    if (invalidItem) {
      showToast('Pastikan semua item diisi nama barang yang benar dan Qty > 0!', 'error');
      return;
    }

    // Build the itemsList formatted string
    const formattedStringList = formItems.map((it, idx) => 
      `${idx + 1}. [${it.source.toUpperCase()}] ${it.name} - ${it.qty} ${it.unit} @ Rp ${it.price.toLocaleString('id-ID')} (Sub: Rp ${it.subTotal.toLocaleString('id-ID')})`
    ).join('\n');

    const totalCalculated = calculateGrandTotal();

    const newRmr: MaterialRequest = {
      id: editingId || `rmr-${Date.now()}`,
      code: formCode,
      projectName: projectName,
      supplierName: supplierName,
      requesterName: requesterName,
      itemsList: formattedStringList,
      date: new Date().toISOString().slice(0, 10),
      status: editingId ? (rmrList.find(r => r.id === editingId)?.status || 'Pending') : 'Pending',
      giverName: giverName,
      items: formItems,
      totalAmount: totalCalculated
    };

    let updatedList: MaterialRequest[];
    if (editingId) {
      updatedList = rmrList.map(item => item.id === editingId ? newRmr : item);
      showToast(`Permintaan RMR ${formCode} berhasil diperbarui!`, 'success');
    } else {
      updatedList = [newRmr, ...rmrList];
      showToast(`Permintaan RMR ${formCode} berhasil didraft!`, 'success');
      // Trigger live cascade of WA messages on creation
      triggerWhatsappForRmrCreation(newRmr);
    }

    saveCollection('materialRequests', updatedList);
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDeleteRmr = (id: string, code: string) => {
    const target = rmrList.find(r => r.id === id);
    if (target?.status === 'Approved') {
      showToast('Permintaan RMR sudah DI-SETUJUI dan dikunci, tidak bisa dihapus!', 'error');
      return;
    }

    if (window.confirm(`Apakah Anda yakin ingin menghapus data Permintaan RMR [${code}]?`)) {
      const updated = rmrList.filter(item => item.id !== id);
      saveCollection('materialRequests', updated);
      showToast(`Data RMR ${code} berhasil dihapus!`, 'success');
    }
  };

  const handleChangeStatus = (id: string, newStatus: 'Approved' | 'Rejected' | 'Pending') => {
    const rmr = rmrList.find(r => r.id === id);
    if (!rmr) return;

    const oldStatus = rmr.status;
    if (oldStatus === newStatus) return;

    // 1. Stock adjustment on approval transition
    if (newStatus === 'Approved' && oldStatus !== 'Approved') {
      try {
        const itemsToDecrement = rmr.items || [];
        if (Array.isArray(itemsToDecrement)) {
          const invent = dbState.inventory || [];
          const newLedgers: any[] = [];
          const updatedInventory = invent.map(item => {
            const matchedInRmr = itemsToDecrement.find((rItem: any) => 
              rItem.source === 'stok' &&
              ((rItem.itemId && rItem.itemId === item.id) || 
               (!rItem.itemId && rItem.name && rItem.name.toLowerCase() === item.name.toLowerCase()))
            );
            
            if (matchedInRmr) {
              const subQty = Number(matchedInRmr.qty) || 0;
              const newStock = Math.max(0, item.stock - subQty);
              
              newLedgers.push({
                id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                itemId: item.id,
                itemName: item.name,
                itemCategory: item.category,
                type: 'Outflow',
                source: `Approval RMR ${rmr.code}`,
                date: new Date().toISOString().split('T')[0],
                qty: subQty,
                unit: item.unit,
                remainingStock: newStock
              });
              
              return {
                ...item,
                stock: newStock,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
            return item;
          });
          
          Object.assign(dbState, { inventory: updatedInventory });
          saveCollection('inventory', updatedInventory);

          // 1.1 Process manual items ('manual' source)
          const manualRmrItems = itemsToDecrement.filter((rItem: any) => rItem.source !== 'stok');
          manualRmrItems.forEach((rItem: any) => {
            const decQty = Number(rItem.qty) || 0;
            newLedgers.push({
              id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              itemId: rItem.itemId || `manual-rmr-${rItem.id || Math.random().toString(36).substring(2, 9)}`,
              itemName: rItem.name || 'Kebutuhan Manual (RMR)',
              itemCategory: 'Item Manual (RMR)',
              type: 'Inflow',
              source: `Approval RMR ${rmr.code}`,
              date: new Date().toISOString().split('T')[0],
              qty: decQty,
              unit: rItem.unit || 'Pcs',
              remainingStock: 0,
              itemMode: 'manual'
            });
          });
          
          if (newLedgers.length > 0) {
            const updatedStockRange = [...(dbState.stockLedgers || []), ...newLedgers];
            Object.assign(dbState, { stockLedgers: updatedStockRange });
            saveCollection('stockLedgers', updatedStockRange);
          }
          
          showToast('Stok material di gudang berkurang otomatis!', 'success');
        }
      } catch (err) {
        console.error("Gagal update stok pada approval RMR:", err);
      }
    } 
    // 2. Revert stock adjustment if reverting from Approved status
    else if (oldStatus === 'Approved' && (newStatus === 'Rejected' || newStatus === 'Pending')) {
      try {
        const itemsToIncrement = rmr.items || [];
        if (Array.isArray(itemsToIncrement)) {
          const invent = dbState.inventory || [];
          const updatedInventory = invent.map(item => {
            const matchedInRmr = itemsToIncrement.find((rItem: any) => 
              rItem.source === 'stok' &&
              ((rItem.itemId && rItem.itemId === item.id) || 
               (!rItem.itemId && rItem.name && rItem.name.toLowerCase() === item.name.toLowerCase()))
            );
            
            if (matchedInRmr) {
              const addQty = Number(matchedInRmr.qty) || 0;
              return {
                ...item,
                stock: item.stock + addQty,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
            return item;
          });
          
          Object.assign(dbState, { inventory: updatedInventory });
          saveCollection('inventory', updatedInventory);
          
          if (dbState.stockLedgers) {
            const remainingLedgers = dbState.stockLedgers.filter(ldg => ldg.source !== `Approval RMR ${rmr.code}`);
            Object.assign(dbState, { stockLedgers: remainingLedgers });
            saveCollection('stockLedgers', remainingLedgers);
          }
          
          showToast('Stok material di gudang dikembalikan (Revert)!', 'success');
        }
      } catch (err) {
        console.error("Gagal mengembalikan stok RMR:", err);
      }
    }

    const updated = rmrList.map(r => {
      if (r.id === id) {
        const updatedRequest = { ...r, status: newStatus };
        // Trigger status cascade WA notification
        triggerWhatsappForRmrStatusChange(updatedRequest, newStatus);
        return updatedRequest;
      }
      return r;
    });

    Object.assign(dbState, { materialRequests: updated });
    saveCollection('materialRequests', updated);
    showToast(`Status berkas RMR berhasil diubah menjadi ${newStatus.toUpperCase()}`, 'success');
  };

  const handlePrintRmr = (rmr: MaterialRequest) => {
    setSelectedRmr(rmr);
    setIsPrintOpen(true);
  };

  // Filter & Search Logik
  const filteredRmr = rmrList.filter(r => {
    const matchesSearch = 
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.itemsList && r.itemsList.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && r.status === statusFilter;
  });

  const totalItems = filteredRmr.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredRmr.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans uppercase">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Halaman <span className="text-slate-900">{currentPage}</span> dari <span className="text-slate-900">{totalPages}</span>
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
    );
  };

  return (
    <div className="bg-white   -3xl p-6  space-y-6 animate-fadeIn min-h-[calc(100vh-120px)] flex flex-col h-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg tracking-tight tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">
            RMR (Request Material)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Permintaan belanja mandor lapangan dengan persetujuan Direksi.
          </p>
        </div>
        
        <button
          onClick={handleOpenNewForm}
          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          title="Kirim RMR Baru"
        >
          <Plus className="w-5 h-5 font-bold" />
        </button>
      </div>

      {/* FILTER & SEARCH CONTROL BAR */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 border border-slate-100 p-2 rounded-2xl">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari RMR berdasarkan Kode atau Sektor Proyek..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 pl-10 pr-4 py-2 text-xs rounded-xl focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder-slate-400 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white hover:bg-slate-100/50"
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-full items-center w-fit gap-0.5">
          {['all', 'Pending', 'Approved', 'Rejected', 'Purchased'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === status
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'all' ? 'Semua' : status}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN DATA RENDERING GRID/TABLE */}
      <div className="bg-white -2xl   overflow-hidden bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                <th className="px-5 py-4">Kode Dokumen</th>
                <th className="px-5 py-4">Sektor Proyek</th>
                <th className="px-5 py-4">Mandor Peminta</th>
                <th className="px-5 py-4">Verifikator Pemberi</th>
                <th className="px-5 py-4">Jumlah Estimasi</th>
                <th className="px-5 py-4">Tanggal Diajukan</th>
                <th className="px-5 py-4">Status Kontrol</th>
                <th className="px-5 py-4 text-right">Opsi Otoritas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRmr.length > 0 ? (
                filteredRmr.map((rmr) => {
                  const subItemCount = rmr.items?.length || 0;
                  const estimatedTotal = rmr.totalAmount || 0;

                  return (
                    <tr key={rmr.id} className="hover:bg-amber-500 hover:text-slate-950/40 relative">
                      <td className="px-5 py-4 font-mono text-indigo-750 font-black">
                        {rmr.code}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 font-sans">{rmr.projectName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {subItemCount} jenis material di BoQ
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {rmr.requesterName}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-[10.5px]">
                        {rmr.giverName || 'SISTEM ERP'}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">
                        {estimatedTotal > 0 ? `Rp ${estimatedTotal.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-450">
                        {rmr.date}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                          rmr.status === 'Approved' ? 'bg-emerald-50 text-emerald-750 border-emerald-200' :
                          rmr.status === 'Rejected' ? 'bg-rose-50 text-rose-650 border-rose-200' :
                          rmr.status === 'Purchased' ? 'bg-indigo-50 text-indigo-750 border-indigo-200' :
                          'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        }`}>
                          {rmr.status === 'Approved' ? '✅ Approved' :
                           rmr.status === 'Rejected' ? '❌ Rejected' :
                           rmr.status === 'Purchased' ? '🛒 Purchased' :
                           '🕒 Pending'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right relative">
                        {/* TRIPLE DOT OPTION MENU BUTTON */}
                        <div className="inline-block relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === rmr.id ? null : rmr.id);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors border-none cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {/* DROPDOWN POPUP FLOAT OVERLAY */}
                          <AnimatePresence>
                            {activeMenuId === rmr.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="absolute right-0 mt-1 w-44 bg-white z-50 overflow-hidden text-left rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] border-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setSelectedRmr(rmr);
                                    setIsDetailOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-amber-500 hover:text-slate-950 flex items-center gap-2 cursor-pointer border-none"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" /> Detail RMR
                                </button>

                                <button
                                  onClick={() => {
                                    handlePrintRmr(rmr);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-amber-500 hover:text-slate-950 flex items-center gap-2 cursor-pointer border-none"
                                >
                                  <Printer className="w-4 h-4 mr-2" /> Cetak Dokumen
                                </button>

                                 <button
                                   onClick={() => {
                                     handleOpenEditForm(rmr);
                                     setActiveMenuId(null);
                                   }}
                                   className="w-full text-left px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-2 cursor-pointer border-none"
                                 >
                                   <Edit className="w-3.5 h-3.5 text-indigo-500" /> Edit (Ubah)
                                 </button>

                                 {rmr.status !== 'Approved' && (
                                   <button
                                     onClick={() => {
                                       handleDeleteRmr(rmr.id, rmr.code);
                                       setActiveMenuId(null);
                                     }}
                                     className="w-full text-left   text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-none w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"
                                   >
                                     <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Hapus Record
                                   </button>
                                 )}

                                 {rmr.status === 'Approved' && (
                                   <button
                                     onClick={() => {
                                       handleChangeStatus(rmr.id, 'Pending');
                                       setActiveMenuId(null);
                                     }}
                                     className="w-full text-left px-4 py-2 text-[10.5px] font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-1.5 cursor-pointer border-none"
                                   >
                                     <XCircle className="w-3.5 h-3.5 text-amber-500" /> Reset ke Draft (Pending)
                                   </button>
                                 )}

                                 {rmr.status !== 'Approved' && (
                                   <div className="border-t border-slate-100 my-1 pt-1">
                                     <button
                                       onClick={() => {
                                         handleChangeStatus(rmr.id, 'Approved');
                                         setActiveMenuId(null);
                                       }}
                                       className="w-full text-left px-4 py-2 text-[10.5px] font-bold text-emerald-650 hover:bg-emerald-50 flex items-center gap-1.5 cursor-pointer border-none"
                                     >
                                       <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Setujui (Approve)
                                     </button>
                                     <button
                                       onClick={() => {
                                         handleChangeStatus(rmr.id, 'Rejected');
                                         setActiveMenuId(null);
                                       }}
                                       className="w-full text-left   text-[10.5px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer border-none w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"
                                     >
                                       <XCircle className="w-3.5 h-3.5 text-rose-500" /> Tolak (Reject)
                                     </button>
                                   </div>
                                 )}
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
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-450 font-medium">
                    Tidak ditemukan records data Permintaan RMR yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>



      <Modal isOpen={scannerRowIdx !== null} onClose={() => setScannerRowIdx(null)} title="Pindai Barcode Item" maxWidth="max-w-md">
        {scannerRowIdx !== null && (
          <BarcodeScanner 
            onScanSuccess={(inv) => {
              handleSelectInventoryItem(scannerRowIdx, inv);
              setScannerRowIdx(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? `Ubah Berkas RMR - ${formCode}` : `Input Permintaan Bahan Baku (RMR)`}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-6 pt-3">
          
          {/* TOP PRIMARY INFRA FIELDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kode Berkas:</label>
              <input
                type="text"
                readOnly
                value={formCode}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
              />
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                Nama Pengaju Peminta: <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              >
                <option value="">Pilih Karyawan Lapangan...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Otoritas Pemberi (Status):</label>
              <input
                type="text"
                readOnly
                value={giverName}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                Sektor Konstruksi / Proyek:
              </label>
              <input
                type="text"
                placeholder="Contoh: Proyek Desain Interior Apartemen Kemang - Sektor Living Room"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              />
            </div>
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                Nama Supplier:
              </label>
              <select
                value={supplierName === 'ADD_NEW' ? '' : supplierName}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    setIsAddSupplierModalOpen(true);
                  } else {
                    setSupplierName(e.target.value);
                  }
                }}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              >
                <option value="">Pilih Supplier...</option>
                {dbState.suppliers.map(sup => (
                  <option key={sup.id} value={sup.name}>
                    {sup.name}
                  </option>
                ))}
                <option value="ADD_NEW" className="font-bold text-indigo-600"> + Tambah Supplier Baru...</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC MULTI-ITEM / REPEATER FORM COMPONENT */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider font-mono">
                Repeater Baris Material BoQ
              </span>
            </div>

            <div className={`p-4 md:divide-y md:divide-slate-100 space-y-1 ${
              formItems.length > 2 ? 'max-h-[350px] overflow-y-auto' : 'overflow-visible'
            }`}>
              {/* Desktop and Tablet unified headers - rendered only ONCE */}
              {formItems.length > 0 && (
                <div className="hidden md:grid grid-cols-12 gap-3 pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans text-center border-b border-slate-150">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2 text-left">Metode Input</div>
                  <div className="col-span-4 text-left">Cari / Nama Barang</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-1">Satuan</div>
                  <div className="col-span-1">Harga Satuan</div>
                  <div className="col-span-1">Subtotal</div>
                  <div className="col-span-1 text-right">Aksi</div>
                </div>
              )}
              {formItems.map((item, index) => {
                const searchTxt = searchInventoryTerm[item.id] || '';
                
                // Filter out items that are already selected in other rows
                const selectedItemIds = formItems
                  .filter(fi => fi.source === 'stok' && fi.itemId && fi.id !== item.id)
                  .map(fi => fi.itemId);

                // Show ALL inventory items on select focus, or filter if typed (exclude items with zero/negative stock & already selected)
                const matchingInventory = inventory.filter(inv => {
                  if (inv.stock <= 0) return false;
                  if (selectedItemIds.includes(inv.id)) return false;
                  if (!searchTxt.trim()) return true;
                  const term = searchTxt.toLowerCase();
                  return (
                    inv.name.toLowerCase().includes(term) ||
                    inv.code.toLowerCase().includes(term)
                  );
                });

                // Direct highlights matching characters
                const highlightText = (text: string, search: string) => {
                  if (!search.trim()) return <span>{text}</span>;
                  const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
                  const parts = text.split(regex);
                  return (
                    <span>
                      {parts.map((part, i) => 
                        regex.test(part) ? (
                          <mark key={i} className="bg-amber-250 text-slate-900 font-extrabold px-0.5 rounded">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      )}
                    </span>
                  );
                };

                return (
                  <div key={item.id} className={`py-4 md:py-2.5 first:pt-4 md:first:pt-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:items-center bg-white md:bg-transparent rounded-xl md:rounded-none border border-slate-200 md:border-transparent shadow-sm md:shadow-none p-4 md:p-0 my-3 md:my-0 relative ${
                    openSearchId === item.id ? 'z-[110]' : 'z-10'
                  }`}>
                    {/* ID Index */}
                    <div className="md:col-span-1 text-center font-bold text-slate-400 font-mono text-[10px]">
                      #{index + 1}
                    </div>

                    {/* SOURCE SWITCH: AMBIL STOK vs KETIK MANUAL */}
                    <div className="md:col-span-2">
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block md:hidden">Metode Input</label>
                      <button
                        type="button"
                        onClick={() => {
                          const targetType = item.source === 'stok' ? 'manual' : 'stok';
                          handleUpdateItemField(item.id, { 
                            source: targetType, 
                            name: '', 
                            price: 0, 
                            subTotal: 0,
                            itemId: undefined 
                          });
                        }}
                        className={`w-full py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          item.source === 'stok' 
                            ? 'bg-emerald-50 border-emerald-200/50 text-emerald-800' 
                            : 'bg-amber-50 border-amber-200/50 text-amber-850'
                        }`}
                      >
                        {item.source === 'stok' ? '📦 GUDANG STOK' : '✏️ KETIK MANUAL'}
                      </button>
                    </div>

                    {/* BARANG INPUT SECTION */}
                    <div className="md:col-span-4 relative" onClick={(e) => e.stopPropagation()}>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block md:hidden">Cari / Input Material</label>
                      
                      {item.source === 'stok' ? (
                        <>
                          <div className="relative flex items-center gap-2">
                            <div className="relative w-full">
                              <input
                                type="text"
                                required
                                placeholder="Ketik nama atau pindai barcode..."
                                value={item.name || searchTxt}
                                onFocus={() => setOpenSearchId(item.id)}
                                onChange={(e) => {
                                  handleUpdateItemField(item.id, { name: '' }); // reset selected
                                  setSearchInventoryTerm(prev => ({ ...prev, [item.id]: e.target.value }));
                                  setOpenSearchId(item.id);
                                }}
                                className="w-full bg-slate-50 border border-slate-300 px-3 py-2 text-xs rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                              />
                              {item.name ? (
                                <span className="absolute right-2.5 top-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Item Terkoneksi Database Stok" />
                              ) : (
                                <span className="absolute right-2.5 top-2.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Pilih Barang" />
                              )}
                            </div>
                            <button type="button" onClick={() => setScannerRowIdx(item.id)} className="shrink-0 p-2 md:p-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer" title="Scan Barcode">
                              <ScanBarcode className="w-5 h-5" />
                            </button>
                          </div>

                          {/* DYNAMIC DROPDOWN SEARCH MENU POPUP */}
                          {openSearchId === item.id && matchingInventory.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white    -2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-100 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                              {matchingInventory.map(inv => (
                                <button
                                  key={inv.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectInventoryItem(item.id, inv);
                                    setOpenSearchId(null);
                                  }}
                                  className="w-full text-left p-2.5 px-3.5 text-xs font-semibold hover:bg-amber-500 hover:text-slate-955 text-slate-800 cursor-pointer border-none flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-bold">{highlightText(inv.name, searchTxt)}</div>
                                    <div className="text-xs md:text-[9px] font-mono text-slate-450">{highlightText(inv.code, searchTxt)} - Sisa Stok: {inv.stock} {inv.unit}</div>
                                  </div>
                                  <div className="text-[10px] font-mono font-bold text-indigo-700">Rp {inv.price.toLocaleString('id-ID')}</div>
                                </button>
                              ))}
                            </div>
                          )}

                          {openSearchId === item.id && matchingInventory.length === 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-rose-50 border border-rose-150 p-2 text-[10px] font-semibold text-rose-600 rounded-lg z-50">
                              ⚠️ Tidak ada material stok yang terdaftar ("{searchTxt}")
                            </div>
                          )}
                        </>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder="Ketik deskripsi bahan manual..."
                          value={item.name}
                          onChange={(e) => handleUpdateItemField(item.id, { name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 px-3 p-2 text-xs rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                        />
                      )}
                    </div>

                    {/* QTY INPUT */}
                    <div className="md:col-span-1">
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block md:hidden">Qty</label>
                      <input
                        type="text"
                        required
                        value={item.qty === 0 ? '' : formatNumberWithDots(item.qty)}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          const numericVal = parseDotsToNumber(valStr);
                          handleUpdateItemField(item.id, { qty: numericVal });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItemRow();
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-300 p-2 text-xs rounded-lg font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                      />
                    </div>

                    {/* SATUAN INPUT */}
                    <div className="md:col-span-1">
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block md:hidden">Satuan</label>
                      <input
                        type="text"
                        required
                        placeholder="Pcs"
                        value={item.unit}
                        onChange={(e) => handleUpdateItemField(item.id, { unit: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItemRow();
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-300 p-2 text-xs rounded-lg font-sans font-bold text-slate-800 text-center focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                      />
                    </div>

                    {/* HARGA INPUT */}
                    <div className="md:col-span-1">
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block md:hidden">Harga Satuan</label>
                      <input
                        type="text"
                        required
                        readOnly={item.source === 'stok'}
                        value={item.price === 0 ? '' : formatNumberWithDots(item.price)}
                        onChange={(e) => {
                          const valStr = e.target.value;
                          const numericVal = parseDotsToNumber(valStr);
                          handleUpdateItemField(item.id, { price: numericVal });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItemRow();
                          }
                        }}
                        className={`w-full border p-2 text-xs rounded-lg font-mono font-bold text-slate-800 text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                          item.source === 'stok' 
                            ? 'bg-slate-50 focus:bg-slate-100 transition-colors border-slate-200/60 text-slate-500' 
                            : 'bg-slate-50 border-slate-205 focus:border-indigo-500'
                        }`}
                      />
                    </div>

                    {/* SUB TOTAL */}
                    <div className="md:col-span-1 text-center font-mono text-[11.5px] font-bold text-slate-800">
                      <div className="block md:hidden text-xs md:text-[8px] font-bold text-slate-400 uppercase mb-0.5">SUBTOTAL</div>
                      Rp {item.subTotal.toLocaleString('id-ID')}
                    </div>

                    {/* DELETE ROW BUTTON */}
                    <div className="md:col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(item.id)}
                        className="text-rose-500 hover:text-white hover:bg-rose-600 p-1.5 rounded-lg border-none cursor-pointer transition-colors inline-flex items-center justify-center bg-transparent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* ITEM NOTES / KETERANGAN REMOVED */}
                  </div>
                );
              })}

              {/* PLUS ICON BUTTON - PLACED DIRECTLY UNDER ITEMS LIST */}
              <div className="flex justify-start px-4 pt-5 pb-1 border-t border-slate-100/50">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="flex items-center justify-center bg-[#172554] text-white rounded-full w-10 h-10 hover:bg-[#d97706] hover:text-slate-950 hover:scale-105 transition-all duration-200 shadow-md shadow-blue-950/20 border-none cursor-pointer"
                  title="Tambah Baris Baru"
                >
                  <Plus className="w-5 h-5 font-bold" />
                </button>
              </div>
            </div>

            {/* GRAND TOTAL CASH VALUE CONTAINER */}
            <div className="bg-indigo-950 p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-2 text-white">
              <span className="text-xs font-black uppercase tracking-wider font-mono">
                Grand Total Estimasi Keuangan RMR:
              </span>
              <strong className="text-xl font-mono text-emerald-400 font-extrabold">
                Rp {calculateGrandTotal().toLocaleString('id-ID')}
              </strong>
            </div>
          </div>

          {/* BOTTOM MODAL TRIGGER BUTTONS */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold w-12 h-12 rounded-xl border-none cursor-pointer flex items-center justify-center transition-colors"
              title="Batal"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              type="submit"
              className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-12 h-12 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
              title="Simpan"
            >
              <Save className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

        </form>
      </Modal>

      {/* DETAILED SPECIFICATION POP-UP MODAL (VIEW PORT) */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Dokumen Asli Permintaan RMR - ${selectedRmr?.code}`}
        maxWidth="max-w-3xl"
      >
        {selectedRmr && (
          <div className="space-y-6 pt-3">
            
            {/* Header info badge grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl leading-relaxed text-slate-800">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Kode RMR:</span>
                <strong className="text-xs text-indigo-700 font-mono font-bold">{selectedRmr.code}</strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Diajukan Tanggal:</span>
                <strong className="text-xs font-mono">{selectedRmr.date}</strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Status Berjalan:</span>
                <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase inline-block border ${
                  selectedRmr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  selectedRmr.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                  'bg-amber-50 text-amber-600 border-amber-200'
                }`}>
                  {selectedRmr.status}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Total Nilai Estimasi:</span>
                <strong className="text-xs font-mono text-slate-900 font-bold">
                  Rp {(selectedRmr.totalAmount || 0).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Context details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold block uppercase mb-1">Mandor Proyek Lapangan (Peminta)</span>
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {selectedRmr.requesterName}
                </div>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-bold block uppercase mb-1">Pejabat Verifikasi (Pemberi Otoritas)</span>
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                  {selectedRmr.giverName || 'SISTEM UTAMA ERP'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[9px] text-slate-400 font-black block uppercase mb-1 font-mono">Sektor Penempatan Pekerjaan</span>
              <div className="font-extrabold text-slate-900 text-sm">{selectedRmr.projectName}</div>
            </div>

            {/* Detailed Table list of materials */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 p-3 font-semibold text-[10.5px] uppercase text-slate-700 font-mono tracking-wider">
                Rincian BoQ Spesifikasi Material RMR
              </div>
              
              {selectedRmr.items && selectedRmr.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead>
                      <tr className="bg-slate-100/50 text-[9.5px] text-slate-500 font-bold font-mono border-b border-slate-200 uppercase">
                        <th className="p-3">#</th>
                        <th className="p-3">Nama Material</th>
                        <th className="p-3 text-center">Berasal Dari</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-center">Satuan</th>
                        <th className="p-3 text-right">Harga Satuan</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium whitespace-nowrap">
                      {selectedRmr.items.map((it, idx) => (
                        <tr key={it.id} className="hover:bg-amber-500 hover:text-slate-950/30">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-sans font-bold">
                            <div>{it.name}</div>
                            {it.notes && (
                              <div className="text-[9px] font-medium text-slate-450 italic mt-0.5">Note: {it.notes}</div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${
                              it.source === 'stok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {it.source === 'stok' ? 'Stok Gudang' : 'Ketik Manual'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-900">{it.qty}</td>
                          <td className="p-3 text-center text-slate-500">{it.unit}</td>
                          <td className="p-3 text-right font-mono text-slate-600">Rp {it.price.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">Rp {it.subTotal.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-white font-mono text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {selectedRmr.itemsList}
                </div>
              )}

              <div className="bg-slate-950 p-3.5 px-5 flex justify-between items-center text-white border-t border-slate-200">
                <span className="text-[10px] font-black uppercase font-mono tracking-wider">Total Nilai Buku RMR:</span>
                <strong className="text-base font-mono text-emerald-450 font-extrabold">
                  Rp {(selectedRmr.totalAmount || 0).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* ACTION DIRECT DECISIONS BAR IN DETAILS IF PENDING */}
            {selectedRmr.status === 'Pending' && currentUserRole === 'super_admin' && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-semibold font-sans">
                  Apakah seluruh list bahan BoQ di atas telah sesuai kelayakan? Selesaikan sekarang:
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleChangeStatus(selectedRmr.id, 'Approved');
                      setIsDetailOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Setujui
                  </button>
                  <button
                    onClick={() => {
                      handleChangeStatus(selectedRmr.id, 'Rejected');
                      setIsDetailOpen(false);
                    }}
                    className="p-2 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl cursor-pointer border-none text-xs flex items-center gap-1 shadow shadow-rose-500/10"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak Berkas
                  </button>
                </div>
              </div>
            )}

            {/* Footer triggers */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold px-6 py-2.5 rounded-xl border-none cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" /> Tutup Jendela Detail
              </button>
            </div>

          </div>
        )}
      </Modal>

      <Modal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        title="Tambah Supplier Baru"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-4">
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Supplier:</label>
            <input 
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
            />
          </div>
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Telepon:</label>
            <input 
              type="text"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
            />
          </div>
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kontak Person (CP):</label>
            <input 
              type="text"
              value={newSupplierContactPerson}
              onChange={(e) => setNewSupplierContactPerson(e.target.value)}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
            />
          </div>
          <button
            onClick={handleSaveNewSupplier}
            className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1" /> Simpan Supplier
          </button>
        </div>
      </Modal>

      {/* RMR BIND DRAFT PDF DOCUMENT PRINT PREVIEW MODAL */}
      <PrintPdfModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        type="MaterialRequest"
        data={selectedRmr}
        settings={dbState.settings}
      />

    </div>
  );
};
