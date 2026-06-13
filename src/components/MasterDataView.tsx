/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Search, Users, Truck, Wrench, ShieldAlert, CheckCircle, HelpCircle, Eye, Camera, Calendar, CreditCard, DollarSign, UserCheck, AlertTriangle, ChevronRight, ChevronLeft, Info, FileText, ClipboardList, CheckSquare, PlusCircle, Lock, MoreHorizontal, X, Save, Receipt, Settings, ChevronDown } from 'lucide-react';
import { DBState, Customer, Supplier, Vehicle, Equipment, ToolLoan, TaxPayment, ServicePayment, Employee, BankMutation, BankAccount } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';

interface MasterDataViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  activeTab: 'mitra' | 'vehicle' | 'equipment';
}

import { Modal } from './Modal';

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole,
  activeTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals controllers
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [viewingItem, setViewingItem] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);

  // New vehicle-specific sub-states
  const [vehicleSubTab, setVehicleSubTab] = useState<'armada' | 'pajak' | 'service'>('armada');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [pajakModalOpen, setPajakModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [receiptPhotoViewing, setReceiptPhotoViewing] = useState<string | null>(null);

  const [pajakForm, setPajakForm] = useState({
    payDate: new Date().toISOString().split('T')[0],
    amount: '',
    payerId: '',
    bankAccount: 'Kas Bank',
    receiptPhoto: ''
  });

  const [serviceForm, setServiceForm] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    kmService: '',
    amount: '',
    servicerId: '',
    bankAccount: 'Kas Bank',
    nextServiceDate: '',
    nextServiceKm: '',
    receiptPhoto: ''
  });

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [mitraSubTab, setMitraSubTab] = useState<'customer' | 'supplier'>('customer');
  const [equipmentSubTab, setEquipmentSubTab] = useState<'perkakas' | 'peminjaman'>('perkakas');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, vehicleSubTab, equipmentSubTab]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      setActiveDropdownId(null);
      
      const dropdownEl = document.getElementById('equipment-multiselect-dropdown');
      if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
        setToolDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Equipment | null>(null);
  const [activeLoan, setActiveLoan] = useState<ToolLoan | null>(null);
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  useEffect(() => {
    if (loanModalOpen) {
      setLoanForm(prev => ({
        ...prev,
        selected_tool_ids: selectedTool ? [selectedTool.id] : []
      }));
      setToolDropdownOpen(false);
      setToolSearchQuery('');
    }
  }, [loanModalOpen, selectedTool]);

  const [loanForm, setLoanForm] = useState({
    craftsman_employee_id: '',
    pic_gudang_id: '',
    project_name: '',
    loan_date: new Date().toISOString().substring(0, 16),
    notes_loan: '',
    selected_tool_ids: [] as string[]
  });

  const [returnForm, setReturnForm] = useState({
    actual_return_date: new Date().toISOString().substring(0, 16),
    condition_status: 'Siap Pakai' as any,
    notes_return: '',
    photo_return: ''
  });

  // Image compressor helper inside component
  const handleImageUpload = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const scale = MAX_WIDTH / img.width;
          
          let w = img.width;
          let h = img.height;
          if (img.width > MAX_WIDTH) {
            w = MAX_WIDTH;
            h = img.height * scale;
          }
          
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality base64 image
            resolve(dataUrl);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Helper function to resolve employee names or admins
  const decodeEmployeeName = (id: string) => {
    const emp = (dbState.employees || []).find(e => e.id === id);
    return emp ? emp.name : id;
  };

  const getAdminAndPicRecipients = (picId?: string) => {
    const list = dbState.employees || [];
    const recs: Array<{ id: string; phone: string; name: string }> = [];
    if (picId) {
      const pic = list.find(e => e.id === picId);
      if (pic && pic.phone) {
        recs.push({ id: pic.id, phone: pic.phone, name: pic.name });
      }
    }
    list.forEach(emp => {
      const r = (emp.role || '').toLowerCase();
      if (r === 'super_admin' || r === 'super admin' || r === 'admin' || r === 'gudang' || r.includes('admin') || r.includes('owner')) {
        if (!recs.some(x => x.id === emp.id) && emp.phone) {
          recs.push({ id: emp.id, phone: emp.phone, name: emp.name });
        }
      }
    });
    if (recs.length === 0) {
      recs.push({ id: 'fallback-admin', phone: '6281234567890', name: 'Super Admin' });
    }
    return recs;
  };

  // Automated WhatsApp checking for vehicle tax / service timelines
  useEffect(() => {
    if (activeTab === 'vehicle') {
      const todayStr = new Date().toISOString().split('T')[0];
      const alertedToday = localStorage.getItem(`erp_vehicle_alerts_sent_${todayStr}`);
      if (alertedToday) return; // Prevent multiple alerts on mounts in same day

      const list = dbState.vehicles || [];
      const employees = dbState.employees || [];
      
      list.forEach(v => {
        const checkDeadline = (dateStr: string | undefined, type: 'Pajak Tahunan' | 'Pajak Bulanan') => {
          if (!dateStr) return;
          const today = new Date();
          const target = new Date(dateStr);
          today.setHours(0,0,0,0);
          target.setHours(0,0,0,0);
          
          const diffTime = target.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 15 || diffDays === 10) {
            const pic = employees.find(emp => emp.id === v.picId) || employees.find(emp => emp.name === v.driverName);
            const recipients = getAdminAndPicRecipients(v.picId);
            
            recipients.forEach(async (rec) => {
              const msg = `⚠️ *PENGINGAT JATUH TEMPO ARMADA KENDARAAN* ⚠️\n\nArmada: *${v.type}* (${v.plateNumber})\nStatus Kebutuhan: *${type}* mendekati batas!\nTgl Jatuh Tempo: *${dateStr}* (*${diffDays} Hari Lagi!*)\n\nHarap hubungi penanggung jawab: *${pic ? pic.name : (v.driverName || 'Sopir Cadangan')}* untuk menghindari denda dlm perjalanan logistik.`;
              
              await sendWhatsAppNotification({
                phone: rec.phone,
                message: msg,
                recipientName: rec.name
              });
            });
          }
        };

        checkDeadline(v.taxAnnualDate, 'Pajak Tahunan');
        checkDeadline(v.taxMonthlyDate, 'Pajak Bulanan');
      });

      localStorage.setItem(`erp_vehicle_alerts_sent_${todayStr}`, 'true');
    }
  }, [activeTab, dbState.vehicles, dbState.employees]);

  const getNextToolCode = () => {
    const items = dbState.equipments || [];
    let maxNum = 0;
    items.forEach(item => {
      if (item.code && (item.code.startsWith('TL-WOOD-2026-') || item.code.startsWith('TL-WOOD-'))) {
        const parts = item.code.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `TL-WOOD-2026-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const getNextLoanCode = () => {
    const loans = dbState.toolLoans || [];
    let maxNum = 0;
    loans.forEach(loan => {
      if (loan.loan_code && loan.loan_code.startsWith('LON-WD-2026-')) {
        const parts = loan.loan_code.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `LON-WD-2026-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const sendLoanWhatsApp = (loan: ToolLoan, toolName: string) => {
    const autoTask = dbState.settings?.whatsappAutoTask !== false;
    if (!autoTask) return;

    const craftsman = (dbState.employees || []).find(e => e.id === loan.craftsman_employee_id);
    const PicGudang = (dbState.employees || []).find(e => e.id === loan.pic_gudang_id);
    const craftsmanName = craftsman ? craftsman.name : 'Tukang';
    const projectName = loan.project_name || '-';
    
    const formattedDate = new Date(loan.loan_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    const template = dbState.settings?.whatsappTemplateTaskLoan || 'NOTIFIKASI GUDANG: Peminjaman Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dipinjam Oleh: {employee_name}, Untuk Project: {project_name}, Jam Pinjam: {task_date}. Mohon gunakan alat sesuai SOP.';
    const message = template
      .replace(/{employee_name}/g, craftsmanName)
      .replace(/{task_name}/g, toolName)
      .replace(/{task_code}/g, loan.loan_code)
      .replace(/{project_name}/g, projectName)
      .replace(/{task_date}/g, formattedDate);

    // 1. Send to craftsman
    if (craftsman && craftsman.phone) {
      sendWhatsAppNotification({
        phone: craftsman.phone,
        message,
        recipientName: craftsman.name
      });
    }

    // 2. Send to Admin list (including pic_gudang)
    const admins = getAdminAndPicRecipients(loan.pic_gudang_id);
    admins.forEach(admin => {
      if (admin.phone && admin.id !== craftsman?.id) {
        sendWhatsAppNotification({
          phone: admin.phone,
          message,
          recipientName: admin.name
        });
      }
    });
  };

  const sendReturnWhatsApp = (loan: ToolLoan, toolName: string, conditionStatus: string) => {
    const autoTask = dbState.settings?.whatsappAutoTask !== false;
    if (!autoTask) return;

    const craftsman = (dbState.employees || []).find(e => e.id === loan.craftsman_employee_id);
    const craftsmanName = craftsman ? craftsman.name : 'Tukang';
    
    const template = dbState.settings?.whatsappTemplateTaskReturn || 'NOTIFIKASI GUDANG: Pengembalian Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dikembalikan Oleh: {employee_name}, Kondisi Akhir Alat: [{task_status}]. Terima kasih.';
    const message = template
      .replace(/{employee_name}/g, craftsmanName)
      .replace(/{task_name}/g, toolName)
      .replace(/{task_code}/g, loan.loan_code)
      .replace(/{task_status}/g, conditionStatus);

    // 1. Send to craftsman
    if (craftsman && craftsman.phone) {
      sendWhatsAppNotification({
        phone: craftsman.phone,
        message,
        recipientName: craftsman.name
      });
    }

    // 2. Send to Admin list
    const admins = getAdminAndPicRecipients(loan.pic_gudang_id);
    admins.forEach(admin => {
      if (admin.phone && admin.id !== craftsman?.id) {
        sendWhatsAppNotification({
          phone: admin.phone,
          message,
          recipientName: admin.name
        });
      }
    });
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine tools to loan
    let toolsToLoanIds = [...loanForm.selected_tool_ids];
    
    // If selecting from a specific tool card, ensure that one is included
    if (selectedTool && !toolsToLoanIds.includes(selectedTool.id)) {
      toolsToLoanIds.unshift(selectedTool.id);
    } 
    
    if (toolsToLoanIds.length === 0) {
      // Fallback for direct selection from form elements if needed (legacy)
      const formData = new FormData(e.currentTarget);
      const directId = formData.get('direct_tool_id') as string;
      if (directId) {
        toolsToLoanIds = [directId];
      }
    }

    if (toolsToLoanIds.length === 0) {
      showToast('Harap pilih minimal 1 Equipment yang dipinjam!', 'error');
      return;
    }

    if (!loanForm.craftsman_employee_id) {
      showToast('Harap pilih Tukang peminjam!', 'error');
      return;
    }

    if (!loanForm.pic_gudang_id) {
      showToast('Harap pilih PIC Gudang / Supervisor!', 'error');
      return;
    }

    const availableTools = (dbState.equipments || []).filter(t => toolsToLoanIds.includes(t.id));
    
    // Check availability
    const unavailable = availableTools.filter(t => t.loan_status === 'Dipakai Produksi' || t.condition_status === 'Rusak Total');
    if (unavailable.length > 0) {
      showToast(`Beberapa alat (${unavailable.map(u => u.name).join(', ')}) sedang tidak tersedia atau rusak!`, 'error');
      return;
    }

    let currentLoans = [...(dbState.toolLoans || [])];
    let currentEquipments = [...(dbState.equipments || [])];
    let baseLoanCode = getNextLoanCode();
    let counter = 0;

    toolsToLoanIds.forEach(toolId => {
      const tool = currentEquipments.find(t => t.id === toolId);
      if (!tool) return;

      // Generate incremental code if multiple tools
      let loanCode = baseLoanCode;
      if (toolsToLoanIds.length > 1) {
        const parts = baseLoanCode.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10) + counter;
        parts[parts.length - 1] = String(num).padStart(lastPart.length, '0');
        loanCode = parts.join('-');
        counter++;
      }

      const newLoan: ToolLoan = {
        id: `loan-${Date.now()}-${toolId}`,
        loan_code: loanCode,
        tool_id: toolId,
        craftsman_employee_id: loanForm.craftsman_employee_id,
        pic_gudang_id: loanForm.pic_gudang_id,
        project_name: loanForm.project_name || '',
        loan_date: loanForm.loan_date || new Date().toISOString().substring(0, 16),
        notes_loan: loanForm.notes_loan || '',
        loan_status: 'Aktif Dipakai'
      };

      currentLoans.push(newLoan);
      
      // Update equipment status
      currentEquipments = currentEquipments.map(t => 
        t.id === toolId ? { ...t, loan_status: 'Dipakai Produksi' as const } : t
      );

      // Send WhatsApp (optional: might send too many if many tools, but user requested individual logic)
      try {
        sendLoanWhatsApp(newLoan, tool.name);
      } catch (err) {
        console.error(err);
      }
    });

    saveCollection('equipments', currentEquipments);
    saveCollection('toolLoans', currentLoans);

    showToast(`Peminjaman ${toolsToLoanIds.length} alat sukses terekam & WhatsApp dikirim.`);
    setLoanModalOpen(false);
    
    // Reset form
    setLoanForm({
      craftsman_employee_id: '',
      pic_gudang_id: '',
      project_name: '',
      loan_date: new Date().toISOString().substring(0, 16),
      notes_loan: '',
      selected_tool_ids: []
    });
    setSelectedTool(null);
  };

  const handleSaveReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;

    const tool = (dbState.equipments || []).find(t => t.id === activeLoan.tool_id);
    if (!tool) {
      showToast('Data alat tidak ditemukan!', 'error');
      return;
    }

    const updatedLoans = (dbState.toolLoans || []).map(l => {
      if (l.id === activeLoan.id) {
        return {
          ...l,
          actual_return_date: returnForm.actual_return_date || new Date().toISOString().substring(0, 16),
          notes_return: returnForm.notes_return || '',
          photo_return: returnForm.photo_return || '',
          loan_status: 'Sudah Kembali' as const
        };
      }
      return l;
    });

    const refreshedLoan = updatedLoans.find(l => l.id === activeLoan.id) as ToolLoan;

    // Update tool status and condition
    const updatedTools = (dbState.equipments || []).map(t => {
      if (t.id === tool.id) {
        return {
          ...t,
          loan_status: 'Tersedia' as const,
          condition_status: returnForm.condition_status,
          // Backwards compatibility
          condition: (returnForm.condition_status === 'Siap Pakai' ? 'Baik' : returnForm.condition_status === 'Rusak Total' ? 'Rusak' : 'Perlu Servis') as any,
          lastServiced: new Date().toISOString().split('T')[0]
        };
      }
      return t;
    });

    saveCollection('equipments', updatedTools);
    saveCollection('toolLoans', updatedLoans);

    // Send WhatsApp notification
    try {
      sendReturnWhatsApp(refreshedLoan, tool.name, returnForm.condition_status);
    } catch (err) {
      console.error(err);
    }

    showToast(`Pengembalian [${tool.name}] terekam. Status menjadi Tersedia.`);
    setReturnModalOpen(false);

    // Reset Form
    setReturnForm({
      actual_return_date: new Date().toISOString().substring(0, 16),
      condition_status: 'Siap Pakai',
      notes_return: ''
    });
    setActiveLoan(null);
  };

  const handleSavePajak = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const payer = (dbState.employees || []).find(emp => emp.id === pajakForm.payerId);
    
    // Create Bank Mutation
    const mutationId = `mut-${Date.now()}`;
    const newMutation: BankMutation = {
       id: mutationId,
       mutation_code: `MUT-PAJAK-${Date.now()}`,
       bank_account_id: pajakForm.bankAccount,
       type: 'Keluar',
       category: 'Pajak Kendaraan',
       amount: Number(pajakForm.amount),
       description: `Pembayaran Pajak ${selectedVehicle.plateNumber}`,
       transaction_date: pajakForm.payDate
    };

    const newPayment: TaxPayment = {
      id: `tax-${Date.now()}`,
      txId: mutationId,
      payDate: pajakForm.payDate,
      amount: Number(pajakForm.amount),
      payerId: pajakForm.payerId,
      payerName: payer ? payer.name : 'Unknown',
      receiptPhoto: pajakForm.receiptPhoto,
      bankAccount: pajakForm.bankAccount,
    };

    const updatedAccounts = dbState.bank_accounts.map(a => {
        if (a.id === pajakForm.bankAccount) {
            return { ...a, current_balance: a.current_balance - Number(pajakForm.amount) };
        }
        return a;
    });

    const updatedVehicles = (dbState.vehicles || []).map(v => {
      if (v.id === selectedVehicle.id) {
        return {
          ...v,
          taxPayments: [...(v.taxPayments || []), newPayment]
        };
      }
      return v;
    });

    saveCollection('vehicles', updatedVehicles);
    saveCollection('bank_mutations', [...(dbState.bank_mutations || []), newMutation]);
    saveCollection('bank_accounts', updatedAccounts);
    showToast('Pembayaran pajak berhasil dicatat!', 'success');
    setPajakModalOpen(false);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const servicer = (dbState.employees || []).find(emp => emp.id === serviceForm.servicerId);
    
    // Validate bank account
    const selectedBank = dbState.bank_accounts.find(ba => ba.id === serviceForm.bankAccount);
    if (!selectedBank) {
      showToast('Harap pilih rekening bank!', 'error');
      return;
    }

    // 1. Create mutation
    const mutationId = `mut-${Date.now()}`;
    const newMutation: BankMutation = {
       id: mutationId,
       mutation_code: `MUT-SVC-${Date.now()}`,
       bank_account_id: selectedBank.id,
       type: 'Keluar',
       category: 'Service Kendaraan',
       amount: Number(serviceForm.amount),
       description: `Service ${selectedVehicle.plateNumber}`,
       transaction_date: serviceForm.serviceDate
    };

    // 2. Update Account balance
    const updatedAccounts = dbState.bank_accounts.map(a => {
        if (a.id === selectedBank.id) {
            return { ...a, current_balance: a.current_balance - Number(serviceForm.amount) };
        }
        return a;
    });

    const newService: ServicePayment = {
      id: `svc-${Date.now()}`,
      txId: mutationId,
      serviceDate: serviceForm.serviceDate,
      kmService: Number(serviceForm.kmService),
      amount: Number(serviceForm.amount),
      servicerId: serviceForm.servicerId,
      servicerName: servicer ? servicer.name : 'Unknown',
      receiptPhoto: serviceForm.receiptPhoto,
      bankAccount: selectedBank.id,
    };

    const updatedVehicles = (dbState.vehicles || []).map(v => {
      if (v.id === selectedVehicle.id) {
        return {
          ...v,
          servicePayments: [...(v.servicePayments || []), newService]
        };
      }
      return v;
    });

    saveCollection('vehicles', updatedVehicles);
    saveCollection('bank_mutations', [...(dbState.bank_mutations || []), newMutation]);
    saveCollection('bank_accounts', updatedAccounts);
    showToast('Data service berhasil dicatat!', 'success');
    setServiceModalOpen(false);
  };

  const getTaxStatus = (dateStr?: string) => {
    if (!dateStr) return { color: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Belum Diatur' };
    const today = new Date();
    const target = new Date(dateStr);
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'LATE / DENDA' };
    } else if (diffDays <= 15) {
      return { color: 'bg-amber-50 text-amber-700 border-amber-200', label: `H-${diffDays} Hari` };
    } else {
      return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Aman' };
    }
  };

  const handleDeleteTaxLog = (vehicleId: string, paymentId: string, mutationId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus pembayaran pajak ini? Transaksi pengeluaran di kas bank akan ikut dihapus dan dikembalikan saldonya.")) return;
    
    const vehicles = dbState.vehicles || [];
    const updatedVehicles = vehicles.map(v => {
      if (v.id === vehicleId) {
        return {
          ...v,
          taxPayments: (v.taxPayments || []).filter(p => p.id !== paymentId)
        };
      }
      return v;
    });
    saveCollection('vehicles', updatedVehicles);

    // Update Bank Data
    const bankMutations = dbState.bank_mutations || [];
    const mutation = bankMutations.find(m => m.id === mutationId);
    
    if (mutation) {
        const updatedAccounts = (dbState.bank_accounts || []).map(a => {
            if (a.id === mutation.bank_account_id) {
                return { ...a, current_balance: a.current_balance + mutation.amount };
            }
            return a;
        });
        saveCollection('bank_accounts', updatedAccounts);
        saveCollection('bank_mutations', bankMutations.filter(m => m.id !== mutationId));
    }
    showToast('Pembayaran pajak berhasil dihapus, transaksi bank dipulihkan.', 'success');
  };

  const handleDeleteServiceLog = (vehicleId: string, paymentId: string, mutationId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus pembayaran service ini? Transaksi pengeluaran di kas bank akan ikut dihapus dan dikembalikan saldonya.")) return;

    const vehicles = dbState.vehicles || [];
    const updatedVehicles = vehicles.map(v => {
      if (v.id === vehicleId) {
        return {
          ...v,
          servicePayments: (v.servicePayments || []).filter(s => s.id !== paymentId)
        };
      }
      return v;
    });
    saveCollection('vehicles', updatedVehicles);

    // Update Bank Data
    const bankMutations = dbState.bank_mutations || [];
    const mutation = bankMutations.find(m => m.id === mutationId);
    
    if (mutation) {
        const updatedAccounts = (dbState.bank_accounts || []).map(a => {
            if (a.id === mutation.bank_account_id) {
                return { ...a, current_balance: a.current_balance + mutation.amount };
            }
            return a;
        });
        saveCollection('bank_accounts', updatedAccounts);
        saveCollection('bank_mutations', bankMutations.filter(m => m.id !== mutationId));
    }
    showToast('Pembayaran service berhasil dihapus, transaksi bank dipulihkan.', 'success');
  };

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  // Open modal for add
  const handleOpenAdd = () => {
    setFormData({});
    setIsEditingId(null);
    setModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (item: any) => {
    setFormData(item);
    setIsEditingId(item.id);
    setModalOpen(true);
  };

  // Open modal for view details
  const handleOpenView = (item: any) => {
    setViewingItem(item);
    setViewModalOpen(true);
  };

  // Delete item general
  const handleDeleteItem = (id: string) => {
    const item = 
      (activeTab === 'mitra' && mitraSubTab === 'customer') ? (dbState.customers || []).find(c => c.id === id) :
      (activeTab === 'mitra' && mitraSubTab === 'supplier') ? (dbState.suppliers || []).find(s => s.id === id) :
      activeTab === 'vehicle' ? (dbState.vehicles || []).find(v => v.id === id) :
      (dbState.equipments || []).find(e => e.id === id);

    const displayName = item ? (('name' in item) ? item.name : ('plateNumber' in item) ? item.plateNumber : id) : id;

    setDeleteConfirm({
      id,
      description: `Apakah Anda yakin ingin menghapus data master [${displayName}] dari record pusat?`
    });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;

    if (activeTab === 'mitra' && mitraSubTab === 'customer') {
      const list = dbState.customers || [];
      saveCollection('customers', list.filter(c => c.id !== id));
      showToast('Data Customer berhasil dieliminasi.', 'info');
    } else if (activeTab === 'mitra' && mitraSubTab === 'supplier') {
      const list = dbState.suppliers || [];
      saveCollection('suppliers', list.filter(s => s.id !== id));
      showToast('Data Supplier berhasil dieliminasi.', 'info');
    } else if (activeTab === 'vehicle') {
      const list = dbState.vehicles || [];
      const targetVehicle = list.find(v => v.id === id);
      
      let updatedTxs = dbState.transactions || [];
      if (targetVehicle) {
        // Collect all related transaction IDs
        const associatedTxIds = [
          ...(targetVehicle.taxPayments || []).map(p => p.txId),
          ...(targetVehicle.servicePayments || []).map(s => s.txId)
        ].filter(Boolean);
        
        if (associatedTxIds.length > 0) {
          updatedTxs = updatedTxs.filter(t => !associatedTxIds.includes(t.id));
          saveCollection('transactions', updatedTxs);
        }
      }

      saveCollection('vehicles', list.filter(v => v.id !== id));
      showToast('Data Kendaraan & seluruh mutasi transaksi keluar terkait dihapus.', 'info');
    } else if (activeTab === 'equipment') {
      const list = dbState.equipments || [];
      saveCollection('equipments', list.filter(e => e.id !== id));
      showToast('Alat kerja ditiadakan dari inventori asset.', 'info');
    }

    setDeleteConfirm(null);
  };

  // Save Item general
  const handleSaveData = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'mitra' && mitraSubTab === 'customer') {
      if (!formData.name || !formData.phone) {
        showToast('Mohon lengkapi Nama Customer & Nomor Telepon!', 'error');
        return;
      }
      const list = dbState.customers || [];
      const codeStr = formData.code || `CUST-${Math.floor(100 + Math.random() * 900)}`;
      const newItem: Customer = {
        id: isEditingId || `cust-${Date.now()}`,
        code: codeStr,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || '',
        company: formData.company || '-',
        address: formData.address || ''
      };

      const updated = isEditingId 
        ? list.map(item => item.id === isEditingId ? newItem : item)
        : [...list, newItem];
      
      saveCollection('customers', updated);
      showToast(`Sukses merekam customer: [${newItem.code}] ${newItem.name}`);

    } else if (activeTab === 'mitra' && mitraSubTab === 'supplier') {
      if (!formData.name || !formData.contactPerson) {
        showToast('Mohon isi nama supplier & penanggung jawab (CP)!', 'error');
        return;
      }
      const list = dbState.suppliers || [];
      const codeStr = formData.code || `SPL-${Math.floor(100 + Math.random() * 900)}`;
      const newItem: Supplier = {
        id: isEditingId || `spl-${Date.now()}`,
        code: codeStr,
        name: formData.name,
        phone: formData.phone || '',
        contactPerson: formData.contactPerson,
        address: formData.address || '',
        bankAccount: formData.bankAccount || '',
        bankName: formData.bankName || '',
        businessType: formData.businessType || 'CV',
        email: formData.email || ''
      };

      const updated = isEditingId 
        ? list.map(item => item.id === isEditingId ? newItem : item)
        : [...list, newItem];

      saveCollection('suppliers', updated);
      showToast(`Sukses mencatatkan supplier: ${newItem.name}`);

    } else if (activeTab === 'vehicle') {
      if (!formData.plateNumber || !formData.type) {
        showToast('Pelat nomor & tipe karoseri harus diinput!', 'error');
        return;
      }
      const list = dbState.vehicles || [];
      const existingItem = list.find(v => v.id === isEditingId);
      
      const matchedEmp = (dbState.employees || []).find(emp => emp.id === formData.picId);
      const picNameStr = matchedEmp ? matchedEmp.name : (formData.picName || formData.driverName || 'Sopir Cadangan');
      
      const nextCode = formData.code || (existingItem?.code || `VHC-${(list.length + 1).toString().padStart(3, '0')}`);

      const newItem: Vehicle = {
        id: isEditingId || `vh-${Date.now()}`,
        code: nextCode,
        plateNumber: formData.plateNumber.toUpperCase(),
        type: formData.type,
        driverName: picNameStr,
        status: formData.status || 'Available',
        chassisNumber: formData.chassisNumber || '',
        color: formData.color || '',
        year: formData.year || '',
        taxAnnualDate: formData.taxAnnualDate || '',
        taxMonthlyDate: formData.taxMonthlyDate || '',
        picId: formData.picId || '',
        picName: picNameStr,
        photoUrl: formData.photoUrl || '',
        taxPayments: existingItem ? (existingItem.taxPayments || []) : (formData.taxPayments || []),
        servicePayments: existingItem ? (existingItem.servicePayments || []) : (formData.servicePayments || [])
      };

      const updated = isEditingId 
        ? list.map(item => item.id === isEditingId ? newItem : item)
        : [...list, newItem];

      saveCollection('vehicles', updated);
      showToast(`Sukses menyimpan armada [${newItem.plateNumber}] terekam.`);

    } else if (activeTab === 'equipment') {
      if (!formData.name) {
        showToast('Nama mesin atau perkakas harus diinput!', 'error');
        return;
      }
      if (!formData.brand) {
        showToast('Merek perkakas harus diinput!', 'error');
        return;
      }
      if (!formData.category) {
        showToast('Kategori perkakas wajib dipilih!', 'error');
        return;
      }
      const list = dbState.equipments || [];
      const codeStr = formData.code || (isEditingId ? (list.find(e => e.id === isEditingId)?.code || getNextToolCode()) : getNextToolCode());
      
      const picNameStr = formData.picId 
        ? ((dbState.employees || []).find(e => e.id === formData.picId)?.name || '')
        : '';

      const newItem: Equipment = {
        id: isEditingId || `eqp-${Date.now()}`,
        code: codeStr,
        tool_code: codeStr,
        name: formData.name,
        category: formData.category || 'Power Tools',
        brand: formData.brand,
        serial_number: formData.serial_number || '',
        power_specs: formData.power_specs || '',
        condition_status: formData.condition_status || 'Siap Pakai',
        loan_status: formData.loan_status || 'Tersedia',
        photo_path: formData.photoUrl || '',
        photoUrl: formData.photoUrl || '',
        created_at: formData.created_at || new Date().toISOString(),
        location: formData.location || '',
        model: formData.model || '',
        price: formData.price ? Number(formData.price) : undefined,
        picId: formData.picId || '',
        picName: picNameStr,
        status_alat: formData.status_alat || 'Baru',

        // Backwards compatibility for general machinery tabs
        condition: (formData.condition_status === 'Siap Pakai' ? 'Baik' : formData.condition_status === 'Rusak Total' ? 'Rusak' : 'Perlu Servis') as any,
        lastServiced: new Date().toISOString().split('T')[0]
      };

      const updated = isEditingId 
        ? list.map(item => item.id === isEditingId ? newItem : item)
        : [...list, newItem];

      saveCollection('equipments', updated);
      showToast(`Aset alat kerja kayu [${newItem.code}] ${isEditingId ? 'diperbarui' : 'didaftarkan'} sukses.`);
    }

    setModalOpen(false);
  };

  // Filter List depending on search term
  const customersList = dbState.customers || [];
  const suppliersList = dbState.suppliers || [];
  const vehiclesList = dbState.vehicles || [];
  const equipmentsList = dbState.equipments || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, vehicleSubTab, equipmentSubTab]);

  const allFilteredItems = (() => {
    const term = searchTerm.toLowerCase();
    
    if (activeTab === 'mitra') {
      if (mitraSubTab === 'customer') {
        return customersList.filter(c => c.name.toLowerCase().includes(term) || (c.company || '').toLowerCase().includes(term));
      } else {
        return suppliersList.filter(s => s.name.toLowerCase().includes(term) || (s.contactPerson || '').toLowerCase().includes(term));
      }
    } else if (activeTab === 'vehicle') {
      if (vehicleSubTab === 'armada') {
        return vehiclesList.filter(v => v.plateNumber.toLowerCase().includes(term) || v.type.toLowerCase().includes(term));
      } else if (vehicleSubTab === 'pajak') {
        const allTaxes: any[] = [];
        vehiclesList.forEach(v => {
          (v.taxPayments || []).forEach((t: any) => {
            const payerName = decodeEmployeeName(t.payerId).toLowerCase();
            if (v.plateNumber.toLowerCase().includes(term) || v.type.toLowerCase().includes(term) || payerName.includes(term)) {
              allTaxes.push({ ...t, vehicleId: v.id, plate: v.plateNumber, type: v.type });
            }
          });
        });
        allTaxes.sort((a,b) => b.payDate.localeCompare(a.payDate));
        return allTaxes;
      } else {
        const allServices: any[] = [];
        vehiclesList.forEach(v => {
          (v.servicePayments || []).forEach((s: any) => {
            const servicerName = decodeEmployeeName(s.servicerId).toLowerCase();
            if (v.plateNumber.toLowerCase().includes(term) || v.type.toLowerCase().includes(term) || servicerName.includes(term) || (s.type || '').toLowerCase().includes(term)) {
              allServices.push({ ...s, vehicleId: v.id, plate: v.plateNumber, type: v.type });
            }
          });
        });
        allServices.sort((a,b) => b.serviceDate.localeCompare(a.serviceDate));
        return allServices;
      }
    } else if (activeTab === 'equipment') {
      if (equipmentSubTab === 'perkakas') {
        return equipmentsList.filter(e => e.name.toLowerCase().includes(term) || (e.code || '').toLowerCase().includes(term));
      } else {
        const allLoans = (dbState.toolLoans || []).filter(l => 
          l.loan_code.toLowerCase().includes(term) || 
          l.project_name.toLowerCase().includes(term) ||
          decodeEmployeeName(l.craftsman_employee_id).toLowerCase().includes(term)
        );
        allLoans.sort((a,b) => new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime());
        return allLoans;
      }
    }
    return [];
  })();

  const totalPages = Math.ceil(allFilteredItems.length / itemsPerPage);
  const currentItems = allFilteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-6 px-2">
        <span className="text-[11px] text-slate-500 font-medium">
          Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, allFilteredItems.length)} dari {allFilteredItems.length} data
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-500 hover:text-slate-950 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                currentPage === i + 1
                  ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-md shadow-indigo-100'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-500 hover:text-slate-950'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-500 hover:text-slate-950 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex-1 flex flex-col bg-white rounded-2xl p-6 animate-fadeIn shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      
      {/* Title wrapper block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
        <div>
          <h2 className="text-2xl tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">
            {activeTab === 'mitra' ? (mitraSubTab === 'customer' ? 'Customer' : 'Supplier') : 
             activeTab === 'vehicle' ? (
               vehicleSubTab === 'armada' ? 'Daftar Armada Kendaraan' :
               vehicleSubTab === 'pajak' ? 'Riwayat Pajak Kendaraan' :
               'Riwayat Service Berkala Kendaraan'
             ) : 
             (equipmentSubTab === 'perkakas' ? 'Peralatan & Workshop' : 'Log Peminjaman Alat Workshop')}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {activeTab === 'mitra' && mitraSubTab === 'customer' && 'Kelola data profil customer klien.'}
            {activeTab === 'mitra' && mitraSubTab === 'supplier' && 'Kelola data profil supplier fungsional.'}
            {activeTab === 'vehicle' && vehicleSubTab === 'armada' && 'Kelola data aset armada kendaraan operasional.'}
            {activeTab === 'vehicle' && vehicleSubTab === 'pajak' && 'Kelola dan pantau riwayat pembayaran pajak STNK bulanan dan tahunan armada.'}
            {activeTab === 'vehicle' && vehicleSubTab === 'service' && 'Kelola logs service berkala dan pemeliharaan armada kendaraan.'}
            {activeTab === 'equipment' && equipmentSubTab === 'perkakas' && 'Kelola daftar aset fungsional Peralatan & alat workshop.'}
            {activeTab === 'equipment' && equipmentSubTab === 'peminjaman' && 'Kelola log peminjaman dan pengembalian perkakas kerja.'}
          </p>
        </div>

        <div className="flex gap-2">
          {isSuperOrAdmin && (
             (activeTab !== 'equipment' || (activeTab === 'equipment' && equipmentSubTab !== 'peminjaman')) 
             ? (
              <button
                onClick={handleOpenAdd}
                className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                title={activeTab === 'equipment' ? 'Input Equipment' : 'Daftar Baru'}
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>
            ) : (
                <button
                   type="button"
                   onClick={() => {
                      setSelectedTool(null);
                      setLoanModalOpen(true);
                   }}
                   className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-10 h-10 transition-all duration-200 shadow-md shadow-emerald-500/20 border-none cursor-pointer"
                   title="Buat Form Peminjaman"
                >
                  <Plus className="w-5 h-5" />
                </button>
            )
          )}
        </div>
      </div>

      {/* Filter and Search Bar with subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder={`Cari data master ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {activeTab === 'mitra' && (
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button 
              onClick={() => setMitraSubTab('customer')} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                mitraSubTab === 'customer' 
                  ? 'bg-white shadow text-indigo-700' 
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Customer
            </button>
            <button 
              onClick={() => setMitraSubTab('supplier')} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                mitraSubTab === 'supplier' 
                  ? 'bg-white shadow text-amber-700' 
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Supplier
            </button>
          </div>
        )}

        {activeTab === 'vehicle' && (
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button
              onClick={() => setVehicleSubTab('armada')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                vehicleSubTab === 'armada' 
                  ? 'bg-white shadow text-indigo-700' 
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Daftar Armada
            </button>
            <button
              onClick={() => setVehicleSubTab('pajak')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                vehicleSubTab === 'pajak' 
                  ? 'bg-white shadow text-indigo-700' 
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Riwayat Pajak
            </button>
            <button
              onClick={() => setVehicleSubTab('service')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                vehicleSubTab === 'service' 
                  ? 'bg-white shadow text-indigo-700' 
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Riwayat Service
            </button>
          </div>
        )}

        {activeTab === 'equipment' && (
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button
              onClick={() => {
                setEquipmentSubTab('perkakas');
                setSearchTerm('');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                equipmentSubTab === 'perkakas'
                  ? 'bg-white shadow text-indigo-700'
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Daftar Alat
            </button>
            <button
              onClick={() => {
                setEquipmentSubTab('peminjaman');
                setSearchTerm('');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                equipmentSubTab === 'peminjaman'
                  ? 'bg-white shadow text-indigo-700'
                  : 'bg-transparent text-slate-500 hover:text-slate-850'
              }`}
            >
              Log Peminjaman
            </button>
          </div>
        )}
      </div>

      {activeTab === 'mitra' ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm bg-white animate-fadeIn flex-grow">
          <table className="w-full text-left text-xs text-slate-700 leading-normal border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100/80 text-[10px] font-bold text-slate-400 font-mono uppercase">
                {mitraSubTab === 'customer' && (
                  <>
                    <th className="px-4 py-3 whitespace-nowrap">ID Kode</th>
                    <th className="px-4 py-3 whitespace-nowrap">Nama Klien</th>
                    <th className="px-4 py-3 whitespace-nowrap">Korporasi</th>
                    <th className="px-4 py-3 whitespace-nowrap">Telefon</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Menu Tindakan</th>
                  </>
                )}
                {mitraSubTab === 'supplier' && (
                  <>
                    <th className="px-4 py-3 whitespace-nowrap">Kode Vendor</th>
                    <th className="px-4 py-3 whitespace-nowrap">Nama Supplier</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kontak Person</th>
                    <th className="px-4 py-3 whitespace-nowrap">No Telefon</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Menu Tindakan</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-500 hover:text-slate-950/50">
                    {mitraSubTab === 'customer' && (
                      <>
                        <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 whitespace-nowrap">{item.code}</td>
                        <td className="px-4 py-3.5 text-slate-850 font-sans font-bold whitespace-nowrap">{item.name}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">{item.company || '-'}</td>
                        <td className="px-4 py-3.5 font-mono whitespace-nowrap">{item.phone}</td>
                      </>
                    )}
                    {mitraSubTab === 'supplier' && (
                      <>
                        <td className="px-4 py-3.5 font-mono font-bold text-amber-600 whitespace-nowrap">{item.code}</td>
                        <td className="px-4 py-3.5 text-slate-850 font-bold whitespace-nowrap">{item.name}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">{item.contactPerson}</td>
                        <td className="px-4 py-3.5 font-mono whitespace-nowrap">{item.phone}</td>
                      </>
                    )}

                    <td className="px-4 py-3.5 text-right relative whitespace-nowrap">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
                          }}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent inline-flex items-center justify-center ${
                            activeDropdownId === item.id
                              ? 'text-indigo-600 bg-indigo-50'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                          title="Pilihan Aksi"
                        >
                          <MoreHorizontal className="w-5 h-5 pointer-events-none" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {activeDropdownId === item.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute right-4 top-11 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] py-1.5 z-40 text-left min-w-[145px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenView(item);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              Detail & Riwayat
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleOpenEdit(item);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Edit className="w-3.5 h-3.5 text-slate-500" />
                              Ubah Data
                            </button>

                            {isSuperOrAdmin && (
                              <div className="border-t border-slate-100 my-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteItem(item.id);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-rose-50 text-rose-600 hover:text-rose-705 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  Hapus Data
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Data master kosong. Buat baru dengan menekan tombol plus di atas kanan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      ) : activeTab === 'equipment' ? (
        <div className="space-y-6 flex-1 flex flex-col">

          {equipmentSubTab === 'perkakas' ? (
            /* CARDS GRID LAYOUT */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn items-start">
                {currentItems.length > 0 ? (
                  currentItems.map((tool: any) => {
                    // Find if there's an active loan for this tool
                    const lastLoan = (dbState.toolLoans || [])
                      .filter((l: any) => l.tool_id === tool.id && l.loan_status === 'Aktif Dipakai')
                      .sort((a: any, b: any) => new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime())[0];
                    
                    const borrower = lastLoan
                      ? (dbState.employees || []).find((e: any) => e.id === lastLoan.craftsman_employee_id)
                      : null;
                    
                    const activeMenuForTool = activeDropdownId === tool.id;

                    return (
                      <div key={tool.id} className="relative bg-white -3xl    hover: transition-all overflow-hidden flex flex-col group text-left bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                        <div className="h-44 relative rounded-t-3xl overflow-hidden bg-slate-50">
                          {tool.photoUrl || tool.photo_path ? (
                            <img
                              src={tool.photoUrl || tool.photo_path}
                              alt={tool.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex flex-col items-center justify-center text-indigo-400 font-sans gap-1 font-bold">
                              <Wrench className="w-8 h-8 text-indigo-300" />
                              <span className="text-[9px] uppercase font-bold text-slate-455">Belum Ada Foto Alat</span>
                            </div>
                          )}

                          {/* Floating Tool Code */}
                          <div className="absolute top-3 left-3 bg-slate-900 border border-slate-800 text-white font-mono px-3 py-1 font-extrabold tracking-wider rounded text-[11px] shadow-sm select-none">
                            {tool.code || tool.tool_code}
                          </div>

                          {/* Floating Tool Status Badge */}
                          <div className={`absolute top-3 right-3 text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm bg-white border ${
                            tool.loan_status === 'Tersedia' || !tool.loan_status
                              ? 'text-emerald-700 border-emerald-100'
                              : 'text-amber-700 border-amber-100 animate-pulse'
                          }`}>
                            ● {tool.loan_status || 'Tersedia'}
                          </div>

                          {/* Card Floating Action Menu Toggle Button */}
                          <div className="absolute top-3 right-12 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === tool.id ? null : tool.id);
                              }}
                              className="w-7 h-7 bg-white/90 border border-slate-200 text-slate-700 hover:bg-white hover:text-slate-950 font-bold flex items-center justify-center rounded-full cursor-pointer shadow-md text-xs border-none"
                            >
                              •••
                            </button>
                            
                            {activeMenuForTool && (
                              <div className="absolute right-0 mt-1 w-44 bg-white   -2xl  py-2 z-20 text-left font-sans font-bold bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                                {tool.loan_status !== 'Dipakai Produksi' && tool.condition_status !== 'Rusak Total' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (tool.status_alat !== 'Terpakai') {
                                        showToast("Hanya peralatan dengan status 'Terpakai' yang dapat dipinjam. Silakan ubah status alat menjadi 'Terpakai' terlebih dahulu.", "error");
                                        return;
                                      }
                                      setSelectedTool(tool);
                                      setLoanModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 text-slate-700 hover:text-indigo-600 text-xs flex items-center gap-2 cursor-pointer border-none bg-transparent font-bold"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-indigo-505" /> Pinjam ke Tukang
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full text-left px-4 py-2 text-slate-350 text-xs flex items-center gap-2 cursor-not-allowed border-none bg-transparent font-bold"
                                  >
                                    <Lock className="w-3.5 h-3.5" /> Pinjam (Terkunci)
                                  </button>
                                )}

                                {tool.loan_status === 'Dipakai Produksi' && lastLoan ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveLoan(lastLoan);
                                      setReturnModalOpen(true);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 text-slate-700 hover:text-emerald-600 text-xs flex items-center gap-2 cursor-pointer border-none bg-transparent font-bold"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-550" /> Pengembalian Alat
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenView(tool);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 text-slate-700 hover:text-slate-950 text-xs flex items-center gap-2 cursor-pointer border-none bg-transparent font-bold"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" /> View Detail
                                </button>
                                
                                {isSuperOrAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleOpenEdit(tool);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 text-slate-700 hover:text-indigo-600 text-xs flex items-center gap-2 cursor-pointer border-none bg-transparent font-bold"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Alat
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteItem(tool.id);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-amber-500 hover:text-slate-950 text-rose-550 text-xs flex items-center gap-2 cursor-pointer border-none bg-transparent font-bold border-t border-slate-50 mt-1"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />&nbsp;Hapus Alat</button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4 font-sans text-xs">
                          <div className="space-y-3">
                            <div>
                              <span className="text-[9px] font-mono font-bold uppercase py-0.5 px-2 bg-indigo-50 text-indigo-700 rounded-md">
                                {tool.category || 'Power Tools'}
                              </span>
                              <h4 className="text-slate-900 text-sm mt-1.5 leading-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{tool.name}</h4>
                            </div>

                            {/* Specifications Bento-Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 text-[10px]">
                              <div>
                                  <span className="text-slate-400 block font-bold">Merek:</span>
                                  <span className="text-slate-700 font-medium truncate block">{tool.brand || '-'}</span>
                              </div>
                              <div>
                                  <span className="text-slate-400 block font-bold">Daya / Volts:</span>
                                  <span className="text-slate-700 font-medium block">{tool.power_specs || 'Manual / N/A'}</span>
                              </div>
                              <div className="col-span-2">
                                  <span className="text-slate-400 block font-bold">No. Seri:</span>
                                  <span className="text-slate-700 font-mono text-[9px] truncate block">{tool.serial_number || 'Tidak Ada'}</span>
                              </div>
                            </div>

                            {/* Physical Condition Status Indicator */}
                            <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-2.5">
                              <span className="text-slate-500 font-bold">Kondisi Alat Kerja:</span>
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[9px] border ${
                                tool.condition_status === 'Siap Pakai' || tool.condition === 'Baik'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : tool.condition_status === 'Mata Pisau Tumpul' 
                                  ? 'bg-amber-50 text-amber-750 border-amber-100'
                                  : tool.condition_status === 'Minta Servis' || tool.condition === 'Perlu Servis'
                                  ? 'bg-orange-50 text-orange-700 border-orange-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {tool.condition_status || tool.condition || 'Siap Pakai'}
                              </span>
                            </div>

                            {/* Real-time Borrower Foot-panel */}
                            {tool.loan_status === 'Dipakai Produksi' && borrower && (
                              <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5 animate-fadeIn">
                                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-[10px] uppercase">
                                  {(borrower.name || 'P').substring(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] text-amber-600 block font-bold animate-pulse">● Dipakai Produksi Oleh:</span>
                                  <span className="text-slate-800 text-[10px] font-bold block truncate leading-none mt-0.5">{borrower.name} ({borrower.role})</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Card Interactive row */}
                          <div className="flex gap-2 font-sans text-xs pt-2">
                            {tool.loan_status !== 'Dipakai Produksi' && tool.condition_status !== 'Rusak Total' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (tool.status_alat !== 'Terpakai') {
                                    showToast("Hanya peralatan dengan status 'Terpakai' yang dapat dipinjam. Silakan ubah status alat menjadi 'Terpakai' terlebih dahulu.", "error");
                                    return;
                                  }
                                  setSelectedTool(tool);
                                  setLoanModalOpen(true);
                                }}
                                className="flex items-center justify-center w-10 h-10 bg-[#2563eb] text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                                title="Pinjam ke Tukang"
                              >
                                <PlusCircle className="w-5 h-5 font-bold" />
                              </button>
                            ) : tool.loan_status === 'Dipakai Produksi' && lastLoan ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveLoan(lastLoan);
                                  setReturnModalOpen(true);
                                }}
                                className="flex items-center justify-center w-10 h-10 bg-[#10b981] text-white rounded-xl hover:bg-emerald-650 transition-all duration-200 shadow-md shadow-emerald-500/20 border-none cursor-pointer"
                                title="Kembalikan Alat"
                              >
                                <CheckSquare className="w-5 h-5 font-bold animate-pulse" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="w-10 h-10 bg-slate-100 text-slate-350 rounded-xl border-none cursor-not-allowed flex items-center justify-center"
                                title="Alat Tidak Tersedia"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs font-sans">
                    Tidak ada alat kerja kayu yang terdaftar. Buat baru dengan mengklik tombol '+' di kanan atas.
                  </div>
                )}
              </div>
              {renderPagination()}
            </>
          ) : (
            /* LOAN LOG TABLE TABLE VIEW */
            <div className="space-y-4 text-left flex-1 flex flex-col justify-between">

              <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm bg-white animate-fadeIn flex-grow flex flex-col justify-between min-h-[450px]">
                <table className="w-full text-left text-xs text-slate-700 leading-normal border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100/80 text-[10px] font-bold text-slate-400 font-mono uppercase">
                      <th className="px-5 py-3 whitespace-nowrap">Kode Log</th>
                      <th className="px-5 py-3 whitespace-nowrap">Equipment</th>
                      <th className="px-5 py-3 whitespace-nowrap">Peminjam (Tukang)</th>
                      <th className="px-5 py-3 whitespace-nowrap">PIC Gudang</th>
                      <th className="px-5 py-3 whitespace-nowrap">Project Interior</th>
                      <th className="px-5 py-3 whitespace-nowrap">Tanggal Pinjam</th>
                      <th className="px-5 py-3 whitespace-nowrap">Tanggal Kembali</th>
                      <th className="px-5 py-3 whitespace-nowrap">Status Log</th>
                      <th className="px-5 py-3 text-right whitespace-nowrap">Menu Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentItems.length > 0 ? (
                      currentItems.map((loan: any) => {
                        const tool = (dbState.equipments || []).find((t: any) => t.id === loan.tool_id);
                        const craftsman = (dbState.employees || []).find((e: any) => e.id === loan.craftsman_employee_id);
                        const pic = (dbState.employees || []).find((e: any) => e.id === loan.pic_gudang_id);

                        return (
                          <tr key={loan.id} className="hover:bg-amber-500 hover:text-slate-950/50">
                            <td className="px-5 py-3.5 font-mono font-bold text-indigo-650 whitespace-nowrap">{loan.loan_code}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-850">{tool ? tool.name : '-'}</span>
                              <span className="block font-mono text-[9px] text-slate-400 mt-0.5">{tool ? tool.code : ''}</span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">{craftsman ? craftsman.name : '-'}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">{pic ? pic.name : '-'}</td>
                            <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{loan.project_name || '-'}</td>
                            <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                              {new Date(loan.loan_date).toLocaleDateString('id-ID', { dateStyle: 'short' })} {new Date(loan.loan_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                              {loan.actual_return_date 
                                ? `${new Date(loan.actual_return_date).toLocaleDateString('id-ID', { dateStyle: 'short' })} ${new Date(loan.actual_return_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                                : '-'}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${
                                loan.loan_status === 'Sudah Kembali'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 bg-white'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100 bg-white animate-pulse'
                              }`}>
                                {loan.loan_status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              {loan.loan_status === 'Aktif Dipakai' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveLoan(loan);
                                    setReturnModalOpen(true);
                                  }}
                                  className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-650 rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1 border-none font-bold"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" /> Kembalikan
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-normal select-none">Selesai</span>
                              )}
                              
                              {isSuperOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Hapus log peminjaman [${loan.loan_code}]? Tindakan ini tidak dapat dibatalkan.`)) {
                                      const updatedLoans = (dbState.toolLoans || []).filter((l: any) => l.id !== loan.id);
                                      
                                      // If the deleted loan was active, restore tool availability
                                      let updatedTools = dbState.equipments || [];
                                      if (loan.loan_status === 'Aktif Dipakai') {
                                        updatedTools = (dbState.equipments || []).map((t: any) => {
                                          if (t.id === loan.tool_id) {
                                            return { ...t, loan_status: 'Tersedia' as const };
                                          }
                                          return t;
                                        });
                                      }
                                      
                                      saveCollection('equipments', updatedTools);
                                      saveCollection('toolLoans', updatedLoans);
                                      showToast(`Log peminjaman ${loan.loan_code} berhasil dihapus.`);
                                    }
                                  }}
                                  className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-550 rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1 border-none font-bold ml-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-5 py-24 text-center text-slate-400 text-xs font-sans">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <span className="text-sm font-semibold text-slate-500">Log Peminjaman Kosong</span>
                            <p className="max-w-md text-[11px] text-slate-450 leading-normal">
                              Belum ada aktivitas sirkulasi peminjaman atau pengembalian alat workshop hari ini. Form peminjaman baru akan tercatat di sini.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination && renderPagination()}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Sub-tab view: CARD GRID */}
          {vehicleSubTab === 'armada' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn flex-grow">
                {currentItems.length > 0 ? (
                  currentItems.map((v: any) => (
                    <div key={v.id} className="relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 hover:shadow-lg transition-all overflow-hidden flex flex-col group">
                      <div className="h-40 relative rounded-t-3xl overflow-hidden bg-slate-50">
                        {v.photoUrl ? (
                          <img 
                            src={v.photoUrl} 
                            alt={v.plateNumber} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex flex-col items-center justify-center text-indigo-400 font-sans gap-1 font-bold">
                            <Truck className="w-8 h-8 text-indigo-300" />
                            <span className="text-[9px] uppercase font-bold text-slate-400">Belum Ada Foto Armada</span>
                          </div>
                        )}
                        
                        {/* Floating license plate */}
                        <div className="absolute top-3 left-3 bg-slate-950 border border-slate-800 text-white font-mono px-3 py-1 font-extrabold tracking-wider rounded text-[11px] shadow-md">
                          {v.plateNumber}
                        </div>

                        {/* Floating status badge */}
                        <div className={`absolute top-12 right-3 text-[9px] font-bold px-2.5 py-1 rounded-full shadow-md bg-white border ${
                          v.status === 'Available' ? 'text-emerald-600 border-emerald-100' :
                          v.status === 'On Delivery' ? 'text-amber-600 border-amber-100 animate-pulse' :
                          'text-rose-600 border-rose-100'
                        }`}>
                          ● {v.status}
                        </div>
                      </div>

                        {/* 3-Dot Menu */}
                        <div className="absolute top-3 right-3 z-10">
                           <button 
                            type="button"
                            onClick={() => setActiveDropdownId(activeDropdownId === v.id ? null : v.id)}
                            className="bg-white/90 backdrop-blur p-1.5 rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-indigo-600"
                           >
                             <MoreHorizontal className="w-4 h-4" />
                           </button>
                           <AnimatePresence>
                             {activeDropdownId === v.id && (
                               <motion.div
                                 initial={{ opacity: 0, scale: 0.95 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 exit={{ opacity: 0, scale: 0.95 }}
                                 className="absolute right-0 top-9 bg-white rounded-xl shadow-xl py-1.5 z-20 min-w-[120px] text-left border border-slate-100"
                               >
                                 <button
                                   onClick={() => {
                                     handleOpenEdit(v);
                                     setActiveDropdownId(null);
                                   }}
                                   className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                 >
                                   <Edit className="w-3.5 h-3.5" /> Ubah Data
                                 </button>
                                 <button
                                   onClick={() => {
                                     handleDeleteItem(v.id);
                                     setActiveDropdownId(null);
                                   }}
                                   className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" /> Hapus
                                 </button>
                                 <button
                                   onClick={() => {
                                     setSelectedVehicle(v);
                                     setPajakForm({
                                       payDate: new Date().toISOString().split('T')[0],
                                       amount: '',
                                       payerId: v.picId || '',
                                       bankAccount: 'Kas Bank',
                                       receiptPhoto: ''
                                     });
                                     setPajakModalOpen(true);
                                     setActiveDropdownId(null);
                                   }}
                                   className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2"
                                 >
                                   <Receipt className="w-3.5 h-3.5" /> Bayar Pajak
                                 </button>
                                 <button
                                   onClick={() => {
                                     setSelectedVehicle(v);
                                     setServiceForm({
                                       serviceDate: new Date().toISOString().split('T')[0],
                                       kmService: '',
                                       amount: '',
                                       servicerId: v.picId || '',
                                       bankAccount: 'Kas Bank',
                                       nextServiceDate: '',
                                       nextServiceKm: '',
                                       receiptPhoto: ''
                                     });
                                     setServiceModalOpen(true);
                                     setActiveDropdownId(null);
                                   }}
                                   className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2"
                                 >
                                   <Settings className="w-3.5 h-3.5" /> Service Mobil
                                 </button>
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] font-mono font-bold uppercase py-0.5 px-2 bg-indigo-50 text-indigo-700 rounded-md">
                                {v.code || 'VHC-ID'}
                              </span>
                              <h4 className="text-slate-900 text-sm mt-1.5 leading-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{v.type}</h4>
                            </div>
                          </div>

                          {/* Bento Specifications Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-[10px]">
                            <div>
                              <span className="text-slate-400 block font-bold">Warna</span>
                              <span className="text-slate-700 font-medium truncate block">{v.color || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-bold">Tahun</span>
                              <span className="text-slate-700 font-medium block">{v.year || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-bold">No Rangka</span>
                              <span className="text-slate-700 font-mono text-[9px] truncate block" title={v.chassisNumber}>{v.chassisNumber || '-'}</span>
                            </div>
                          </div>

                          {/* PIC penanggung jawab row */}
                          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] uppercase">
                              {(v.picName || v.driverName || 'S').substring(0, 2)}
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">Penanggung Jawab PIC:</span>
                              <span className="text-slate-800 text-[11px] font-bold block leading-none mt-0.5">{v.picName || v.driverName}</span>
                            </div>
                          </div>

                          {/* Tax deadlines list */}
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Pajak Tahunan:
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[9px] border ${getTaxStatus(v.taxAnnualDate).color}`}>
                                {v.taxAnnualDate ? `${v.taxAnnualDate} (${getTaxStatus(v.taxAnnualDate).label})` : 'Belum Diatur'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-550 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Pajak Bulanan:
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[9px] border ${getTaxStatus(v.taxMonthlyDate).color}`}>
                                {v.taxMonthlyDate ? `${v.taxMonthlyDate} (${getTaxStatus(v.taxMonthlyDate).label})` : 'Belum Diatur'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Feet Action Rows */}
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          {/* High-priority action buttons */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setSelectedVehicle(v);
                                setPajakForm({
                                  payDate: new Date().toISOString().split('T')[0],
                                  amount: '',
                                  payerId: v.picId || '',
                                  bankAccount: 'Kas Bank',
                                  receiptPhoto: ''
                                });
                                setPajakModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" /> Bayar Pajak
                            </button>
                            <button
                              onClick={() => {
                                setSelectedVehicle(v);
                                setServiceForm({
                                  serviceDate: new Date().toISOString().split('T')[0],
                                  kmService: '',
                                  amount: '',
                                  servicerId: v.picId || '',
                                  bankAccount: 'Kas Bank',
                                  nextServiceDate: '',
                                  nextServiceKm: '',
                                  receiptPhoto: ''
                                });
                                setServiceModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5" /> Service Mobil
                            </button>
                          </div>

                          {/* Standard action buttons */}
                          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-100 mt-2">
                            <button
                              onClick={() => handleOpenView(v)}
                              title="Detail & Riwayat"
                              className="text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer flex items-center gap-1 font-bold mb-0 text-[11px]"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail & Riwayat
                            </button>
                            
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(v)}
                                title="Ubah"
                                className="p-1 px-2 text-slate-500 hover:text-indigo-605 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer border-none bg-transparent flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Edit className="w-3.5 h-3.5" /> Ubah
                              </button>
                              {isSuperOrAdmin && (
                                <button
                                  onClick={() => handleDeleteItem(v.id)}
                                  title="Hapus"
                                  className="p-1 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border-none bg-transparent flex items-center gap-1 text-[11px] font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="hidden flex items-center justify-between text-[10px] relative">
                            <button
                              onClick={() => handleOpenView(v)}
                              className="text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer flex items-center gap-1 font-bold mb-0"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail & Riwayat
                            </button>
                            
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(activeDropdownId === v.id ? null : v.id);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 border-none cursor-pointer inline-flex items-center"
                                title="Pilihan Aksi"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {/* Dropdown Menu Popup - Bahasa Indonesia */}
                              {activeDropdownId === v.id && (
                                <div className="absolute right-0 bottom-full mb-1 w-44 bg-white     -900/10 z-[100] overflow-hidden text-left font-sans bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100" onClick={(e) => e.stopPropagation()}>
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        handleOpenEdit(v);
                                        setActiveDropdownId(null);
                                      }}
                                      className="w-full text-left   text-[11px] font-bold text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-indigo-500" /> Ubah Master Data
                                    </button>

                                    {isSuperOrAdmin && (
                                      <button
                                        onClick={() => {
                                          handleDeleteItem(v.id);
                                          setActiveDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-rose-605 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-none bg-transparent"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Hapus Record
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-16 text-center text-slate-400 bg-slate-50/50 rounded-3xl font-sans text-xs animate-fadeIn">
                    Tidak ada armada kendaraan cocok dengan filter pencarian Anda.
                  </div>
                )}
              </div>
              {renderPagination()}
            </>
          )}

          {/* Sub-tab view: PAJAK LOGS */}
          {vehicleSubTab === 'pajak' && (
            <div className="overflow-x-auto -3xl   bg-white  animate-fadeIn bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <table className="w-full text-left text-xs text-slate-700 leading-normal border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase">
                    <th className="px-5 py-3 whitespace-nowrap">Armada / No Polisi</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tanggal Bayar</th>
                    <th className="px-5 py-3 whitespace-nowrap">Payer (PIC)</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Nominal Bayar</th>
                    <th className="px-5 py-3 whitespace-nowrap">Sumber Dana</th>
                    <th className="px-5 py-3 text-center whitespace-nowrap">Attachment</th>
                    {isSuperOrAdmin && <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 leading-relaxed">
                        Data riwayat pajak kosong.
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((tax, idx) => (
                      <tr key={tax.id || idx} className="hover:bg-amber-500 hover:text-slate-950/50">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{tax.type}</span>
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{tax.plate}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono whitespace-nowrap">{tax.payDate}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-700 whitespace-nowrap">{decodeEmployeeName(tax.payerId)}</td>
                        <td className="px-5 py-3.5 font-bold font-mono text-right text-emerald-600 whitespace-nowrap">
                          Rp {Number(tax.amount).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">{tax.bankAccount}</td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {tax.receiptPhoto ? (
                            <button
                              type="button"
                              onClick={() => setReceiptPhotoViewing(tax.receiptPhoto)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-755 text-[10px] rounded-lg border-none font-bold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Lihat Bukti
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Tidak ada</span>
                          )}
                        </td>
                        {isSuperOrAdmin && (
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteTaxLog(tax.vehicleId, tax.id, tax.txId)}
                              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1 border-none font-bold shadow-sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />&nbsp;Hapus</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination && renderPagination()}
            </div>
          )}

          {/* Sub-tab view: SERVICE LOGS */}
          {vehicleSubTab === 'service' && (
            <div className="overflow-x-auto -3xl   bg-white  animate-fadeIn bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <table className="w-full text-left text-xs text-slate-700 leading-normal border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono uppercase">
                    <th className="px-5 py-3 whitespace-nowrap">Armada / No Polisi</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tanggal Service</th>
                    <th className="px-5 py-3 whitespace-nowrap">KM Service</th>
                    <th className="px-5 py-3 whitespace-nowrap">Yang Service</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Biaya</th>
                    <th className="px-5 py-3 whitespace-nowrap">Payment Bank</th>
                    <th className="px-5 py-3 whitespace-nowrap">Next Service</th>
                    <th className="px-5 py-3 text-center whitespace-nowrap">Attachment</th>
                    {isSuperOrAdmin && <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400 leading-relaxed">
                        Data riwayat service kosong.
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((srv, idx) => (
                      <tr key={srv.id || idx} className="hover:bg-amber-500 hover:text-slate-950/50">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{srv.type}</span>
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{srv.plate}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono whitespace-nowrap">{srv.serviceDate}</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">{srv.kmService} KM</td>
                        <td className="px-5 py-3.5 font-bold text-slate-700 whitespace-nowrap">{decodeEmployeeName(srv.servicerId)}</td>
                        <td className="px-5 py-3.5 font-bold font-mono text-right text-emerald-600 whitespace-nowrap">
                          Rp {Number(srv.amount).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">{srv.bankAccount}</td>
                        <td className="px-5 py-3.5 font-sans whitespace-nowrap">
                          {srv.nextServiceDate ? (
                            <div className="text-[10px]">
                              <span className="block text-indigo-700 font-bold">{srv.nextServiceDate}</span>
                              {srv.nextServiceKm && <span className="block text-slate-400">{srv.nextServiceKm} KM</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {srv.receiptPhoto ? (
                            <button
                              type="button"
                              onClick={() => setReceiptPhotoViewing(srv.receiptPhoto)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-755 text-[10px] rounded-lg border-none font-bold cursor-pointer"
                            >
                              Lihat Bukti
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Tidak ada</span>
                          )}
                        </td>
                        {isSuperOrAdmin && (
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteServiceLog(srv.vehicleId, srv.id, srv.txId)}
                              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1 border-none font-bold shadow-sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />&nbsp;Hapus</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination && renderPagination()}
            </div>
          )}
        </div>
      )}

      {/* POPUP DYNAMIC MODAL FORM */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          isEditingId 
            ? `Edit ${
                activeTab === 'mitra' && mitraSubTab === 'customer' ? 'Customer' : 
                activeTab === 'mitra' && mitraSubTab === 'supplier' ? 'Supplier' : 
                activeTab === 'vehicle' ? 'Aset Kendaraan' : 
                'Alat'
              }` 
            : `${activeTab === 'equipment' ? 'Tambah Alat Baru' : 'Input ' + (
                activeTab === 'mitra' && mitraSubTab === 'customer' ? 'Customer' : 
                activeTab === 'mitra' && mitraSubTab === 'supplier' ? 'Supplier' : 
                activeTab === 'vehicle' ? 'Aset Kendaraan' : 
                'Alat Baru'
              )}`
        }
        maxWidth={(activeTab === 'equipment' || activeTab === 'vehicle') ? 'max-w-4xl' : 'max-w-md'}
      >
        <p className="text-[10px] text-slate-400 font-sans -mt-2 mb-4">Semua data secara instan memengaruhi dropdown skema di modul transaksi.</p>
        
        {/* MITRA TYPE SWITCH */}
        {activeTab === 'mitra' && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 w-full">
            <button type="button" onClick={() => setMitraSubTab('customer')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mitraSubTab === 'customer' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>Customer</button>
            <button type="button" onClick={() => setMitraSubTab('supplier')} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mitraSubTab === 'supplier' ? 'bg-white shadow text-amber-700' : 'text-slate-500'}`}>Supplier</button>
          </div>
        )}

        <form onSubmit={handleSaveData} className="space-y-4 text-xs font-sans text-left font-bold text-slate-705">
                    {activeTab === 'mitra' && mitraSubTab === 'customer' && (
            <>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Customer Klien:</label>
                <input
                  type="text"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No Handphone / WhatsApp:</label>
                <input
                  type="text"
                  placeholder="e.g. 0812345678"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Email Klien:</label>
                  <input
                    type="email"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.email || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Perusahaan / PT (Opsional):</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.company || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alamat Lokasi Utama:</label>
                <textarea
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </>
          )}

          {activeTab === 'mitra' && mitraSubTab === 'supplier' && (
            <>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Vendor / Toko Supplier:</label>
                <input
                  type="text"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Badan Usaha:</label>
                <select
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.businessType || 'CV'}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                >
                  <option value="Perorangan">Perorangan</option>
                  <option value="CV">CV</option>
                  <option value="PT">PT</option>
                  <option value="Firma">Firma</option>
                  <option value="Koperasi">Koperasi</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama PJ (Contact Person):</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.contactPerson || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">WhatsApp PJ:</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Email Vendor:</label>
                <input
                  type="email"
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.email || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Bank:</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank Mandiri"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.bankName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nomor Rekening:</label>
                  <input
                    type="text"
                    placeholder="e.g. 138..."
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    defaultValue={formData.bankAccount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alamat Lengkap:</label>
                <textarea
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                  defaultValue={formData.address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                />
              </div>
            </>
          )}

          {activeTab === 'vehicle' && (
            <div className="space-y-6 pt-3 font-sans">
              {/* ROW 1: PLAT NOMOR, JENIS, STATUS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                    Plat Nomor Polisi: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B 9091 CBA"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.plateNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, plateNumber: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                    Jenis Armada / Kendaraan: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GranMax Box, L300"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.type || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Status Armada:</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.status || 'Available'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Available">Available</option>
                    <option value="On Delivery">On Delivery</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              {/* ROW 2: NO RANGKA, WARNA, TAHUN PEMBUATAN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No Rangka / Sasis:</label>
                  <input
                    type="text"
                    placeholder="e.g. MHK7GD..."
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.chassisNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, chassisNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Warna:</label>
                  <input
                    type="text"
                    placeholder="e.g. Hitam Metalik"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.color || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tahun Pembuatan:</label>
                  <input
                    type="text"
                    placeholder="e.g. 2021"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.year || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                  />
                </div>
              </div>

              {/* ROW 3: PAJAK TAHUNAN, PAJAK BULANAN, PENANGGUNG JAWAB */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Pajak Tahunan:</label>
                  <input
                    type="date"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.taxAnnualDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxAnnualDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Pajak Bulanan:</label>
                  <input
                    type="date"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.taxMonthlyDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxMonthlyDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Penanggung Jawab (PIC / Sopir):</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.picId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, picId: e.target.value }))}
                  >
                    <option value="">-- Pilih Karyawan Penanggung Jawab --</option>
                    {(dbState.employees || []).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ROW 4: PHOTO UPLOAD */}
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                  <span>Unggah Foto Armada (Kompres Otomatis):</span>
                  {formData.photoUrl && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                      className="text-[10px] text-rose-500 hover:underline border-none bg-transparent cursor-pointer font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Foto
                    </button>
                  )}
                </label>
                {formData.photoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-28 bg-slate-50 flex items-center justify-center animate-fadeIn">
                    <img src={formData.photoUrl} alt="Preview Armada" className="h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const compressed = await handleImageUpload(e.target.files[0]);
                          setFormData(prev => ({ ...prev, photoUrl: compressed }));
                          showToast('Foto armada berhasil ditambahkan dengan otomatisasi kompres!', 'success');
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center gap-1 font-sans">
                      <Camera className="w-5 h-5 text-indigo-500 mb-1" />
                      <span className="text-[10px] text-slate-500 font-bold">Tekan untuk ambil/unggah foto</span>
                      <span className="text-[9px] text-slate-400 font-normal">Sistem auto-kompres menjaga performa database jernih</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'equipment' && (
                <div className="space-y-6 pt-3 font-sans">
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 font-sans">
                    {/* KOLOM PERTAMA (KIRI): PHOTO & BARCODE */}
                    <div className="space-y-6">
                        {/* PHOTO UPLOAD */}
                        <div>
                         <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                           <span>Unggah Foto Alat:</span>
                           {formData.photoUrl && (
                             <button type="button" onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))} className="text-[10px] text-rose-500 hover:underline border-none bg-transparent cursor-pointer font-bold">Hapus</button>
                           )}
                         </label>
                         {formData.photoUrl ? (
                           <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-40 w-full bg-slate-50 flex items-center justify-center">
                             <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                           </div>
                         ) : (
                           <div className="border border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer relative w-full h-40 flex flex-col items-center justify-center">
                             <input type="file" accept="image/*" onChange={async (e) => {
                               if (e.target.files && e.target.files[0]) {
                                 const compressed = await handleImageUpload(e.target.files[0]);
                                 setFormData(prev => ({ ...prev, photoUrl: compressed }));
                                 showToast('Foto berhasil diunggah!', 'success');
                               }
                             }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                             <Camera className="w-8 h-8 text-indigo-500 mb-2" />
                             <span className="text-xs text-slate-500 font-bold">Upload Foto Alat</span>
                           </div>
                         )}
                       </div>

                       {/* BARCODE SECTION */}
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-row items-center gap-4">
                           <div className="bg-white p-2 rounded-lg border border-slate-200">
                               <QRCode value={formData.code || getNextToolCode()} size={60} />
                           </div>
                           <div className="flex-1">
                             <label className="text-[10px] font-semibold text-[#8fa0be] uppercase tracking-wider block">ID Barcode (Auto):</label>
                             <input
                               type="text"
                               readOnly
                               value={formData.code || getNextToolCode()}
                               className="w-full bg-[#e2e8f0] text-slate-800 rounded-lg p-2 text-xs font-mono font-bold border-none"
                             />
                           </div>
                       </div>
                    </div>

                    {/* KOLOM KEDUA (TENGAH): Kategori Barang, Nama Alat, Lokasi Penyimpanan, Status */}
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                          Status Pembelian Alat:
                        </label>
                        <div className="flex bg-[#f1f5f9] p-1 rounded-xl w-full">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, status_alat: 'Baru' }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                              (formData.status_alat || 'Baru') === 'Baru'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 bg-transparent'
                            }`}
                          >
                            Baru
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, status_alat: 'Terpakai' }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                              (formData.status_alat || 'Baru') === 'Terpakai'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 bg-transparent'
                            }`}
                          >
                            Terpakai
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                          Kategori Barang: <span className="text-rose-500">*</span>
                        </label>
                        <select
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={formData.category || 'Power Tools'}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                          required
                        >
                          <option value="Power Tools">Power Tools</option>
                          <option value="Hand Tools">Hand Tools</option>
                          <option value="Stationary Machinery">Stationary Machinery</option>
                          <option value="Pneumatic Tools">Pneumatic Tools</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">Nama Alat: <span className="text-rose-500">*</span></label>
                        <input type="text" placeholder="Contoh: Mesin Potong HPL" className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Lokasi Penyimpanan:</label>
                        <input type="text" list="lokasi-list" placeholder="Contoh: Rak Alat Workshop A" className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans" value={formData.location || ''} onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))} />
                        <datalist id="lokasi-list">
                          {Array.from(new Set((dbState.equipments || []).map(e => e.location).filter(Boolean))).map((loc, i) => (
                             <option key={i} value={loc} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Status:</label>
                        <select
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={formData.loan_status || 'Tersedia'}
                          onChange={(e) => setFormData(prev => ({ ...prev, loan_status: e.target.value }))}
                        >
                          <option value="Tersedia">Tersedia</option>
                          <option value="Dipakai Produksi">Di Pinjam</option>
                          <option value="Tidak Boleh Dipakai">Tidak Boleh Di Pakai</option>
                        </select>
                      </div>
                    </div>

                    {/* KOLOM KETIGA (KANAN): Penanggung Jawab (PIC), Merk Alat, Model, Harga (Nilai Alat), Kondisi */}
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Penanggung Jawab (PIC):</label>
                        <select
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={formData.picId || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, picId: e.target.value }))}
                        >
                          <option value="">-</option>
                          {(dbState.employees || []).map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">Merk Alat: <span className="text-rose-500">*</span></label>
                        <input type="text" placeholder="Contoh: Makita" className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans" value={formData.brand || ''} onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))} required />
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Model:</label>
                        <input type="text" placeholder="Contoh: 9553B" className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans" value={formData.model || ''} onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))} />
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Harga (Nilai Alat):</label>
                        <input type="number" placeholder="0" className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans" value={formData.price || ''} onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))} />
                      </div>

                      <div>
                        <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kondisi:</label>
                        <select
                          className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                          value={formData.condition_status || 'Siap Pakai'}
                          onChange={(e) => setFormData(prev => ({ ...prev, condition_status: e.target.value as any }))}
                        >
                          <option value="Siap Pakai">Siap Pakai / Baik</option>
                          <option value="Minta Servis">Minta Servis</option>
                          <option value="Rusak Total">Rusak Total</option>
                          <option value="Mata Pisau Tumpul">Mata Pisau Tumpul</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                {activeTab !== 'vehicle' ? (
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm"
                    title="Batal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm"
                    title="Batal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {activeTab !== 'vehicle' ? (
                  <button
                    type="submit"
                    className="flex items-center justify-center bg-[#2563eb] hover:bg-blue-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-blue-500/20"
                    title="Simpan"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex items-center justify-center bg-[#2563eb] hover:bg-blue-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-blue-500/20"
                    title="Simpan"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>

      </Modal>

      {/* POPUP VIEW DATA DETAIL MODAL */}
      <Modal
        isOpen={viewModalOpen && !!viewingItem}
        onClose={() => setViewModalOpen(false)}
        title={`Arsip Detail ${viewingItem?.code || viewingItem?.plateNumber}`}
        maxWidth={activeTab === 'vehicle' ? 'max-w-2xl' : 'max-w-md'}
      >
        {viewingItem && (
          <div className="space-y-4 text-xs font-sans">
              <div className="mb-4">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                  {activeTab} Card
                </span>
              </div>
              
              {activeTab === 'customer' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Kode Customer:</span>
                    <span className="font-mono text-xs font-bold text-indigo-600">{viewingItem.code}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Customer Klien:</span>
                    <span className="text-slate-800 font-bold text-sm block mt-0.5">{viewingItem.name}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">No Handphone:</span>
                      <span className="text-slate-700 font-mono font-bold block mt-0.5">{viewingItem.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Perusahaan:</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.company || '-'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Email Klien:</span>
                    <span className="text-slate-700 block mt-0.5">{viewingItem.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Alamat Utama Lokasi:</span>
                    <span className="text-slate-600 block mt-0.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 leading-relaxed text-[11px] font-medium">
                      {viewingItem.address || 'Alamat belum dilengkapi.'}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'supplier' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50/35 rounded-2xl border border-amber-100/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Kode Vendor:</span>
                      <span className="font-mono text-xs font-bold text-amber-600">{viewingItem.code}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-mono text-[9px] font-bold rounded">Active Supplier</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Toko / Supplier:</span>
                    <span className="text-slate-850 font-bold text-sm block mt-0.5">{viewingItem.name}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Contact Person (CP):</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.contactPerson}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">WhatsApp Vendor:</span>
                      <span className="text-slate-700 font-mono font-bold block mt-0.5">{viewingItem.phone || '-'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-50 border border-indigo-100/80 rounded-2xl space-y-2.5 animate-fadeIn">
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-md font-mono font-bold uppercase tracking-wider block w-fit">
                      Arsip Transfer Keuangan
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px]">
                      <div>
                        <span className="text-[10px] text-indigo-400 block font-bold">Nama Bank:</span>
                        <span className="text-indigo-900 font-bold block mt-0.5">{viewingItem.bankName || 'Belum diisi'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-400 block font-bold">No. Rekening:</span>
                        <span className="text-indigo-900 font-mono font-bold block mt-0.5">{viewingItem.bankAccount || 'Belum diisi'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                     <span className="text-[10px] text-slate-400 uppercase font-bold block">Alamat Gudang / Kantor:</span>
                     <span className="text-slate-600 block mt-0.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 leading-relaxed text-[11px] font-medium">
                       {viewingItem.address || 'Alamat belum dilengkapi.'}
                     </span>
                  </div>
                </div>
              )}

              {activeTab === 'vehicle' && (
                <div className="space-y-4 text-xs font-sans text-slate-700">
                  
                  {viewingItem?.photoUrl ? (
                    <div className="h-44 rounded-2xl overflow-hidden bg-slate-50 border border-slate-205">
                      <img src={viewingItem?.photoUrl} alt={viewingItem?.plateNumber} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="h-28 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center font-bold text-slate-400 text-[10px]">
                      <Truck className="w-8 h-8 text-slate-300 mb-1" />
                      BELUM ADA FOTO ARMADA
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Pelat Nomor</span>
                      <span className="font-mono text-sm font-black text-slate-900 block mt-0.5">{viewingItem?.plateNumber}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">PIC Penanggung Jawab</span>
                      <span className="font-sans text-xs font-extrabold text-slate-900 block mt-0.5">{viewingItem?.picName || viewingItem?.driverName}</span>
                    </div>
                  </div>

                  {/* Bento specs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl text-[10px] border border-slate-100/60 font-medium">
                    <div>
                      <span className="text-slate-400 block font-bold">Jenis Kendaraan:</span>
                      <span className="text-slate-800 font-extrabold block">{viewingItem?.type || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Warna Karoseri:</span>
                      <span className="text-slate-800 font-bold block">{viewingItem?.color || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Tahun Produksi:</span>
                      <span className="text-slate-800 font-mono font-bold block">{viewingItem?.year || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Status:</span>
                      <span className="text-slate-800 font-bold block">● {viewingItem?.status}</span>
                    </div>
                  </div>

                  {/* Riwayat Pajak Pajak (Pajak Logs) */}
                  <div className="space-y-2 pt-1">
                    <h5 className="font-extrabold text-slate-900 text-[11px] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Riwayat Pembayaran Pajak Kendaraan
                    </h5>
                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 bg-white">
                      {viewingItem?.taxPayments && viewingItem?.taxPayments.length > 0 ? (
                        viewingItem?.taxPayments.map((p: any, i: number) => (
                          <div key={p.id || i} className="p-2.5 flex justify-between items-center text-[10px] hover:bg-amber-500 hover:text-slate-950 animate-fadeIn font-medium">
                            <div>
                              <span className="font-bold text-slate-800 block">{p.payDate}</span>
                              <span className="text-[9px] text-slate-400 font-normal">Pembayar: {decodeEmployeeName(p.payerId)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="font-mono font-bold text-emerald-600 block">Rp {Number(p.amount).toLocaleString('id-ID')}</span>
                                <span className="text-[9px] text-slate-405 font-mono block">{p.bankAccount}</span>
                              </div>
                              {p.receiptPhoto && (
                                <button
                                  type="button"
                                  onClick={() => setReceiptPhotoViewing(p.receiptPhoto)}
                                  className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] rounded-md border-none font-bold cursor-pointer"
                                >
                                  Nota
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-405 text-[10px]">Belum ada data pembayaran pajak diarsipkan.</div>
                      )}
                    </div>
                  </div>

                  {/* Riwayat Service Mobil */}
                  <div className="space-y-2 pt-1">
                    <h5 className="font-extrabold text-slate-900 text-[11px] flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-indigo-500" /> Riwayat Perawatan & Service Berkala
                    </h5>
                    <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 bg-white">
                      {viewingItem.servicePayments && viewingItem.servicePayments.length > 0 ? (
                        viewingItem.servicePayments.map((s: any, i: number) => (
                          <div key={s.id || i} className="p-2.5 space-y-1.5 hover:bg-amber-500 hover:text-slate-950 text-[10px] animate-fadeIn font-medium">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold text-slate-800 block">{s.serviceDate} • {s.kmService} KM</span>
                                <span className="text-[9px] text-slate-400">Teknisi: {decodeEmployeeName(s.servicerId)}</span>
                              </div>
                              <div className="flex items-center gap-3 text-right">
                                <div>
                                  <span className="font-mono font-bold text-emerald-600 block">Rp {Number(s.amount).toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] text-slate-450 font-mono block">{s.bankAccount}</span>
                                </div>
                                {s.receiptPhoto && (
                                  <button
                                    type="button"
                                    onClick={() => setReceiptPhotoViewing(s.receiptPhoto)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] rounded-md border-none font-bold cursor-pointer"
                                  >
                                    Nota
                                  </button>
                                )}
                              </div>
                            </div>
                            {s.nextServiceDate && (
                              <div className="bg-indigo-50/50 p-1.5 rounded-lg text-[9px] text-indigo-755 font-bold flex justify-between">
                                <span>Rencana Servis Berikutnya:</span>
                                <span>{s.nextServiceDate} {s.nextServiceKm ? `(${s.nextServiceKm} KM)` : ''}</span>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-405 text-[10px]">Belum ada data service berkala diarsipkan.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'equipment' && (
                <div className="space-y-4 font-sans text-xs text-left">
                  {/* Photo Display if available */}
                  {(viewingItem?.photoUrl || viewingItem?.photo_path) && (
                    <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                      <img
                        src={viewingItem?.photoUrl || viewingItem?.photo_path}
                        alt={viewingItem?.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">ID Alokasi Kode Alat:</span>
                      <span className="font-mono text-sm font-black text-indigo-650">{viewingItem.code || viewingItem.tool_code}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold border ${
                        viewingItem.loan_status === 'Tersedia' || !viewingItem.loan_status
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                      }`}>
                        {viewingItem.loan_status || 'Tersedia'}
                      </span>
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold border ${
                        viewingItem.condition_status === 'Siap Pakai' || viewingItem.condition === 'Baik'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {viewingItem.condition_status || viewingItem.condition || 'Siap Pakai'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Nama Mesin/Alat:</span>
                      <span className="text-slate-800 font-bold block mt-0.5">{viewingItem.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Kategori Workshop:</span>
                      <span className="text-slate-800 font-bold block mt-0.5">{viewingItem.category || 'Power Tools'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Merek Pabrikan:</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.brand || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Voltase/Daya Listrik:</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.power_specs || 'Manual / N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Lokasi Penyimpanan:</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.location || 'Belum Diatur'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Harga (Nilai Alat):</span>
                      <span className="text-slate-700 font-bold block mt-0.5">{viewingItem.price ? `Rp ${Number(viewingItem.price).toLocaleString('id-ID')}` : 'Tidak Ada'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Kondisi Pembelian:</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${viewingItem.status_alat === 'Terpakai' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-10 border border-indigo-200 text-indigo-700'}`}>{viewingItem.status_alat || 'Baru'}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Nomor Seri Alat (S/N):</span>
                    <span className="text-slate-700 font-mono font-bold block mt-0.5">{viewingItem.serial_number || 'Tidak Ada'}</span>
                  </div>

                  {/* Active Loan Session details block */}
                  {viewingItem.loan_status === 'Dipakai Produksi' && (
                    <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 mt-3 animate-fadeIn">
                      <h5 className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                        <UserCheck className="w-4 h-4 animate-bounce" /> Peminjaman Aktif Pada Tukang
                      </h5>
                      {(() => {
                        const activeLoanSession = (dbState.toolLoans || [])
                          .filter((l: any) => l.tool_id === viewingItem.id && l.loan_status === 'Aktif Dipakai')
                          .sort((a: any, b: any) => new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime())[0];

                        if (activeLoanSession) {
                          const craftsman = (dbState.employees || []).find((e: any) => e.id === activeLoanSession.craftsman_employee_id);
                          const pic = (dbState.employees || []).find((e: any) => e.id === activeLoanSession.pic_gudang_id);

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px] text-slate-700 font-medium">
                              <div>
                                <span className="text-amber-600 block text-[9px] font-bold">Tukang Peminjam:</span>
                                <span className="font-bold text-slate-900">{craftsman ? craftsman.name : 'Tukang'}</span>
                              </div>
                              <div>
                                <span className="text-amber-600 block text-[9px] font-bold">PIC Gudang:</span>
                                <span className="font-bold text-slate-900">{pic ? pic.name : '-'}</span>
                              </div>
                              <div>
                                <span className="text-amber-600 block text-[9px] font-bold">Project Interior:</span>
                                <span className="font-bold text-slate-900">{activeLoanSession.project_name || '-'}</span>
                              </div>
                              <div>
                                <span className="text-amber-600 block text-[9px] font-bold">Tanggal Peminjaman:</span>
                                <span className="font-mono font-bold text-slate-900">
                                  {new Date(activeLoanSession.loan_date).toLocaleDateString('id-ID')}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return <span className="text-slate-400 text-[10px] font-normal italic">Detail log tidak sinkron.</span>;
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4 font-sans font-bold">
                <button
                  type="button"
                  onClick={() => setViewModalOpen(false)}
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  Tutup Tampilan
                </button>
              </div>
            </div>
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
            className="bg-slate-150 hover:bg-amber-500 hover:text-slate-950 text-slate-750 font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
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

      {/* POPUP VIEW RECEIPT PHOTO */}
      <Modal
        isOpen={!!receiptPhotoViewing}
        onClose={() => setReceiptPhotoViewing(null)}
        title="Lampiran Bukti Pembayaran"
        maxWidth="max-w-lg"
      >
        <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 p-1 flex items-center justify-center max-h-[70vh]">
          <img src={receiptPhotoViewing || ''} alt="Bukti Pembayaran Kendaran" className="max-w-full max-h-[60vh] object-contain rounded-xl" referrerPolicy="no-referrer" />
        </div>
        <div className="pt-3 text-[10px] text-slate-400 text-center font-medium font-sans">
          Lampiran jernih berhasil dikompresi sistem untuk pemrosesan ultra-ringan.
        </div>
      </Modal>

      {/* MODAL 1: PINJAM ALAT KE TUKANG */}
      {/* MODAL: BAYAR PAJAK ARMADA */}
      <Modal
        isOpen={pajakModalOpen && !!selectedVehicle}
        onClose={() => setPajakModalOpen(false)}
        title={`Pembayaran Pajak: ${selectedVehicle?.plateNumber}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSavePajak} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Bayar:</label>
              <input type="date" value={pajakForm.payDate} onChange={(e) => setPajakForm({...pajakForm, payDate: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" required />
            </div>
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nominal:</label>
              <input type="number" value={pajakForm.amount} onChange={(e) => setPajakForm({...pajakForm, amount: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" placeholder="Rp" required />
            </div>
          </div>
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Akun Kas Bank:</label>
            <select value={pajakForm.bankAccount} onChange={(e) => setPajakForm({...pajakForm, bankAccount: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" required>
                <option value="">Pilih Bank</option>
                {(dbState.bank_accounts || []).map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
            </select>
          </div>
          <div className="flex gap-2.5 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setPajakModalOpen(false)} className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm" title="Batal"><X className="w-5 h-5" /></button>
            <button type="submit" className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-5 font-semibold transition-all duration-200 shadow-md shadow-indigo-500/20 border-none cursor-pointer"><Save className="w-5 h-5" /> Simpan</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SERVICE ARMADA */}
      <Modal
        isOpen={serviceModalOpen && !!selectedVehicle}
        onClose={() => setServiceModalOpen(false)}
        title={`Form Service: ${selectedVehicle?.plateNumber}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveService} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Service:</label>
              <input type="date" value={serviceForm.serviceDate} onChange={(e) => setServiceForm({...serviceForm, serviceDate: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" required />
            </div>
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">KM Service:</label>
              <input type="number" value={serviceForm.kmService} onChange={(e) => setServiceForm({...serviceForm, kmService: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nominal:</label>
              <input type="number" value={serviceForm.amount} onChange={(e) => setServiceForm({...serviceForm, amount: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" placeholder="Rp" required />
            </div>
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Akun Kas Bank:</label>
              <select value={serviceForm.bankAccount} onChange={(e) => setServiceForm({...serviceForm, bankAccount: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" required>
                  <option value="">Pilih Bank</option>
                  {(dbState.bank_accounts || []).map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
              </select>
            </div>
          </div>
          <div>
             <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Next Service KM / Tanggal:</label>
               <div className="flex gap-2">
                 <input type="number" value={serviceForm.nextServiceKm} onChange={(e) => setServiceForm({...serviceForm, nextServiceKm: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" placeholder="KM" />
                 <input type="date" value={serviceForm.nextServiceDate} onChange={(e) => setServiceForm({...serviceForm, nextServiceDate: e.target.value})} className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none" />
               </div>
            </div>
          <div className="flex gap-2.5 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setServiceModalOpen(false)} className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm" title="Batal"><X className="w-5 h-5" /></button>
            <button type="submit" className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-5 font-semibold transition-all duration-200 shadow-md shadow-indigo-500/20 border-none cursor-pointer"><Save className="w-5 h-5" /> Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={loanModalOpen}
        onClose={function() { setLoanModalOpen(false); setSelectedTool(null); }}
        title="Form Peminjaman Equipment"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSaveLoan} className="space-y-4 pt-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">KODE TRANSAKSI PEMINJAMAN:</span>
            <span className="font-mono text-sm font-black text-indigo-650 bg-indigo-50/50 px-3 py-1.5 rounded-lg border border-indigo-100/50 inline-block">
              {getNextLoanCode()}
            </span>
          </div>

          {/* CUSTOM SEARCHABLE MULTI-SELECT DROPDOWN FOR EQUIPMENT */}
          <div className="relative font-sans" id="equipment-multiselect-dropdown">
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
              Pilih Peralatan / Equipment yang Dipinjam: <span className="text-rose-500">*</span>
            </label>
            
            {/* Dropdown Trigger Button */}
            <button
              type="button"
              onClick={() => setToolDropdownOpen(!toolDropdownOpen)}
              className="w-full bg-[#f1f5f9] text-left text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none flex items-center justify-between cursor-pointer min-h-[46px]"
            >
              <div className="truncate flex flex-wrap gap-1.5 max-w-[90%] pointer-events-auto">
                {loanForm.selected_tool_ids.length === 0 ? (
                  <span className="text-slate-400">-- Pilih Satu atau Lebih Alat --</span>
                ) : (
                  loanForm.selected_tool_ids.map(id => {
                    const tool = (dbState.equipments || []).find(e => e.id === id);
                    return tool ? (
                      <span key={id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-850 px-2.5 py-1 rounded-lg text-xs font-bold leading-none border border-indigo-200 shadow-sm">
                        {tool.name}
                        <span
                          className="hover:text-rose-600 font-extrabold cursor-pointer ml-1.5 px-0.5 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLoanForm(prev => ({
                              ...prev,
                              selected_tool_ids: prev.selected_tool_ids.filter(item => item !== id)
                            }));
                          }}
                        >
                          &times;
                        </span>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 shrink-0 select-none">
                {loanForm.selected_tool_ids.length > 0 && (
                  <span className="bg-[#2563eb] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {loanForm.selected_tool_ids.length}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${toolDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu Container */}
            {toolDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-[90] p-3 space-y-2.5 animate-fadeIn max-h-80 flex flex-col">
                {/* Search Input inside Dropdown */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari nama, brand, atau kode alat..."
                    value={toolSearchQuery}
                    onChange={(e) => setToolSearchQuery(e.target.value)}
                    className="w-full bg-[#f1f5f9] pl-9 pr-8 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans text-slate-850"
                  />
                  {toolSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setToolSearchQuery('')}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status disclaimer & shortcuts */}
                <div className="flex justify-between items-center px-1 text-[9px] font-bold text-slate-400 select-none">
                  <span>KONDISI ALAT HARUS 'SIAP PAKAI'</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer font-bold text-[9px]"
                      onClick={() => {
                        const availableIds = (dbState.equipments || [])
                          .filter(t => t.status_alat === 'Terpakai' && t.loan_status !== 'Dipakai Produksi' && t.condition_status !== 'Rusak Total')
                          .map(t => t.id);
                        setLoanForm(prev => ({ ...prev, selected_tool_ids: availableIds }));
                      }}
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 hover:text-rose-800 bg-transparent border-none cursor-pointer font-bold text-[9px]"
                      onClick={() => {
                        setLoanForm(prev => ({ ...prev, selected_tool_ids: [] }));
                      }}
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Equipment List */}
                <div className="overflow-y-auto flex-1 max-h-48 space-y-1.5 pr-1">
                  {(dbState.equipments || [])
                    .filter(t => {
                      // 1. Only equipment status_alat === 'Terpakai' is shown!
                      if (t.status_alat !== 'Terpakai') return false;
                      
                      // 2. Already selected items are NOT shown in the dropdown list!
                      if (loanForm.selected_tool_ids.includes(t.id)) return false;

                      const matchesSearch = t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) || 
                                            (t.code || '').toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
                                            (t.brand || '').toLowerCase().includes(toolSearchQuery.toLowerCase());
                      return matchesSearch;
                    })
                    .map(t => {
                      const isSelected = loanForm.selected_tool_ids.includes(t.id);
                      const isUnavailable = t.loan_status === 'Dipakai Produksi';
                      const isDamaged = t.condition_status === 'Rusak Total';
                      const isDisabled = isUnavailable || isDamaged;

                      let statusLabel = '';
                      let statusClass = '';
                      if (isUnavailable) {
                        statusLabel = 'Dipakai';
                        statusClass = 'bg-rose-50 text-rose-600 border-rose-105 duration-150';
                      } else if (isDamaged) {
                        statusLabel = 'Rusak';
                        statusClass = 'bg-slate-100 text-slate-400 border-slate-200';
                      } else {
                        statusLabel = 'Tersedia';
                        statusClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                      }

                      return (
                        <label 
                          key={t.id} 
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                              : isDisabled 
                                ? 'bg-slate-50/50 border-transparent opacity-50 cursor-not-allowed' 
                                : 'bg-transparent border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              disabled={isDisabled}
                              className="bg-slate-50 w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer disabled:cursor-not-allowed min-w-[14px]"
                              checked={isSelected}
                              onChange={(e) => {
                                if (isDisabled) return;
                                if (e.target.checked) {
                                  setLoanForm(prev => ({ ...prev, selected_tool_ids: [...prev.selected_tool_ids, t.id] }));
                                } else {
                                  setLoanForm(prev => ({ ...prev, selected_tool_ids: prev.selected_tool_ids.filter(id => id !== t.id) }));
                                }
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 text-xs block truncate leading-tight">{t.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[9px] text-slate-400 font-bold">
                                <span className="text-indigo-600">{t.code}</span>
                                <span>•</span>
                                <span>{t.brand || 'No Brand'}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusClass} shrink-0`}>
                            {statusLabel}
                          </span>
                        </label>
                      );
                    })}
                  
                  {(dbState.equipments || []).filter(t => {
                    const matchesSearch = t.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) || 
                                          (t.code || '').toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
                                          (t.brand || '').toLowerCase().includes(toolSearchQuery.toLowerCase());
                    return matchesSearch;
                  }).length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      Alat tidak ditemukan atau tidak cocok.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Peminjam (Tukang Kayu):</label>
              <select
                value={loanForm.craftsman_employee_id}
                onChange={(e) => setLoanForm(prev => ({ ...prev, craftsman_employee_id: e.target.value }))}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                required
              >
                <option value="">-- Pilih Tukang --</option>
                {(dbState.employees || [])
                  .filter(emp => emp.role === 'Tukang' || emp.role === 'Sopir' || emp.role === 'Gudang' || emp.role === 'Admin' || emp.role === 'Super Admin')
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">PIC Gudang / Supervisor:</label>
              <select
                value={loanForm.pic_gudang_id}
                onChange={(e) => setLoanForm(prev => ({ ...prev, pic_gudang_id: e.target.value }))}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                required
              >
                <option value="">-- Pilih Penanggung Jawab --</option>
                {(dbState.employees || [])
                  .filter(emp => emp.role === 'Gudang' || emp.role === 'Admin' || emp.role === 'Super Admin')
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Project Tujuan Interior:</label>
              <input
                type="text"
                placeholder="Contoh: Kitchen Set Bp Jemi, Wardrobe PIK"
                value={loanForm.project_name}
                onChange={(e) => setLoanForm(prev => ({ ...prev, project_name: e.target.value }))}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal & Jam Pinjam:</label>
              <input
                type="datetime-local"
                value={loanForm.loan_date}
                onChange={(e) => setLoanForm(prev => ({ ...prev, loan_date: e.target.value }))}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Catatan Peminjaman Tambahan:</label>
            <textarea
              placeholder="Ketik keterangan tambahan e.g. Dipakai potong multiplek HPL..."
              rows={2}
              value={loanForm.notes_loan}
              onChange={(e) => setLoanForm(prev => ({ ...prev, notes_loan: e.target.value }))}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setLoanModalOpen(false);
                setSelectedTool(null);
              }}
              className="flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 p-3 rounded-xl border-none cursor-pointer duration-200 shadow-sm"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="submit"
              className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl border-none cursor-pointer duration-200 shadow-md shadow-indigo-500/20"
              title="Simpan"
            >
              <Save className="w-5 h-5" />
            </button>
          </div>
        </form>
      </Modal>
      
      
      <Modal
        isOpen={returnModalOpen && !!activeLoan}
        onClose={function() { setReturnModalOpen(false); setActiveLoan(null); }}
        title="Form Pengembalian Equipment"
        maxWidth="max-w-lg"
      >
        {(() => {
          const tool = (dbState.equipments || []).find(t => t.id === activeLoan?.tool_id);
          const craftsman = (dbState.employees || []).find(e => e.id === activeLoan?.craftsman_employee_id);

          return (
            <form onSubmit={handleSaveReturn} className="space-y-4 pt-2">
              <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100/80 flex items-center justify-between gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase block">Kode Log Pinjam:</span>
                    <span className="font-mono text-xs font-black text-emerald-900">{activeLoan?.loan_code}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase block">Equipment:</span>
                    <span className="text-slate-850 font-extrabold text-[12px] block">{tool ? tool.name : '-'}</span>
                  </div>
                  <div className="border-t border-emerald-100/50 pt-2.5">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase block">Peminjam (Tukang):</span>
                    <span className="text-slate-800 font-bold block">{craftsman ? craftsman.name : 'Tukang'}</span>
                  </div>
                  <div className="border-t border-emerald-100/50 pt-2.5">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase block">Tanggal Pinjam:</span>
                    <span className="text-slate-700 font-mono text-[10px] block">
                      {activeLoan ? `${new Date(activeLoan.loan_date).toLocaleDateString('id-ID')} ${new Date(activeLoan.loan_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : '-'}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-1 rounded-lg border border-slate-200">
                  <QRCode value={tool?.code || ''} size={60} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Kembalian Aktual:</label>
                  <input
                    type="datetime-local"
                    value={returnForm.actual_return_date}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, actual_return_date: e.target.value }))}
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Kondisi Barang Saat Kembali:</label>
                  <select
                    value={returnForm.condition_status}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, condition_status: e.target.value as any }))}
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                  >
                    <option value="Siap Pakai" className="text-emerald-650">Alat Kondisi Baik (Siap Pakai)</option>
                    <option value="Mata Pisau Tumpul">Mata Pisau Tumpul (Butuh Diasah)</option>
                    <option value="Minta Servis">Butuh Perbaikan / Servis</option>
                    <option value="Rusak Total" className="text-rose-600">Alat Rusak atau Tidak Bisa Dipakai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Catatan Pengembalian Alat:</label>
                <textarea
                  placeholder="Ketik keterangan pengembalian e.g. Dikembalikan dlm keadaan bersih, pisau pemotong aman..."
                  rows={2}
                  value={returnForm.notes_return}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, notes_return: e.target.value }))}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>

              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Foto Kondisi Alat Kembali:</label>
                {returnForm.photo_return ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-28 w-28 bg-slate-50">
                    <img src={returnForm.photo_return} alt="Preview" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setReturnForm(prev => ({...prev, photo_return: ''}))} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center cursor-pointer hover:bg-amber-50">
                    <input type="file" accept="image/*" onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const compressed = await handleImageUpload(e.target.files[0]);
                        setReturnForm(prev => ({ ...prev, photo_return: compressed }));
                      }
                    }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Camera className="w-5 h-5 text-indigo-500 mx-auto" />
                    <span className="text-[9px] text-slate-500 font-bold block mt-1">Upload Foto</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setReturnModalOpen(false);
                    setActiveLoan(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold py-3 px-4 rounded-xl border-none cursor-pointer text-center"
                >
                  <X className="w-4 h-4 mr-1" /> Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  Konfirmasi Kembalikan Alat
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

    </div>
  );
};
