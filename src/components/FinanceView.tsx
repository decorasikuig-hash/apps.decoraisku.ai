/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DollarSign, Wallet, TrendingDown, TrendingUp, FileText, Check, X, Search, Plus, Minus, Printer, User, Hammer, Activity, Clock, HeartHandshake, CheckCircle, AlertTriangle, Trash2, MoreHorizontal, Edit, Eye, Save, Package, Users, ClipboardList, ShoppingCart, Compass, Landmark, Receipt, MapPin, Coins, Edit2, Send } from 'lucide-react';
import { DBState, Transaction, SalaryPayroll, StaffCashAdvance, CraftsmanWorkReport } from '../types';

interface FinanceViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  triggerPdfPrint: (type: 'Payroll' | 'OpnamTukang', data: any) => void;
  activeTab?: 'cash' | 'bank' | 'payable' | 'receivable' | 'payroll' | 'cashadvance' | 'craftsman';
}

import { Modal } from './Modal';
import { PrintPdfModal } from './PrintPdfModal';

export const FinanceView: React.FC<FinanceViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole,
  triggerPdfPrint,
  activeTab: propActiveTab
}) => {
  const [activeTab, setActiveTab] = useState<'cash' | 'bank' | 'payable' | 'receivable' | 'payroll' | 'cashadvance' | 'craftsman'>(propActiveTab || 'cash');

  React.useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    }
  }, [propActiveTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cashTypeFilter, setCashTypeFilter] = useState<'Semua' | 'Pemasukan' | 'Pengeluaran'>('Semua');
  const [payableMonthFilter, setPayableMonthFilter] = useState<string>('Semua');

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [showInActions, setShowInActions] = useState(false);
  const [showOutActions, setShowOutActions] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [viewingTx, setViewingTx] = useState<any>(null);
  const [printingTx, setPrintingTx] = useState<any>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  React.useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownId(null);
      setShowInActions(false);
      setShowOutActions(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  React.useEffect(() => {
    setActiveDropdownId(null);
    setCurrentPage(1);
    setPayableMonthFilter('Semua');
    setSearchTerm('');
  }, [activeTab]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'tx' | 'payroll' | 'kasbon' | 'opnam' | 'omni_in' | 'omni_out' | 'income_manual' | 'income_sales' | 'income_survey' | 'income_bank' | 'expense_purchase' | 'expense_payroll' | 'expense_opnam' | 'expense_manual'>('tx');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [deleteBlockAlert, setDeleteBlockAlert] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';
  const formatIDR = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // Transactions lists
  const getTxsByAccount = (acc: 'Kas Harian' | 'Kas Bank') => {
    return (dbState.transactions || []).filter(tx => tx.account === acc);
  };

  const getBalance = (acc: 'Kas Harian' | 'Kas Bank') => {
    const list = getTxsByAccount(acc);
    return list.reduce((accu, item) => {
      if (item.type === 'Pemasukan') return accu + item.amount;
      return accu - item.amount;
    }, 0);
  };

  // --- SAVE MANUAL TRANSACTION ---
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.description) {
      showToast('Mohon isi nominal, deskripsi & kategori transaksi!', 'error');
      return;
    }

    const list = dbState.transactions || [];
    if (editingTxId) {
      const oldTx = list.find(t => t.id === editingTxId);
      const updatedList = list.map((t: any) => {
        if (t.id === editingTxId) {
          return {
            ...t,
            date: formData.date || new Date().toISOString().split('T')[0],
            description: formData.description,
            type: formData.type || 'Pengeluaran',
            amount: Number(formData.amount),
            category: formData.category
          };
        }
        return t;
      });

      // 1. REKONSILIASI EDIT UNTUK INVOICE
      if (oldTx && oldTx.salesInvoiceId && oldTx.amount !== Number(formData.amount)) {
        const delta = Number(formData.amount) - oldTx.amount;
        const invs = dbState.salesInvoices || [];
        const updatedInvs = invs.map(inv => {
          if (inv.id === oldTx.salesInvoiceId) {
            const newPaid = (inv.paidAmount || 0) + delta;
            return {
              ...inv,
              paidAmount: newPaid,
              status: newPaid >= inv.totalAmount ? 'Lunas' : (newPaid === 0 ? 'Draft' : 'Sebagian')
            };
          }
          return inv;
        });
        saveCollection('salesInvoices', updatedInvs);
      }

      // 2. REKONSILIASI EDIT UNTUK SURVEI
      if (oldTx && oldTx.projectId && oldTx.category === 'Survey' && oldTx.amount !== Number(formData.amount)) {
        const srvs = dbState.surveys || [];
        const updatedSrvs = srvs.map(srv => {
          if (srv.id === oldTx.projectId) {
            return { ...srv, depositAmount: Number(formData.amount) };
          }
          return srv;
        });
        saveCollection('surveys', updatedSrvs);
      }

      saveCollection('transactions', updatedList);
      showToast('Transaksi kas harian & data terkait berhasil diperbarui!', 'success');
      setEditingTxId(null);
    } else {
      const tCode = formData.id || `${formData.type === 'Pemasukan' ? 'REV' : 'EXP'}-${Date.now()}`;
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        code: tCode,
        date: formData.date || new Date().toISOString().split('T')[0],
        description: formData.description,
        type: (formData.type === 'Pemasukan' || formData.type === 'Income') ? 'Pemasukan' : 'Pengeluaran',
        amount: Number(formData.amount),
        category: formData.category,
        account: activeTab === 'cash' ? 'Kas Harian' : 'Kas Bank',
        salesInvoiceId: formData.salesInvoiceId,
        projectId: formData.projectId
      };

      // 1. INTEGRASI INVOICE PENJUALAN
      if (formData.salesInvoiceId) {
        const invs = dbState.salesInvoices || [];
        const updatedInvs = invs.map(inv => {
          if (inv.id === formData.salesInvoiceId) {
            const newPaid = (inv.paidAmount || 0) + newTx.amount;
            return {
              ...inv,
              paidAmount: newPaid,
              status: newPaid >= inv.totalAmount ? 'Lunas' as const : 'Sebagian' as const
            };
          }
          return inv;
        });
        saveCollection('salesInvoices', updatedInvs);
      }

      // 2. INTEGRASI SURVEI
      if (formData.projectId && formData.category === 'Survey') {
        const srvs = dbState.surveys || [];
        const updatedSrvs = srvs.map(srv => {
          if (srv.id === formData.projectId) {
            return {
              ...srv,
              depositStatus: 'Lunas',
              status: 'Selesai' as const,
              paymentMethod: activeTab === 'cash' ? 'Cash' : 'Bank'
            };
          }
          return srv;
        });
        saveCollection('surveys', updatedSrvs);
      }

      // 3. INTEGRASI MUTASI BANK (Jika Transfer Bank)
      if (formData.bankAccountId) {
        const banks = dbState.bank_accounts || [];
        const updatedBanks = banks.map(b => {
          if (b.id === formData.bankAccountId) {
            return { ...b, current_balance: (b.current_balance || 0) - newTx.amount };
          }
          return b;
        });
        saveCollection('bank_accounts', updatedBanks);

        const mutations = dbState.bank_mutations || [];
        const newMutation = {
          id: `mut-${Date.now()}`,
          mutation_code: `OUT-${Date.now()}`,
          bank_account_id: formData.bankAccountId,
          type: 'Keluar' as const,
          category: 'Transfer ke Kas Harian',
          amount: newTx.amount,
          description: `Transfer Mutasi Dana ke Kas Harian: ${newTx.description}`,
          transaction_date: newTx.date
        };
        saveCollection('bank_mutations', [...mutations, newMutation]);
      }

      // 4. INTEGRASI INVOICE PEMBELIAN (VENDOR)
      if (formData.purchaseInvoiceId) {
        const pinvs = dbState.purchaseInvoices || [];
        const updatedPinvs = pinvs.map(iv => {
          if (iv.id === formData.purchaseInvoiceId) {
            return { ...iv, status: 'Paid' as const, paymentAccount: activeTab === 'cash' ? 'Petty Cash' : 'Corporate Bank' };
          }
          return iv;
        });
        saveCollection('purchaseInvoices', updatedPinvs);
      }

      // 5. INTEGRASI PAYROLL (Gaji)
      if (formData.payrollId) {
        const payrolls = dbState.salaries || [];
        const updatedPayrolls = payrolls.map(p => {
          if (p.id === formData.payrollId) {
            return { ...p, status: 'Paid' as const, paymentDate: newTx.date };
          }
          return p;
        });
        saveCollection('salaries', updatedPayrolls);
      }

      // 6. INTEGRASI OPNAM
      if (formData.craftsmanReportId) {
        const reports = dbState.craftsmanReports || [];
        const updatedReports = reports.map(r => {
          if (r.id === formData.craftsmanReportId) {
            return { ...r, status: 'Selesai' as const };
          }
          return r;
        });
        saveCollection('craftsmanReports', updatedReports);
      }

      saveCollection('transactions', [...list, newTx]);
      showToast(`Transaksi ${newTx.code} berhasil dibukukan & Terintegrasi!`, 'success');
    }
    setModalOpen(false);
  };

  const checkTransactionBlock = (tx: Transaction | undefined): boolean => {
    if (!tx) return true;

    // First check via projectId if exists
    if (tx.projectId) {
      const activeQuotations = dbState.quotations || [];
      const hasRAB = activeQuotations.some((q: any) => q.surveyId === tx.projectId || q.id === tx.projectId);
      if (hasRAB) {
        setDeleteBlockAlert({
          isOpen: true,
          message: 'Transaksi tidak dapat diubah/dihapus karena sudah terkoneksi dengan RAB / Survei. Anda harus menghapus penawaran RAB terlebih dahulu.'
        });
        return false;
      }
    }

    // Also check via category "Uang Jaminan/Deposit Survei" and parsing survey code from description if projectId is not set or to be ultra safe
    if (tx.category === 'Uang Jaminan/Deposit Survei' && dbState.surveys) {
      const desc = tx.description || '';
      let surveyCode = '';
      const bracketMatch = desc.match(/\[(SRV-[^\]]+)\]/);
      if (bracketMatch) {
        surveyCode = bracketMatch[1];
      } else {
        surveyCode = desc.split('atas ').pop()?.trim() || '';
      }

      if (surveyCode) {
        const surveyObj = dbState.surveys.find((s: any) => s.code === surveyCode);
        if (surveyObj) {
          const activeQuotations = dbState.quotations || [];
          const hasRAB = activeQuotations.some((q: any) => q.surveyId === surveyObj.id || q.surveyCode === surveyObj.code);
          if (hasRAB) {
            setDeleteBlockAlert({
              isOpen: true,
              message: 'Transaksi deposit survei tidak dapat diubah/dihapus karena data survei terkait sudah ditarik ke dalam Penawaran RAB. Hapus RAB terlebih dahulu!'
            });
            return false;
          }
        }
      }
    }

    return true;
  };

  // --- DELETE TRANSACTION (WITH VEHICLE SYNC) ---
  const handleDeleteTransaction = (txId: string) => {
    console.log('Attempting to delete transaction:', txId);
    
    const currentTxs = dbState.transactions || [];
    const toDeleteTrx = currentTxs.find(t => t.id === txId);
    
    if (!toDeleteTrx) {
      showToast('Transaksi tidak ditemukan!', 'error');
      return;
    }

    if (!checkTransactionBlock(toDeleteTrx)) {
      return;
    }

    // Confirm deletion
    const confirmed = true; // Forcing true to ensure it works in all iframe environments as requested for "tidak fungsi" fix

    const updatedTxs = currentTxs.filter(t => t.id !== txId);
    saveCollection('transactions', updatedTxs);

    // Revert Bank Accounts and Mutations if it's Kas Bank
    if (toDeleteTrx.account === 'Kas Bank') {
      const bankMutations = dbState.bank_mutations || [];
      const matchedMutationIndex = bankMutations.findIndex(m => m.transaction_date === toDeleteTrx.date && Math.abs(m.amount) === toDeleteTrx.amount);
      if (matchedMutationIndex !== -1) {
        const matchedMutation = bankMutations[matchedMutationIndex];
        const updatedAccounts = (dbState.bank_accounts || []).map(a => {
          if (a.id === matchedMutation.bank_account_id) {
            const adjustment = matchedMutation.type === 'Masuk' ? -matchedMutation.amount : matchedMutation.amount;
            return { ...a, current_balance: (a.current_balance || 0) + adjustment };
          }
          return a;
        });
        saveCollection('bank_accounts', updatedAccounts);
        
        const newMutations = [...bankMutations];
        newMutations.splice(matchedMutationIndex, 1);
        saveCollection('bank_mutations', newMutations);
      }
    }

    // Sync Sales Invoices
    let invoiceChanged = false;
    const descLower = (toDeleteTrx.description || '').toLowerCase();
    const isDPorTermin = toDeleteTrx.category === 'Pembayaran DP/Termin Klien' || 
                         toDeleteTrx.category === 'Revisi/Pengembalian Termin Klien' ||
                         descLower.includes('pembayaran termin') || 
                         descLower.includes('danatermin');
    
    if (toDeleteTrx.salesInvoiceId || isDPorTermin) {
      const currentInvoices = dbState.salesInvoices || [];
      const updatedInvoices = currentInvoices.map(inv => {
        const matchesInvoice = toDeleteTrx.salesInvoiceId === inv.id || 
                               (isDPorTermin && toDeleteTrx.description && toDeleteTrx.description.includes(inv.code));
        
        if (matchesInvoice) {
          invoiceChanged = true;
          const adjustment = (toDeleteTrx.type === 'Pemasukan' || toDeleteTrx.type === 'Income') ? -toDeleteTrx.amount : toDeleteTrx.amount;
          const newPaidAmount = Math.max(0, (inv.paidAmount || 0) + adjustment);
          const newStatus = newPaidAmount === 0 ? 'Draft' : (newPaidAmount >= inv.totalAmount ? 'Lunas' : 'Sebagian');
          return { ...inv, paidAmount: newPaidAmount, status: newStatus };
        }
        return inv;
      });
      if (invoiceChanged) {
        saveCollection('salesInvoices', updatedInvoices);
      }
    }

    // Sync surveys
    let surveyChanged = false;
    if (toDeleteTrx.projectId && !toDeleteTrx.salesInvoiceId) {
      const currentSurveys = dbState.surveys || [];
      const updatedSurveys = currentSurveys.map(s => {
        if (s.id === toDeleteTrx.projectId) {
          surveyChanged = true;
          return { ...s, depositStatus: 'Pending', status: 'Pending', paymentMethod: '', bankAccountId: '' };
        }
        return s;
      });
      if (surveyChanged) {
        saveCollection('surveys', updatedSurveys);
      }
    }

    // Sync vehicles...
    const currentVehicles = dbState.vehicles || [];
    let vehicleChanged = false;
    const updatedVehicles = currentVehicles.map(v => {
      let changed = false;
      let taxPayments = v.taxPayments || [];
      let servicePayments = v.servicePayments || [];

      if (taxPayments.some(p => p.txId === txId)) {
        taxPayments = taxPayments.filter(p => p.txId !== txId);
        changed = true;
      }
      if (servicePayments.some(p => p.txId === txId)) {
        servicePayments = servicePayments.filter(p => p.txId !== txId);
        changed = true;
      }

      if (changed) {
        vehicleChanged = true;
        return { ...v, taxPayments, servicePayments };
      }
      return v;
    });

    if (vehicleChanged) {
      saveCollection('vehicles', updatedVehicles);
    }

    // Final user feedback
    if (invoiceChanged) {
      showToast('Transaksi dihapus & status pembayaran Invoice telah dikembalikan!', 'success');
    } else if (surveyChanged) {
      showToast('Transaksi dihapus & status survei dikembalikan ke Pending!', 'success');
    } else if (vehicleChanged) {
      showToast('Transaksi dihapus & status pembayaran kendaraan dikembalikan ke Belum Bayar!', 'success');
    } else {
      showToast('Transaksi manual berhasil dihapus dari pembukuan.', 'success');
    }
  };


  // --- SAVE MANUAL PAYROLL ---
  const handleSavePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.basicSalary) return;

    const matchedEmp = dbState.employees?.find(emp => emp.id === formData.employeeId);
    if (!matchedEmp) return;

    const list = dbState.salaries || [];
    const basic = Number(formData.basicSalary);
    const bonus = Number(formData.bonus || 0);
    const deductions = Number(formData.deductions || 0);

    const newSalary: SalaryPayroll = {
      id: `sal-${Date.now()}`,
      employeeId: formData.employeeId,
      employeeName: matchedEmp.name,
      nip: matchedEmp.nip,
      monthYear: formData.monthYear || 'Juni 2026',
      basicSalary: basic,
      bonus: bonus,
      deductions: deductions,
      totalPaid: basic + bonus - deductions,
      status: 'Diterima',
      paymentDate: formData.paymentDate || new Date().toISOString().split('T')[0]
    };

    saveCollection('salaries', [...list, newSalary]);

    // Debit cash book expense automatically
    const txs = dbState.transactions || [];
    const newTx = {
      id: `tx-${Date.now()}`,
      code: `EXP-${Date.now()}`,
      date: newSalary.paymentDate,
      description: `Beban Gaji/Payroll Karyawan: ${newSalary.employeeName} (${newSalary.monthYear})`,
      type: 'Pengeluaran' as const,
      amount: newSalary.totalPaid,
      category: 'Payroll Gaji',
      account: 'Kas Bank'
    };
    saveCollection('transactions', [...txs, newTx]);

    showToast(`Payroll ${newSalary.employeeName} disalurkan! Pengeluaran didebet di Kas Bank.`, 'success');
    setModalOpen(false);
  };

  // --- SAVE MANUAL KASBON ---
  const handleSaveKasbon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.amount) return;

    const matchedEmp = dbState.employees?.find(emp => emp.id === formData.employeeId);
    if (!matchedEmp) return;

    const list = dbState.cashAdvances || [];
    const codeAdv = `ADV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;

    const newAdv: StaffCashAdvance = {
      id: `adv-${Date.now()}`,
      code: codeAdv,
      employeeId: formData.employeeId,
      employeeName: matchedEmp.name,
      date: formData.date || new Date().toISOString().split('T')[0],
      amount: Number(formData.amount),
      reason: formData.reason || 'Beli konsumsi instalasi paku / tambahan',
      status: 'Pending',
      paymentSource: formData.paymentSource || 'Kas Harian',
      bankAccountId: formData.bankAccountId
    };

    saveCollection('cashAdvances', [...list, newAdv]);
    showToast(`Formulir Kasbon ${newAdv.code} dirilis dewan HR.`, 'success');
    setModalOpen(false);
  };

  // --- APPROVE KASBON (Debit to petty cash) ---
  const handleApproveKasbon = (adv: StaffCashAdvance, status: 'Approved' | 'Rejected') => {
    if (!isSuperOrAdmin) {
      showToast('Otoritas Direksi keuangan dibutuhkan untuk menyetujui kasbon', 'error');
      return;
    }

    if (status === 'Approved') {
      const confirmApprove = window.confirm(
        `Setujui Pengajuan Kasbon ${adv.code}?\n\n` +
        `Nominal: ${formatIDR(adv.amount)}\n` +
        `Sumber: ${adv.paymentSource || 'Kas Harian'}\n\n` +
        `Tindakan ini akan memotong saldo ${adv.paymentSource || 'Kas Harian'} secara otomatis.`
      );
      if (!confirmApprove) return;
    }

    const updated = dbState.cashAdvances.map(a => {
      if (a.id === adv.id) return { ...a, status };
      return a;
    });
    saveCollection('cashAdvances', updated);

    if (status === 'Approved') {
      // Debit from petty cash automatically!
      const txs = dbState.transactions || [];
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        code: `EXP-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: `Beban Kasbon Panjar Kerja: ${adv.employeeName} Ref: ${adv.code}`,
        type: 'Pengeluaran',
        amount: adv.amount,
        category: 'Kasbon Pinjaman',
        account: adv.paymentSource || 'Kas Harian'
      };

      // Bank Integration
      if (adv.paymentSource === 'Kas Bank' && adv.bankAccountId) {
        const banks = dbState.bank_accounts || [];
        const updatedBanks = banks.map(b => {
          if (b.id === adv.bankAccountId) {
            return { ...b, current_balance: (b.current_balance || 0) - adv.amount };
          }
          return b;
        });
        saveCollection('bank_accounts', updatedBanks);

        const mutations = dbState.bank_mutations || [];
        const newMutation = {
          id: `mut-${Date.now()}`,
          mutation_code: `OUT-ADV-${Date.now()}`,
          bank_account_id: adv.bankAccountId,
          type: 'Keluar' as const,
          category: 'Kasbon Staff',
          amount: adv.amount,
          description: `Kasbon Staff: ${adv.employeeName} (${adv.code})`,
          transaction_date: newTx.date
        };
        saveCollection('bank_mutations', [...mutations, newMutation]);
      }

      saveCollection('transactions', [...txs, newTx]);
      showToast(`Kasbon ${adv.code} DISETUJUI! ${adv.paymentSource || 'Kas Harian'} berkurang -${formatIDR(adv.amount)}.`, 'success');
    } else {
      showToast(`Pengajuan Kasbon ${adv.code} DITOLAK.`, 'info');
    }
  };

  // --- OPNAM TUKANG HELPERS ---
  const handleOpnamInvoiceChange = (invoiceId: string) => {
    const invoice = dbState.salesInvoices?.find(si => si.id === invoiceId);
    if (!invoice) {
      setFormData({ ...formData, salesInvoiceId: '', salesInvoiceCode: '', items: [], appraisalValue: 0 });
      return;
    }

    let items = [];
    try {
      items = JSON.parse(invoice.itemsList || '[]');
    } catch (e) {
      items = [];
    }

    const opnamItems = items.map((it: any) => ({
      id: it.id || Math.random().toString(36).substr(2, 9),
      name: it.name || it.item_name || 'Item Pekerjaan',
      dimension: it.dimension || it.spec || '-',
      price: 0, // Reset price for craftsmanship appraisal
      qty: it.qty || it.quantity || 1,
      subtotal: 0
    }));

    setFormData({
      ...formData,
      salesInvoiceId: invoice.id,
      salesInvoiceCode: invoice.code,
      items: opnamItems,
      projectName: invoice.projectName || (dbState.quotations?.find(q => q.code === invoice.quotationCode)?.projectName) || formData.projectName,
      appraisalValue: 0
    });
  };

  const updateOpnamItem = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'price' || field === 'qty') {
      newItems[index].subtotal = Number(newItems[index].price || 0) * Number(newItems[index].qty || 0);
    }
    const total = newItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    setFormData({ ...formData, items: newItems, appraisalValue: total });
  };

  // --- SAVE OPNAM TUKANG (Pre-workmanship achievement) ---
  const handleSaveOpnam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.craftsmanName || !formData.appraisalValue) {
      showToast('Mohon isi nama tukang dan rincian pekerjaan!', 'error');
      return;
    }

    const list = dbState.craftsmanReports || [];
    const codeOp = `OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;

    const newOp: CraftsmanWorkReport = {
      id: `rep-${Date.now()}`,
      code: codeOp,
      projectName: formData.projectName || 'Pekerjaan Borongan',
      craftsmanName: formData.craftsmanName,
      workDescription: formData.workDescription || 'Berita Acara Opnam Prestasi Kerja',
      date: formData.date || new Date().toISOString().split('T')[0],
      appraisalValue: Number(formData.appraisalValue),
      status: 'Pending',
      salesInvoiceId: formData.salesInvoiceId,
      salesInvoiceCode: formData.salesInvoiceCode,
      items: formData.items
    };

    saveCollection('craftsmanReports', [...list, newOp]);
    showToast(`Berita Acara Opnam ${newOp.code} berhasil dirilis.`, 'success');
    setModalOpen(false);
  };

  // --- APPROVE OPNAM TUKANG ---
  const handleApproveOpnam = (op: CraftsmanWorkReport, status: 'Approved' | 'Rejected') => {
    if (!isSuperOrAdmin) {
      showToast('Mandor tidak berwenang, harus Admin / Super Admin utama', 'error');
      return;
    }

    const updated = dbState.craftsmanReports.map(o => {
      if (o.id === op.id) return { ...o, status };
      return o;
    });
    saveCollection('craftsmanReports', updated);

    if (status === 'Approved') {
      // Debit to petty cash
      const txs = dbState.transactions || [];
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        code: `EXP-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: `Beban Opnam Tukang: ${op.craftsmanName} Ref: ${op.code}`,
        type: 'Pengeluaran',
        amount: op.appraisalValue,
        category: 'Upah Tukang Opnam',
        account: 'Kas Harian'
      };
      saveCollection('transactions', [...txs, newTx]);
      showToast(`Opnam ${op.code} APPROVED! Kas harian dipotong ${formatIDR(op.appraisalValue)} untuk upah tukang.`, 'success');
    } else {
      showToast(`Prestasi Opnam ${op.code} DITOLAK.`, 'info');
    }
  };

  const getFilteredItems = () => {
    const term = searchTerm.toLowerCase();
    let items: any[] = [];
    if (activeTab === 'cash' || activeTab === 'bank') {
      items = getTxsByAccount(activeTab === 'cash' ? 'Kas Harian' : 'Kas Bank');
      if (cashTypeFilter !== 'Semua') {
        items = items.filter(tx => tx.type === cashTypeFilter);
      }
      items = items.filter(tx => tx.description.toLowerCase().includes(term) || tx.code.toLowerCase().includes(term));
    } else if (activeTab === 'payroll') {
      items = (dbState.salaries || []).filter(p => p.employeeName.toLowerCase().includes(term) || (p as any).code?.toLowerCase().includes(term));
    } else if (activeTab === 'cashadvance') {
      items = (dbState.cashAdvances || []).filter(c => c.employeeName.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
    } else if (activeTab === 'craftsman') {
      items = (dbState.craftsmanReports || []).filter(r => r.craftsmanName.toLowerCase().includes(term) || r.code.toLowerCase().includes(term));
    } else if (activeTab === 'receivable') {
      items = (dbState.salesInvoices || []).filter(i => i.customerName.toLowerCase().includes(term) || i.code.toLowerCase().includes(term));
    } else if (activeTab === 'payable') {
      const activePayables = (dbState.purchaseInvoices || []).filter(i => 
        (i.status === 'Unpaid' || i.status === 'Partial' || i.totalAmount > (i.paidAmount || 0)) && 
        i.status !== 'Draft' && i.status !== 'Paid' && i.status !== 'Completed'
      );
      items = activePayables;
      if (payableMonthFilter !== 'Semua') {
        items = items.filter(i => i.date && i.date.startsWith(payableMonthFilter));
      }
      items = items.filter(i => i.supplierName.toLowerCase().includes(term) || i.code.toLowerCase().includes(term));
    }
    return [...items].reverse();
  };

  const filteredItems = getFilteredItems();
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans">
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
    <div className="animate-fadeIn flex flex-col h-full space-y-5 uppercase">
      
      {/* SECTION NAV TABS HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 shrink-0">
            <div>
              <h3 className="text-lg text-slate-900 font-semibold font-sans tracking-tight capitalize">
                {propActiveTab === 'cash' ? 'Kas Harian' :
                 propActiveTab === 'payable' ? 'Laporan Hutang (A/P)' :
                 propActiveTab === 'receivable' ? 'Laporan Piutang (A/R)' :
                 propActiveTab === 'payroll' ? 'Payroll Gaji Bulanan' :
                 propActiveTab === 'cashadvance' ? 'Laporan Kasbon Staff' :
                 propActiveTab === 'craftsman' ? 'Laporan Opnam Tukang' :
                 'Kas Harian'}
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {propActiveTab === 'cash' ? 'Pantau likuiditas real-time kas harian operasional.' :
                 propActiveTab === 'payable' ? 'Daftar rincian tagihan pembelian material vendor yang masih aktif.' :
                 propActiveTab === 'receivable' ? 'Daftar rincian piutang kontrak proyek interior klien berjalan.' :
                 propActiveTab === 'payroll' ? 'Kelola penggajian bulanan staf dan karyawan lapangan.' :
                 propActiveTab === 'cashadvance' ? '' :
                 propActiveTab === 'craftsman' ? '' :
                 'Pantau sisa hutang, piutang, gaji bulanan, & prestasi mingguan.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isSuperOrAdmin && activeTab === 'cashadvance' && (
              <button
                onClick={() => {
                  setModalType('kasbon');
                  setFormData({
                    employeeId: dbState.employees?.[0]?.id || '',
                    amount: 1000000,
                    date: new Date().toISOString().split('T')[0],
                    reason: 'Belanja paku rivet stainless steel & isolasi tebal',
                    paymentSource: 'Kas Harian'
                  });
                  setModalOpen(true);
                }}
                className="bg-indigo-50 text-indigo-600 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-indigo-100 transition-all shadow-sm border-none cursor-pointer"
                title="Ajukan Kasbon Operasional"
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>
            )}
            {isSuperOrAdmin && activeTab === 'craftsman' && (
              <button
                onClick={() => {
                  setModalType('opnam');
                  setFormData({
                    craftsmanName: '',
                    projectName: '',
                    appraisalValue: 0,
                    workDescription: '',
                    date: new Date().toISOString().split('T')[0],
                    items: []
                  });
                  setModalOpen(true);
                }}
                className="bg-indigo-50 text-indigo-600 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-indigo-100 transition-all shadow-sm border-none cursor-pointer"
                title="Rilis Berita Acara Opnam"
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>
            )}
            {isSuperOrAdmin && activeTab === 'payroll' && (
              <button
                onClick={() => {
                  setModalType('payroll');
                  setFormData({
                    employeeId: '',
                    basicSalary: 0,
                    bonus: 0,
                    deductions: 0,
                    monthYear: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
                    paymentDate: new Date().toISOString().split('T')[0]
                  });
                  setModalOpen(true);
                }}
                className="bg-indigo-50 text-indigo-600 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-indigo-100 transition-all shadow-sm border-none cursor-pointer"
                title="Rilis Slip Gaji Baru"
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>
            )}
            {isSuperOrAdmin && activeTab === 'cash' && (
              <div className="flex items-center gap-2">
                {/* PEMASUKAN (+) */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowInActions(!showInActions); setShowOutActions(false); }}
                    className="bg-emerald-50 text-emerald-600 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-emerald-100 transition-all shadow-sm border-none cursor-pointer"
                    title="Pemasukan Dana Baru (+)"
                  >
                    <Plus className="w-5 h-5 font-bold" />
                  </button>
                  
                  <AnimatePresence>
                    {showInActions && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-2 z-50 min-w-max"
                      >
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl w-14 h-14 hover:bg-emerald-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pemasukan', category: 'Setoran Modal', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Setoran Modal Pemilik/Investor' });
                            setModalOpen(true);
                            setShowInActions(false);
                          }}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Modal</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-blue-50 text-blue-600 rounded-xl w-14 h-14 hover:bg-blue-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pemasukan', category: 'Piutang Penjualan', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Penerimaan Tunai Penjualan' });
                            setModalOpen(true);
                            setShowInActions(false);
                          }}
                        >
                          <ShoppingCart className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Jual</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-amber-50 text-amber-600 rounded-xl w-14 h-14 hover:bg-amber-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pemasukan', category: 'Uang Jaminan/Deposit', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Penerimaan Deposit' });
                            setModalOpen(true);
                            setShowInActions(false);
                          }}
                        >
                          <MapPin className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Survei</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl w-14 h-14 hover:bg-indigo-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pemasukan', category: 'Mutasi dari Kas Bank', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Tarik Tunai dari Bank...' });
                            setModalOpen(true);
                            setShowInActions(false);
                          }}
                        >
                          <Coins className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Bank</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* PENGELUARAN (-) */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowOutActions(!showOutActions); setShowInActions(false); }}
                    className="bg-rose-50 text-rose-600 rounded-xl w-10 h-10 flex items-center justify-center hover:bg-rose-100 transition-all shadow-sm border-none cursor-pointer"
                    title="Pengeluaran Dana Baru (-)"
                  >
                    <Minus className="w-5 h-5 font-bold" />
                  </button>

                  <AnimatePresence>
                    {showOutActions && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-2 z-50 min-w-max"
                      >
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-14 h-14 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pengeluaran', category: 'Belanja Material', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Belanja Material Operasional' });
                            setModalOpen(true);
                            setShowOutActions(false);
                          }}
                        >
                          <ShoppingCart className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Beli</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-14 h-14 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pengeluaran', category: 'Gaji & Upah', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Bayar Gaji/Upah Kerja' });
                            setModalOpen(true);
                            setShowOutActions(false);
                          }}
                        >
                          <Plus className="w-5 h-5 scale-x-[-1] rotate-45" />
                          <span className="text-[9px] mt-1 font-bold">Gaji</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-14 h-14 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pengeluaran', category: 'Biaya Opnam/Proyek', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Biaya Opnam Proyek' });
                            setModalOpen(true);
                            setShowOutActions(false);
                          }}
                        >
                          <Edit2 className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Opnam</span>
                        </button>
                        <button 
                          type="button"
                          className="flex flex-col items-center justify-center bg-slate-50 text-slate-600 rounded-xl w-14 h-14 hover:bg-slate-100 transition-all duration-200 border-none cursor-pointer" 
                          onClick={() => { 
                            setEditingTxId(null);
                            setModalType('tx');
                            setFormData({ type: 'Pengeluaran', category: 'Biaya Lainnya', amount: 0, date: new Date().toISOString().split('T')[0], description: 'Pengeluaran Kas Harian Lainnya' });
                            setModalOpen(true);
                            setShowOutActions(false);
                          }}
                        >
                          <Minus className="w-5 h-5" />
                          <span className="text-[9px] mt-1 font-bold">Lain</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div className="hidden xl:block">
              {propActiveTab !== 'payable' && propActiveTab !== 'receivable' && activeTab !== 'cash' && (
                <div className="flex flex-wrap bg-slate-100 p-1 rounded-full items-center w-fit gap-0.5">
                  <button onClick={() => setActiveTab('cash')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'cash' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Kas Harian</button>
                  <button onClick={() => setActiveTab('bank')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'bank' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Kas Bank</button>
                  <button onClick={() => setActiveTab('payable')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'payable' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Hutang</button>
                  <button onClick={() => setActiveTab('receivable')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'receivable' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Piutang</button>
                  <button onClick={() => setActiveTab('payroll')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'payroll' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Payroll</button>
                  <button onClick={() => setActiveTab('cashadvance')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'cashadvance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Kasbon</button>
                  <button onClick={() => setActiveTab('craftsman')} className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'craftsman' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Opnam Tukang</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RENDER VIEW 1: KAS HARIAN / PETTY CASH LEDGER */}
      {(activeTab === 'cash' || activeTab === 'bank') && (
        <div className="space-y-4 flex flex-col flex-grow">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="p-4 bg-indigo-50/50 rounded-2xl">
              <div className="text-[10px] text-indigo-600 font-mono font-bold uppercase tracking-wider">UANG MASUK (INCOME)</div>
              <strong className="text-xl font-mono text-indigo-800 font-black">
                {formatIDR(getTxsByAccount(activeTab === 'cash' ? 'Kas Harian' : 'Kas Bank').filter(t => t.type === 'Pemasukan').reduce((a, b) => a + b.amount, 0))}
              </strong>
              <div className="text-[9.5px] text-slate-450 mt-1">Dicatat dari Survey & Termin Klien</div>
            </div>
            <div className="p-4 bg-rose-50/50 rounded-2xl">
              <div className="text-[10px] text-rose-600 font-mono font-bold uppercase tracking-wider">UANG KELUAR (EXPENSE)</div>
              <strong className="text-xl font-mono text-rose-800 font-black">
                {formatIDR(getTxsByAccount(activeTab === 'cash' ? 'Kas Harian' : 'Kas Bank').filter(t => t.type === 'Pengeluaran').reduce((a, b) => a + b.amount, 0))}
              </strong>
              <div className="text-[9.5px] text-slate-450 mt-1">Beban Sourcing Kayu, Gaji, & Kasbon</div>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl">
              <div className="text-[10px] text-emerald-600 font-mono font-bold uppercase tracking-wider">SISA SALDO (NET)</div>
              <strong className="text-xl font-mono text-emerald-800 font-black">
                {formatIDR(getBalance(activeTab === 'cash' ? 'Kas Harian' : 'Kas Bank'))}
              </strong>
              <div className="text-[9.5px] text-slate-500 mt-1">Estimasi Likuiditas Kas Aktif</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari logs ledgers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 bg-slate-50 border-none rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {activeTab === 'cash' && (
                <div className="flex bg-slate-100 p-0.5 rounded-lg items-center">
                  <button 
                    onClick={() => setCashTypeFilter('Semua')} 
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${cashTypeFilter === 'Semua' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    SEMUA
                  </button>
                  <button 
                    onClick={() => setCashTypeFilter('Pemasukan')} 
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${cashTypeFilter === 'Pemasukan' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    TRANSAKSI MASUK
                  </button>
                  <button 
                    onClick={() => setCashTypeFilter('Pengeluaran')} 
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${cashTypeFilter === 'Pengeluaran' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    TRANSAKSI KELUAR
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-grow flex flex-col">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 flex-grow shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Kode Vouch.</th>
                    <th className="px-5 py-3">Kategori Beban</th>
                    <th className="px-5 py-3">Deskripsi Ledger Alokasi</th>
                    <th className="px-5 py-3 text-center">Tipe Aliran</th>
                    <th className="px-5 py-3 text-right">Biaya Nominal</th>
                    {isSuperOrAdmin && <th className="px-5 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-amber-500 hover:text-slate-950/20 align-top">
                        <td className="px-5 py-3.5 font-mono text-slate-450 whitespace-nowrap">{tx.date}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-800 font-bold whitespace-nowrap">{tx.code}</td>
                        <td className="px-5 py-3.5 text-indigo-700 whitespace-normal min-w-[120px] max-w-[150px] break-words" title={tx.category}>{tx.category}</td>
                        <td className="px-5 py-3.5 text-slate-900 font-bold whitespace-normal break-words leading-relaxed" title={tx.description}>{tx.description}</td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${tx.type === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`px-5 py-3.5 text-right font-mono font-bold whitespace-nowrap ${tx.type === 'Pemasukan' ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {tx.type === 'Pemasukan' ? '+' : '-'}{formatIDR(tx.amount)}
                        </td>
                        {isSuperOrAdmin && (
                          <td className="px-5 py-3.5 text-right relative whitespace-nowrap">
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(activeDropdownId === tx.id ? null : tx.id);
                                }}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent inline-flex items-center justify-center ${
                                  activeDropdownId === tx.id
                                    ? 'text-indigo-600 bg-indigo-50'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                                title="Pilihan Aksi"
                              >
                                <MoreHorizontal className="w-5 h-5 pointer-events-none" />
                              </button>
                            </div>

                            <AnimatePresence>
                              {activeDropdownId === tx.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                  transition={{ duration: 0.15, ease: 'easeOut' }}
                                  className="absolute right-4 top-11 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] py-1.5 z-40 text-left min-w-[155px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingTx(tx);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" /> Lihat Detail
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!checkTransactionBlock(tx)) {
                                        setActiveDropdownId(null);
                                        return;
                                      }
                                      setEditingTxId(tx.id);
                                      setModalType('tx');
                                      setFormData({
                                        type: tx.type,
                                        category: tx.category,
                                        date: tx.date,
                                        amount: tx.amount,
                                        description: tx.description
                                      });
                                      setModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Transaksi
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPrintingTx(tx);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-slate-500" /> Cetak Kwitansi
                                  </button>

                                  <div className="border-t border-slate-100 my-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteTransaction(tx.id);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-3 py-2.5 hover:bg-rose-50 text-rose-600 hover:text-rose-705 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Hapus Transaksi
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isSuperOrAdmin ? 7 : 6} className="px-5 py-8 text-center text-slate-400">Belum ada aktivitas finansial terekam di akun ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* RENDER VIEW 2: LAPORAN HUTANG (UNPAID PURCHASE INVOICES) */}
      {activeTab === 'payable' && (() => {
        // Helper to format Month in Indonesian
        const formatMonthYearIndo = (ymStr: string) => {
          if (!ymStr) return '-';
          if (ymStr === 'Semua') return 'Semua Bulan';
          const parts = ymStr.split('-');
          if (parts.length < 2) return ymStr;
          const year = parts[0];
          const monthNum = parseInt(parts[1], 10);
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          return `${monthNames[monthNum - 1] || ''} ${year}`;
        };

        // Extract all active payables (no draft, no fully paid)
        const allActivePayables = (dbState.purchaseInvoices || []).filter(i => 
          (i.status === 'Unpaid' || i.status === 'Partial' || i.totalAmount > (i.paidAmount || 0)) && 
          i.status !== 'Draft' && i.status !== 'Paid' && i.status !== 'Completed'
        );

        // Total stats
        const totalActiveDebt = allActivePayables.reduce((acc, curr) => acc + (curr.totalAmount - (curr.paidAmount || 0)), 0);
        const totalPaidDebt = allActivePayables.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
        const totalOriginalDebtVal = allActivePayables.reduce((acc, curr) => acc + curr.totalAmount, 0);

        // Overdue stats
        const todayStr = new Date().toISOString().split('T')[0];
        const overduePayables = allActivePayables.filter(i => i.dueDate && i.dueDate < todayStr);
        const totalOverdueDebt = overduePayables.reduce((acc, curr) => acc + (curr.totalAmount - (curr.paidAmount || 0)), 0);

        // Group items by month (YYYY-MM)
        const monthlyGroups: Record<string, {
          monthKey: string;
          count: number;
          totalAmt: number;
          paidAmt: number;
          remainingAmt: number;
          items: any[];
        }> = {};

        allActivePayables.forEach(inv => {
          const monthKey = inv.date ? inv.date.slice(0, 7) : 'Unknown';
          if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = {
              monthKey,
              count: 0,
              totalAmt: 0,
              paidAmt: 0,
              remainingAmt: 0,
              items: []
            };
          }
          const remaining = inv.totalAmount - (inv.paidAmount || 0);
          monthlyGroups[monthKey].count += 1;
          monthlyGroups[monthKey].totalAmt += inv.totalAmount;
          monthlyGroups[monthKey].paidAmt += (inv.paidAmount || 0);
          monthlyGroups[monthKey].remainingAmt += remaining;
          monthlyGroups[monthKey].items.push(inv);
        });

        // Convert to array and sort by month key desc
        const monthlyReportList = Object.values(monthlyGroups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        return (
          <div className="space-y-6 flex flex-col flex-grow">
            <div className="bg-amber-50/40 p-4 border border-amber-100 rounded-2xl flex gap-3 text-xs items-start leading-relaxed text-amber-800 font-sans shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <strong>Laporan Hutang Usaha (A/P):</strong> Di bawah ini menampilkan tagihan pembelian bahan material vendor yang masih aktif (Belum Lunas / Sebagian). Membantu meminta persetujuan dana dan memantau realisasi pembayaran tempo serta mendukung tim purchasing.
              </div>
            </div>

            {/* RINGKASAN HUTANG SEJAJAR 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 font-sans">
              <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-rose-600 font-mono font-bold uppercase tracking-wider">TOTAL SISA HUTANG BERJALAN</div>
                <strong className="text-2xl font-mono text-rose-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalActiveDebt)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-rose-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Hutang Pokok: {formatIDR(totalOriginalDebtVal)}</span>
                  <span className="font-bold text-slate-700">{allActivePayables.length} Faktur</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-amber-600 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> HUTANG MELEBIHI JATUH TEMPO
                </div>
                <strong className="text-2xl font-mono text-amber-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalOverdueDebt)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-amber-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Batas Termin Lewat</span>
                  <span className="font-bold text-slate-700">{overduePayables.length} Faktur</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-emerald-600 font-mono font-bold uppercase tracking-wider">TOTAL TERBAYAR (AKUMULATIF)</div>
                <strong className="text-2xl font-mono text-emerald-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalPaidDebt)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-emerald-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Realisasi Pembayaran</span>
                  <span className="font-bold text-emerald-700">Vendor Supplier</span>
                </div>
              </div>
            </div>

            {/* TABEL RINCIAN DOKUMEN FAKTUR HUTANG */}
            <div className="flex-grow flex flex-col space-y-3">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  📋 DAFTAR RINCIAN HUTANG [SEMUA BULAN]
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100 flex-grow scrollbar-hide shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                      <th className="px-5 py-3 whitespace-nowrap">No. Faktur Vendor</th>
                      <th className="px-5 py-3 whitespace-nowrap">Supplier</th>
                      <th className="px-5 py-3 whitespace-nowrap">PO Pendukung</th>
                      <th className="px-5 py-3 whitespace-nowrap">Tanggal & Jatuh Tempo</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap">Nilai Invoice</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap text-emerald-600">Sdh Dibayar</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap text-rose-600">Sisa Hutang</th>
                      <th className="px-5 py-3 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-705 font-sans">
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map((pinv: any) => {
                        const isOverdue = pinv.dueDate && pinv.dueDate < todayStr;
                        const outstanding = pinv.totalAmount - (pinv.paidAmount || 0);
                        return (
                          <tr key={pinv.id} className="hover:bg-amber-500 hover:text-slate-950/20 align-top">
                            <td className="px-5 py-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                              {pinv.code}
                            </td>
                            <td className="px-5 py-3.5 text-slate-800 font-extrabold whitespace-nowrap">
                              {pinv.supplierName}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-450 whitespace-nowrap text-[10px]">
                              {pinv.poCode || '-'}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5 leading-tight animate-slideDown">
                                <span className="font-mono text-slate-500 text-[10px]">{pinv.date}</span>
                                {pinv.dueDate ? (
                                  <span className={`font-mono text-[9.5px] px-1.5 py-0.5 rounded w-max mt-0.5 ${
                                    isOverdue 
                                      ? 'bg-rose-50 border border-rose-200 text-rose-600 font-bold' 
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    J.T: {pinv.dueDate} {isOverdue && '(MELEBIHI)'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-350 italic">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                              {formatIDR(pinv.totalAmount)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-medium whitespace-nowrap">
                              {formatIDR(pinv.paidAmount || 0)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              {formatIDR(outstanding)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                                pinv.status === 'Partial' || outstanding < pinv.totalAmount && outstanding > 0
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-rose-100 text-rose-750 border border-rose-200'
                              }`}>
                                {pinv.status === 'Partial' || outstanding < pinv.totalAmount && outstanding > 0
                                  ? 'Bagian'
                                  : 'Belum Lunas'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          Tidak ada data faktur hutang aktif terekam pada filter periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </div>
          </div>
        );
      })()}

      {/* RENDER VIEW 3: LAPORAN PIUTANG (CLIENT UNPAID BALANCES) */}
      {activeTab === 'receivable' && (() => {
        const allActiveInvoices = (dbState.salesInvoices || []).filter(inv =>
          (inv.status === 'Sebagian' || inv.status === 'Belum Bayar' || inv.totalAmount > (inv.paidAmount || 0)) &&
          inv.status !== 'Draft'
        );

        const totalActiveReceivables = allActiveInvoices.reduce((acc, curr) => acc + (curr.totalAmount - (curr.paidAmount || 0)), 0);
        const totalReceivedPayments = allActiveInvoices.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
        const totalOriginalInvoiceVal = allActiveInvoices.reduce((acc, curr) => acc + curr.totalAmount, 0);

        return (
          <div className="space-y-6 flex flex-col flex-grow">
            <div className="bg-amber-50/40 p-4 border border-amber-100 rounded-2xl flex gap-3 text-xs items-start leading-relaxed text-amber-800 font-sans shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <strong>Laporan Piutang Klien (A/R Ledger):</strong> Menelusuri semua kontrak rancangan interior buatan yang pembayarannya parsial (termin). Sisa pihaknya otomatis ditampung di sini guna mendukung tim CRM menagih cicilan termin kedua serta memperkuat cash inflow.
              </div>
            </div>

            {/* RINGKASAN PIUTANG SEJAJAR 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 font-sans">
              <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-rose-600 font-mono font-bold uppercase tracking-wider">TOTAL OUTSTANDING PIUTANG KLIEN</div>
                <strong className="text-2xl font-mono text-rose-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalActiveReceivables)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-rose-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Arrears Belum Lunas</span>
                  <span className="font-bold text-slate-700">{allActiveInvoices.length} Kontrak</span>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-indigo-600 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  DP / TERMIN MASUK (AKUMULATIF)
                </div>
                <strong className="text-2xl font-mono text-indigo-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalReceivedPayments)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-indigo-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Pendapatan Realisasi</span>
                  <span className="font-bold text-slate-700">{allActiveInvoices.length} Projek</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl shadow-sm">
                <div className="text-[10px] text-emerald-600 font-mono font-bold uppercase tracking-wider">TOTAL NILAI KONTRAK TERBIT</div>
                <strong className="text-2xl font-mono text-emerald-800 font-black tracking-tight block mt-1">
                  {formatIDR(totalOriginalInvoiceVal)}
                </strong>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-emerald-100/50 text-[10px] text-slate-500 font-mono">
                  <span>Estimasi Omset Bruto</span>
                  <span className="font-bold text-emerald-700">Client Invoiced</span>
                </div>
              </div>
            </div>

            <div className="flex-grow flex flex-col space-y-3">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  📋 DAFTAR RINCIAN PIUTANG KLIEN [SEMUA BULAN]
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100 flex-grow scrollbar-hide shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
                <table className="w-full text-left text-xs border-collapse font-medium text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                      <th className="px-5 py-3 whitespace-nowrap">No. Faktur Klien</th>
                      <th className="px-5 py-3 whitespace-nowrap">Nama Pemilik Proyek</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap">Nilai Kontrak Total</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap">Uang Muka Termin</th>
                      <th className="px-5 py-3 text-right text-rose-600 font-bold whitespace-nowrap">Outstanding Piutang</th>
                      <th className="px-5 py-3 whitespace-nowrap">Konfirmasi Keuangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-705 font-sans">
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map((sinv: any) => {
                        const outstanding = sinv.totalAmount - sinv.paidAmount;
                        return (
                          <tr key={sinv.id} className="hover:bg-amber-500 hover:text-slate-950/20">
                            <td className="px-5 py-3.5 font-bold font-mono text-slate-905 whitespace-nowrap">{sinv.code}</td>
                            <td className="px-5 py-3.5 text-slate-800 font-extrabold whitespace-nowrap">{sinv.customerName}</td>
                            <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatIDR(sinv.totalAmount)}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-emerald-600 whitespace-nowrap">{formatIDR(sinv.paidAmount)}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-black text-rose-600 whitespace-nowrap">{formatIDR(outstanding)}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="bg-rose-50 text-rose-550 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">Tagihan Aktif</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Luar biasa! Tidak ada piutang tertunda secara komersial dari klien.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination()}
            </div>
          </div>
        );
      })()}

      {/* RENDER VIEW 4: PAYROLL GAJI LIST */}
      {activeTab === 'payroll' && (
        <div className="space-y-4 flex flex-col flex-grow">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div />
          </div>

          <div className="flex-grow flex flex-col">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 flex-grow scrollbar-hide shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
              <table className="w-full text-left text-xs border-collapse font-medium text-slate-700">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                    <th className="px-5 py-3 whitespace-nowrap">Nama Pegawai / NIP</th>
                    <th className="px-5 py-3 whitespace-nowrap">Bulan Periode</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Gaji Pokok</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Bonus Desain</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Potongan</th>
                    <th className="px-5 py-3 text-right text-emerald-700 whitespace-nowrap">Gaji Bersih Diterima</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-705 font-sans">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((sal: any) => (
                      <tr key={sal.id} className="hover:bg-amber-500 hover:text-slate-950/20">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{sal.employeeName}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{sal.nip}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-505 font-bold whitespace-nowrap">{sal.monthYear}</td>
                        <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatIDR(sal.basicSalary)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600 whitespace-nowrap">+{formatIDR(sal.bonus)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-500 whitespace-nowrap">-{formatIDR(sal.deductions)}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">{formatIDR(sal.totalPaid)}</td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => triggerPdfPrint('Payroll', sal)}
                            className="bg-slate-100 p-1.5 rounded-lg text-slate-650 hover:text-slate-900 hover:bg-amber-500 hover:text-slate-950 cursor-pointer text-xs flex items-center justify-center border-none"
                            title="Print Slip Gaji PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Belum ada slip gaji pegawai diterbitkan di database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* RENDER VIEW 5: LAPORAN KASBON STAFF */}
      {activeTab === 'cashadvance' && (
        <div className="space-y-4 flex flex-col flex-grow">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
            <div className="relative group w-full max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Cari nama pegawai atau kode kasbon..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div />
          </div>

          <div className="flex-grow flex flex-col pt-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 font-medium text-slate-700 flex-grow scrollbar-hide shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                    <th className="px-5 py-3 whitespace-nowrap">No. Kasbon</th>
                    <th className="px-5 py-3 whitespace-nowrap">Nama Pegawai Lapangan</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Nilai Kasbon</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tanggal Pengajuan</th>
                    <th className="px-5 py-3 whitespace-nowrap">Sumber Dana</th>
                    <th className="px-5 py-3 whitespace-nowrap">Keterangan Ops.</th>
                    <th className="px-5 py-3 whitespace-nowrap">Status Verifikasi</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Persetujuan Keuangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-705 font-sans">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((adv: any) => (
                      <tr key={adv.id} className="hover:bg-amber-500 hover:text-slate-950/20">
                        <td className="px-5 py-3.5 font-bold font-mono text-slate-900 whitespace-nowrap">{adv.code}</td>
                        <td className="px-5 py-3.5 text-slate-800 font-extrabold whitespace-nowrap">{adv.employeeName}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-650 whitespace-nowrap">{formatIDR(adv.amount)}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">{adv.date}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            adv.paymentSource === 'Kas Bank' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            {adv.paymentSource || 'Kas Harian'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-505 max-w-xs truncate whitespace-nowrap">{adv.reason}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            adv.status === 'Approved' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                            adv.status === 'Rejected' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                            'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                          }`}>
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap font-bold">
                          {adv.status === 'Pending' && isSuperOrAdmin ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleApproveKasbon(adv, 'Approved')}
                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproveKasbon(adv, 'Rejected')}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">Persetujuan Terkunci</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Belum ada pengajuan kasbon darurat lapangan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        </div>
      )}

      {/* RENDER VIEW 6: LAPORAN OPNAM TUKANG Achievement */}
      {activeTab === 'craftsman' && (
        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="relative group w-full max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Cari tukang atau kode opnam..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 font-medium text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
                  <th className="px-5 py-3 whitespace-nowrap">ID Opnam</th>
                  <th className="px-5 py-3 whitespace-nowrap">Nama Tukang Opnam</th>
                  <th className="px-5 py-3 whitespace-nowrap">Ref Invoice</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Nilai Upah</th>
                  <th className="px-5 py-3 whitespace-nowrap">Tgl Opnam</th>
                  <th className="px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Aksi Mandor / Keuangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-705 bg-white">
                {dbState.craftsmanReports && dbState.craftsmanReports.length > 0 ? (
                  dbState.craftsmanReports
                    .slice()
                    .reverse()
                    .filter(op => 
                      op.craftsmanName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      op.code.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-5 py-3.5 font-mono text-slate-400 font-bold whitespace-nowrap group-hover:text-slate-600">{op.code}</td>
                      <td className="px-5 py-3.5 text-slate-800 font-extrabold whitespace-nowrap uppercase tracking-tight">{op.craftsmanName}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[10px] text-indigo-600 font-bold">
                        {op.salesInvoiceCode || <span className="text-slate-300 italic">- Non Invoice -</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-black text-rose-700 whitespace-nowrap">{formatIDR(op.appraisalValue)}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">{op.date}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          op.status === 'Approved' ? 'bg-teal-50 text-teal-650 border-teal-100' :
                          op.status === 'Rejected' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex gap-2 justify-end items-center">
                          <button
                            onClick={() => triggerPdfPrint('OpnamTukang', op)}
                            className="bg-slate-100 p-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                            title="Print Lembar Prestasi PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {op.status === 'Pending' && isSuperOrAdmin ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApproveOpnam(op, 'Approved')}
                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproveOpnam(op, 'Rejected')}
                                className="bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">Arsip Permanen</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Belum ada rilis berita acara opnam tukang rilis mandor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FINANCE CREATION SHEET POPUP MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalType === 'omni_in' ? 'Pilih Jenis Pemasukan' :
          modalType === 'omni_out' ? 'Pilih Jenis Pengeluaran' :
          modalType === 'income_manual' ? 'Catat Tambahan Modal (Revenue)' :
          modalType === 'income_sales' ? 'Catat Pelunasan Penjualan (Revenue)' :
          modalType === 'income_survey' ? 'Catat Deposit Survei (Revenue)' :
          modalType === 'income_bank' ? 'Mutasi Masuk dari Bank (Transfer)' :
          modalType === 'expense_purchase' ? 'Catat Pembayaran Vendor (Expense)' :
          modalType === 'expense_payroll' ? 'Catat Pembayaran Gaji (Expense)' :
          modalType === 'expense_opnam' ? 'Catat Pembayaran Opnam (Expense)' :
          modalType === 'expense_manual' ? 'Catat Pengeluaran Lainnya (Expense)' :
          modalType === 'tx' ? (editingTxId ? 'Ubah Catatan Kas' : 'Catat Kas Manual') :
          modalType === 'payroll' ? 'Rilis Slip Gaji Bulanan Karyawan' :
          modalType === 'kasbon' ? 'Pengajuan Kasbon Operational' :
          'Form Berita Acara Opnam'
        }
        maxWidth={modalType === 'omni_in' || modalType === 'omni_out' ? 'max-w-2xl' : 'max-w-md'}
      >
        <p className="text-xs text-slate-500 mb-5 -mt-2 tracking-tight">Formulir integrasi penarikan database relasional.</p>

            {modalType === 'omni_in' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2 pb-6">
                <button 
                  onClick={() => { setModalType('income_manual'); setFormData({ id: `REV-${Date.now()}`, type: 'Pemasukan', category: 'Modal', description: 'Tambahan Modal Masuk', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-emerald-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-emerald-700 uppercase tracking-widest text-center">Tambah Modal</span>
                </button>

                <button 
                  onClick={() => { setModalType('income_sales'); setFormData({ id: `REV-${Date.now()}`, type: 'Pemasukan', category: 'Project', description: 'Pelunasan Invoice #...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-blue-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-blue-700 uppercase tracking-widest text-center">Penjualan</span>
                </button>

                <button 
                  onClick={() => { setModalType('income_survey'); setFormData({ id: `REV-${Date.now()}`, type: 'Pemasukan', category: 'Survey', description: 'Fee Survey Proyek...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-amber-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <Compass className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-amber-700 uppercase tracking-widest text-center">Survey</span>
                </button>

                <button 
                  onClick={() => { setModalType('income_bank'); setFormData({ id: `REV-${Date.now()}`, type: 'Pemasukan', category: 'Transfer', description: 'Mutasi dari Bank...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-indigo-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-indigo-700 uppercase tracking-widest text-center">Transfer Bank</span>
                </button>
              </div>
            )}

            {modalType === 'omni_out' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2 pb-6">
                <button 
                  onClick={() => { setModalType('expense_purchase'); setFormData({ id: `EXP-${Date.now()}`, type: 'Pengeluaran', category: 'Bahan Baku', description: 'Pembayaran Vendor #...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-rose-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-rose-700 uppercase tracking-widest text-center">Pembelian</span>
                </button>

                <button 
                  onClick={() => { setModalType('expense_payroll'); setFormData({ id: `PAY-${Date.now()}`, type: 'Pengeluaran', category: 'Gaji & Upah', description: 'Pembayaran Slip Gaji #...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-indigo-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-indigo-700 uppercase tracking-widest text-center">Gaji Staf</span>
                </button>

                <button 
                  onClick={() => { setModalType('expense_opnam'); setFormData({ id: `OPN-${Date.now()}`, type: 'Pengeluaran', category: 'Upah Tukang Opnam', description: 'Pembayaran Opnam Tukang...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-amber-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-amber-700 uppercase tracking-widest text-center">Opnam</span>
                </button>

                <button 
                  onClick={() => { setModalType('expense_manual'); setFormData({ id: `EXP-${Date.now()}`, type: 'Pengeluaran', category: 'Lain-lain', description: 'Beban Operasional...', date: new Date().toISOString().split('T')[0] }); }}
                  className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-3xl hover:bg-slate-50 transition-all group cursor-pointer border-none shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-600 group-hover:text-white transition-all">
                    <Plus className="w-6 h-6 opacity-30 rotate-45" />
                  </div>
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-slate-700 uppercase tracking-widest text-center">Lainnya</span>
                </button>
              </div>
            )}

            {(modalType === 'tx' || modalType === 'income_manual' || modalType === 'income_sales' || modalType === 'income_survey' || modalType === 'income_bank' || modalType === 'expense_purchase' || modalType === 'expense_payroll' || modalType === 'expense_opnam' || modalType === 'expense_manual') && (
              <form onSubmit={handleSaveTransaction} className="space-y-4 font-semibold">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">ID Transaksi</label>
                    <input disabled className="w-full bg-slate-100 text-slate-400 rounded-xl p-3 text-sm font-mono" value={formData.id || ''} />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tipe Log Alur</label>
                    <input disabled className={`w-full ${formData.type === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} rounded-xl p-3 text-sm font-bold`} value={formData.type || 'Pengeluaran'} />
                  </div>
                </div>

                {modalType === 'income_sales' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Invoice Penjualan</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.salesInvoiceId || ''}
                      onChange={(e) => {
                        const inv = dbState.salesInvoices?.find(i => i.id === e.target.value);
                        if (inv) {
                          setFormData({ 
                            ...formData, 
                            salesInvoiceId: inv.id, 
                            amount: (inv.totalAmount - (inv.paidAmount || 0)), 
                            description: `Pembayaran Pelunasan Invoice ${inv.code} - ${inv.customerName}`,
                            projectId: inv.quotationId // Linking to project
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Invoice --</option>
                      {(dbState.salesInvoices || []).filter(i => i.status !== 'Lunas').map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.code} - {inv.customerName} (Sisa: {formatIDR(inv.totalAmount - (inv.paidAmount || 0))})</option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'expense_purchase' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Invoice Pembelian (Vendor)</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.purchaseInvoiceId || ''}
                      onChange={(e) => {
                        const inv = dbState.purchaseInvoices?.find(i => i.id === e.target.value);
                        if (inv) {
                          setFormData({ 
                            ...formData, 
                            purchaseInvoiceId: inv.id, 
                            amount: inv.totalAmount, 
                            description: `Pembayaran Vendor ${inv.supplierName} ref ${inv.code}`
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Invoice Pembelian --</option>
                      {(dbState.purchaseInvoices || []).filter(i => i.status !== 'Paid').map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.code} - {inv.supplierName} ({formatIDR(inv.totalAmount)})</option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'expense_payroll' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Slip Gaji Karyawan</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.payrollId || ''}
                      onChange={(e) => {
                        const pay = dbState.salaries?.find(p => p.id === e.target.value);
                        if (pay) {
                          setFormData({ 
                            ...formData, 
                            payrollId: pay.id, 
                            amount: pay.netPay, 
                            description: `Pembayaran Gaji Bulanan: ${pay.employeeName}`
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Slip Gaji --</option>
                      {(dbState.salaries || []).filter(p => p.status !== 'Paid').map(pay => (
                        <option key={pay.id} value={pay.id}>{pay.employeeName} ({formatIDR(pay.netPay)})</option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'expense_opnam' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Laporan Opnam Tukang</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.craftsmanReportId || ''}
                      onChange={(e) => {
                        const rep = dbState.craftsmanReports?.find(r => r.id === e.target.value);
                        if (rep) {
                          setFormData({ 
                            ...formData, 
                            craftsmanReportId: rep.id, 
                            amount: rep.volume * rep.unitPrice, 
                            description: `Pembayaran Opnam Tukang: ${rep.craftsmanName} Proyek ${rep.projectName}`
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Berita Acara Opnam --</option>
                      {(dbState.craftsmanReports || []).filter(r => r.status !== 'Selesai').map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.craftsmanName} - {rep.projectName} ({formatIDR(rep.volume * rep.unitPrice)})</option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'income_survey' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Ambil Data Survei Lokasi</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.projectId || ''}
                      onChange={(e) => {
                        const srv = dbState.surveys?.find(s => s.id === e.target.value);
                        if (srv) {
                          setFormData({ 
                            ...formData, 
                            projectId: srv.id, 
                            amount: srv.depositAmount || 0, 
                            description: `Deposit Survei Lokasi [${srv.code}] - ${srv.customerName}`
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Data Survei --</option>
                      {(dbState.surveys || []).filter(s => s.status !== 'Selesai' && s.depositStatus !== 'Lunas').map(srv => (
                        <option key={srv.id} value={srv.id}>{srv.code} - {srv.customerName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {modalType === 'income_bank' && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Rekening Sumber (Bank)</label>
                    <select
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.bankAccountId || ''}
                      onChange={(e) => {
                        const acc = dbState.bank_accounts?.find(a => a.id === e.target.value);
                        if (acc) {
                          setFormData({ 
                            ...formData, 
                            bankAccountId: acc.id, 
                            description: `Tarik Dana Mutasi dari ${acc.bank_name} (${acc.account_number})`
                          });
                        }
                      }}
                    >
                      <option value="">-- Pilih Bank --</option>
                      {(dbState.bank_accounts || []).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number} ({formatIDR(acc.current_balance)})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Keterangan / Memo</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    placeholder="Beri catatan detail transaksi..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nominal Dana (IDR)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-bold font-sans"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kategori</label>
                    <select
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.category || 'Lain-lain'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {formData.type === 'Pemasukan' ? (
                        <>
                          <option value="Modal">Modal Disetor</option>
                          <option value="Project">Invoice Penjualan</option>
                          <option value="Survey">Fee Survey</option>
                          <option value="Transfer">Transfer Bank</option>
                          <option value="Lain-lain">Pendapatan Lain-lain</option>
                        </>
                      ) : (
                        <>
                          <option value="Sourcing Bahan">Sourcing Bahan Kayu/Mebel</option>
                          <option value="Upah Tukang Opnam">Upah Tukang Opnam</option>
                          <option value="Kasbon Pinjaman">Kasbon Pinjaman</option>
                          <option value="Makan Lembur">Makan Lembur</option>
                          <option value="Lain-lain">Beban Lain-lain</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-bold">
                  <button type="button" onClick={() => setModalOpen(false)} className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all border-none flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
                  <button type="submit" className="w-12 h-12 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all border-none flex items-center justify-center shadow-lg shadow-blue-500/20 cursor-pointer"><Save className="w-5 h-5" /></button>
                </div>
              </form>
            )}

            {modalType === 'payroll' && (
              <form onSubmit={handleSavePayroll} className="space-y-4 font-semibold">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Pegawai Penerima Gaji</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.employeeId || ''}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = dbState.employees?.find(em => em.id === empId);
                      setFormData({
                        ...formData,
                        employeeId: empId,
                        basicSalary: emp?.baseSalary || 0
                      });
                    }}
                    required
                  >
                    <option value="">-- Pilih Staff Gaji --</option>
                    {dbState.employees?.map(em => <option key={em.id} value={em.id}>{em.name} ({em.role.toUpperCase()})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Gaji Pokok (IDR)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.basicSalary || ''}
                      onChange={(e) => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Bonus Estimator / Prestasi</label>
                    <input
                      type="number"
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.bonus || ''}
                      onChange={(e) => setFormData({ ...formData, bonus: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Deduction / Kasbon Gunting</label>
                    <input
                      type="number"
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.deductions || ''}
                      onChange={(e) => setFormData({ ...formData, deductions: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Bulan Periode</label>
                    <input
                      type="text"
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.monthYear || 'Juni 2026'}
                      onChange={(e) => setFormData({ ...formData, monthYear: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-bold">
                  <button type="button" onClick={() => setModalOpen(false)} className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all border-none flex items-center justify-center cursor-pointer shadow-sm"><X className="w-5 h-5 font-bold" /></button>
                  <button type="submit" className="w-12 h-12 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all border-none flex items-center justify-center shadow-lg shadow-indigo-500/20 cursor-pointer" title="Salurkan Gaji"><Check className="w-5 h-5 font-bold" /></button>
                </div>
              </form>
            )}

            {modalType === 'kasbon' && (
              <form onSubmit={handleSaveKasbon} className="space-y-4 font-semibold">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">ID Pengajuan</label>
                    <input
                      type="text"
                      disabled
                      className="w-full bg-slate-50 text-slate-400 rounded-xl p-3 text-sm border-none font-medium font-sans cursor-not-allowed"
                      value={`ADV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-AUTO`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Pengajuan</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Pegawai Lapangan Pengaju</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.employeeId || ''}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Staff --</option>
                    {dbState.employees?.map(em => <option key={em.id} value={em.id}>{em.name} ({em.role})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Sumber Pembayaran</label>
                    <select
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.paymentSource || 'Kas Harian'}
                      onChange={(e) => setFormData({ ...formData, paymentSource: e.target.value })}
                      required
                    >
                      <option value="Kas Harian">Kas Harian (Petty Cash)</option>
                      <option value="Kas Bank">Kas Bank (Transfer)</option>
                    </select>
                  </div>
                  {formData.paymentSource === 'Kas Bank' && (
                    <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Rekening Bank</label>
                      <select
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={formData.bankAccountId || ''}
                        onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                        required
                      >
                        <option value="">-- Pilih Bank --</option>
                        {dbState.bank_accounts?.map(b => (
                          <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nominal Kasbon Operasional (IDR)</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alokasi Keperluan Lapangan</label>
                  <textarea
                    rows={2}
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    placeholder="Beli paku tembak fungsional, bensin pick up, atau makan malam lembur..."
                    value={formData.reason || ''}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-bold">
                  <button type="button" onClick={() => setModalOpen(false)} className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all border-none flex items-center justify-center cursor-pointer shadow-sm"><X className="w-5 h-5 font-bold" /></button>
                  <button type="submit" className="w-12 h-12 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all border-none flex items-center justify-center shadow-lg shadow-indigo-500/20 cursor-pointer" title="Kirim Pengajuan"><Send className="w-5 h-5 font-bold" /></button>
                </div>
              </form>
            )}

            {modalType === 'opnam' && (
              <form onSubmit={handleSaveOpnam} className="space-y-4 font-semibold text-slate-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">ID Berita Acara (Auto)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full bg-slate-50 text-slate-400 rounded-xl p-3 text-sm border-none font-medium font-sans cursor-not-allowed"
                      value={`OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-AUTO`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Opnam</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Tukang Borongan</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.craftsmanName || ''}
                    onChange={(e) => setFormData({ ...formData, craftsmanName: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Tukang --</option>
                    {dbState.employees?.filter(e => e.type === 'Borongan').map(e => (
                      <option key={e.id} value={e.name}>{e.name} ({e.department || e.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Link ke Invoice Penjualan (Opsional)</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.salesInvoiceId || ''}
                    onChange={(e) => handleOpnamInvoiceChange(e.target.value)}
                  >
                    <option value="">-- Tanpa Link Invoice --</option>
                    {dbState.salesInvoices?.map(si => (
                      <option key={si.id} value={si.id}>{si.code} - {si.customerName}</option>
                    ))}
                  </select>
                </div>

                {formData.items && formData.items.length > 0 && (
                  <div className="space-y-2">
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Rincian Progress Kerja & Prestasi Upah</label>
                    <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2">Item Pekerjaan</th>
                            <th className="px-3 py-2">Ukuran</th>
                            <th className="px-3 py-2 w-16">Qty</th>
                            <th className="px-3 py-2 w-28 text-right">Harga Upah</th>
                            <th className="px-3 py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {formData.items.map((it: any, idx: number) => (
                            <tr key={it.id || idx} className="hover:bg-indigo-50/30">
                              <td className="px-3 py-2 font-bold text-slate-700">{it.name}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  className="w-full bg-slate-50 rounded px-1.5 py-0.5 border-none text-slate-600 focus:ring-1 focus:ring-indigo-500 text-[11px]"
                                  value={it.dimension || ''}
                                  onChange={(e) => updateOpnamItem(idx, 'dimension', e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full bg-slate-50 rounded px-1.5 py-0.5 border-none text-slate-800 font-bold focus:ring-1 focus:ring-indigo-500 text-[11px]"
                                  value={it.qty || 0}
                                  onChange={(e) => updateOpnamItem(idx, 'qty', Number(e.target.value))}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full bg-slate-50 rounded px-1.5 py-0.5 border-none text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 text-[11px]"
                                  value={it.price || 0}
                                  onChange={(e) => updateOpnamItem(idx, 'price', Number(e.target.value))}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-black text-rose-600">{formatIDR(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-black">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-right uppercase text-slate-500">Nilai Borongan (Total):</td>
                            <td className="px-3 py-2 text-right text-rose-700">{formatIDR(formData.appraisalValue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p className="text-[10px] text-slate-400 italic font-medium">* Nilai borongan dihitung berdasarkan prestasi opnam di lapangan oleh mandor.</p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Keterangan Tambahan / Lokasi Site</label>
                  <textarea
                    rows={2}
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    placeholder="Contoh: Site Kemang Lt. 3 - Pemasangan Moulding Ruang Utama"
                    value={formData.workDescription || ''}
                    onChange={(e) => setFormData({ ...formData, workDescription: e.target.value })}
                  />
                </div>

                {!formData.items && (
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Total Nilai Upah (Jika tanpa item)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.appraisalValue || ''}
                      onChange={(e) => setFormData({ ...formData, appraisalValue: Number(e.target.value) })}
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-bold">
                  <button type="button" onClick={() => setModalOpen(false)} className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all border-none flex items-center justify-center cursor-pointer shadow-sm"><X className="w-5 h-5 font-bold" /></button>
                  <button type="submit" className="w-12 h-12 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all border-none flex items-center justify-center shadow-lg shadow-slate-500/20 cursor-pointer" title="Simpan Berita Acara"><Save className="w-5 h-5 font-bold" /></button>
                </div>
              </form>
            )}

      </Modal>

      {/* VIEW TRANSACTION DETAIL MODAL */}
      <Modal
        isOpen={!!viewingTx}
        onClose={() => setViewingTx(null)}
        title="Detail Aktivitas Arus Kas Ledger"
        maxWidth="max-w-md"
      >
        {viewingTx && (
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">Kode Voucher</span>
                <span className="font-mono text-xs text-slate-900 font-black">{viewingTx.code}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Tanggal Log</span>
                <span className="text-slate-800 font-bold">{viewingTx.date}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Nama Akun Buku Kas</span>
                <span className="text-slate-850 font-extrabold text-indigo-750 bg-indigo-50 px-2 py-0.5 rounded font-mono">{viewingTx.account || 'Kas Harian'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Kategori Finansial</span>
                <span className="text-indigo-700 font-bold ">{viewingTx.category}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Tipe Aliran</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${viewingTx.type === 'Pemasukan' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                  {viewingTx.type}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Nominal Transaksi</span>
                <span className={`font-mono text-sm font-black ${viewingTx.type === 'Pemasukan' ? 'text-emerald-600' : 'text-slate-850'}`}>
                  {viewingTx.type === 'Pemasukan' ? '+' : '-'}{formatIDR(viewingTx.amount)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 p-3.5 bg-indigo-50/20 border border-indigo-150/20 rounded-2xl">
              <span className="text-[10.5px] text-slate-400 font-bold uppercase block tracking-wider font-mono">📋 Deskripsi Keterangan Alokasi:</span>
              <p className="text-slate-700 font-bold leading-normal text-xs whitespace-pre-wrap">{viewingTx.description || 'Tidak ada uraian rincian deskripsi tambahan.'}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 font-bold">
              <button
                onClick={() => {
                  setPrintingTx(viewingTx);
                  setViewingTx(null);
                }}
                className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
              >
                <Printer className="w-4 h-4 mr-2" /> Cetak Kwitansi
              </button>
              <button
                onClick={() => setViewingTx(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-4 rounded-xl cursor-pointer border-none"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* PRINT KWITANSI MODAL */}
      <PrintPdfModal
        isOpen={!!printingTx}
        onClose={() => setPrintingTx(null)}
        type="Kwitansi"
        data={printingTx}
        settings={dbState.settings}
      />

      {/* Delete Block Warning Modal */}
      {deleteBlockAlert.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white -2xl w-full max-w-sm overflow-hidden -2xl p-6 text-center bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200/80">
              <span className="text-amber-500 font-extrabold text-2xl">⚠️</span>
            </div>
            <h3 className="text-base text-slate-800 mb-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Penghapusan Diblokir</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed font-semibold">
              {deleteBlockAlert.message}
            </p>
            <button 
              onClick={() => setDeleteBlockAlert({ isOpen: false, message: '' })}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors uppercase text-xs tracking-wider cursor-pointer border-none"
            >
              Mengerti & <X className="w-4 h-4 mr-1" /> Batal
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
