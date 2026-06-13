import React, { useState, useEffect } from 'react';
import { Plus, Minus, MoreHorizontal, ArrowUpRight, ArrowDownRight, RefreshCcw, Wallet, X, Trash2, Edit2, Save, ShoppingCart, MapPin, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

import { BankAccount, BankMutation, DBState } from '../types';
import { Modal } from './Modal';

export const BankModuleView: React.FC<{ dbState: DBState, saveCollection: any, showToast: any }> = ({ dbState, saveCollection, showToast }) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'mutations'>('accounts');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [accountModal, setAccountModal] = useState(false);
  const [mutationModal, setMutationModal] = useState<'in' | 'out' | 'interbank' | 'in_capital' | 'in_sales' | 'in_survey' | 'in_daily_cash' | 'out_purchase' | 'out_salary' | 'out_stock' | 'out_expense' | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountModal(false);
        setMutationModal(null);
        setActiveDropdownId(null);
      }
    };
    const handleClick = () => setActiveDropdownId(null);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  useEffect(() => {
    setActiveTab('mutations');
  }, []);

  const accounts: BankAccount[] = dbState.bank_accounts || [];
  const mutations: BankMutation[] = dbState.bank_mutations || [];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'account' | 'mutation', id: string, amount?: number, mType?: 'Masuk'|'Keluar', accountId?: string} | null>(null);

  const [accountForm, setAccountForm] = useState<Partial<BankAccount>>({ id: '', bank_code: '', bank_name: '', account_number: '', account_name: '', initial_balance: 0 });
  const [mutationForm, setMutationForm] = useState({ 
    id: '', 
    bank_account_id: '', 
    to_bank_account_id: '', 
    type: 'Masuk' as 'Masuk' | 'Keluar', 
    category: '', 
    amount: 0, 
    description: '', 
    transaction_date: '',
    salesInvoiceId: '',
    surveyId: '',
    purchaseId: '',
    employeeId: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteBlockAlert, setDeleteBlockAlert] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const [showInActions, setShowInActions] = useState(false);
  const [showOutActions, setShowOutActions] = useState(false);

  const invoices = dbState.salesInvoices || [];
  const surveys = dbState.surveys || [];
  const purchases = dbState.purchaseOrders || dbState.purchases || [];
  const employees = dbState.employees || [];

  const handleSaveAccount = () => {
    if (editingId) {
        const nextAccounts = accounts.map(a => {
            if (a.id === editingId) {
                // When editing, if initial_balance changed, we need to adjust current_balance
                // New Balance = New Initial + Total Mutations
                const accMutations = mutations.filter(m => m.bank_account_id === editingId);
                const netMutations = accMutations.reduce((sum, m) => sum + (m.type === 'Masuk' ? m.amount : -m.amount), 0);
                const newInitial = Number(accountForm.initial_balance || 0);
                const newCurrent = newInitial + netMutations;

                return { 
                    ...a, 
                    ...accountForm, 
                    id: editingId, 
                    initial_balance: newInitial,
                    current_balance: newCurrent 
                } as BankAccount;
            }
            return a;
        });
        saveCollection('bank_accounts', nextAccounts);
        showToast('Rekening berhasil diupdate dan saldo disinkronisasi!', 'success');
    } else {
        const newAccount: BankAccount = { 
            id: `bnk-${Date.now()}`,
            bank_code: accountForm.bank_code || '',
            bank_name: accountForm.bank_name || '',
            account_number: accountForm.account_number || '',
            account_name: accountForm.account_name || '',
            initial_balance: Number(accountForm.initial_balance || 0),
            current_balance: Number(accountForm.initial_balance || 0)
        };
        saveCollection('bank_accounts', [...accounts, newAccount]);
        showToast('Rekening berhasil ditambahkan!', 'success');
    }
    setAccountModal(false);
    setAccountForm({ id: '', bank_code: '', bank_name: '', account_number: '', account_name: '', initial_balance: 0 });
    setEditingId(null);
  };

  const deleteAccount = (accountId: string) => {
    const nextAccounts = accounts.filter(a => a.id !== accountId);
    const nextMutations = mutations.filter(m => m.bank_account_id !== accountId);
    saveCollection('bank_accounts', nextAccounts);
    saveCollection('bank_mutations', nextMutations);
    showToast('Rekening dan mutasi terkait berhasil dihapus!', 'success');
  };

  const checkMutationBlock = (mToDelete: BankMutation | undefined) => {
    if (!mToDelete) return true;

    // Check if this is a Survey Deposit and block if linked to an active Quotation / RAB
    if (mToDelete.category === 'Uang Jaminan/Deposit Survei' && dbState.surveys) {
      const desc = mToDelete.description || '';
      const surveyCode = desc.split('atas ').pop()?.trim();
      if (surveyCode) {
        const surveyObj = dbState.surveys.find((s: any) => s.code === surveyCode);
        if (surveyObj) {
          const activeQuotations = dbState.quotations || [];
          const hasRAB = activeQuotations.some((q: any) => q.surveyId === surveyObj.id || q.surveyCode === surveyObj.code);
          if (hasRAB) {
            setDeleteBlockAlert({
              isOpen: true,
              message: 'Transaksi deposit survei tidak dapat dihapus atau diubah karena data survei terkait sudah ditarik ke dalam Penawaran RAB. Hapus RAB terlebih dahulu!'
            });
            return false;
          }
        }
      }
    }

    // Check if connected to an active Quotation (RAB) via transactions lookup
    if (dbState.transactions) {
      const relatedTx = dbState.transactions.find(t => 
        t.account === 'Kas Bank' && 
        Math.abs(t.amount) === mToDelete.amount &&
        (t.date === mToDelete.transaction_date || t.description?.includes(mToDelete.description))
      );
      if (relatedTx && relatedTx.projectId) {
        const activeQuotations = dbState.quotations || [];
        const hasRAB = activeQuotations.some((q: any) => q.surveyId === relatedTx.projectId || q.id === relatedTx.projectId);
        if (hasRAB) {
          setDeleteBlockAlert({
            isOpen: true,
            message: 'Transaksi tidak dapat dihapus/diubah karena sudah terkoneksi dengan RAB / Survei. Anda harus menghapus penawaran RAB terlebih dahulu.'
          });
          return false;
        }
      }
    }
    return true;
  };

  const deleteMutation = (id: string, amount: number, type: 'Masuk' | 'Keluar', accountId: string) => {
    if (!checkMutationBlock(mutations.find(m => m.id === id))) return;

    const mToDelete = mutations.find(m => m.id === id);
    const nextMutations = mutations.filter(m => m.id !== id);
    const updatedAccounts = accounts.map(a => {
        if (a.id === accountId) {
            return { ...a, current_balance: a.current_balance - (type === 'Masuk' ? amount : -amount) };
        }
        return a;
    });
    
    // Reverse Purchase Invoice if tied to this mutation
    if (dbState.purchaseInvoices) {
      let changedInvoices = false;
      const nextInvoices = dbState.purchaseInvoices.map(inv => {
        // If it was the main mutation OR inside history
        const hasHistory = inv.paymentHistory && inv.paymentHistory.find((p: any) => p.mutationId === id);
        if (inv.bankMutationId === id || hasHistory) {
          changedInvoices = true;
          let newHistory = inv.paymentHistory ? inv.paymentHistory.filter((p: any) => p.mutationId !== id) : [];
          
          let newPaidAmount = newHistory.reduce((sum: number, p: any) => sum + p.amount, 0);
          // Fallback if no history but they had paidAmount (for legacy records)
          if (!inv.paymentHistory && inv.paidAmount) {
            newPaidAmount = 0; // if it was just the one mutation
          }
          
          let newStatus = 'Unpaid';
          if (newHistory.length > 0 && newPaidAmount > 0) {
            newStatus = 'Partial';
          }
          if (newPaidAmount >= (inv.totalAmount || 0)) {
            newStatus = 'Paid';
          }
          
          return {
            ...inv,
            status: newStatus as any,
            paidAmount: newPaidAmount,
            bankMutationId: newHistory.length > 0 ? newHistory[newHistory.length - 1].mutationId : '',
            paymentAccount: newHistory.length > 0 ? newHistory[newHistory.length - 1].accountName : '',
            paymentHistory: newHistory
          };
        }
        return inv;
      });
      
      if (changedInvoices) {
        saveCollection('purchaseInvoices', nextInvoices);
        showToast('Transaksi bank dihapus. Pembayaran Faktur terkait ikut disesuaikan.', 'info');
      }
    }

    // Reverse Sales Invoice if tied to this mutation
    const descLower = (mToDelete?.description || '').toLowerCase();
    const isDPorTerminSales = mToDelete?.category === 'Pembayaran DP/Termin Klien' || 
                              mToDelete?.category === 'Revisi/Pengembalian Termin Klien' ||
                              descLower.includes('pembayaran termin') || 
                              descLower.includes('danatermin');
    
    if (mToDelete && isDPorTerminSales && dbState.salesInvoices) {
      let salesChanged = false;
      const nextSales = dbState.salesInvoices.map(inv => {
        const matchesInvoice = (mToDelete.description && mToDelete.description.includes(inv.code));
        
        if (matchesInvoice) {
          salesChanged = true;
          const prevPaidAmount = inv.paidAmount || 0;
          const adjustment = (mToDelete.type === 'Masuk') ? -mToDelete.amount : mToDelete.amount;
          const newPaidAmount = Math.max(0, prevPaidAmount + adjustment);
          const newStatus = newPaidAmount === 0 ? 'Draft' : (newPaidAmount >= inv.totalAmount ? 'Lunas' : 'Sebagian');
          return { ...inv, paidAmount: newPaidAmount, status: newStatus };
        }
        return inv;
      });
      if (salesChanged) {
        saveCollection('salesInvoices', nextSales);
        showToast('Transaksi dihapus & status pembayaran Invoice ikut disesuaikan.', 'info');
      }
    }

    // Revert Survey status if tied to this deposit
    if (mToDelete && mToDelete.category === 'Uang Jaminan/Deposit Survei' && dbState.surveys) {
        const surveyCode = mToDelete.description.split('atas ').pop();
        const surveyToRevert = dbState.surveys.find((s: any) => s.code === surveyCode);
        
        if (surveyToRevert) {
            const updatedSurveys = dbState.surveys.map((s: any) => {
                if (s.id === surveyToRevert.id) {
                    return { ...s, status: 'Draft', depositStatus: 'Draft' };
                }
                return s;
            });
            saveCollection('surveys', updatedSurveys);
            showToast('Riwayat deposito survei dihapus & status survei dikembalikan ke Draft.', 'info');
        }
    }

    // Delete parallel Transaction in Kas Bank
    if (mToDelete && dbState.transactions) {
      const relatedTxIndex = dbState.transactions.findIndex(t => 
        t.account === 'Kas Bank' && 
        t.date === mToDelete.transaction_date && 
        Math.abs(t.amount) === mToDelete.amount
      );
      if (relatedTxIndex !== -1) {
        const nextTxs = [...dbState.transactions];
        nextTxs.splice(relatedTxIndex, 1);
        saveCollection('transactions', nextTxs);
      }
    }
    
    saveCollection('bank_mutations', nextMutations);
    saveCollection('bank_accounts', updatedAccounts);
    showToast('Transaksi dihapus!', 'success');
  };

  const editMutation = (m: BankMutation) => {
    if (!checkMutationBlock(m)) return;
    setMutationForm(m as any);                
    setMutationModal(m.type === 'Masuk' ? 'in' : 'out');
    setEditingId(m.id);
  };

  const handleSaveMutation = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mutationModal === 'interbank') {
        const fromAccount = accounts.find(a => a.id === mutationForm.bank_account_id);
        const toAccount = accounts.find(a => a.id === mutationForm.to_bank_account_id);
        if (!fromAccount || !toAccount) return showToast('Pilih rekening asal dan tujuan!', 'error');
        if (fromAccount.current_balance < mutationForm.amount) return showToast('Saldo asal tidak mencukupi!', 'error');

        const mutationOut: BankMutation = {
            id: `mut-${Date.now()}-out`,
            mutation_code: `MUT-${Date.now()}-OUT`,
            bank_account_id: fromAccount.id,
            type: 'Keluar',
            category: 'Transfer Interbank',
            amount: Number(mutationForm.amount),
            description: `Transfer ke ${toAccount.bank_name}`,
            transaction_date: mutationForm.transaction_date,
        };
        const mutationIn: BankMutation = {
            id: `mut-${Date.now()}-in`,
            mutation_code: `MUT-${Date.now()}-IN`,
            bank_account_id: toAccount.id,
            type: 'Masuk',
            category: 'Transfer Interbank',
            amount: Number(mutationForm.amount),
            description: `Terima dari ${fromAccount.bank_name}`,
            transaction_date: mutationForm.transaction_date,
        };

        const updatedAccounts = accounts.map(a => {
            if (a.id === fromAccount.id) return { ...a, current_balance: a.current_balance - Number(mutationForm.amount) };
            if (a.id === toAccount.id) return { ...a, current_balance: a.current_balance + Number(mutationForm.amount) };
            return a;
        });

        saveCollection('bank_mutations', [...mutations, mutationOut, mutationIn]);
        saveCollection('bank_accounts', updatedAccounts);
        showToast('Transfer antar bank berhasil!', 'success');
    } else {
        const account = accounts.find(a => a.id === mutationForm.bank_account_id);
        if (!account) return showToast('Pilih rekening!', 'error');
        
        if (editingId) {
            const oldMutation = mutations.find(m => m.id === editingId);
            if (!oldMutation) return;

            if (!checkMutationBlock(oldMutation)) return;

            // Rollback old mutation from its account
            const oldAccount = accounts.find(a => a.id === oldMutation.bank_account_id);
            if (!oldAccount) return;

            // We calculate the net effect. 
            // If we are changing account, we need to rollback oldAccount and apply to newAccount.
            const isBalanceCompatible = mutationForm.type === 'Keluar' 
                ? (account.id === oldAccount.id 
                    ? (account.current_balance + (oldMutation.type === 'Keluar' ? oldMutation.amount : -oldMutation.amount)) >= Number(mutationForm.amount)
                    : account.current_balance >= Number(mutationForm.amount))
                : true;

            if (mutationForm.type === 'Keluar' && !isBalanceCompatible) {
                return showToast('Saldo tidak mencukupi untuk update ini!', 'error');
            }

            const nextMutations = mutations.map(m => m.id === editingId ? { ...m, ...mutationForm, amount: Number(mutationForm.amount), id: editingId } : m);
            
            const updatedAccounts = accounts.map(a => {
                let bal = a.current_balance;
                // If this is the old account, remove old effect
                if (a.id === oldAccount.id) {
                    bal -= (oldMutation.type === 'Masuk' ? oldMutation.amount : -oldMutation.amount);
                }
                // If this is the new account, apply new effect
                if (a.id === account.id) {
                    bal += (mutationForm.type === 'Masuk' ? Number(mutationForm.amount) : -Number(mutationForm.amount));
                }
                return { ...a, current_balance: bal };
            });

            saveCollection('bank_mutations', nextMutations);
            saveCollection('bank_accounts', updatedAccounts);
            showToast('Mutasi berhasil diperbarui!', 'success');
            setEditingId(null);
        } else {
            if (mutationForm.type === 'Keluar' && account.current_balance < mutationForm.amount) return showToast('Saldo tidak mencukupi!', 'error');

            const nextMutationId = `MUT-${Date.now()}`;
            const newMutation: BankMutation = {
                id: `mut-${Date.now()}`,
                mutation_code: nextMutationId,
                bank_account_id: mutationForm.bank_account_id,
                type: mutationForm.type,
                category: mutationForm.category,
                amount: Number(mutationForm.amount),
                description: mutationForm.description,
                transaction_date: mutationForm.transaction_date,
            };

            // 1. INTEGRASI PENJUALAN
            if (mutationModal === 'in_sales' && mutationForm.salesInvoiceId) {
                const nextSales = (dbState.salesInvoices || []).map(inv => {
                    if (inv.id === mutationForm.salesInvoiceId) {
                        const newPaid = (inv.paidAmount || 0) + Number(mutationForm.amount);
                        const isLunas = newPaid >= (inv.totalAmount || 0);
                        return { 
                            ...inv, 
                            paidAmount: newPaid, 
                            status: isLunas ? 'Lunas' : 'Sebagian' as any,
                            paymentAccount: account.bank_name
                        };
                    }
                    return inv;
                });
                saveCollection('salesInvoices', nextSales);
            }

            // 2. INTEGRASI SURVEI
            if (mutationModal === 'in_survey' && mutationForm.surveyId) {
                const nextSurveys = (dbState.surveys || []).map(srv => {
                    if (srv.id === mutationForm.surveyId) {
                        return { 
                            ...srv, 
                            status: 'Selesai' as any, 
                            depositStatus: 'Paid',
                            depositAmount: Number(mutationForm.amount),
                            bankAccountId: account.id
                        };
                    }
                    return srv;
                });
                saveCollection('surveys', nextSurveys);
            }

            // 3. INTEGRASI KAS HARIAN
            if (mutationModal === 'in_daily_cash') {
                const nextTxs = dbState.transactions || [];
                const newDailyTx: any = {
                    id: `tx-${Date.now()}`,
                    code: `TRX-${Date.now()}`,
                    type: 'Pemasukan',
                    category: 'Mutasi dari Kas Bank',
                    amount: Number(mutationForm.amount),
                    date: mutationForm.transaction_date,
                    description: `Penerimaan dari ${account.bank_name}: ${mutationForm.description}`,
                    account: 'Kas Harian'
                };
                saveCollection('transactions', [...nextTxs, newDailyTx]);
            }

            // 4. INTEGRASI PEMBELIAN (PENGELUARAN)
            if (mutationModal === 'out_purchase' && mutationForm.purchaseId) {
              const nextPurchases = (dbState.purchaseOrders || []).map((p: any) => {
                if (p.id === mutationForm.purchaseId) {
                  return { ...p, status: 'Paid', paymentStatus: 'Lunas', bankAccountId: account.id };
                }
                return p;
              });
              saveCollection('purchaseOrders', nextPurchases);
            }

            // 5. INTEGRASI GAJI (PENGELUARAN)
            if (mutationModal === 'out_salary' && mutationForm.employeeId) {
              // Jika ada sistem payroll, bisa diupdate di sini. 
              // Sementara ini cukup mencatat di mutasi bank dengan referensi karyawan.
            }

            const updatedAccounts = accounts.map(a => {
                if (a.id === account.id) {
                    return { ...a, current_balance: a.current_balance + (mutationForm.type === 'Masuk' ? Number(mutationForm.amount) : -Number(mutationForm.amount)) };
                }
                return a;
            });
            saveCollection('bank_mutations', [...mutations, newMutation]);
            saveCollection('bank_accounts', updatedAccounts);
            showToast('Riwayat Mutasi berhasil dicatat dan terintegrasi!', 'success');
        }
    }
    setMutationModal(null);
    setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: '', amount: 0, description: '', transaction_date: '', salesInvoiceId: '', surveyId: '' });
  };

  // Pagination logic for mutations
  const totalItems = mutations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedMutations = [...mutations].reverse().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  return (
    <div className="p-6 min-h-[calc(100vh-120px)] flex flex-col h-full uppercase">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-4">
        <div>
          <h2 className="text-xl tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Kas Bank Perusahaan</h2>
          <p className="text-slate-500 text-[11px] mt-0.5">Pantau saldo, rekening aktif, dan mutasi dana masuk serta keluar secara efisien.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'mutations' && (
            <div className="flex items-center gap-2">
              {/* PEMASUKAN (+) */}
              <div className="relative">
                <button 
                  className="flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl w-10 h-10 hover:bg-emerald-100 transition-all duration-200 border-none cursor-pointer shadow-sm" 
                  onClick={() => { setShowInActions(!showInActions); setShowOutActions(false); }}
                  title="Pemasukan Dana"
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
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: 'Setoran Modal', amount: 0, description: 'Setoran Modal Pemilik/Investor', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('in_capital'); setShowInActions(false); }}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Modal</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-blue-50 text-blue-600 rounded-xl w-14 h-14 hover:bg-blue-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: 'Penerimaan Penjualan', amount: 0, description: 'Pembayaran SINV...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('in_sales'); setShowInActions(false); }}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Jual</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-amber-50 text-amber-600 rounded-xl w-14 h-14 hover:bg-amber-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: 'Uang Jaminan/Deposit Survei', amount: 0, description: 'Deposit Survei Klien...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('in_survey'); setShowInActions(false); }}
                      >
                        <MapPin className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Survei</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl w-14 h-14 hover:bg-indigo-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: 'Mutasi dari Kas Harian', amount: 0, description: 'Setoran dari Kas Harian...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('in_daily_cash'); setShowInActions(false); }}
                      >
                        <Coins className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Kas</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PENGELUARAN (-) */}
              <div className="relative">
                <button 
                  className="flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-10 h-10 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer shadow-sm" 
                  onClick={() => { setShowOutActions(!showOutActions); setShowInActions(false); }}
                  title="Pengeluaran Dana"
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
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Keluar', category: 'Pembelian Material/Stok', amount: 0, description: 'Pembayaran PO...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('out_purchase'); setShowOutActions(false); }}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Beli</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-14 h-14 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Keluar', category: 'Gaji & Upah', amount: 0, description: 'Bayar Gaji...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('out_salary'); setShowOutActions(false); }}
                      >
                        <Plus className="w-5 h-5 scale-x-[-1] rotate-45" />
                        <span className="text-[9px] mt-1 font-bold">Gaji</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-rose-50 text-rose-600 rounded-xl w-14 h-14 hover:bg-rose-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Keluar', category: 'Biaya Opnam/Gudang', amount: 0, description: 'Biaya Selisih Stok...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('out_stock'); setShowOutActions(false); }}
                      >
                        <Edit2 className="w-5 h-5" />
                        <span className="text-[9px] mt-1 font-bold">Opnam</span>
                      </button>
                      <button 
                        type="button"
                        className="flex flex-col items-center justify-center bg-slate-50 text-slate-600 rounded-xl w-14 h-14 hover:bg-slate-100 transition-all duration-200 border-none cursor-pointer" 
                        onClick={() => { setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Keluar', category: 'Biaya Lainnya', amount: 0, description: 'Pengeluaran...', transaction_date: new Date().toISOString().split('T')[0], salesInvoiceId: '', surveyId: '', purchaseId: '', employeeId: '' }); setMutationModal('out'); setShowOutActions(false); }}
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
          {activeTab === 'accounts' && (
            <button 
              className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer" 
              onClick={() => setAccountModal(true)}
              title="Tambah Rekening Kas Bank"
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>
          )}
        </div>
      </div>


      
      {/* MODALS */}
      <Modal 
        isOpen={accountModal} 
        onClose={() => { setAccountModal(false); setEditingId(null); setAccountForm({ id: '', bank_code: '', bank_name: '', account_number: '', account_name: '', initial_balance: 0 }); }}
        title={editingId ? "Update Rekening" : "Tambah Rekening Baru"}
      >
        <div className="space-y-4 pt-2">
          <input type="text" placeholder="Kode Bank (Contoh: BNK-01)" value={accountForm.bank_code} onChange={e => setAccountForm({...accountForm, bank_code: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          <input type="text" placeholder="Nama Bank (BCA, Mandiri...)" value={accountForm.bank_name} onChange={e => setAccountForm({...accountForm, bank_name: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          <input type="text" placeholder="Nomor Rekening" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          <input type="text" placeholder="Nama Pemilik" value={accountForm.account_name} onChange={e => setAccountForm({...accountForm, account_name: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          <div className="space-y-1">
             <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">SALDO AWAL (REKONSILIASI)</label>
             <input type="number" placeholder="Saldo Awal" value={accountForm.initial_balance} onChange={e => setAccountForm({...accountForm, initial_balance: Number(e.target.value)})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          </div>
          <div className="flex gap-2">
            <button
                type="button"
                onClick={() => { setAccountModal(false); setEditingId(null); }}
                className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm"
                title="Batal"
            >
                <X className="w-5 h-5" />
            </button>
            <button type="button" onClick={handleSaveAccount} className="flex items-center justify-center bg-[#2563eb] hover:bg-blue-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-blue-500/20" title="Simpan">
                <Save className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={mutationModal !== null}
        onClose={() => { setMutationModal(null); setEditingId(null); setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: '', amount: 0, description: '', transaction_date: '', salesInvoiceId: '', surveyId: '' }); }}
        title={
          mutationModal === 'in_capital' ? 'Setoran Modal (Equity)' :
          mutationModal === 'in_sales' ? 'Penerimaan Penjualan (Revenue)' :
          mutationModal === 'in_survey' ? 'Deposit Survei (Revenue)' :
          mutationModal === 'in_daily_cash' ? 'Mutasi dari Kas Harian (Transfer)' :
          mutationModal === 'in' ? 'Dana Masuk' : 
          mutationModal === 'out' ? 'Dana Keluar' : 
          'Transfer Antar Bank'
        }
      >
        <form onSubmit={handleSaveMutation} className="space-y-4 pt-2">
          {mutationModal !== 'interbank' && (
              <>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block text-rose-600">ID OTOMATIS: {editingId || `M-${Date.now()}`}</label>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">REKENING BANK PENAMPUNG</label>
                <select value={mutationForm.bank_account_id} onChange={e => setMutationForm({...mutationForm, bank_account_id: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required>
                    <option value="">-- Pilih Rekening --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
                </select>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block mt-4">TYPE LOG: {mutationForm.type === 'Masuk' ? 'PEMASUKAN DANA' : 'PENGELUARAN DANA'}</label>
              </>
          )}

          {mutationModal === 'in_sales' && (
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">PILIH INVOICE PENJUALAN</label>
              <select 
                value={mutationForm.salesInvoiceId} 
                onChange={e => {
                  const inv = invoices.find(i => i.id === e.target.value);
                  if (inv) {
                    setMutationForm({
                      ...mutationForm,
                      salesInvoiceId: inv.id,
                      amount: (inv.totalAmount - (inv.paidAmount || 0)),
                      description: `Penerimaan Pembayaran INV: ${inv.code} - ${inv.customerName}`
                    });
                  }
                }} 
                className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required
              >
                <option value="">-- Pilih Invoice --</option>
                {invoices.filter(i => i.status !== 'Lunas').map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.code} - {inv.customerName} (Sisa: Rp {(inv.totalAmount - (inv.paidAmount || 0)).toLocaleString()})</option>
                ))}
              </select>
            </div>
          )}

          {mutationModal === 'in_survey' && (
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">PILIH DATA SURVEI LOKASI</label>
              <select 
                value={mutationForm.surveyId} 
                onChange={e => {
                  const srv = surveys.find(s => s.id === e.target.value);
                  if (srv) {
                    setMutationForm({
                      ...mutationForm,
                      surveyId: srv.id,
                      amount: srv.depositAmount || 0,
                      description: `Penerimaan Deposit Survei: ${srv.code} - ${srv.customerName}`
                    });
                  }
                }} 
                className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required
              >
                <option value="">-- Pilih Survei --</option>
                {surveys.filter(s => s.depositStatus !== 'Paid').map(srv => (
                  <option key={srv.id} value={srv.id}>{srv.code} - {srv.customerName}</option>
                ))}
              </select>
            </div>
          )}

          {mutationModal === 'interbank' && (
              <>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">REKENING ASAL (PENGIRIM)</label>
                 <select value={mutationForm.bank_account_id} onChange={e => setMutationForm({...mutationForm, bank_account_id: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required>
                    <option value="">Pilih Rekening Asal</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
                </select>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">REKENING TUJUAN (PENERIMA)</label>
                <select value={mutationForm.to_bank_account_id} onChange={e => setMutationForm({...mutationForm, to_bank_account_id: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required>
                    <option value="">Pilih Rekening Tujuan</option>
                    {accounts.filter(a => a.id !== mutationForm.bank_account_id).map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
                </select>
              </>
          )}

          {mutationModal === 'in_daily_cash' && (
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">ID OTOMATIS: TRX-{Date.now()}</label>
              <p className="text-[10px] text-amber-600 font-medium italic mt-1">Sistem akan secara otomatis mencatat transaksi masuk di Kas Harian.</p>
            </div>
          )}

          {mutationModal === 'out_purchase' && (
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">PILIH INVOICE PEMBELIAN / PO</label>
              <select 
                value={mutationForm.purchaseId} 
                onChange={e => {
                  const p = purchases.find((x: any) => x.id === e.target.value);
                  if (p) {
                    setMutationForm({
                      ...mutationForm,
                      purchaseId: p.id,
                      amount: p.totalAmount || p.grandTotal || 0,
                      description: `Pembayaran Pembelian: ${p.code || p.poNumber} - ${p.supplierName || p.vendor}`
                    });
                  }
                }} 
                className="bg-white w-full p-3 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200" required
              >
                <option value="">-- Pilih Pembelian --</option>
                {purchases.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.code || p.poNumber} - {p.supplierName || p.vendor} (Rp {(p.totalAmount || p.grandTotal || 0).toLocaleString()})</option>
                ))}
              </select>
            </div>
          )}

          {mutationModal === 'out_salary' && (
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">PILIH KARYAWAN (PEMBAYARAN GAJI)</label>
              <select 
                value={mutationForm.employeeId} 
                onChange={e => {
                  const emp = employees.find((x: any) => x.id === e.target.value);
                  if (emp) {
                    setMutationForm({
                      ...mutationForm,
                      employeeId: emp.id,
                      description: `Pembayaran Gaji Karyawan: ${emp.name} (${emp.position})`
                    });
                  }
                }} 
                className="bg-white w-full p-3 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200" required
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">KATEGORI TRANSAKSI</label>
              <input type="text" value={mutationForm.category} onChange={e => setMutationForm({...mutationForm, category: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
            </div>
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">TANGGAL TRANSAKSI</label>
              <input type="date" value={mutationForm.transaction_date} onChange={e => setMutationForm({...mutationForm, transaction_date: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
            </div>
          </div>

          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">NOMINAL RUPIAH (IDR)</label>
          <input type="number" value={mutationForm.amount} onChange={e => setMutationForm({...mutationForm, amount: Number(e.target.value)})} className="bg-slate-50 w-full p-3 border rounded-xl text-sm font-bold text-blue-600 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50" required />
          
          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">KETERANGAN / LOG CATATAN</label>
          <textarea value={mutationForm.description} onChange={e => setMutationForm({...mutationForm, description: e.target.value})} className="bg-slate-50 w-full p-3 border rounded-xl text-xs focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50 min-h-[80px]" />
          
          <div className="flex gap-2 pt-2">
            <button
                type="button"
                onClick={() => { setMutationModal(null); setEditingId(null); setMutationForm({ id: '', bank_account_id: '', to_bank_account_id: '', type: 'Masuk', category: '', amount: 0, description: '', transaction_date: '', salesInvoiceId: '', surveyId: '' }); }}
                className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm grow"
                title="Batal"
            >
                <X className="w-5 h-5" />
            </button>
            <button type="submit" className="flex items-center justify-center bg-[#2563eb] hover:bg-blue-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-blue-500/20 grow" title="Simpan">
                <Save className="w-5 h-5" />
            </button>
          </div>
        </form>
      </Modal>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-full items-center w-fit mb-6">
        <button 
          onClick={() => setActiveTab('mutations')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'mutations' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Transaksi
        </button>
        <button 
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${activeTab === 'accounts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Data Rekening Bank
        </button>
      </div>

      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {accounts.map(acc => {
              const accMutations = mutations.filter(m => m.bank_account_id === acc.id);
              const totalMasuk = accMutations.filter(m => m.type === 'Masuk').reduce((sum, m) => sum + m.amount, 0);
              const totalKeluar = accMutations.filter(m => m.type === 'Keluar').reduce((sum, m) => sum + m.amount, 0);
              const sisa = acc.current_balance; 
              
              const chartData = [
                { name: 'Masuk', value: totalMasuk },
                { name: 'Keluar', value: totalKeluar },
                { name: 'Saldo', value: sisa }
              ];
              const COLORS = ['#10b981', '#f43f5e', '#3b82f6'];

              return (
                 <div key={acc.id} className="p-5 bg-white flex flex-col bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                        <div className="font-bold text-slate-800">{acc.bank_name}</div>
                        <div className="text-xs text-slate-400">{acc.account_number}</div>
                     </div>
                     <div className="relative">
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           setActiveDropdownId(activeDropdownId === acc.id ? null : acc.id);
                         }}
                         className={`p-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent inline-flex items-center justify-center ${
                           activeDropdownId === acc.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-100'
                         }`}
                       >
                         <MoreHorizontal className="w-5 h-5 pointer-events-none" />
                       </button>

                       <AnimatePresence>
                         {activeDropdownId === acc.id && (
                           <motion.div
                             initial={{ opacity: 0, scale: 0.95, y: -8 }}
                             animate={{ opacity: 1, scale: 1, y: 0 }}
                             exit={{ opacity: 0, scale: 0.95, y: -8 }}
                             transition={{ duration: 0.15, ease: 'easeOut' }}
                             className="absolute right-0 top-9 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] py-1.5 z-40 text-left min-w-[145px]"
                             onClick={(e) => e.stopPropagation()}
                           >
                             <button
                               type="button"
                               onClick={() => {
                                 setEditingId(acc.id);
                                 setAccountForm(acc);
                                 setAccountModal(true);
                                 setActiveDropdownId(null);
                               }}
                               className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                             >
                               <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                               Ubah Rekening
                             </button>
                             <div className="border-t border-slate-100 my-1">
                               <button
                                 type="button"
                                 onClick={() => {
                                   setDeleteConfirm({ type: 'account', id: acc.id });
                                   setActiveDropdownId(null);
                                 }}
                                 className="w-full text-left px-3 py-2.5 hover:bg-rose-50 text-rose-600 hover:text-rose-705 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                >
                                 <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                 Hapus Rekening
                               </button>
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>
                   </div>
                   
                   <div className="flex-grow flex items-center justify-center h-40">
                       <ResponsiveContainer>
                           <PieChart>
                              <Pie data={chartData} innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                                 {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                           </PieChart>
                       </ResponsiveContainer>
                   </div>
                   
                   <div className="text-xs font-medium text-slate-500 mt-2 truncate">{acc.account_name}</div>
                   <div className="text-xl font-bold text-blue-600 mt-3">Rp {acc.current_balance.toLocaleString()}</div>
                 </div>
               )
           })}
        </div>
      )}

      {activeTab === 'mutations' && (
        <div className="bg-white     p-4 flex-grow overflow-hidden flex flex-col bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <div className="overflow-x-auto flex-grow scrollbar-hide">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="p-2 whitespace-nowrap">Tanggal</th>
                  <th className="p-2 whitespace-nowrap">Kode</th>
                  <th className="p-2 whitespace-nowrap">Akun Bank</th>
                  <th className="p-2 whitespace-nowrap">Kategori</th>
                  <th className="p-2 text-right whitespace-nowrap">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMutations.map(m => {
                  const bank = accounts.find(a => a.id === m.bank_account_id);
                  return (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="p-2 font-mono text-xs text-slate-600 whitespace-nowrap">{m.transaction_date}</td>
                      <td className="p-2 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">{m.mutation_code}</td>
                      <td className="p-2 text-xs text-slate-600 whitespace-nowrap">{bank ? bank.bank_name : '-'}</td>
                      <td className="p-2 text-xs text-slate-600 whitespace-nowrap">{m.category}</td>
                      <td className={`p-2 text-right font-bold text-sm ${m.type === 'Masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.type === 'Masuk' ? '+' : '-'} {m.amount.toLocaleString()}
                      </td>
                      <td className="p-2 text-right relative whitespace-nowrap font-medium">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(activeDropdownId === m.id ? null : m.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent inline-flex items-center justify-center ${
                              activeDropdownId === m.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-105'
                            }`}
                          >
                            <MoreHorizontal className="w-5 h-5 pointer-events-none" />
                          </button>
                        </div>

                        <AnimatePresence>
                          {activeDropdownId === m.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -8 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              className="absolute right-2 top-9 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] py-1.5 z-45 text-left min-w-[145px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  editMutation(m);
                                  setActiveDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                Ubah Transaksi
                              </button>
                              <div className="border-t border-slate-100 my-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!checkMutationBlock(m)) return;
                                    setDeleteConfirm({ type: 'mutation', id: m.id, amount: m.amount, mType: m.type, accountId: m.bank_account_id });
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-rose-50 text-rose-600 hover:text-rose-705 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  Hapus Transaksi
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION UI */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0">
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
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white -2xl w-full max-w-sm overflow-hidden -2xl animate-scaleIn bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-rose-200 rounded-full animate-ping opacity-20"></div>
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl text-slate-800 mb-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Konfirmasi Hapus</h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">
                {deleteConfirm.type === 'account' 
                  ? 'Anda yakin ingin menghapus rekening bank ini? Seluruh riwayat mutasi terkait rekening ini juga akan dihapus.'
                  : 'Anda yakin ingin menghapus mutasi kas bank ini?'}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors uppercase text-xs tracking-wider cursor-pointer"
                >
                  <X className="w-4 h-4 mr-1" /> Batal
                </button>
                <button 
                  onClick={() => {
                    if (deleteConfirm.type === 'account') {
                      deleteAccount(deleteConfirm.id);
                    } else if (deleteConfirm.type === 'mutation' && deleteConfirm.amount !== undefined && deleteConfirm.mType && deleteConfirm.accountId) {
                      deleteMutation(deleteConfirm.id, deleteConfirm.amount, deleteConfirm.mType, deleteConfirm.accountId);
                    }
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 px-4 py-3 bg-rose-600 border-2 border-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors uppercase text-xs tracking-wider cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Block Warning Modal */}
      {deleteBlockAlert.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white -2xl w-full max-w-sm overflow-hidden -2xl p-6 text-center bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200/80">
              <span className="text-amber-500 font-extrabold text-2xl">⚠️</span>
            </div>
            <h3 className="text-base text-slate-800 mb-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Penghapusan Bank Diblokir</h3>
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
