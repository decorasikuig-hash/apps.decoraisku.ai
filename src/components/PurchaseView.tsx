/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, FileText, ShoppingBag, Printer, Check, X, Calculator, Receipt, Search, CheckCircle, Smartphone, MoreHorizontal, Package, Database, Paperclip, Eye, Wallet, ScanBarcode, Save, Banknote, Pencil } from 'lucide-react';
import { DBState, PurchaseOrder, PurchaseInvoice, GoodsReceipt, Transaction, BankMutation } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { compressImage } from '../utils/imageCompress';

// Helper functions for Indonesian formatting and 0 elimination
const formatInputValue = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = Number(val);
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('id-ID'); // formats with dots for Indonesian locale
};

const parseInputValue = (val: string): number => {
  // Remove dots/commas format to extract pure digits
  const cleanStr = val.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (!cleanStr) return 0;
  return parseInt(cleanStr, 10);
};

interface PurchaseViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  activeTab: 'po' | 'invoice' | 'receipt';
  triggerPdfPrint: (type: 'MaterialRequest' | 'PurchaseOrder' | 'PurchaseInvoice' | 'GoodsReceipt', data: any) => void;
}

import { Modal } from './Modal';

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  dbState,                
  saveCollection,
  showToast,
  currentUserRole,
  activeTab,
  triggerPdfPrint
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'Semua' | 'Lunas' | 'Hutang' | 'Bayar Sebagian'>('Semua');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannerRowIdx, setScannerRowIdx] = useState<number | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', city: '' });
  const [formData, setFormData] = useState<Record<string, any>>({
    peruntukan: 'Untuk Proyek'
  });
  
  // Body scroll lock with absolute precision
  React.useEffect(() => {
    if (isModalOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isModalOpen]);

  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);

  React.useEffect(() => {
    const handleOutsideClick = () => setActiveDropdownId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';
  const isAccounting = currentUserRole === 'accounting' || isSuperOrAdmin;

  // Base Data arrays
  const poList = dbState.purchaseOrders || [];
  const invoiceList = dbState.purchaseInvoices || [];
  const receiptList = dbState.goodsReceipts || [];

  // Dropdown lists
  const suppliers = dbState.suppliers || [];
  const materialRequests = dbState.materialRequests?.filter(r => r.status === 'Approved') || [];
  const bankAccounts = dbState.bank_accounts || [];

  const formatIDR = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // Indonesian spelling helper for Rp currency values
  function terbilangValue(angka: number): string {
    const bil = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    if (angka < 12) return bil[angka];
    else if (angka < 20) return terbilangValue(angka - 10) + " belas";
    else if (angka < 100) return terbilangValue(Math.floor(angka / 10)) + " puluh " + terbilangValue(angka % 10);
    else if (angka < 200) return "seratus " + terbilangValue(angka - 100);
    else if (angka < 1000) return terbilangValue(Math.floor(angka / 100)) + " ratus " + terbilangValue(angka % 100);
    else if (angka < 2000) return "seribu " + terbilangValue(angka - 1000);
    else if (angka < 1000000) return terbilangValue(Math.floor(angka / 1000)) + " ribu " + terbilangValue(angka % 1000);
    else if (angka < 1000000000) return terbilangValue(Math.floor(angka / 1000000)) + " juta " + terbilangValue(angka % 1000000);
    else return terbilangValue(Math.floor(angka / 1000000000)) + " milyar " + terbilangValue(angka % 1000000000);
  }

  // Indonesian printable Kwitansi states
  const [kwitansiData, setKwitansiData] = useState<any | null>(null);
  const [isKwitansiModalOpen, setIsKwitansiModalOpen] = useState(false);
  
  // Payment History states
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] = useState(false);
  const [paymentHistoryData, setPaymentHistoryData] = useState<any>(null);

  // States for "Bayar Hutang" popup
  const [isPayHutangModalOpen, setIsPayHutangModalOpen] = useState(false);
  const [payHutangData, setPayHutangData] = useState<any>(null);
  const [payHutangForm, setPayHutangForm] = useState({ bayarAmount: 0, bankAccountId: '', dueDate: '' });

  // Find currently selected Supplier or PO bank details for purchase-time display
  const selectedSupplierInPo = suppliers.find(s => s.id === formData.supplierId);
  const selectedPoInInvoice = poList.find(p => p.id === formData.poId);
  const matchedSupplierInInvoice = selectedPoInInvoice 
    ? suppliers.find(s => s.id === selectedPoInInvoice.supplierId || s.name === selectedPoInInvoice.supplierName) 
    : null;

  const inventory = dbState.inventory || [];
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [stockSearchText, setStockSearchText] = useState('');

  // State for Purchase Order Multi-item Repeater
  const [poItems, setPoItems] = useState<Array<{ id: string; description: string; type: 'manual' | 'stock'; qty: number; unit: string; price: number; subtotal: number; itemId?: string }>>([{
    id: `row-${Date.now()}`,
    description: '',
    type: 'manual',
    qty: 0,
    unit: '',
    price: 0,
    subtotal: 0
  }]);

  const addPoRow = () => {
    setPoItems([...poItems, {
      id: `row-${Date.now()}-${Math.random()}`,
      description: '',
      type: 'manual',
      qty: 0,
      unit: '',
      price: 0,
      subtotal: 0
    }]);
    
    // Auto-focus the description input of the newly added row
    setTimeout(() => {
      const inputs = document.querySelectorAll('.po-item-description');
      const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
      if (lastInput) lastInput.focus();
    }, 50);
  };
  
  const updatePoRow = (index: number, field: string, value: any) => {
    const updatedItems = [...poItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-fill logic for stock type
    if (field === 'itemId' && updatedItems[index].type === 'stock') {
      const selectedItem = inventory.find(i => i.id === value);
      if (selectedItem) {
        updatedItems[index].description = selectedItem.name;
        updatedItems[index].unit = selectedItem.unit;
        updatedItems[index].price = selectedItem.price;
      }
    }

    if (field === 'qty' || field === 'price' || field === 'itemId' || true) {
      updatedItems[index].subtotal = (updatedItems[index].qty || 0) * (updatedItems[index].price || 0);
    }
    setPoItems(updatedItems);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    
    const supplierId = `sup-${Date.now()}`;
    const updatedSuppliers = [...suppliers, { id: supplierId, ...newSupplier }];
    saveCollection('suppliers', updatedSuppliers);
    setFormData(prev => ({ ...prev, supplierId }));
    setIsSupplierModalOpen(false);
    setNewSupplier({ name: '', phone: '', city: '' });
    showToast('Supplier baru berhasil terdaftar!');
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressed = await compressImage(file);
        setFormData(prev => ({ 
          ...prev, 
          attachmentName: file.name,
          attachmentData: compressed 
        }));
        showToast('Berkas berhasil dilampirkan & otomatis dikompres!', 'success');
      } catch (err) {
        setFormData(prev => ({ ...prev, attachmentName: file.name }));
        showToast('Berkas berhasil dilampirkan!', 'success');
      }
    }
  };

  // Save PO Order
  const handleSavePo = (e: React.FormEvent, customStatus?: 'Pending' | 'Approved') => {
    e.preventDefault();

    if (!formData.supplierId || poItems.length === 0) {
      showToast('Mohon lengkapi Supplier & Rincian Item material!', 'error');
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === formData.supplierId);
    const supplierNameStr = matchedSupplier ? matchedSupplier.name : 'Supplier Lokal';
    
    // Calculate total amount from all items
    const totalAmount = poItems.reduce((acc, item) => acc + item.subtotal, 0);
    const codeStr = formData.code || `PO-${Math.floor(1000 + Math.random() * 9000)}`;

    const newItem: PurchaseOrder = {
      id: isEditingId || `po-${Date.now()}`,
      code: codeStr,
      supplierId: formData.supplierId,
      supplierName: supplierNameStr,
      itemsList: JSON.stringify(poItems), 
      date: formData.date || new Date().toISOString().split('T')[0],
      totalAmount: totalAmount,
      status: customStatus || formData.status || 'Pending',
    } as any;
    
    const updated = isEditingId 
      ? poList.map(item => item.id === isEditingId ? newItem : item)
      : [...poList, newItem];

    saveCollection('purchaseOrders', updated);
    showToast(`Sukses merekam PO: ${newItem.code} (${newItem.status === 'Approved' ? 'Terkirim via WA' : 'Draft'})`, 'success');
    setIsModalOpen(false);
    
    // Fonnte WA Gateway logic (Backend-like)
    if (newItem.status === 'Approved') {
       const autoOrder = dbState.settings?.whatsappAutoOrder !== false;
       if (autoOrder && matchedSupplier) {
         const template = dbState.settings?.whatsappTemplateOrderPurchase || 'NOTIFIKASI PO: Berkas pesanan baru dengan Kode PO *{order_code}* telah diterbitkan untuk *{supplier_name}* senilai *{order_amount}* pada *{order_date}* silakan segera diproses.';
         const message = template
           .replace(/{supplier_name}/g, matchedSupplier.name)
           .replace(/{order_code}/g, newItem.code)
           .replace(/{order_amount}/g, formatIDR(totalAmount))
           .replace(/{order_date}/g, newItem.date);

         // Save notification
         const newNotif = {
           id: `notif-${Date.now()}`,
           title: `Fonnte WA PO ${newItem.code}`,
           message: `Berhasil mendistribusikan berkas pemesanan SEKTOR KONSTRUKSI / PROYEK untuk ${matchedSupplier.name} via WhatsApp.`,
           type: 'success',
           timestamp: new Date().toISOString(),
           whatsappSent: true,
           whatsappMessage: message
         };
         const updatedNotifs = dbState.notifications ? [newNotif, ...dbState.notifications] : [newNotif];
         saveCollection('notifications', updatedNotifs);
         showToast('Mengirim notifikasi via Fonnte WA Gateway...', 'success');
       } else {
         showToast('Mengirim notifikasi Fonnte ke Supplier, Admin, Accounting...', 'info');
       }
    }
  };

  // Save Purchase Invoice with custom status & full banking rollback capabilities
  const handleSaveInvoice = (e: React.FormEvent, customStatus?: 'Draft' | 'Unpaid' | 'Paid' | 'Partial') => {
    if (e) e.preventDefault();

    if (!formData.supplierId && !formData.supplierName) {
      showToast('Wajib menunjuk Supplier rekanan!', 'error');
      return;
    }

    const matchedSupplier = suppliers.find(s => s.id === formData.supplierId);
    const supplierNameStr = matchedSupplier ? matchedSupplier.name : (formData.supplierName || 'Supplier Lokal');

    const codeStr = formData.code || `PINV-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Calculating subtotals & options
    const subtotal = poItems.reduce((acc, item) => acc + item.subtotal, 0);
    let totalAmount = subtotal;

    let discountAmt = 0;
    if (formData.isDiscountActive && formData.discountValue) {
      discountAmt = Number(formData.discountValue) || 0;
      totalAmount -= discountAmt;
    }

    let ppnAmt = 0;
    if (formData.isPpnActive) {
      ppnAmt = Math.round(totalAmount * 0.11);
      totalAmount += ppnAmt;
    }

    let ongkirAmt = 0;
    if (formData.isOngkirActive && formData.ongkirValue) {
      ongkirAmt = Number(formData.ongkirValue) || 0;
      totalAmount += ongkirAmt;
    }

    const finalStatus = customStatus || formData.status || 'Draft';

    let paidVal = 0;
    if (finalStatus === 'Paid') {
      paidVal = totalAmount;
    } else if (finalStatus === 'Partial') {
      paidVal = Number(formData.paidAmount) || 0;
      if (paidVal >= totalAmount) {
        showToast('Nilai bayar sebagian tidak boleh melebihi total invoice! Otomatis diset Lunas.', 'info');
        paidVal = totalAmount;
      }
    }

    if ((finalStatus === 'Paid' || finalStatus === 'Partial') && !formData.bankAccountId) {
      showToast('Harap pilih Rekening Bank / Kas sebagai sumber dana!', 'error');
      return;
    }

    let oldInvoice: any = null;
    if (isEditingId) {
      oldInvoice = invoiceList.find(i => i.id === isEditingId);
    }

    let currentMutations = [...(dbState.bank_mutations || [])];
    let currentAccounts = [...(dbState.bank_accounts || [])];

    // ROLLBACK old bank mutation if editing existing invoice
    if (oldInvoice && oldInvoice.bankMutationId) {
      const oldMutation = currentMutations.find(m => m.id === oldInvoice.bankMutationId);
      if (oldMutation) {
        currentMutations = currentMutations.filter(m => m.id !== oldInvoice.bankMutationId);
        currentAccounts = currentAccounts.map(acc => {
          if (acc.id === oldMutation.bank_account_id) {
            return { ...acc, current_balance: acc.current_balance + oldMutation.amount };
          }
          return acc;
        });
      }
    }

    // CREATE new mutation if Paid/Partial
    let newMutationId = undefined;
    let chosenBankName = '';
    if ((finalStatus === 'Paid' || finalStatus === 'Partial') && formData.bankAccountId) {
      const chosenAccount = currentAccounts.find(a => a.id === formData.bankAccountId);
      if (!chosenAccount) {
        showToast('Rekening bank terpilih tidak terdaftar!', 'error');
        return;
      }

      if (chosenAccount.current_balance < paidVal) {
        showToast(`Saldo bank ${chosenAccount.bank_name} tidak mencukupi! Sisa: ${formatIDR(chosenAccount.current_balance)}`, 'error');
        return;
      }

      currentAccounts = currentAccounts.map(acc => {
        if (acc.id === chosenAccount.id) {
          return { ...acc, current_balance: acc.current_balance - paidVal };
        }
        return acc;
      });

      const mutationId = `mut-${Date.now()}`;
      newMutationId = mutationId;
      chosenBankName = `${chosenAccount.bank_name} (${chosenAccount.account_number})`;

      const newMutation: BankMutation = {
        id: mutationId,
        mutation_code: `MUT-OUT-${Math.floor(1000 + Math.random() * 9000)}`,
        bank_account_id: chosenAccount.id,
        type: 'Keluar',
        category: 'Belanja Material Supplier',
        amount: paidVal,
        description: `Pelunasan Invoice Pembelian ${codeStr} kepada ${supplierNameStr}`,
        transaction_date: formData.date || new Date().toISOString().split('T')[0]
      };

      currentMutations.push(newMutation);

      const trx: Transaction = {
        id: `trx-${Date.now()}`,
        code: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
        type: 'Pengeluaran',
        category: 'Belanja Material Supplier',
        amount: paidVal,
        date: formData.date || new Date().toISOString().split('T')[0],
        description: `Pelunasan Invoice Pembelian ${codeStr} kepada ${supplierNameStr}`,
        account: chosenBankName
      };
      saveCollection('transactions', [...(dbState.transactions || []), trx]);
    }

    saveCollection('bank_accounts', currentAccounts);
    saveCollection('bank_mutations', currentMutations);

    const newItem: any = {
      id: isEditingId || `pinv-${Date.now()}`,
      code: codeStr,
      poId: formData.poId || '',
      poCode: selectedPoInInvoice ? selectedPoInInvoice.code : (formData.poCode || ''),
      supplierId: formData.supplierId || '',
      supplierName: supplierNameStr,
      date: formData.date || new Date().toISOString().split('T')[0],
      totalAmount: totalAmount,
      status: finalStatus,
      paymentAccount: chosenBankName || formData.paymentAccount || '',
      bankAccountId: formData.bankAccountId || '',
      bankMutationId: newMutationId || '',
      paidAmount: paidVal,
      peruntukan: formData.peruntukan || 'Untuk Proyek',
      itemsList: JSON.stringify(poItems),
      isDiscountActive: !!formData.isDiscountActive,
      discountValue: discountAmt,
      isPpnActive: !!formData.isPpnActive,
      isOngkirActive: !!formData.isOngkirActive,
      ongkirValue: ongkirAmt,
      dueDate: formData.dueDate || '',
      attachmentName: formData.attachmentName || '',
      attachmentData: formData.attachmentData || '',
    };

    const updated = isEditingId 
      ? invoiceList.map(item => item.id === isEditingId ? newItem : item)
      : [...invoiceList, newItem];

    saveCollection('purchaseInvoices', updated);

    if (formData.poId) {
      const updatedPos = poList.map(p => p.id === formData.poId ? { ...p, status: 'Invoiced' as any } : p);
      saveCollection('purchaseOrders', updatedPos);
    }

    showToast(`Sukses merekam invoice pembelian: ${newItem.code}`, 'success');
    setIsModalOpen(false);

    if (finalStatus !== 'Draft') {
      const notifyStg = () => {
        const clientMsg = `🚨 NOTIFIKASI INVOICE PEMBELIAN (${newItem.code}) 🚨\nTelah terbit faktur pembelian kepada *${newItem.supplierName}* senilai *${formatIDR(newItem.totalAmount)}*.\nStatus Pembayaran: *${newItem.status.toUpperCase()}* (${formatIDR(newItem.paidAmount)} terbayar).\nKeterangan Peruntukan: *${newItem.peruntukan}*.`;

        const newNotif = {
          id: `notif-${Date.now()}`,
          title: `WhatsApp Invoice ${newItem.code}`,
          message: `Berhasil mendistribusikan notifikasi Invoice ${newItem.code} ke Supplier, Admin, Accounting, Peminta Stok, dan Super Admin via WhatsApp.`,
          type: 'success',
          timestamp: new Date().toISOString(),
          whatsappSent: true,
          whatsappMessage: clientMsg
        };
        saveCollection('notifications', dbState.notifications ? [newNotif, ...dbState.notifications] : [newNotif]);
        showToast('Notifikasi WhatsApp didistribusikan otomatis ke stakeholder!', 'success');
      };
      notifyStg();
    }
  };

  // Save Goods Receipt STB
  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.invoiceId || !formData.receivedBy) {
      showToast('Wajib isi Invoice referensi & Penanggung jawab gudang!', 'error');
      return;
    }

    const matchedInvoice = invoiceList.find(inv => inv.id === formData.invoiceId);
    if (!matchedInvoice) return;

    // Retrieve corresponding items list from invoice
    const materialsStr = matchedInvoice.itemsList || 'Material Kayu Logistik';

    const codeStr = formData.code || `GRN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newItem: GoodsReceipt = {
      id: isEditingId || `grn-${Date.now()}`,
      code: codeStr,
      invoiceId: formData.invoiceId,
      invoiceCode: matchedInvoice.code,
      supplierName: matchedInvoice.supplierName,
      date: formData.date || new Date().toISOString().split('T')[0],
      itemsReceived: JSON.stringify(poItems),
      receivedBy: formData.receivedBy,
      status: 'Pending'
    };

    const updated = isEditingId 
      ? receiptList.map(item => item.id === isEditingId ? { ...item, ...newItem } : item)
      : [...receiptList, newItem];

    saveCollection('goodsReceipts', updated);

    showToast(`Sukses merekam Berita Terima Fisik (STB) ${newItem.code}. Status Pending.`);
    
    setIsModalOpen(false);
  };

  // Delete Purchase Data general
  const handleDeleteItem = (id: string) => {
    const matchedCode = 
      activeTab === 'po' ? poList.find(p => p.id === id)?.code :
      activeTab === 'invoice' ? invoiceList.find(i => i.id === id)?.code :
      receiptList.find(r => r.id === id)?.code;

    setDeleteConfirm({
      id,
      description: `Apakah Anda yakin ingin menghapus dokumen [${matchedCode || id}] dari pembukuan purchasing?`
    });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;

    if (activeTab === 'po') {
      saveCollection('purchaseOrders', poList.filter(p => p.id !== id));
      showToast('Dokumen PO dihapus.', 'info');
    } else if (activeTab === 'invoice') {
      const invToDelete = invoiceList.find(i => i.id === id);
      if (invToDelete) {
        let currentAccounts = [...(dbState.bank_accounts || [])];
        let currentMutations = [...(dbState.bank_mutations || [])];

        // 1. Rollback bank mutations and account balance
        if (invToDelete.bankMutationId) {
          const matchedMut = currentMutations.find(m => m.id === invToDelete.bankMutationId);
          if (matchedMut) {
            currentMutations = currentMutations.filter(m => m.id !== invToDelete.bankMutationId);
            currentAccounts = currentAccounts.map(acc => {
              if (acc.id === matchedMut.bank_account_id) {
                return { ...acc, current_balance: acc.current_balance + matchedMut.amount };
              }
              return acc;
            });
            saveCollection('bank_accounts', currentAccounts);
            saveCollection('bank_mutations', currentMutations);
            showToast('Saldo rekening / transaksi keluar kas dibalikkan otomatis.', 'info');
          }
        }

        // 2. Rollback referenced Purchase Order status from 'Invoiced' back to 'Approved'
        if (invToDelete.poId) {
          const updatedPos = poList.map(p => p.id === invToDelete.poId ? { ...p, status: 'Approved' as any } : p);
          saveCollection('purchaseOrders', updatedPos);
        }
      }

      saveCollection('purchaseInvoices', invoiceList.filter(i => i.id !== id));
      showToast('Faktur pembelian dihapus dan penyesuaian kas berhasil.', 'info');
    } else if (activeTab === 'receipt') {
      saveCollection('goodsReceipts', receiptList.filter(r => r.id !== id));
      showToast('Surat Terima Barang dihapus.', 'info');
    }

    setDeleteConfirm(null);
  };

  const handleSavePayHutang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payHutangData || !payHutangForm.bankAccountId || payHutangForm.bayarAmount <= 0) {
      showToast('Mohon lengkapi bank dan nominal pembayaran', 'error');
      return;
    }

    const currentTotalPaid = payHutangData.paidAmount || 0;
    const remainingDebt = (payHutangData.totalAmount || 0) - currentTotalPaid;
    const payment = Number(payHutangForm.bayarAmount) || 0;

    if (payment > remainingDebt) {
      showToast(`Pembayaran Rp ${formatIDR(payment)} melebihi sisa hutang Rp ${formatIDR(remainingDebt)}!`, 'error');
      return;
    }

    let currentAccounts = [...(dbState.bank_accounts || [])];
    const chosenAccount = currentAccounts.find(a => a.id === payHutangForm.bankAccountId);
    if (!chosenAccount) {
      showToast('Rekening bank terpilih tidak ditemukan!', 'error');
      return;
    }

    if (chosenAccount.current_balance < payment) {
      showToast(`Saldo bank tidak mencukupi! Sisa: ${formatIDR(chosenAccount.current_balance)}`, 'error');
      return;
    }

    // Update account balance
    currentAccounts = currentAccounts.map(acc => {
      if (acc.id === chosenAccount.id) {
        return { ...acc, current_balance: acc.current_balance - payment };
      }
      return acc;
    });

    // Create BankMutation & Transaction
    const mutationId = `mut-${Date.now()}`;
    const chosenBankName = `${chosenAccount.bank_name} (${chosenAccount.account_number})`;
    let currentMutations = [...(dbState.bank_mutations || [])];

    const newMutation: BankMutation = {
      id: mutationId,
      mutation_code: `MUT-OUT-${Math.floor(1000 + Math.random() * 9000)}`,
      bank_account_id: chosenAccount.id,
      type: 'Keluar',
      category: 'Pelunasan Hutang Pembelian',
      amount: payment,
      description: `Cicilan/Pelunasan Hutang Pembelian ${payHutangData.code} kepada ${payHutangData.supplierName}`,
      transaction_date: new Date().toISOString().split('T')[0]
    };
    currentMutations.push(newMutation);

    const trx: Transaction = {
      id: `trx-${Date.now()}`,
      code: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
      type: 'Pengeluaran',
      category: 'Pelunasan Hutang Pembelian',
      amount: payment,
      date: new Date().toISOString().split('T')[0],
      description: `Cicilan/Pelunasan Hutang Pembelian ${payHutangData.code} kepada ${payHutangData.supplierName}`,
      account: chosenBankName
    };
    saveCollection('transactions', [...(dbState.transactions || []), trx]);
    saveCollection('bank_accounts', currentAccounts);
    saveCollection('bank_mutations', currentMutations);

    const newPaidAmount = currentTotalPaid + payment;
    let newStatus = 'Unpaid';
    
    // Evaluate new status
    if (newPaidAmount >= (payHutangData.totalAmount || 0)) {
      newStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'Partial';
    }

    // Update invoice
    const updatedInvoices = invoiceList.map(inv => {
      if (inv.id === payHutangData.id) {
        const history = inv.paymentHistory || [];
        const newHistoryRecord = {
          mutationId,
          amount: payment,
          date: new Date().toISOString().split('T')[0],
          accountName: chosenBankName,
        };
        return { 
          ...inv, 
          status: newStatus as any, 
          paidAmount: newPaidAmount,
          bankMutationId: mutationId,
          dueDate: payHutangForm.dueDate || inv.dueDate,
          paymentHistory: [...history, newHistoryRecord]
        };
      }
      return inv;
    });
    saveCollection('purchaseInvoices', updatedInvoices);

    showToast(`Pembayaran Hutang sebesar Rp ${formatIDR(payment)} berhasil dicatat! Status: ${newStatus === 'Paid' ? 'LUNAS' : 'BAYAR SEBAGIAN'}. Saldo dipotong dari ${chosenBankName}.`, 'success');
    setIsPayHutangModalOpen(false);
  };

  // Update PO Status (Approval/Rejection) with WA Notification
  const handleUpdatePoStatus = (po: PurchaseOrder, newStatus: 'Approved' | 'Rejected') => {
    const updated = poList.map(p => p.id === po.id ? { ...p, status: newStatus } : p);
    saveCollection('purchaseOrders', updated);

    const matchedSupplier = suppliers.find(s => s.id === po.supplierId);
    const supplierPhone = matchedSupplier?.phone;
    const supplierName = matchedSupplier?.name || po.supplierName;

    const statusAction = newStatus === 'Approved' ? 'DISETUJUI ✅' : 'DITOLAK ❌';
    const message = `Pemberitahuan Purchase Order: Document *${po.code}* senilai *${formatIDR(po.totalAmount)}* telah *${statusAction}*.\n\nMohon dicek kembali di sistem.`;

    // Send WA if phone exists
    if (supplierPhone) {
      sendWhatsAppNotification({
        phone: supplierPhone,
        message: message,
        recipientName: supplierName
      });
    }

    // Create In-App Notification
    const newNotif = {
      id: `notif-${Date.now()}`,
      title: `PO Status Updated: ${po.code}`,
      message: `Purchase Order ${po.code} telah diupdate menjadi ${newStatus}. Notifikasi WhatsApp telah dikoordinasikan.`,
      type: newStatus === 'Approved' ? 'success' : 'warning',
      timestamp: new Date().toISOString(),
      whatsappSent: !!supplierPhone,
      whatsappMessage: message
    };
    saveCollection('notifications', dbState.notifications ? [newNotif, ...dbState.notifications] : [newNotif]);

    showToast(`PO ${po.code} berhasil ${newStatus === 'Approved' ? 'disetujui' : 'ditolak'}!`, 'success');
    setActiveDropdownId(null);
  };

  const handleUpdateReceiptStatus = (receipt: GoodsReceipt, newStatus: 'Setuju' | 'Tolak' | 'Pending') => {
    const oldStatus = receipt.status;
    if (oldStatus === newStatus) return;

    const updated = receiptList.map(r => r.id === receipt.id ? { ...r, status: newStatus } : r);
    Object.assign(dbState, { goodsReceipts: updated });
    saveCollection('goodsReceipts', updated);

    if (newStatus === 'Setuju' && oldStatus !== 'Setuju') {
      try {
        const itemsToIncrement = JSON.parse(receipt.itemsReceived || '[]');
        if (Array.isArray(itemsToIncrement)) {
          const invent = dbState.inventory || [];
          const newLedgers: any[] = [];
          
          // 1. Process standard catalog items ('stock' mode)
          const updatedInventory = invent.map(item => {
            const matchedInReceipt = itemsToIncrement.find((rItem: any) => 
              rItem &&
              rItem.type === 'stock' &&
              ((rItem.itemId && rItem.itemId === item.id) || 
               (!rItem.itemId && rItem.description && item.name && String(rItem.description).trim().toLowerCase() === String(item.name).trim().toLowerCase()))
            );
            
            if (matchedInReceipt) {
              const addQty = Number(matchedInReceipt.qty) || 0;
              newLedgers.push({
                id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                itemId: item.id,
                itemName: item.name,
                itemCategory: item.category || 'Belum Terkategori',
                type: 'Inflow',
                source: `Approval STB ${receipt.code}`,
                date: new Date().toISOString().split('T')[0],
                qty: addQty,
                unit: item.unit || 'Unit',
                remainingStock: item.stock + addQty,
                itemMode: 'stock'
              });
              
              return {
                ...item,
                stock: item.stock + addQty,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
            return item;
          });
          
          // 2. Process manual items ('manual' mode / anything not 'stock')
          const manualReceiptItems = itemsToIncrement.filter((rItem: any) => rItem && rItem.type !== 'stock');
          manualReceiptItems.forEach((rItem: any) => {
            const addQty = Number(rItem.qty) || 0;
            newLedgers.push({
              id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              itemId: rItem.itemId || `manual-${rItem.id || Math.random().toString(36).substring(2, 9)}`,
              itemName: rItem.description || 'Penerimaan Manual',
              itemCategory: 'Item Manual (STB)',
              type: 'Inflow',
              source: `Approval STB ${receipt.code}`,
              date: new Date().toISOString().split('T')[0],
              qty: addQty,
              unit: rItem.unit || 'Pcs',
              remainingStock: addQty,
              itemMode: 'manual'
            });
          });
          
          Object.assign(dbState, { inventory: updatedInventory });
          saveCollection('inventory', updatedInventory);
          
          if (newLedgers.length > 0) {
            const updatedStockRange = [...(dbState.stockLedgers || []), ...newLedgers];
            Object.assign(dbState, { stockLedgers: updatedStockRange });
            saveCollection('stockLedgers', updatedStockRange);
          }
          
          showToast('Realisasi stok mebel di gudang bertambah otomatis!', 'success');
        }
      } catch (err) {
        console.error("Gagal memproses peningkatan stok STB:", err);
        showToast("Error update stok STB: " + (err as Error).message, "error");
      }
    } else if ((newStatus === 'Tolak' || newStatus === 'Pending') && oldStatus === 'Setuju') {
      // Revert stock increment & remove from ledger
      try {
        const itemsToDecrement = JSON.parse(receipt.itemsReceived || '[]');
        if (Array.isArray(itemsToDecrement)) {
          const invent = dbState.inventory || [];
          const updatedInventory = invent.map(item => {
            const matchedInReceipt = itemsToDecrement.find((rItem: any) => 
              rItem &&
              rItem.type === 'stock' &&
              ((rItem.itemId && rItem.itemId === item.id) || 
               (!rItem.itemId && rItem.description && item.name && String(rItem.description).trim().toLowerCase() === String(item.name).trim().toLowerCase()))
            );
            
            if (matchedInReceipt) {
              const subQty = Number(matchedInReceipt.qty) || 0;
              return {
                ...item,
                stock: Math.max(0, item.stock - subQty), // prevent negative
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
            return item;
          });
          
          Object.assign(dbState, { inventory: updatedInventory });
          saveCollection('inventory', updatedInventory);
          
          if (dbState.stockLedgers) {
            const newLedgers = dbState.stockLedgers.filter(ldg => ldg.source !== `Approval STB ${receipt.code}`);
            Object.assign(dbState, { stockLedgers: newLedgers });
            saveCollection('stockLedgers', newLedgers);
          }
          
          showToast('Realisasi stok mebel di gudang dikurangkan (revert)!', 'success');
        }
      } catch (err) {
        console.error("Gagal mengembalikan stok STB:", err);
        showToast("Error revert stok STB: " + (err as Error).message, "error");
      }
    }

    showToast(`STB ${receipt.code} berhasil ${newStatus === 'Setuju' ? 'Disetujui' : newStatus === 'Tolak' ? 'Ditolak' : 'dikembalikan ke Pending'}!`, 'success');
    
    // Send WA automatically to Penerima and Super Admin
    const getUserPhoneByRole = (roleQuery: string) => {
      // Find someone whose role somehow matches roleQuery
      const user = dbState.users?.find(u => u.role === roleQuery);
      return user?.phone || '';
    };

    // Attempt to find penerima by name or their actual User identity
    // We only have their name 'receivedBy', let's search if they have a phone, if not just skip or we could use 'admin'
    // The prompt says "ke penerima dan super admin"
    const penerimaUser = dbState.users?.find(u => 
      u.email === receipt.receivedBy || 
      u.id === receipt.receivedBy || 
      (u.role && u.role.replace('_', ' ').toUpperCase() === receipt.receivedBy)
    );
    const superAdminPhone = getUserPhoneByRole('super_admin');
    const penerimaPhone = penerimaUser?.phone || getUserPhoneByRole('admin') || ''; // fallback admin

    const statusAction = newStatus === 'Setuju' ? 'DISETUJUI ✅' : newStatus === 'Tolak' ? 'DITOLAK ❌' : 'DICANCEL / DIRESET PENDING ⚠️';
    let waMsg = `🚨 NOTIFIKASI BARANG MASUK (STB) - STATUS UPDATE 🚨\nSTB ID: ${receipt.code}\nInvoice: ${receipt.invoiceCode}\nSupplier: ${receipt.supplierName}\nDiterima Oleh: ${receipt.receivedBy}\nTanggal: ${receipt.date}\n\nStatus penerimaan: *${statusAction}*`;

    if (newStatus === 'Setuju') {
       waMsg += `\n\nStok gudang telah terupdate otomatis.`;
    } else {
       waMsg += `\n\nSilakan periksa kembali dan edit rincian item jika diperlukan.`;
    }

    if (penerimaPhone) {
      sendWhatsAppNotification({ phone: penerimaPhone, message: waMsg, recipientName: receipt.receivedBy });
    }
    if (superAdminPhone && superAdminPhone !== penerimaPhone) {
      sendWhatsAppNotification({ phone: superAdminPhone, message: waMsg, recipientName: 'Super Admin' });
    }

    setActiveDropdownId(null);
  };

  const getFilteredItems = () => {
    const term = searchTerm.toLowerCase();
    if (activeTab === 'po') {
      return poList.filter(p => p.supplierName.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
    } else if (activeTab === 'invoice') {
      let items = invoiceList.filter(i => i.supplierName.toLowerCase().includes(term) || i.code.toLowerCase().includes(term));
      
      if (paymentStatusFilter !== 'Semua') {
        const statusMap: Record<string, string> = {
          'Lunas': 'Paid',
          'Hutang': 'Unpaid',
          'Bayar Sebagian': 'Partial'
        };
        items = items.filter(i => i.status === statusMap[paymentStatusFilter]);
      }
      return items;
    } else if (activeTab === 'receipt') {
      return receiptList.filter(r => r.supplierName.toLowerCase().includes(term) || r.code.toLowerCase().includes(term));
    }
    return [];
  };

  const filteredItems = getFilteredItems();

  // Pagination Logic
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when tab, search, or status filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, paymentStatusFilter]);

  const isReadOnlyReceipt = activeTab === 'receipt' && formData.status === 'Setuju';

  return (
    <div className="bg-white   -3xl p-6  space-y-6 animate-fadeIn min-h-[calc(100vh-120px)] flex flex-col h-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      
      {/* TITLE VIEW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 shrink-0">
        <div>
          <h3 className="text-lg text-slate-905 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
            {activeTab === 'po' && 'Po Pesanan Bahan'}
            {activeTab === 'invoice' && 'Invoice Pembelian'}
            {activeTab === 'receipt' && 'Penerimaan Barang'}
          </h3>
          <p className="text-slate-500 text-xs">
            {activeTab === 'po' && 'Tarik kebutuhan dari RMR untuk order ke supplier.'}
            {activeTab === 'invoice' && 'Catat invoice belanja supplier untuk persetujuan pembayaran.'}
            {activeTab === 'receipt' && 'Pencatatan sediaan barang masuk di gudang.'}
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              ...(activeTab === 'receipt' ? { receivedBy: (currentUserRole || '').replace('_', ' ').toUpperCase() } : {})
            });
            setIsEditingId(null);
            if (activeTab === 'receipt') {
              setPoItems([{
                id: `row-${Date.now()}-0`,
                description: '',
                type: 'manual',
                qty: 1,
                unit: 'Pcs',
                price: 0,
                subtotal: 0
              }]);
            }
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          title={
            activeTab === 'po' ? 'Buat SPK PO Baru' :
            activeTab === 'invoice' ? 'Catat Pembayaran Invoice' :
            'Registrasi STB Bongkar Muat'
          }
        >
          <Plus className="w-5 h-5 font-bold" />
        </button>
      </div>

      {/* FILTER SEARCH & STATUS TABS FOR INVOICE */}
      {activeTab === 'invoice' ? (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search & Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  placeholder="Cari invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['Semua', 'Lunas', 'Hutang', 'Bayar Sebagian'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setPaymentStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-none cursor-pointer ${
                      paymentStatusFilter === status
                        ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-sm'
                        : 'text-slate-600 hover:bg-amber-500 hover:text-slate-950/50 p-1 rounded'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'HUTANG', val: invoiceList.reduce((acc, inv) => inv.status === 'Unpaid' ? acc + inv.totalAmount : acc, 0), color: 'rose' },
                { label: 'LUNAS', val: invoiceList.reduce((acc, inv) => inv.status === 'Paid' ? acc + inv.totalAmount : acc, 0), color: 'emerald' },
                { label: 'PARTIAL', val: invoiceList.reduce((acc, inv) => inv.status === 'Partial' ? acc + (inv.totalAmount - (inv.paidAmount || 0)) : acc, 0), color: 'amber' },
              ].map((stat) => (
                <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-100 p-3 rounded-2xl min-w-[120px]`}>
                  <p className={`text-xs md:text-[8px] font-black text-${stat.color}-600 tracking-[0.2em] mb-1`}>{stat.label}</p>
                  <p className={`text-[11px] font-mono font-black text-${stat.color}-900`}>{formatIDR(stat.val)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder={`Cari berkas ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      )}

      {/* WIDE FORM MODAL OVERLAY */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100000] w-full h-full bg-black/40 backdrop-blur-md flex items-center justify-center p-4 md:p-8 overflow-y-auto pointer-events-auto">
            {/* Inner Backdrop for click-to-close */}
            <div 
              className="fixed inset-0 z-0"
              onClick={() => setIsModalOpen(false)}
            />

            {/* CENTERED WIDE CARD */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`relative w-full ${activeTab === 'po' || activeTab === 'invoice' || activeTab === 'receipt' ? 'max-w-4xl' : 'max-w-4xl'} bg-white overflow-hidden flex flex-col my-auto max-h-[92vh] z-10 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] border border-slate-200`}
            >
              {/* HEADER FORM */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 select-none">
                <div>
                  <h2 className="text-lg text-emerald-600 tracking-tight flex items-center gap-2 tracking-tight font-bold  font-sans tracking-tight capitalize">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    {activeTab === 'po' && 'Input Pesanan Bahan (PO)'}
                    {activeTab === 'invoice' && 'Input Invoice Pembelian'}
                    {activeTab === 'receipt' && 'Surat Terima Barang (STB)'}
                  </h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                    LuxeLiving Cloud ERP — Smart Procurement Hub
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-150 hover:bg-rose-50 text-slate-650 hover:text-rose-600 border-none cursor-pointer text-xs transition-all"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>

              {/* SCROLLABLE CODE AND REPEATER CONTAINER */}
              <div className="p-6 overflow-y-auto space-y-6">
                

                {/* 3. SURAT TERIMA BARANG (STB) TAB FORM */}
                {activeTab === 'receipt' && (
                  <div className="space-y-6">
                    {/* BARIS ATAS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">KODE STB:</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={formData.code || "STB-AUTO-GENERATION"} 
                          className="w-full bg-slate-50 rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-600 font-mono font-bold outline-none" 
                        />
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">INVOICE/PO REFERENSI:</label>
                        <select 
                          className={`w-full border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold outline-none transition-all ${
                            isReadOnlyReceipt ? 'bg-slate-100 cursor-not-allowed text-slate-400' : 'bg-white cursor-pointer text-slate-800'
                          }`}
                          value={formData.invoiceId || ''}
                          disabled={isReadOnlyReceipt}
                          onChange={(e) => {
                            const inv = invoiceList.find(i => i.id === e.target.value);
                            if (inv) {
                              setFormData(prev => ({
                                ...prev,
                                invoiceId: inv.id,
                                invoiceCode: inv.code,
                                supplierId: inv.supplierId,
                                supplierName: inv.supplierName,
                                peruntukan: inv.peruntukan || 'Untuk Proyek'
                              }));
                              const items = JSON.parse(inv.itemsList || '[]').map((it:any) => ({
                                  ...it,
                                  id: crypto.randomUUID()
                              }));
                              setPoItems(items);
                              showToast('Data barang dari invoice berhasil dimuat!', 'success');
                            }
                          }}
                        >
                          <option value="">-- Pilih Referensi --</option>
                          {invoiceList.map(i => (
                            <option key={i.id} value={i.id}>{i.code} - {i.supplierName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">PENERIMA (LOGISTIK):</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-500 font-bold outline-none"
                          placeholder="Nama Staff Logistik..."
                          value={formData.receivedBy || ''}
                          readOnly
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">TANGGAL MASUK:</label>
                        <input 
                          type="date"
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold outline-none focus:border-indigo-400" 
                          value={formData.receivedDate || ''}
                          onChange={(e) => setFormData(p => ({ ...p, receivedDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">STAFF PENERIMA (VERIFIKATOR):</label>
                            <input 
                              type="text"
                              required
                              placeholder="Nama staff penerima barang..."
                              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold outline-none focus:border-indigo-400" 
                              value={formData.staffReceiver || ''}
                              onChange={(e) => setFormData(p => ({ ...p, staffReceiver: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-[#8fa0be] uppercase tracking-widest block">DITERIMA DARI (SUPPLIER/DRIVER):</label>
                            <input 
                              type="text"
                              required
                              placeholder="Nama pengirim / driver..."
                              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-800 font-bold outline-none focus:border-indigo-400" 
                              value={formData.deliveredBy || ''}
                              onChange={(e) => setFormData(p => ({ ...p, deliveredBy: e.target.value }))}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Rincian Item Diterima</span>
                    </div>
                    {/* Item List Slim Table */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        {/* Header Inside Table Area */}
                        <div className="px-4 pt-4 pb-2 bg-slate-50 border-b border-slate-200 hidden md:grid grid-cols-12 gap-3 text-[10px] font-bold text-[#8fa0be] uppercase tracking-wider font-sans text-center">
                            <div className="col-span-1">#</div>
                            <div className="col-span-1 text-left">Metode</div>
                            <div className="col-span-5 text-left">Cari / Input Material</div>
                            <div className="col-span-2">Qty</div>
                            <div className="col-span-2">Satuan</div>
                            <div className="col-span-1 text-right">Aksi</div>
                        </div>

                        <div className={`overflow-x-auto ${poItems.length > 3 ? 'max-h-[350px] overflow-y-auto' : ''} px-4 py-2 md:divide-y md:divide-slate-100 space-y-1`}>
                            <div className="md:divide-y md:divide-slate-100">
                                {poItems.map((item, index) => (
                                    <div key={item.id} className="py-2 md:py-2.5 first:pt-4 md:first:pt-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:items-center bg-white md:bg-transparent rounded-xl md:rounded-none border border-slate-200 md:border-transparent p-4 md:p-0 my-3 md:my-0 relative transition-colors">
                                        <div className="col-span-1 text-center font-bold text-[#8fa0be] font-mono text-[10px]">#{index + 1}</div>
                                        
                                        <div className="col-span-1">
                                            <label className="text-[10px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Metode</label>
                                            <button
                                              type="button"
                                              disabled={isReadOnlyReceipt}
                                              onClick={() => {
                                                const val = item.type === 'manual' ? 'stock' : 'manual';
                                                updatePoRow(index, 'type', val);
                                                if(val === 'stock') {
                                                  setActiveSearchRowIndex(index);
                                                  setStockSearchText('');
                                                }
                                              }}
                                              className={`w-full py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                                                item.type === 'stock' 
                                                  ? 'bg-emerald-50 border-emerald-200/50 text-emerald-800' 
                                                  : 'bg-amber-50 border-amber-200/50 text-amber-850'
                                              } ${isReadOnlyReceipt ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {item.type === 'stock' ? (
                                                  <>
                                                    <Package className="w-3 h-3" /> STOK
                                                  </>
                                                ) : (
                                                  <>
                                                    <Pencil className="w-3 h-3" /> MANUAL
                                                  </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="col-span-5 relative">
                                            <label className="text-[10px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Material</label>
                                            {item.type === 'manual' ? (
                                              <input 
                                                type="text" 
                                                disabled={isReadOnlyReceipt}
                                                className="w-full bg-slate-50 border border-slate-300 px-3 py-2 text-xs rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 shadow-none outline-none disabled:opacity-50" 
                                                placeholder="Ketik nama material..."
                                                value={item.description} 
                                                onChange={(e) => updatePoRow(index, 'description', e.target.value)}
                                              />
                                            ) : (
                                              <div className="relative">
                                                <div className="flex items-center gap-2">
                                                  <div className="relative w-full">
                                                    <input 
                                                      type="text" 
                                                      disabled={isReadOnlyReceipt}
                                                      className="w-full bg-slate-50 border border-slate-300 px-3 py-2 text-xs rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 shadow-none outline-none disabled:opacity-50" 
                                                      placeholder="Cari item atau scan..."
                                                      value={activeSearchRowIndex === index ? stockSearchText : item.description} 
                                                      onFocus={() => {
                                                        if (!isReadOnlyReceipt) {
                                                          setActiveSearchRowIndex(index);
                                                          setStockSearchText(item.description);
                                                        }
                                                      }}
                                                      onChange={(e) => setStockSearchText(e.target.value)}
                                                    />
                                                    {item.itemId && <span className="absolute right-2.5 top-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />}
                                                  </div>
                                                  {!isReadOnlyReceipt && (
                                                      <button type="button" onClick={() => setScannerRowIdx(index)} className="shrink-0 p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-all cursor-pointer border-none shadow-sm"><ScanBarcode className="w-5 h-5"/></button>
                                                  )}
                                                </div>
                                                {activeSearchRowIndex === index && (
                                                  <div className="absolute z-[999] left-0 right-0 mt-1 bg-white    -2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-100 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                                                    {inventory.filter(i => i.name.toLowerCase().includes(stockSearchText.toLowerCase())).map(i => (
                                                      <button key={i.id} onClick={() => { updatePoRow(index, 'itemId', i.id); updatePoRow(index, 'description', i.name); setActiveSearchRowIndex(null); }} className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 rounded-lg flex flex-col gap-0.5 border-none cursor-pointer text-xs mb-0.5 last:mb-0 transition-colors">
                                                        <div className="flex justify-between items-center font-bold"><span>{i.name}</span><span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">{i.code}</span></div>
                                                        <div className="text-[9px] text-slate-400">Sedia: {i.stock} {i.unit}</div>
                                                      </button>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                        </div>

                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Qty</label>
                                            <input 
                                              type="text"
                                              disabled={isReadOnlyReceipt}
                                              className="w-full bg-slate-50 border border-slate-300 p-2 text-xs rounded-lg font-mono font-bold text-center focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 outline-none disabled:opacity-50 transition-all" 
                                              value={formatInputValue(item.qty)} 
                                              onChange={(e) => {
                                                const val = parseInputValue(e.target.value);
                                                updatePoRow(index, 'qty', val);
                                              }} 
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Unit</label>
                                            <input 
                                              type="text" 
                                              disabled={isReadOnlyReceipt}
                                              className="w-full bg-slate-50 border border-slate-300 p-2 text-xs rounded-lg font-bold text-center focus:outline-none focus:border-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 outline-none uppercase disabled:opacity-50 text-slate-800" 
                                              value={item.unit} 
                                              onChange={(e) => updatePoRow(index, 'unit', e.target.value)} 
                                            />
                                        </div>

                                        <div className="col-span-1 text-right">
                                            <button 
                                              disabled={isReadOnlyReceipt || poItems.length === 1}
                                              onClick={() => setPoItems(poItems.filter((_, i) => i !== index))} 
                                              className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors border-none cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                            {!isReadOnlyReceipt && (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-slate-800">
                                  <button
                                    type="button"
                                    onClick={addPoRow}
                                    className="bg-[#2563eb] text-white rounded-xl h-10 w-10 flex items-center justify-center hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                                    title="Tambah Baris Material"
                                  >
                                    <Plus className="w-5 h-5 font-bold" />
                                  </button>
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 shadow-sm">
                                    <Package className="w-4 h-4 text-indigo-500" />
                                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Total: {poItems.length} Item</span>
                                  </div>
                                </div>
                            )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 flex flex-col justify-between gap-3 min-h-[100px]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Lampiran STB / Foto</h4>
                                <p className="text-[9px] text-slate-400 font-medium">Bukti nyata fisik barang yang diterima</p>
                              </div>
                            </div>

                            {formData.attachmentName ? (
                              <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-[10px] font-bold border border-emerald-200 flex justify-between items-center">
                                <span className="truncate max-w-[150px]">{formData.attachmentName}</span>
                                {!isReadOnlyReceipt && (
                                    <button onClick={() => setFormData(p => ({ ...p, attachmentName: undefined, attachmentData: undefined }))} className="text-rose-500 bg-transparent border-none cursor-pointer font-bold ml-2">✕</button>
                                )}
                              </div>
                            ) : (
                              !isReadOnlyReceipt && (
                                <label className="border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 rounded-lg py-2 cursor-pointer flex items-center justify-center gap-2 transition-all font-black text-[9px] uppercase tracking-widest">
                                  <Paperclip className="w-3 h-3" /> UPLOAD FOTO FISIK
                                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleAttachmentUpload} />
                                </label>
                              )
                            )}
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-slate-200 min-h-[100px] shadow-sm">
                            <textarea
                              disabled={isReadOnlyReceipt}
                              placeholder="Ketik catatan kondisi fisik material atau keterangan lainnya..."
                              className="w-full h-full bg-transparent border-none p-0 text-xs text-slate-800 outline-none resize-none placeholder:text-slate-300 font-medium leading-relaxed disabled:opacity-50"
                              value={formData.remarks || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                            />
                        </div>
                    </div>
                  </div>
                )}


                {/* 1. PURCHASE ORDER TAB FORM */}
                {activeTab === 'po' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest block">KODE SPK:</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={formData.code || "PO-AUTO-GENERATION"} 
                          className="w-full bg-slate-100 rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-500 outline-none font-mono font-bold" 
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest block">TANGGAL SPK:</label>
                        <input 
                          type="date"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all font-bold" 
                          value={formData.date || ''}
                          onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest block">AMBIL DATA RMR (Opsional):</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all cursor-pointer font-bold"
                          onChange={(e) => {
                            const rmr = materialRequests.find(r => r.id === e.target.value);
                            if (rmr) {
                              const rmrItems = rmr.items || JSON.parse(rmr.itemsList || '[]');
                              setPoItems(rmrItems.map((ritem: any) => ({
                                id: `row-${Date.now()}-${Math.random()}`,
                                description: ritem.name || ritem.description,
                                type: ritem.source === 'stok' ? 'stock' : 'manual',
                                itemId: ritem.itemId,
                                qty: ritem.qty || 0,
                                unit: ritem.unit || '',
                                price: ritem.price || 0,
                                subtotal: ritem.subTotal || 0,
                              })));
                              
                              // Auto-populate Peruntukan from Project Name and Supplier
                              const matchedSupplier = suppliers.find(s => s.name === rmr.supplierName);
                              setFormData(prev => ({ 
                                ...prev, 
                                rmrId: rmr.id,
                                peruntukan: rmr.projectName,
                                supplierId: matchedSupplier ? matchedSupplier.id : prev.supplierId,
                                supplierName: rmr.supplierName
                              }));
                              showToast('Sukses Import: Data RMR telah disalin ke list PO, Project Name sebagai Peruntukan, dan Supplier terpilih!', 'success');
                            }
                          }}
                        >
                          <option value="">-- Pilih RMR yang telah di-Approve --</option>
                          {materialRequests.map(m => (
                            <option key={m.id} value={m.id}>{m.code} - {m.description}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest block">NAMA SUPPLIER:</label>
                        <select 
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all cursor-pointer font-bold"
                          value={formData.supplierId || ''}
                          onChange={(e) => {
                            if (e.target.value === 'ADD_NEW_SUPPLIER') {
                              setIsSupplierModalOpen(true);
                            } else {
                              const s = suppliers.find(sup => sup.id === e.target.value);
                              setFormData(prev => ({ 
                                ...prev, 
                                supplierId: e.target.value,
                                supplierName: s ? s.name : ''
                              }));
                            }
                          }}
                        >
                          <option value="">-- Cari Rekanan Supplier --</option>
                          <option value="ADD_NEW_SUPPLIER" className="font-bold text-emerald-600 bg-emerald-50">+ Tambah Supplier Baru...</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} - {s.category || 'Vendor'}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. PURCHASE INVOICE TAB FORM */}
                {activeTab === 'invoice' && (
                  <>
                    {/* BARIS ATAS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest block">PO REFERENSI (Opsional):</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all cursor-pointer font-bold"
                          value={formData.poId || ''}
                          onChange={(e) => {
                            const po = poList.find(p => p.id === e.target.value);
                            if (po) {
                              const items = JSON.parse(po.itemsList || '[]');
                              setPoItems(items);
                              setFormData(prev => ({
                                ...prev,
                                poId: po.id,
                                poCode: po.code,
                                supplierId: po.supplierId,
                                supplierName: po.supplierName,
                                peruntukan: po.peruntukan || 'Untuk Proyek',
                                totalAmount: po.totalAmount
                              }));
                              showToast(`Sukses memuat rincian material dari PO ${po.code}!`, 'success');
                            } else {
                              setFormData(prev => ({ ...prev, poId: '', poCode: '' }));
                            }
                          }}
                        >
                          <option value="">-- Pilih PO Referensi --</option>
                          {poList.map(po => (
                            <option key={po.id} value={po.id}>{po.code} - {po.supplierName} ({formatIDR(po.totalAmount || 0)})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No. Invoice / Faktur:</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 rounded-xl border border-slate-300 py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                          placeholder="PINV-XXXX (Bila kosong, otomatis)"
                          value={formData.code || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Invoice:</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 rounded-xl border border-slate-300 py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                          value={formData.date || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* BARIS KEDUA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="space-y-1.5 font-sans">
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Supplier:</label>
                        {formData.poId ? (
                          <input
                            type="text"
                            readOnly
                            className="w-full bg-slate-50 rounded-xl border border-slate-300 py-3 px-4 text-xs text-slate-600 outline-none focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                            value={formData.supplierName || ''}
                          />
                        ) : (
                          <select
                            required
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                            value={formData.supplierId || ''}
                            onChange={(e) => {
                              const s = suppliers.find(sup => sup.id === e.target.value);
                              setFormData(prev => ({
                                ...prev,
                                supplierId: e.target.value,
                                supplierName: s ? s.name : ''
                              }));
                            }}
                          >
                            <option value="">-- Rekanan Supplier --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} - {s.category || 'Vendor'}</option>)}
                          </select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Keterangan Peruntukan:</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                          value={formData.peruntukan || 'Untuk Proyek'}
                          onChange={(e) => setFormData(prev => ({ ...prev, peruntukan: e.target.value }))}
                        >
                          <option value="Untuk Proyek">SEKTOR KONSTRUKSI / PROYEK: Untuk Proyek Interior</option>
                          <option value="Untuk Stok font-semibold">Inventory: Untuk Stok Gudang</option>
                        </select>
                      </div>
                    </div>

                    {/* BARIS FINANSIAL & BANK SETTLEMENT */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                      <h4 className="text-xs text-slate-800 tracking-wider flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                        <span className="w-1.5 h-3 bg-indigo-600 rounded-full inline-block" /> Setelan Pembayaran & Rekening Bank
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Status Pembayaran / Termin:</label>
                          <select
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm animate-fadeIn focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                            value={formData.status || 'Draft'}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                          >
                            <option value="Draft">Draft (Belum Ditagih)</option>
                            <option value="Unpaid">Belum Bayar (Unpaid)</option>
                            <option value="Paid">Lunas (Paid)</option>
                            <option value="Partial">Bayar Sebagian (Partial)</option>
                          </select>
                        </div>

                        {formData.status === 'Unpaid' && (
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Jatuh Tempo:</label>
                            <input
                              type="date"
                              className="w-full bg-slate-50 rounded-xl border border-slate-300 py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                              value={formData.dueDate || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                            />
                          </div>
                        )}

                        {(formData.status === 'Paid' || formData.status === 'Partial') && (
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Akun Bank / Kas (Sumber Dana):</label>
                            <select
                              required
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                              value={formData.bankAccountId || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                            >
                              <option value="">-- Pilih Rekening Sumber --</option>
                              {bankAccounts.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.bank_name} ({b.account_number}) - Bal: {formatIDR(b.current_balance)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {formData.status === 'Partial' && (
                          <div className="space-y-1.5 animate-fadeIn">
                            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Jumlah Dibayar (DP/Sebagian):</label>
                            <input
                              type="text"
                              required
                              className="w-full bg-slate-50 rounded-xl border border-slate-300 py-3 px-4 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                              placeholder="Masukkan Nilai Nominal..."
                              value={formatInputValue(formData.paidAmount)}
                              onChange={(e) => setFormData(prev => ({ ...prev, paidAmount: parseInputValue(e.target.value) }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}




                {/* REPEATER TABEL (Hanya PO dan Invoice) */}
                {activeTab !== 'receipt' && (
                  <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono font-sans tracking-tight capitalize">
                          Rincian Material BoQ / Pesanan
                        </span>
                      </div>

                      {/* Header Inside Scroll Area Container */}
                      <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white ${
                        poItems.length > 2 ? 'max-h-[380px] overflow-y-auto' : ''
                      }`}>
                        {/* Grid Header */}
                        {poItems.length > 0 && (
                          <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-slate-50 text-[10px] font-bold text-[#8fa0be] uppercase tracking-wider font-sans text-center border-b border-slate-200">
                            <div className="col-span-1">No</div>
                            <div className="col-span-1 text-left">Metode</div>
                            <div className="col-span-3 text-left">Cari / Input Material</div>
                            <div className="col-span-1">Qty</div>
                            <div className="col-span-1 text-center">Satuan</div>
                            <div className="col-span-2 text-center">Harga Satuan</div>
                            <div className="col-span-2 text-center">Subtotal</div>
                            <div className="col-span-1 text-right pr-2">Aksi</div>
                          </div>
                        )}
                        <div className="divide-y divide-slate-100">
                        {poItems.map((item, index) => (
                          <div key={item.id} className={`p-3 md:p-1 flex flex-col md:grid md:grid-cols-12 gap-2 md:items-center relative ${
                            activeSearchRowIndex === index ? 'z-[110]' : 'z-10'
                          }`}>
                            <div className="hidden md:block col-span-1 text-center font-bold text-[#8fa0be] font-mono text-[10px]">#{index + 1}</div>
                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Metode</label>
                              <button
                                type="button"
                                onClick={() => {
                                  const val = item.type === 'manual' ? 'stock' : 'manual';
                                  updatePoRow(index, 'type', val);
                                  if(val === 'stock') {
                                    setActiveSearchRowIndex(index);
                                    setStockSearchText('');
                                  }
                                }}
                                className={`w-full py-1 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                                  item.type === 'stock' 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                    : 'bg-amber-50 border-amber-200 text-amber-850'
                                }`}
                              >
                                {item.type === 'stock' ? (
                                  <>
                                    <Package className="w-3 h-3" /> STOK
                                  </>
                                ) : (
                                  <>
                                    <Pencil className="w-3 h-3" /> MANUAL
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="col-span-3 relative">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Material</label>
                              {item.type === 'manual' ? (
                                <input 
                                  type="text" 
                                  className="w-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-indigo-400" 
                                  placeholder="Ketik manual..."
                                  value={item.description} 
                                  onChange={(e) => updatePoRow(index, 'description', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && addPoRow()}
                                />
                              ) : (
                                <div className="relative">
                                  <div className="flex items-center gap-1">
                                    <div className="relative w-full">
                                      <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs rounded-lg font-medium text-slate-800 focus:outline-none focus:border-indigo-400" 
                                        placeholder="Cari..."
                                        value={activeSearchRowIndex === index ? stockSearchText : item.description} 
                                        onFocus={() => {
                                          setActiveSearchRowIndex(index);
                                          setStockSearchText(item.description);
                                        }}
                                        onChange={(e) => setStockSearchText(e.target.value)}
                                      />
                                      {item.itemId && (
                                        <span className="absolute right-2.5 top-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      )}
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => setScannerRowIdx(index)} 
                                      className="p-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 hover:text-emerald-600 transition-colors"
                                    >
                                      <ScanBarcode className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  {activeSearchRowIndex === index && (
                                    <div className="absolute z-[999] left-0 right-0 mt-1 bg-white max-h-48 overflow-y-auto p-1.5 rounded-xl shadow-xl border border-slate-100">
                                      {inventory.filter(i => 
                                        i.name.toLowerCase().includes(stockSearchText.toLowerCase()) || 
                                        i.code.toLowerCase().includes(stockSearchText.toLowerCase())
                                      ).slice(0, 10).map(i => (
                                        <button
                                          key={i.id}
                                          type="button"
                                          className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex flex-col gap-0.5 border-none cursor-pointer text-[11px] mb-0.5 last:mb-0"
                                          onClick={() => {
                                            updatePoRow(index, 'itemId', i.id);
                                            setActiveSearchRowIndex(null);
                                            setStockSearchText('');
                                          }}
                                        >
                                          <div className="flex justify-between items-center font-bold">
                                            <span className="truncate">{i.name}</span>
                                            <span className="text-[8px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">{i.code}</span>
                                          </div>
                                          <div className="flex justify-between text-[9px] text-slate-400">
                                            <span>Sisa: {i.stock} {i.unit}</span>
                                            <span className="text-emerald-600 font-bold">{formatIDR(i.price)}</span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Qty</label>
                              <input 
                                type="text"
                                className="w-full bg-white border border-slate-200 p-1 text-xs rounded-lg font-mono font-bold text-center focus:outline-none focus:border-indigo-400" 
                                value={formatInputValue(item.qty)} 
                                onChange={(e) => updatePoRow(index, 'qty', parseInputValue(e.target.value))} 
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Unit</label>
                              <input 
                                type="text" 
                                className="w-full bg-white border border-slate-200 p-1 text-xs rounded-lg font-bold text-center focus:outline-none focus:border-indigo-400 uppercase" 
                                value={item.unit} 
                                placeholder="PCS" 
                                onChange={(e) => updatePoRow(index, 'unit', e.target.value)} 
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Harga Satuan</label>
                              <input 
                                type="text"
                                className="w-full bg-white border border-slate-200 p-1 text-xs rounded-lg font-mono font-bold text-center focus:outline-none focus:border-indigo-400"
                                value={formatInputValue(item.price)} 
                                onChange={(e) => updatePoRow(index, 'price', parseInputValue(e.target.value))} 
                              />
                            </div>
                            <div className="col-span-2 text-center">
                              <label className="text-[9px] font-black text-[#8fa0be] uppercase md:hidden block mb-1">Subtotal</label>
                              <div className="font-mono font-bold text-slate-800 text-xs">
                                {formatIDR(item.subtotal)}
                              </div>
                            </div>
                            <div className="col-span-1 text-right">
                              <button 
                                type="button" 
                                onClick={() => setPoItems(poItems.filter((_, i) => i !== index))}
                                disabled={poItems.length === 1}
                                className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-colors border-none cursor-pointer disabled:opacity-20"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    
                    {/* PLUS ICON BUTTON - PLACED DIRECTLY UNDER ITEMS LIST */}
                      <div className="p-3 bg-[#f8fafc] border-t border-slate-100 flex justify-between items-center text-slate-800">
                        <button
                          type="button"
                          onClick={addPoRow}
                          className="bg-indigo-600 text-white rounded-xl w-10 h-10 shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all border-none cursor-pointer flex items-center justify-center"
                        >
                          <Plus className="w-5 h-5 font-bold" />
                        </button>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total:</span>
                          <span className="font-mono text-sm font-black text-slate-900 leading-none">
                            {formatIDR(poItems.reduce((acc, it) => acc + it.subtotal, 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 flex flex-col justify-between gap-3 min-h-[100px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Lampiran Nota</h4>
                            <p className="text-[9px] text-slate-400 font-medium">Bahan/Vendor (PDF, JPG)</p>
                          </div>
                        </div>

                        {formData.attachmentName ? (
                          <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-[10px] font-bold border border-emerald-200 flex justify-between items-center">
                            <span className="truncate max-w-[150px]">{formData.attachmentName}</span>
                            <button onClick={() => setFormData(p => ({ ...p, attachmentName: undefined }))} className="text-rose-500 bg-transparent border-none cursor-pointer font-bold ml-2">✕</button>
                          </div>
                        ) : (
                          <label className="border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 rounded-lg py-2 cursor-pointer flex items-center justify-center gap-2 transition-all font-black text-[9px] uppercase tracking-widest">
                            <Paperclip className="w-3 h-3" /> UPLOAD NOTA
                            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleAttachmentUpload} />
                          </label>
                        )}
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-slate-200 min-h-[100px] shadow-sm">
                        <textarea
                          required
                          placeholder="Catatan belanja / keterangan proyek..."
                          className="w-full h-full bg-transparent border-none p-0 text-xs text-slate-800 outline-none resize-none placeholder:text-slate-300 font-medium leading-relaxed"
                          value={formData.peruntukan || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, peruntukan: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* BOTTOM ACTION BAR (DEPENDENT ON TAB) */}
                {activeTab === 'po' && (
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-6 border-t border-slate-200 shrink-0 select-none">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      <div className="text-[10px] text-slate-400 font-medium max-w-[180px] leading-relaxed italic">
                        * Otomatis sinkronisasi ke WhatsApp dan Cloud ERP.
                      </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto items-center">
                      <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)} 
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold w-12 h-12 rounded-xl border-none cursor-pointer flex items-center justify-center transition-colors"
                        title="Batal"
                      >
                        <X className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleSavePo(e, 'Pending')} 
                        className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-12 h-12 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                        title="Simpan Draft"
                      >
                        <Save className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleSavePo(e, 'Approved')} 
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-xl w-16 h-12 hover:bg-emerald-700 transition-all duration-200 shadow-md shadow-emerald-500/10 border-none cursor-pointer text-xs"
                        title="Simpan & Kirim WA"
                      >
                        <Save className="w-4 h-4 stroke-[2.5]" shrink-0="true" />
                        <span className="text-[10px] font-black uppercase font-sans tracking-wider leading-none">WA</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'invoice' && (
                  <div className="pt-6 border-t border-slate-200 shrink-0 select-none space-y-6">
                    {/* Financial Breakdown - Rapih di Kanan Bawah */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                      <div className="text-[10px] text-slate-400 font-medium max-w-[280px] leading-relaxed italic order-2 md:order-1 select-none">
                        <span className="font-bold text-slate-500 uppercase block mb-1">💡 Catatan Settlement:</span>
                        * Menekan tombol "Simpan & Bukukan" akan memotong saldo rekening utama jika status diset ke Lunas (Paid) atau Bayar Sebagian (Partial), serta merekam mutasi bank secara otomatis.
                      </div>
                      
                      {/* Breakdown Box right-aligned */}
                      <div className="w-full md:w-85 bg-slate-50 rounded-2xl p-4.5 border border-slate-200/60 flex flex-col gap-3 order-1 md:order-2 ml-auto shadow-sm select-none">
                        {/* Subtotal */}
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Subtotal:</span>
                          <span className="font-mono text-slate-700">{(() => {
                            const sub = poItems.reduce((acc, it) => acc + it.subtotal, 0);
                            return formatIDR(sub);
                          })()}</span>
                        </div>

                        {/* Diskon */}
                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-500">
                            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                              <input
                                type="checkbox"
                                checked={!!formData.isDiscountActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isDiscountActive: e.target.checked }))}
                                className="bg-slate-50 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                              />
                              <span>Diskon</span>
                            </label>
                            <span className={`font-mono font-bold ${formData.isDiscountActive && formData.discountValue ? 'text-rose-600' : 'text-slate-400'}`}>
                              {formData.isDiscountActive && formData.discountValue ? `- ${formatIDR(Number(formData.discountValue))}` : 'Rp 0'}
                            </span>
                          </div>
                          {formData.isDiscountActive && (
                            <div className="flex items-center gap-1.5 mt-1.5 justify-end animate-fadeIn">
                              <span className="text-[10px] text-slate-405 font-bold font-mono">Rp</span>
                              <input
                                type="text"
                                placeholder="..."
                                className="w-32 bg-slate-50 rounded-lg border border-slate-205 py-1 px-2.5 text-xs text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                                value={formatInputValue(formData.discountValue)}
                                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseInputValue(e.target.value) }))}
                              />
                            </div>
                          )}
                        </div>

                        {/* PPN */}
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-500 pt-2 border-t border-slate-200/60">
                          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                            <input
                              type="checkbox"
                              checked={!!formData.isPpnActive}
                              onChange={(e) => setFormData(prev => ({ ...prev, isPpnActive: e.target.checked }))}
                              className="bg-slate-50 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                            />
                            <span>PPN (11%)</span>
                          </label>
                          <span className="font-mono text-slate-700">
                            {(() => {
                              const sub = poItems.reduce((acc, it) => acc + it.subtotal, 0);
                              let totalBeforePpn = sub;
                              if (formData.isDiscountActive && formData.discountValue) {
                                totalBeforePpn -= Number(formData.discountValue);
                              }
                              const ppn = formData.isPpnActive ? Math.round(totalBeforePpn * 0.11) : 0;
                              return formatIDR(ppn);
                            })()}
                          </span>
                        </div>

                        {/* Ongkir */}
                        <div className="pt-2 border-t border-slate-200/60 pb-2.5 border-b border-slate-200">
                          <div className="flex justify-between items-center text-[11px] font-bold uppercase text-slate-500">
                            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                              <input
                                type="checkbox"
                                checked={!!formData.isOngkirActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isOngkirActive: e.target.checked }))}
                                className="bg-slate-50 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                              />
                              <span>Ongkir / Kirim</span>
                            </label>
                            <span className={`font-mono font-bold ${formData.isOngkirActive && formData.ongkirValue ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {formData.isOngkirActive && formData.ongkirValue ? formatIDR(Number(formData.ongkirValue)) : 'Rp 0'}
                            </span>
                          </div>
                          {formData.isOngkirActive && (
                            <div className="flex items-center gap-1.5 mt-1.5 justify-end animate-fadeIn">
                              <span className="text-[10px] text-slate-405 font-bold font-mono">Rp</span>
                              <input
                                type="text"
                                placeholder="..."
                                className="w-32 bg-slate-50 rounded-lg border border-slate-205 py-1 px-2.5 text-xs text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                                value={formatInputValue(formData.ongkirValue)}
                                onChange={(e) => setFormData(prev => ({ ...prev, ongkirValue: parseInputValue(e.target.value) }))}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-[10px] font-black text-slate-850 tracking-wider uppercase font-mono">TOTAL INVOICE:</span>
                          <span className="text-sm font-black text-slate-900 font-mono bg-emerald-100 border border-emerald-200 text-emerald-805 px-3 py-1.5 rounded-xl shadow-xs leading-none">
                            {(() => {
                              const sub = poItems.reduce((acc, it) => acc + it.subtotal, 0);
                              let total = sub;
                              if (formData.isDiscountActive && formData.discountValue) {
                                total -= Number(formData.discountValue);
                              }
                              if (formData.isPpnActive) {
                                let totalBeforePpn = sub;
                                if (formData.isDiscountActive && formData.discountValue) {
                                  totalBeforePpn -= Number(formData.discountValue);
                                }
                                total += Math.round(totalBeforePpn * 0.11);
                              }
                              if (formData.isOngkirActive && formData.ongkirValue) {
                                total += Number(formData.ongkirValue);
                              }
                              return formatIDR(total);
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons sitting right beneath */}
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3 w-full">
                      <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)} 
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold px-4 h-12 rounded-xl border-none cursor-pointer text-xs transition-all flex items-center justify-center gap-2"
                        title="Batal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleSaveInvoice(e, 'Draft')} 
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-xl h-12 px-5 font-bold hover:bg-slate-50 transition-all duration-200 shadow-sm border-none cursor-pointer text-xs uppercase tracking-widest"
                        title="Simpan Draft"
                      >
                        <Save className="w-4 h-4" /> DRAFT
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => handleSaveInvoice(e)} 
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl h-12 px-6 font-black uppercase tracking-widest hover:bg-indigo-700 transition-all duration-200 shadow-md shadow-indigo-500/20 border-none cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-1">
                          <Save className="w-4 h-4" />
                          <Banknote className="w-4 h-4" />
                        </div>
                        SIMPAN & BUKUKAN
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'receipt' && (
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-6 border-t border-slate-200 shrink-0 select-none">
                    <div className="flex items-center gap-6 w-full md:w-auto col-span-2">
                      <p className="text-xs text-slate-400 italic leading-snug">
                        {isReadOnlyReceipt ? (
                          <span className="text-amber-600 font-bold">⚠️ Dokumen Serah Terima Barang (STB) ini telah disetujui and dikunci. Rincian item bersifat read-only.</span>
                        ) : (
                          "* Input ini khusus untuk mencatat bukti serah terima fisik material logistik, tidak memengaruhi nilai pembukuan jurnal keuangan secara langsung."
                        )}
                      </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto shrink-0">
                      <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)} 
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold w-12 h-12 rounded-xl border-none cursor-pointer flex items-center justify-center transition-colors"
                        title={isReadOnlyReceipt ? 'Tutup' : 'Batal'}
                      >
                        <X className="w-5 h-5 stroke-[2.5]" />
                      </button>
                      {!isReadOnlyReceipt && (
                        <button 
                          type="button" 
                          onClick={(e) => handleSaveReceipt(e)} 
                          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-12 h-12 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                          title="Simpan & Masuk Gudang"
                        >
                          <Save className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* MODAL REGISTRASI SUPPLIER BARU */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isSupplierModalOpen && (
            <div className="fixed inset-0 z-[100005] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setIsSupplierModalOpen(false)}
               className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} 
               animate={{ opacity: 1, scale: 1 }} 
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative w-full max-w-md bg-white -[2rem] -2xl p-8 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
             >
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-sm text-slate-900 tracking-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Registrasi Supplier Baru</h3>
                   <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 border-none bg-transparent cursor-pointer hover:text-rose-500"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleSaveSupplier} className="space-y-4">
                   <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Perusahaan / Toko</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={newSupplier.name}
                        onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                      />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No. WhatsApp</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={newSupplier.phone}
                          onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kota Asal</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={newSupplier.city}
                          onChange={(e) => setNewSupplier({...newSupplier, city: e.target.value})}
                        />
                      </div>
                   </div>
                   <button type="submit" className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"><Save className="w-4 h-4 mr-1" /> Simpan SUPPLIER</button>
                </form>
             </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}


      {/* TABLE RENDERS DEPENDING ON ACTIVE TAB */}
      <div className="overflow-x-auto min-h-[450px] flex-grow">
        <table className="w-full text-left text-xs text-slate-705">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-450 font-mono uppercase">
              {activeTab === 'po' && (
                <>
                  <th className="px-4 py-3 whitespace-nowrap">Kode PO</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nama Vendor Supplier</th>
                  <th className="px-4 py-3 whitespace-nowrap">Rincian Item & Spesifikasi BoQ</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tanggal PO</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nilai Belanja</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status Dokumen</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Opsi</th>
                </>
              )}
              {activeTab === 'invoice' && (
                <>
                  <th className="px-4 py-3 whitespace-nowrap">Kode Invoice</th>
                  <th className="px-4 py-3 whitespace-nowrap">PO Referensi</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nama Vendor</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Sumber Kas Perusahaan</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tanggal Tagih</th>
                  <th className="px-4 py-3 whitespace-nowrap">Total Nilai</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Opsi</th>
                </>
              )}
              {activeTab === 'receipt' && (
                <>
                  <th className="px-4 py-3 whitespace-nowrap">Kode STB</th>
                  <th className="px-4 py-3 whitespace-nowrap">Invoice Referensi</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nama Vendor</th>
                  <th className="px-4 py-3 whitespace-nowrap">Tanggal Masuk Merapat</th>
                  <th className="px-4 py-3 whitespace-nowrap">Staf Penerima (Pabrik)</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Unboxing Item Terhitung</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Opsi</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-amber-500 hover:text-slate-950/40">
                  {activeTab === 'po' && (
                    <>
                      <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">{item.code}</td>
                      <td className="px-4 py-3.5 text-slate-850 font-bold whitespace-nowrap">{item.supplierName}</td>
                      <td className="px-4 py-3.5 font-mono max-w-xs text-[10px] text-slate-500 whitespace-pre-wrap whitespace-nowrap">
                        {(() => {
                          try {
                            const parsed = JSON.parse(item.itemsList);
                            if (Array.isArray(parsed)) {
                              return parsed.map((it: any) => `• ${it.qty} ${it.unit} - ${it.description}`).join('\n');
                            }
                          } catch (e) {
                            return item.itemsList;
                          }
                          return item.itemsList;
                        })()}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">{formatIDR(item.totalAmount)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          item.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          item.status === 'Invoiced' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          'bg-slate-100 text-slate-500 animate-pulse'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </>
                  )}
                  {activeTab === 'invoice' && (
                    <>
                      <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">{item.code}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-500 whitespace-nowrap">{item.poCode}</td>
                      <td className="px-4 py-3.5 text-slate-850 font-bold whitespace-nowrap">{item.supplierName}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          item.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          item.status === 'Unpaid' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          item.status === 'Partial' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {item.status === 'Paid' ? 'Lunas' : 
                           item.status === 'Unpaid' ? 'Hutang' :
                           item.status === 'Partial' ? 'Bayar Sebagian' : item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-teal-600 font-sans whitespace-nowrap">{item.paymentAccount}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-450 whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">{formatIDR(item.totalAmount)}</td>
                    </>
                  )}
                  {activeTab === 'receipt' && (
                    <>
                      <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">{item.code}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 whitespace-nowrap">{item.invoiceCode}</td>
                      <td className="px-4 py-3.5 text-slate-850 font-bold whitespace-nowrap">{item.supplierName}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-450 whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3.5 font-sans font-bold text-slate-900 whitespace-nowrap">{item.receivedBy}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          item.status === 'Setuju' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          item.status === 'Tolak' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          'bg-slate-100 text-slate-500 animate-pulse'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono max-w-xs text-[10px] text-slate-500 whitespace-pre-wrap whitespace-nowrap">
                        {(() => {
                          try {
                            const parsed = JSON.parse(item.itemsReceived);
                            if (Array.isArray(parsed)) {
                              return parsed.map((p, idx) => `• ${p.qty} ${p.unit} - ${p.description}`).join('\n');
                            }
                            return item.itemsReceived;
                          } catch (e) {
                            return item.itemsReceived;
                          }
                        })()}
                      </td>
                    </>
                  )}

                  <td className="px-4 py-3.5 text-right relative whitespace-nowrap">
                    <div className="inline-block relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors border-none cursor-pointer"
                        title="Pilihan Aksi"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      <AnimatePresence>
                        {activeDropdownId === item.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute right-0 mt-1 w-52 bg-white z-[100] overflow-hidden text-left py-2 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] border-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* EXPLICIT TAB BRANCHING */}
                            {activeTab === 'po' && (
                              <>
                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditingId(item.id);
                                    setPoItems(JSON.parse(item.itemsList || '[]'));
                                    setIsModalOpen(true);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Calculator className="w-3.5 h-3.5" /> Edit Data
                                </button>

                                <button
                                  onClick={() => {
                                    triggerPdfPrint('PurchaseOrder', item);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Print PO
                                </button>

                                {item.status === 'Pending' && (
                                  <>
                                    <div className="h-[1px] bg-slate-100 my-1 mx-4" />
                                    <button
                                      onClick={() => handleUpdatePoStatus(item, 'Approved')}
                                      className="w-full text-left px-4 py-2.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" /> Setujui PO
                                    </button>

                                    <button
                                      onClick={() => handleUpdatePoStatus(item, 'Rejected')}
                                      className="w-full text-left  .5 text-[10px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"
                                    >
                                      <X className="w-3.5 h-3.5" /> Tolak PO
                                    </button>
                                    <div className="h-[1px] bg-slate-100 my-1 mx-4" />
                                  </>
                                )}

                                <button
                                  onClick={() => {
                                    const matchedSupplier = suppliers.find(s => s.id === item.supplierId);
                                    if (matchedSupplier) {
                                      const totalAmount = item.totalAmount || 0;
                                      const template = dbState.settings?.whatsappTemplateOrderPurchase || 'NOTIFIKASI PO: Berkas pesanan baru dengan Kode PO *{order_code}* telah diterbitkan untuk *{supplier_name}* senilai *{order_amount}* pada *{order_date}* silakan segera diproses.';
                                      const message = template
                                        .replace(/{supplier_name}/g, matchedSupplier.name)
                                        .replace(/{order_code}/g, item.code)
                                        .replace(/{order_amount}/g, formatIDR(totalAmount))
                                        .replace(/{order_date}/g, item.date);

                                      const newNotif = {
                                        id: `notif-${Date.now()}`,
                                        title: `Fonnte WA PO ${item.code}`,
                                        message: `Berhasil mendistribusikan berkas pemesanan SEKTOR KONSTRUKSI / PROYEK untuk ${matchedSupplier.name} via WhatsApp.`,
                                        type: 'success',
                                        timestamp: new Date().toISOString(),
                                        whatsappSent: true,
                                        whatsappMessage: message
                                      };
                                      const updatedNotifs = dbState.notifications ? [newNotif, ...dbState.notifications] : [newNotif];
                                      saveCollection('notifications', updatedNotifs);
                                      showToast(`Mengirim ulang notifikasi PO ${item.code} dengan Fonnte WA Gateway...`, 'success');
                                    } else {
                                      showToast('Gagal mengirim WhatsApp: Rekanan supplier tidak ditemukan!', 'error');
                                    }
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-emerald-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Smartphone className="w-3.5 h-3.5" /> WA PO
                                </button>

                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditingId(item.id);
                                    setPoItems(JSON.parse(item.itemsList || '[]'));
                                    setIsModalOpen(true);
                                    setActiveDropdownId(null);
                                    setTimeout(() => {
                                      showToast('Silakan pilih berkas di area Lampiran Penawaran / Nota baru.', 'success');
                                    }, 450);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Upload Attachment
                                </button>

                                <div className="h-[1px] bg-slate-100 my-2 mx-4" />

                                <button
                                  onClick={() => {
                                    handleDeleteItem(item.id);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-rose-500 hover:bg-rose-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Hapus PO
                                </button>
                              </>
                            )}

                            {activeTab === 'invoice' && (
                              <>
                                {(item.status === 'Unpaid' || item.status === 'Partial') && (
                                  <button
                                    onClick={() => {
                                      const remaining = (item.totalAmount || 0) - (item.paidAmount || 0);
                                      const futureDate = new Date();
                                      futureDate.setDate(futureDate.getDate() + 30);
                                      setPayHutangData(item);
                                      setPayHutangForm({ bayarAmount: remaining, bankAccountId: '', dueDate: futureDate.toISOString().split('T')[0] });
                                      setIsPayHutangModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black text-amber-600 hover:bg-amber-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Bayar Hutang
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditingId(item.id);
                                    setPoItems(JSON.parse(item.itemsList || '[]'));
                                    setIsModalOpen(true);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Calculator className="w-3.5 h-3.5" /> Edit Data
                                </button>

                                <button
                                  onClick={() => {
                                    triggerPdfPrint('PurchaseInvoice', item);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                                </button>

                                {(item.status === 'Paid' || item.status === 'Partial') && (
                                  <button
                                    onClick={() => {
                                      setPaymentHistoryData(item);
                                      setIsPaymentHistoryModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                  >
                                    <Receipt className="w-3.5 h-3.5" /> Riwayat & Kwitansi
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditingId(item.id);
                                    setPoItems(JSON.parse(item.itemsList || '[]'));
                                    setIsModalOpen(true);
                                    setActiveDropdownId(null);
                                    setTimeout(() => {
                                      showToast('Pilih berkas pembuktian transfer di area Lampiran.', 'success');
                                    }, 450);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Upload Attachment
                                </button>

                                <div className="h-[1px] bg-slate-100 my-2 mx-4" />

                                <button
                                  onClick={() => {
                                    handleDeleteItem(item.id);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-rose-500 hover:bg-rose-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Hapus Invoice
                                </button>
                              </>
                            )}

                            {activeTab === 'receipt' && (
                              <>
                                {/* VIEW STB: Selalu muncul */}
                                <button
                                  onClick={() => {
                                    setFormData(item);
                                    setIsEditingId(item.id);
                                    try {
                                      setPoItems(JSON.parse(item.itemsReceived || '[]'));
                                    } catch (e) {
                                      setPoItems([]);
                                    }
                                    setIsModalOpen(true);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Lihat Detail
                                </button>

                                {/* EDIT STB: Hanya jika belum disetujui (Pending / Tolak) */}
                                {item.status !== 'Setuju' && (
                                  <button
                                    onClick={() => {
                                      setFormData(item);
                                      setIsEditingId(item.id);
                                      try {
                                        setPoItems(JSON.parse(item.itemsReceived || '[]'));
                                      } catch (e) {
                                        setPoItems([]);
                                      }
                                      setIsModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                  >
                                    <Calculator className="w-3.5 h-3.5" /> Edit STB
                                  </button>
                                )}

                                {/* PRINT STB: Selalu muncul */}
                                <button
                                  onClick={() => {
                                    triggerPdfPrint('GoodsReceipt', item);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Print STB
                                </button>

                                {/* WA STB: Selalu muncul */}
                                <button
                                  onClick={() => {
                                    const getUserPhoneByRole = (role: string) => {
                                      const user = dbState.users?.find(u => u.role === role);
                                      return user?.phone || '';
                                    };
                                    const waMsg = `🚨 NOTIFIKASI STB 🚨\nSTB ID: ${item.code}\nInvoice: ${item.invoiceCode}\nSupplier: ${item.supplierName}\nDiterima Oleh: ${item.receivedBy}\nTanggal: ${item.date}`;
                                    
                                    ['admin', 'accounting', 'super_admin'].forEach(role => {
                                      const phone = getUserPhoneByRole(role);
                                      if (phone) {
                                          sendWhatsAppNotification({ phone, message: waMsg, recipientName: role });
                                      }
                                    });
                                    
                                    showToast('Mengirim notifikasi STB via WhatsApp...', 'success');
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[10px] font-black text-slate-700 hover:bg-amber-500 hover:text-slate-950 hover:text-indigo-600 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                >
                                  <Smartphone className="w-3.5 h-3.5" /> WA STB
                                </button>

                                <div className="h-[1px] bg-slate-100 my-1.5 mx-4" />

                                {/* SETUJU / APPROVE: Hanya jika belum disetujui (Pending / Tolak) */}
                                {item.status !== 'Setuju' && (
                                  <button
                                    onClick={() => handleUpdateReceiptStatus(item, 'Setuju')}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Setuju
                                  </button>
                                )}

                                {/* TOLAK: Hanya jika belum ditolak (Pending / Setuju) */}
                                {item.status !== 'Tolak' && (
                                  <button
                                    onClick={() => handleUpdateReceiptStatus(item, 'Tolak')}
                                    className="w-full text-left  .5 text-[10px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest w-8 h-8 flex gap-1 rounded-full items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors mx-1 font-semibold text-[0px] [&>svg]:text-[16px]"
                                  >
                                    <X className="w-3.5 h-3.5" /> Tolak
                                  </button>
                                )}

                                {/* RESET PENDING: Jika status bukan Pending */}
                                {item.status !== 'Pending' && (
                                  <button
                                    onClick={() => handleUpdateReceiptStatus(item, 'Pending')}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black text-amber-650 hover:bg-amber-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                  >
                                    <X className="w-3.5 h-3.5 text-amber-500" /> Reset ke Pending
                                  </button>
                                )}

                                {/* HAPUS: Hanya jika belum disetujui */}
                                {item.status !== 'Setuju' && (
                                  <>
                                    <div className="h-[1px] bg-slate-100 my-1.5 mx-4" />
                                    <button
                                      onClick={() => {
                                        handleDeleteItem(item.id);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-[10px] font-black text-rose-500 hover:bg-rose-50 flex items-center gap-3 cursor-pointer border-none transition-all uppercase tracking-widest"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Hapus Surat
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Belum ada dokumen transaksional {activeTab.toUpperCase()} yang direkam.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION UI */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-slate-900">{totalItems}</span> results
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
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Simple logic to show only few page numbers
                if (
                  totalPages <= 7 || 
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
              Next
            </button>
          </div>
        </div>
      )}



      <Modal isOpen={scannerRowIdx !== null} onClose={() => setScannerRowIdx(null)} title="Pindai Barcode Item" maxWidth="max-w-md">
        {scannerRowIdx !== null && (
          <BarcodeScanner 
            onScanSuccess={(invItem) => {
              updatePoRow(scannerRowIdx, 'itemId', invItem.id);
              updatePoRow(scannerRowIdx, 'description', invItem.name);
              setScannerRowIdx(null);
            }}
          />
        )}
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
            className="bg-slate-150 hover:bg-amber-500 hover:text-slate-950 text-slate-755 font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
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

      {/* PAYMENT HISTORY MODAL */}
      <Modal isOpen={isPaymentHistoryModalOpen} onClose={() => setIsPaymentHistoryModalOpen(false)} title="Riwayat Pembayaran & Kwitansi">
        {paymentHistoryData && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Faktur Pembelian</span>
                <span className="font-mono text-sm font-bold text-indigo-700">{paymentHistoryData.code}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Invoice</span>
                <span className="font-mono text-sm font-bold text-slate-800">{formatIDR(paymentHistoryData.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Total Dibayar</span>
                <span className="font-mono text-lg font-black text-emerald-600">{formatIDR(paymentHistoryData.paidAmount || 0)}</span>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <h4 className="text-xs text-slate-600 tracking-wider mb-2 border-b border-slate-200 pb-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Daftar Transaksi</h4>
              {(!paymentHistoryData.paymentHistory || paymentHistoryData.paymentHistory.length === 0) ? (
                // Legacy support (before paymentHistory array was tracked)
                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">Pembayaran Legacy</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">{paymentHistoryData.date}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{paymentHistoryData.paymentAccount || 'Rekening Perusahaan'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-600">{formatIDR(paymentHistoryData.paidAmount || paymentHistoryData.totalAmount)}</div>
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={() => {
                          setKwitansiData({ invoice: paymentHistoryData, payment: { amount: paymentHistoryData.paidAmount || paymentHistoryData.totalAmount, date: paymentHistoryData.date, accountName: paymentHistoryData.paymentAccount || 'Rekening Perusahaan' }, seq: 1 });
                          setIsKwitansiModalOpen(true);
                        }}
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] cursor-pointer border border-indigo-200 transition-all uppercase tracking-wider ml-auto"
                      >
                        <Printer className="w-3 h-3" /> Kwitansi
                      </button>
                      <button
                        onClick={() => {
                          const kwitansiMsg = `🚨 BUKTI PEMBAYARAN RAW (KWITANSI) 🚨\nTelah dilakukan pemindahan bukuan lunas kepada *${paymentHistoryData.supplierName}* senilai *${formatIDR(paymentHistoryData.paidAmount || paymentHistoryData.totalAmount)}* untuk pelunasan Invoice ${paymentHistoryData.code} pada tanggal ${paymentHistoryData.date}.\nStatus: *${paymentHistoryData.status === 'Paid' ? 'LUNAS' : 'SEBAGIAN'}* via ${paymentHistoryData.paymentAccount || 'Rekening Bank'}.`;
                          sendWhatsAppNotification({ phone: '', message: kwitansiMsg, recipientName: paymentHistoryData.supplierName });
                        }}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] cursor-pointer border border-emerald-200 transition-all uppercase tracking-wider ml-auto"
                      >
                        <Smartphone className="w-3 h-3" /> WA
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                paymentHistoryData.paymentHistory.map((p: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        Pembayaran ke-{idx + 1}
                        <span className="text-xs md:text-[9px] font-mono bg-slate-100 text-slate-500 py-0.5 px-1.5 rounded">
                          {p.mutationId}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">{p.date}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{p.accountName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-600">{formatIDR(p.amount)}</div>
                      <div className="flex flex-col gap-2 mt-2">
                        <button
                          onClick={() => {
                            setKwitansiData({ invoice: paymentHistoryData, payment: p, seq: idx + 1 });
                            setIsKwitansiModalOpen(true);
                          }}
                          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] cursor-pointer border border-indigo-200 transition-all uppercase tracking-wider ml-auto"
                        >
                          <Printer className="w-3 h-3" /> Kwitansi
                        </button>
                        <button
                          onClick={() => {
                            const kwitansiMsg = `🚨 BUKTI PEMBAYARAN RAW (KWITANSI) 🚨\nTelah dilakukan pemindahan bukuan kepada *${paymentHistoryData.supplierName}* senilai *${formatIDR(p.amount)}* untuk cicilan/pelunasan Invoice ${paymentHistoryData.code} (Pembayaran ke-${idx + 1}) pada tanggal ${p.date}.\nvia ${p.accountName}.`;
                            sendWhatsAppNotification({ phone: '', message: kwitansiMsg, recipientName: paymentHistoryData.supplierName });
                          }}
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] cursor-pointer border border-emerald-200 transition-all uppercase tracking-wider ml-auto"
                        >
                          <Smartphone className="w-3 h-3" /> WA
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* INDONESIAN PRINTABLE KWITANSI MODAL */}
      <Modal
        isOpen={isKwitansiModalOpen}
        onClose={() => setIsKwitansiModalOpen(false)}
        title="Dokumen Bukti Bayar / Kwitansi Digital"
        maxWidth="max-w-2xl"
      >
        {kwitansiData && (
          <div className="space-y-6 font-sans select-none">
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 no-print">
              <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse" />
                Bukti Pengeluaran Kas Valid
              </span>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
              >
                <Printer className="w-4 h-4 mr-2" /> Cetak Kwitansi
              </button>
            </div>

            {/* Receipt Printable Card */}
            <div id="printable-kwitansi-area" className="p-8 bg-white   -3xl relative overflow-hidden  -100 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              {/* Ornaments for formal look */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500" />
              
              {/* Header */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-dashed border-slate-200">
                <div>
                  <h2 className="text-xl tracking-tight leading-none tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Kwitansi Bukti Bayar</h2>
                  <p className="text-xs md:text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-widest">OFFICIAL PAYMENT RECEIPT {kwitansiData.seq ? `(KE-${kwitansiData.seq})` : ''}</p>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1.5 bg-slate-950 text-white rounded-xl font-mono text-xs font-bold inline-block leading-none">
                    NO: {kwitansiData.invoice.code || 'KW-X'}
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase font-mono">{kwitansiData.payment.date}</p>
                </div>
              </div>

              {/* Main Metadata Rows */}
              <div className="py-6 space-y-4 text-xs">
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-3 border-b border-slate-100 items-baseline">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Telah Terima Dari :</span>
                  <span className="col-span-1 md:col-span-3 text-slate-800 font-bold uppercase text-xs">Bagian Administrasi Keuangan (Internal ERP)</span>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-3 border-b border-slate-100 items-baseline">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Diserahkan Kepada :</span>
                  <span className="col-span-1 md:col-span-3 text-slate-900 font-bold uppercase text-xs text-indigo-600">{kwitansiData.invoice.supplierName}</span>
                </div>

                {/* Row 3 - Terbilang Huruf */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-3 border-b border-slate-100 items-baseline">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Uang Sejumlah :</span>
                  <span className="col-span-1 md:col-span-3 text-slate-800 font-black tracking-wide text-xs italic bg-slate-50 p-2.5 rounded-lg border border-slate-100 block capitalize">
                    ## {terbilangValue(kwitansiData.payment.amount)} rupiah ##
                  </span>
                </div>

                {/* Row 4 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-1 items-baseline">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Untuk Pembayaran :</span>
                  <span className="col-span-1 md:col-span-3 text-slate-700 font-medium leading-relaxed">
                    Pembayaran Invoice <strong className="font-mono text-slate-900">{kwitansiData.invoice.code}</strong> {kwitansiData.seq ? `(Pembayaran ke-${kwitansiData.seq})` : ''} peruntukan <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold text-[10px]">{kwitansiData.invoice.peruntukan || 'Material Stok'}</span>. Pengeluaran kas terhubung langsung via portofolio akun bank: <strong>{kwitansiData.payment.accountName || 'Rekening Perusahaan'}</strong>.
                  </span>
                </div>
              </div>

              {/* Amount Display & Seal Seal Footer */}
              <div className="pt-6 border-t-2 border-dashed border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6">
                {/* Large visual amount box */}
                <div className="bg-emerald-50/70 border-2 border-emerald-500/20 px-6 py-4 rounded-2xl flex items-center gap-3">
                  <span className="text-emerald-700 font-black text-xs uppercase select-none">Jumlah:</span>
                  <span className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer">
                    {formatIDR(kwitansiData.payment.amount)}
                  </span>
                </div>

                {/* Stamp & Authorized Signature */}
                <div className="relative w-48 text-center sm:text-right select-none">
                  {/* Decorative stamp "METERAI ELEKTRONIK" */}
                  {kwitansiData.payment.amount >= 5000000 && (
                    <div className="absolute -left-16 -top-12 w-24 h-16 border-2 border-dashed border-indigo-500 rounded-lg flex items-center justify-center rotate-12 bg-white/80 backdrop-blur-xs select-none">
                      <div className="text-center font-bold text-xs md:text-[8px] text-indigo-600">
                        <span className="block border-b border-indigo-200 pb-0.5 leading-none">METERAI</span>
                        <span className="block text-[9px] font-black font-mono leading-none py-0.5">Rp 10.000</span>
                        <span className="block border-t border-indigo-200 pt-0.5 text-[6px] tracking-wide leading-none">TEMPEL ELEKTRONIK</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-14">Petugas Verifikasi Kas,</p>
                  <p className="text-xs font-black text-slate-900 underline uppercase leading-none">Sistem Automasi ERP</p>
                  <p className="text-xs md:text-[8px] text-slate-400 font-mono tracking-widest mt-1">SIGNED DIGITAL CERTIFIED</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isPayHutangModalOpen} onClose={() => setIsPayHutangModalOpen(false)} title="Pembayaran Hutang Invoice">
        {payHutangData && (
          <form onSubmit={handleSavePayHutang} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Faktur Pembelian</span>
                <span className="font-mono text-sm font-bold text-indigo-700">{payHutangData.code}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Invoice</span>
                <span className="font-mono text-sm font-bold text-slate-800">{formatIDR(payHutangData.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Telah Dibayar</span>
                <span className="font-mono text-sm font-bold text-emerald-600">{formatIDR(payHutangData.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-xs font-black text-rose-600 uppercase tracking-wider">Sisa Hutang Berjalan</span>
                <span className="font-mono text-lg font-black text-rose-600">{formatIDR((payHutangData.totalAmount || 0) - (payHutangData.paidAmount || 0))}</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Rekening Pembayaran</label>
              <select 
                required
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                value={payHutangForm.bankAccountId}
                onChange={(e) => setPayHutangForm({ ...payHutangForm, bankAccountId: e.target.value })}
              >
                <option value="">-- Pilih Buku Kas / Rekening --</option>
                {(dbState.bank_accounts || []).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} - {a.account_number} (Saldo: {formatIDR(a.current_balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nominal Bayar</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">Rp</span>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3.5 pl-10 pr-4 text-xs text-slate-800 outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 font-medium font-sans"
                  value={payHutangForm.bayarAmount === 0 ? '' : formatInputValue(payHutangForm.bayarAmount)}
                  onChange={(e) => setPayHutangForm({ ...payHutangForm, bayarAmount: parseInputValue(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            {payHutangForm.bayarAmount < ((payHutangData.totalAmount || 0) - (payHutangData.paidAmount || 0)) && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-fadeIn">
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span>⚠️</span> Pembayaran Sebagian / Cicilan
                </p>
                <p className="text-xs text-amber-600 mb-3 leading-relaxed">
                  Nominal bayar lebih kecil dari sisa hutang. Sisa hutang baru akan ditagihkan kembali. Tentukan jatuh tempo berikut:
                </p>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Target Jatuh Tempo Sisa Hutang</label>
                <input
                  type="date"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  value={payHutangForm.dueDate}
                  onChange={(e) => setPayHutangForm({ ...payHutangForm, dueDate: e.target.value })}
                />
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPayHutangModalOpen(false)}
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
        )}
      </Modal>

    </div>
  );
};
