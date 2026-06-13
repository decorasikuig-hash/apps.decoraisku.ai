/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, 
  User,
  Clock, 
  CalendarCheck2, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Fingerprint, 
  Check, 
  X, 
  Printer, 
  HelpCircle, 
  Smartphone,
  CheckCircle2,
  Calendar,
  Save,
  Download,
  Upload,
  Eye,
  QrCode,
  FileText,
  Send,
  MoreVertical,
  DollarSign,
  Banknote,
  BarChart3,
  AlertCircle,
  CreditCard,
  Building
} from 'lucide-react';
import { Employee, AttendanceLog, DBState, WeeklyPayroll, BankAccount, Transaction, BankMutation } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { checkTabPermission } from './RoleGuard';

interface EsdmViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  initialTab?: 'employees' | 'attendance' | 'recap';
}

import { EmployeeView } from './EmployeeView';
import { Modal } from './Modal';

export const EsdmView: React.FC<EsdmViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole,
  initialTab
}) => {
  const isEmployeesAllowed = checkTabPermission(currentUserRole, 'esdm-employees', 'employees', dbState);
  const isSalaryAllowed = checkTabPermission(currentUserRole, 'esdm-employees', 'salary', dbState);
  const isRecapAllowed = checkTabPermission(currentUserRole, 'esdm-employees', 'recap', dbState);

  const [activeTab, setActiveTab] = useState<'employees' | 'salary' | 'recap'>('employees');

  // Auto-redirect if current tab is not allowed
  React.useEffect(() => {
    if (activeTab === 'employees' && !isEmployeesAllowed) {
      if (isSalaryAllowed) setActiveTab('salary');
      else if (isRecapAllowed) setActiveTab('recap');
    } else if (activeTab === 'salary' && !isSalaryAllowed) {
      if (isEmployeesAllowed) setActiveTab('employees');
      else if (isRecapAllowed) setActiveTab('recap');
    } else if (activeTab === 'recap' && !isRecapAllowed) {
      if (isEmployeesAllowed) setActiveTab('employees');
      else if (isSalaryAllowed) setActiveTab('salary');
    }
  }, [currentUserRole, dbState, activeTab, isEmployeesAllowed, isSalaryAllowed, isRecapAllowed]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  React.useEffect(() => {
    if (initialTab) {
      // Mapping initialTab to maybe new tab names if they changed
      if ((initialTab as string) === 'attendance') {
         setActiveTab('salary');
      } else {
         setActiveTab(initialTab as any);
      }
    }
  }, [initialTab]);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Employee | null>(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<WeeklyPayroll | null>(null);
  
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [salaryFormData, setSalaryFormData] = useState<Partial<WeeklyPayroll>>({});
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string; type: 'employee' | 'payroll' } | null>(null);

  // NFC Biometric attendance simulator states
  const [nfcStaffId, setNfcStaffId] = useState('');
  const [nfcStatusType, setNfcStatusType] = useState<'Check-In' | 'Check-Out'>('Check-In');

  // Filter and Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Helper for ID generation
  const generateEmployeeId = (joinDate: string) => {
    if (!joinDate) return "";
    const date = new Date(joinDate);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `${yyyy}${mm}`;
    
    const sameMonthEmployees = (dbState.employees || []).filter(e => e.id.startsWith(prefix));
    let nextNum = 1;
    if (sameMonthEmployees.length > 0) {
      const numbers = sameMonthEmployees.map(e => {
        const numPart = e.id.slice(6);
        return parseInt(numPart, 10);
      });
      nextNum = Math.max(...numbers.filter(n => !isNaN(n))) + 1;
    }
    
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  // Helper for weekly range
  const getWeeklyRange = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    const sunday = new Date(d.setDate(diff));
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    
    return {
      start: sunday.toISOString().split('T')[0],
      end: saturday.toISOString().split('T')[0]
    };
  };

  const calculateAllowances = (employeeId: string) => {
    const range = getWeeklyRange();
    const logs = (dbState.attendance || []).filter(a => 
      a.employeeId === employeeId && 
      a.date && a.date >= range.start && a.date <= range.end
    );

    // Get unique days for each category
    const daysKC = new Set(logs.filter(l => l.category === 'KC').map(l => l.date)).size;
    const daysWM = new Set(logs.filter(l => l.category === 'WM').map(l => l.date)).size;

    const rateKC = 25000; // Rp 25.000 / day
    const rateWM = 25000; // Rp 25.000 / day

    return {
      kc: daysKC * rateKC,
      wm: daysWM * rateWM
    };
  };

  const calculateOvertime = (employeeId: string) => {
    const range = getWeeklyRange();
    const logs = (dbState.attendance || []).filter(a => 
      a.employeeId === employeeId && 
      a.date && a.date >= range.start && a.date <= range.end &&
      a.isOvertime
    );

    // Group logs by date
    const logsByDate: Record<string, AttendanceLog[]> = {};
    logs.forEach(log => {
      if (log.date) {
        if (!logsByDate[log.date]) logsByDate[log.date] = [];
        logsByDate[log.date].push(log);
      }
    });

    let totalMinutes = 0;
    let totalLemburHours = 0;

    Object.keys(logsByDate).forEach(date => {
      const dateLogs = logsByDate[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Look for Lembur-In and Lembur-Out pairs
      for (let i = 0; i < dateLogs.length; i++) {
        if (dateLogs[i].type === 'Lembur-In' && dateLogs[i+1]?.type === 'Lembur-Out') {
          const start = new Date(dateLogs[i].timestamp);
          const end = new Date(dateLogs[i+1].timestamp);
          const diffMs = end.getTime() - start.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          
          if (diffMin >= 45) {
             totalLemburHours += 1;
          } else {
             totalMinutes += diffMin;
          }
          i++; // Skip the next one as it's the pair
        }
      }
    });

    const overtimeHourlyRate = 25000; // Example Rp 25.000 / hour
    const overtimeMinuteRate = overtimeHourlyRate / 60;
    
    return (totalLemburHours * overtimeHourlyRate) + (totalMinutes * overtimeMinuteRate);
  };

  const isFirstSaturdayAfterFirst = (date = new Date()) => {
    const d = new Date(date);
    // Find the current week's saturday
    const day = d.getDay();
    const diff = d.getDate() + (6 - day);
    const saturday = new Date(d.setDate(diff));
    
    // Check if this Saturday is between the 1st and the 7th of the month
    return saturday.getDate() <= 7;
  };

  const calculateAutomatedBonus = (employeeId: string) => {
    const range = getWeeklyRange();
    const attendance = (dbState.attendance || []).filter(a => 
      a.employeeId === employeeId && 
      a.date && a.date >= range.start && a.date <= range.end &&
      a.type === 'Check-In'
    );
    
    // Unique days count
    const uniqueDays = new Set(attendance.map(a => a.date)).size;
    
    let multiplier = 0;
    if (uniqueDays >= 6) multiplier = 1;
    else if (uniqueDays === 5) multiplier = 0.5;
    
    // Assume base bonus rates (Kerajinan & Kebersihan)
    const baseBonus = 200000; 
    return {
      bonus: baseBonus * multiplier,
      days: uniqueDays
    };
  };

  const exportMassTransferCSV = () => {
    const approvedPayrolls = (dbState.weeklyPayrolls || []).filter(p => p.status === 'Approved');
    if (approvedPayrolls.length === 0) return showToast('Tidak ada data gaji status Approved untuk dieksport!', 'warning');

    // Header standard Mass Transfer Template 1.6
    let csv = 'Bank Code,Account Number,Recipient Name,Amount,Description,Remark,Reference Number\n';
    
    approvedPayrolls.forEach(p => {
      const emp = dbState.employees?.find(e => e.id === p.employeeId);
      csv += `"${emp?.bank_name || ''}","${emp?.bank_account || ''}","${emp?.name || ''}",${p.totalGaji},"Payroll ${p.weekStartDate}","${dbState.settings.companyName}",${p.id}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Mass_Transfer_ERP_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const generateEmployeeIDCard = (emp: Employee) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85, 55] // Standard ID Card size
    });

    // Background decoration
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 85, 20, 'F');

    // Company Logo/Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(dbState.settings.companyName.toUpperCase(), 42.5, 12, { align: 'center' });

    // Employee Photo Placeholder
    doc.setDrawColor(200, 200, 200);
    doc.rect(8, 25, 25, 30);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(6);
    doc.text('FOTO 2x3', 20.5, 40, { align: 'center' });

    // Data
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.name.toUpperCase(), 40, 32);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`ID: ${emp.id}`, 40, 38);
    doc.text(`DEPT: ${emp.department || '-'}`, 40, 42);
    doc.text(`TIPE: ${emp.type || '-'}`, 40, 46);

    // Barcode Representation
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(`[ BARCODE: ${emp.id} ]`, 42.5, 52, { align: 'center' });

    doc.save(`ID_Card_${emp.name}.pdf`);
    showToast(`ID Card ${emp.name} berhasil di-generate!`, 'success');
  };

  const generatePDFSlip = (payroll: WeeklyPayroll) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    const emp = dbState.employees?.find(e => e.id === payroll.employeeId);

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(dbState.settings.companyName.toUpperCase(), 10, 15);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SLIP GAJI MINGGUAN KARYAWAN', 10, 20);
    doc.line(10, 22, 138, 22);

    // Employee Info
    doc.setFontSize(9);
    doc.text(`ID Pegawai  : ${payroll.employeeId}`, 10, 30);
    doc.text(`Nama        : ${payroll.employeeName}`, 10, 35);
    doc.text(`Jabatan     : ${emp?.department || emp?.role || '-'}`, 10, 40);
    doc.text(`Periode     : ${payroll.weekStartDate} s/d ${payroll.weekEndDate}`, 10, 45);

    // Financial Table
    doc.setFont('helvetica', 'bold');
    doc.text('RINCIAN PENERIMAAN', 10, 55);
    doc.setFont('helvetica', 'normal');
    
    let y = 62;
    const items = [
      { label: 'Gaji Pokok / Harian', val: payroll.dailyRate * (payroll.presenceDays || 6) },
      { label: 'Borongan / Workload', val: payroll.workloadRate },
      { label: 'Tunjangan KC', val: payroll.allowanceKC },
      { label: 'Tunjangan WM', val: payroll.allowanceWM },
      { label: 'Bonus Kerajinan', val: payroll.bonusAttendance },
      { label: 'Bonus Kebersihan', val: payroll.bonusCleanliness },
      { label: 'Lembur', val: payroll.overtimePay || 0 },
      { label: 'Gaji Bulanan (Role)', val: payroll.isMonthlyRoleActive ? (payroll.monthlySalaryAmount || 0) : 0 }
    ];

    items.filter(i => i.val > 0).forEach(item => {
      doc.text(item.label, 15, y);
      doc.text(`Rp ${item.val.toLocaleString()}`, 110, y, { align: 'right' });
      y += 6;
    });

    doc.line(10, y, 138, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL GAJI BERSIH (TAKE HOME PAY)', 10, y);
    doc.text(`Rp ${payroll.totalGaji.toLocaleString()}`, 138, y, { align: 'right' });

    // Footer
    y += 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Dicetak secara sistem pada ${new Date().toLocaleString()}`, 10, y);
    doc.text('Dokumen ini sah tanpa tanda tangan basah.', 10, y + 4);

    doc.save(`Slip_Gaji_${payroll.employeeName}_${payroll.weekEndDate}.pdf`);
    showToast(`PDF Slip Gaji ${payroll.employeeName} berhasil di-generate!`, 'success');
  };

  const handleApprovePayrollExecution = (payroll: WeeklyPayroll) => {
    if (!payroll.bankAccountId) return showToast('Pilih bank pengirim!', 'error');
    
    const bank = dbState.bank_accounts?.find(ba => ba.id === payroll.bankAccountId);
    if (!bank) return;

    if (bank.current_balance < payroll.totalGaji) {
      showToast('Saldo bank tidak mencukupi!', 'error');
      return;
    }

    // 1. Update Payroll Status
    const currentPayrolls = dbState.weeklyPayrolls || [];
    const updatedPayrolls = currentPayrolls.map(p => 
      p.id === payroll.id ? { ...p, status: 'Paid', paymentDate: new Date().toISOString() } : p
    );

    // 2. Update Bank Balance
    const updatedBanks = dbState.bank_accounts.map(ba => 
      ba.id === bank.id ? { ...ba, current_balance: ba.current_balance - payroll.totalGaji } : ba
    );

    // 3. Create Bank Mutation
    const mutation: BankMutation = {
      id: `mut-${Date.now()}`,
      mutation_code: `OUT-PRL-${Date.now()}`,
      bank_account_id: bank.id,
      type: 'Keluar',
      category: 'Gaji Karyawan',
      amount: payroll.totalGaji,
      description: `Pembayaran Gaji ${payroll.employeeName} (${payroll.weekStartDate} - ${payroll.weekEndDate})`,
      transaction_date: new Date().toISOString()
    };

    // 4. Automated Financial Posting based on Type
    const emp = dbState.employees?.find(e => e.id === payroll.employeeId);
    let financeCategory = 'Gaji';
    let financeDescription = `Biaya Gaji ${payroll.employeeName}`;
    
    if (emp?.type === 'Borongan') {
      financeCategory = 'Laporan Piutang / Kasbon';
      financeDescription = `Pinjaman / Borongan Gaji ${payroll.employeeName}`;
    } else {
      financeCategory = 'Laporan Biaya Gaji';
    }

    const transaction: Transaction = {
      id: `trx-${Date.now()}`,
      code: `EXP-PRL-${Date.now()}`,
      type: 'Pengeluaran',
      category: financeCategory,
      amount: payroll.totalGaji,
      date: new Date().toISOString().split('T')[0],
      description: financeDescription,
      account: bank.bank_name
    };

    saveCollection('weeklyPayrolls', updatedPayrolls);
    saveCollection('bank_accounts', updatedBanks);
    saveCollection('bank_mutations', [...(dbState.bank_mutations || []), mutation]);
    saveCollection('transactions', [...(dbState.transactions || []), transaction]);
    
    setApprovalModalOpen(false);
    showToast(`Payroll ${payroll.employeeName} berhasil disetujui & diposting ke Keuangan!`, 'success');

    // Trigger Slip Notification
    const slipMsg = `SLIP GAJI TERKONFIRMASI ✅\n\nNama: ${payroll.employeeName}\nPeriode: ${payroll.weekStartDate} - ${payroll.weekEndDate}\nTotal: *Rp ${payroll.totalGaji.toLocaleString()}*\n\nStatus: TELAH TERBAYAR via ${bank.bank_name}.\nSilakan cek rekening Anda. Terima kasih.`;
    sendWhatsAppNotification({
      phone: emp?.phone || '',
      message: slipMsg,
      recipientName: payroll.employeeName
    });
  };

  // Helper for image compression
  const compressImage = (file: File, maxWidth = 1080): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth && width >= height) {
            height *= maxWidth / width;
            width = maxWidth;
          } else if (height > maxWidth && height > width) {
            width *= maxWidth / height;
            height = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo_url' | 'ktp_photo_url') => {
    const file = e.target.files?.[0];
    if (file) {
      showToast('Sedang mengompres gambar...', 'info');
      const compressed = await compressImage(file);
      setFormData(prev => ({ ...prev, [field]: compressed }));
      showToast('Gambar berhasil dikompres.', 'success');
    }
  };

  const downloadCSVTemplate = () => {
    const headers = ["name", "nickname", "join_date", "ktp_number", "gender", "pob", "dob", "address", "religion", "phone", "email", "bank_account", "bank_name", "department", "shirt_size", "shoe_size", "type"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_karyawan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  // --- SAVE EMPLOYEE DATA ---
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role || !formData.phone) {
      showToast('Mohon lengkapi info nama, peran staff & kontak nomor telepon!', 'error');
      return;
    }

    const list = dbState.employees || [];
    
    if (editingId) {
      const nipCode = formData.nip || generateEmployeeId(formData.join_date || "");
      const newEmp: Employee = {
        ...formData,
        id: editingId,
        nip: nipCode,
      } as Employee;
      
      const updated = list.map(em => em.id === editingId ? newEmp : em);
      saveCollection('employees', updated);
      showToast(`Profil pegawai ${newEmp.name} berhasil diperbarui.`, 'success');
    } else {
      const generatedId = generateEmployeeId(formData.join_date || "");
      const newEmp: Employee = {
        ...formData,
        id: generatedId,
        nip: generatedId,
      } as Employee;
      
      const updated = [...list, newEmp];
      saveCollection('employees', updated);
      showToast(`Pegawai baru ${newEmp.name} terdaftar dengan ID: ${newEmp.id}!`, 'success');
    }
    
    setModalOpen(false);
  };

  const handleBulkCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      const headers = rows[0].split(',').map(h => h.trim());
      
      const newEmployees: Employee[] = [];
      const currentList = [...(dbState.employees || [])];
      
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const emp: any = {};
        headers.forEach((h, idx) => {
          emp[h] = values[idx];
        });
        
        if (emp.name) {
          const join_date = emp.join_date || new Date().toISOString().split('T')[0];
          const id = generateEmployeeId(join_date);
          const newEmp: Employee = {
            ...emp,
            id: id,
            nip: id,
            join_date: join_date,
            status: 'Aktif',
            type: emp.type || 'Harian',
            role: emp.department || 'Staff',
          };
          newEmployees.push(newEmp);
        }
      }
      
      if (newEmployees.length > 0) {
        saveCollection('employees', [...currentList, ...newEmployees]);
        showToast(`Sukses mengimpor ${newEmployees.length} karyawan baru!`, 'success');
      }
    };
    reader.readAsText(file);
  };

  // --- DELETE EMPLOYEE ---
  const handleDeleteEmployee = (id: string) => {
    const list = dbState.employees || [];
    const emp = list.find(e => e.id === id);
    const displayName = emp ? emp.name : id;

    setDeleteConfirm({
      id,
      description: `Apakah Anda yakin ingin memberhentikan/menghapus data pegawai [${displayName}] dari records personalia?`,
      type: 'employee'
    });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;

    if (type === 'employee') {
      const list = dbState.employees || [];
      saveCollection('employees', list.filter(em => em.id !== id));
      showToast('Pegawai dihapus dari draf personalia.', 'info');
    } else {
      const list = dbState.weeklyPayrolls || [];
      saveCollection('weeklyPayrolls', list.filter(p => p.id !== id));
      showToast('Data pembayaran gaji dihapus.', 'info');
    }

    setDeleteConfirm(null);
  };

  // --- NFC ATTENDANCE SIMULATION ACTION TRIGGER ---
  const handleSimulateNFCTap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nfcStaffId) {
      showToast('Mohon pilih staff yang akan melakukan tap biometric!', 'error');
      return;
    }

    const matchedEmp = dbState.employees?.find(em => em.id === nfcStaffId);
    if (!matchedEmp) return;

    const currentAttendance = dbState.attendance || [];
    const now = new Date();
    const timestampLocal = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const isLate = nfcStatusType === 'Check-In' && now.getHours() >= 9; // Late check-in after 09:00 AM

    const newLog: AttendanceLog = {
      id: `att-${Date.now()}`,
      employeeId: matchedEmp.id,
      employeeName: matchedEmp.name,
      nip: matchedEmp.nip,
      date: dateStr,
      time: timestampLocal,
      type: nfcStatusType,
      deviceUid: matchedEmp.nfcUid || 'SIMULATOR-01',
      status: isLate ? 'Late' : 'On-Time',
      timestamp: now.toISOString(),
      method: 'NFC'
    };

    saveCollection('attendance', [...currentAttendance, newLog]);
    showToast(`BIOMETRIC TAP SUCCESS: [${newLog.status.toUpperCase()}] ${matchedEmp.name} berhasil melakukan ${nfcStatusType} Pukul ${timestampLocal}!`, 'success');
  };

  // Pre-calculate attendance statistics for Recap view
  const getAttendanceRecap = () => {
    const activeStaff = dbState.employees || [];
    const logs = dbState.attendance || [];

    return activeStaff.map(emp => {
      const empLogs = logs.filter(l => l.employeeId === emp.id);
      const totalCheckIns = empLogs.filter(l => l.type === 'Check-In').length;
      const onTimeCount = empLogs.filter(l => l.type === 'Check-In' && l.status === 'On-Time').length;
      const lateCount = empLogs.filter(l => l.type === 'Check-In' && l.status === 'Late').length;

      return {
        id: emp.id,
        name: emp.name,
        nip: emp.nip,
        role: emp.role,
        gender: 'Laki-laki', 
        totalIn: totalCheckIns,
        onTime: onTimeCount,
        late: lateCount,
        absentNum: Math.max(0, 22 - totalCheckIns) // assume 22 work days
      };
    });
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const renderPagination = (itemsCount: number) => {
    const totalPages = Math.ceil(itemsCount / itemsPerPage);
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

  if (!isEmployeesAllowed && !isSalaryAllowed && !isRecapAllowed) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-150 shadow-sm flex flex-col items-center justify-center text-center my-6">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase font-sans">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-2 font-sans leading-relaxed">
          Anda tidak memiliki hak akses-tab di halaman Manajemen Karyawan ini. Silakan hubungi administrator Anda untuk mengaktifkan akses.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn flex flex-col h-full space-y-6 uppercase">
      
      {/* Header section with titles and primary action button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h3 className="text-lg text-slate-905 tracking-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize border-none bg-transparent m-0 p-0 shadow-none">
            {activeTab === 'employees' ? 'Daftar Karyawan' : activeTab === 'recap' ? 'Rekap Absensi' : 'Input Gaji'}
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5 border-none bg-transparent m-0 p-0 shadow-none leading-none">
            {activeTab === 'employees' 
              ? 'Kelola data karyawan, jabatan, dan detail kepegawaian.' 
              : activeTab === 'recap' 
                ? 'Rekapitulasi persentase kehadiran dan durasi kerja bulanan.' 
                : 'Penyusunan siklus gaji berkala dan rekonsiliasi transfer bank.'}
          </p>
        </div>

        {activeTab === 'employees' && isSuperOrAdmin && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ status: 'Active', role: 'architect', code: '' });
              setModalOpen(true);
            }}
            className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            title="Daftarkan Karyawan Baru"
          >
            <Plus className="w-5 h-5 font-bold" />
          </button>
        )}

        {activeTab === 'salary' && isSuperOrAdmin && (
          <button
            onClick={() => {
              setSalaryFormData({});
              setSalaryModalOpen(true);
            }}
            className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            title="Input Gaji Baru"
          >
            <Banknote className="w-5 h-5 font-bold" />
          </button>
        )}

        {activeTab === 'recap' && isSuperOrAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                const approved = (dbState.weeklyPayrolls || []).filter(p => p.status === 'Approved');
                if (approved.length === 0) return showToast('Tidak ada data Approved untuk diproses!', 'warning');
                showToast(`Memproses ${approved.length} data Approved...`, 'info');
                approved.forEach(p => {
                  generatePDFSlip(p);
                });
              }}
              className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
              title="Proses Payout Sabtu (Sim)"
            >
              <CreditCard className="w-5 h-5 font-bold" />
            </button>
            <button
              onClick={exportMassTransferCSV}
              className="flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-600 rounded-xl w-10 h-10 hover:bg-slate-100 transition-all cursor-pointer"
              title="Export CSV Bank"
            >
              <Download className="w-5 h-5 font-bold" />
            </button>
            <button
              onClick={() => showToast('Mencetak Laporan Gaji Global...', 'info')}
              className="flex items-center justify-center bg-slate-900 text-white rounded-xl w-10 h-10 hover:bg-slate-800 transition-all cursor-pointer"
              title="Cetak Summary"
            >
              <Printer className="w-5 h-5 font-bold" />
            </button>
          </div>
        )}
      </div>

      {/* TOOLKIT ENGINE: Search, Upload/Download, then Tabs */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search & Utility Column - Order: Search then Upload/Download */}
        {activeTab !== 'recap' && (
          <div className="flex items-center gap-2 w-full lg:flex-1 lg:max-w-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={`Cari pegawai / ID...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-150 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            {activeTab === 'employees' && (
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={downloadCSVTemplate}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
                  title="Download Template CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <label className="flex items-center justify-center p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition-all">
                  <Upload className="w-4 h-4" />
                  <input type="file" accept=".csv" className="hidden" onChange={handleBulkCSVUpload} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs - Moved to the end */}
        <div className="flex bg-slate-100 p-1 rounded-full items-center w-full lg:w-fit overflow-x-auto scrollbar-hide">
          {isEmployeesAllowed && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 lg:flex-none px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'employees'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-none bg-transparent'
              }`}
            >
              Karyawan ({dbState.employees?.length || 0})
            </button>
          )}
          {isSalaryAllowed && (
            <button
              onClick={() => setActiveTab('salary')}
              className={`flex-1 lg:flex-none px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'salary'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-none bg-transparent'
              }`}
            >
              Input Gaji
            </button>
          )}
          {isRecapAllowed && (
            <button
              onClick={() => setActiveTab('recap')}
              className={`flex-1 lg:flex-none px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === 'recap'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-none bg-transparent'
              }`}
            >
              Approval & Recap
            </button>
          )}
        </div>
      </div>

      {/* VIEW SECTION 1: DAFTAR KARYAWAN */}
      {activeTab === 'employees' && (
        <EmployeeView 
          dbState={dbState}
          saveCollection={saveCollection}
          showToast={showToast}
          currentUserRole={currentUserRole}
          searchTerm={searchTerm}
          onView={(emp) => {
            setViewingItem(emp);
            setViewModalOpen(true);
          }}
          onEdit={(emp) => {
            setEditingId(emp.id);
            setFormData({ ...emp });
            setModalOpen(true);
          }}
          onPrint={(emp) => {
            showToast(`Mencetak ID Card untuk ${emp.name}...`, 'info');
            window.print();
          }}
          onDelete={handleDeleteEmployee}
        />
      )}

      {/* VIEW SECTION 2: INPUT GAJI */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          <Modal
            isOpen={salaryModalOpen}
            onClose={() => setSalaryModalOpen(false)}
            title="Input Daftar Gaji"
            maxWidth="max-w-6xl"
          >
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!salaryFormData.employeeId) return showToast('Pilih karyawan!', 'error');
                
                const range = getWeeklyRange();
                const total = (Number(salaryFormData.dailyRate || 0) * 6) + 
                              Number(salaryFormData.workloadRate || 0) + 
                              Number(salaryFormData.allowanceKC || 0) + 
                              Number(salaryFormData.allowanceWM || 0) + 
                              Number(salaryFormData.bonusAttendance || 0) + 
                              Number(salaryFormData.bonusCleanliness || 0) + 
                              Number(salaryFormData.overtimePay || 0) + 
                              (salaryFormData.isMonthlyRoleActive ? Number(salaryFormData.monthlySalaryAmount || 0) : 0);

                const payrollEntry: WeeklyPayroll = {
                  id: salaryFormData.id || `pay-${Date.now()}`,
                  employeeId: salaryFormData.employeeId,
                  employeeName: dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.name || '',
                  weekStartDate: range.start,
                  weekEndDate: range.end,
                  type: salaryFormData.type || 'Harian',
                  dailyRate: Number(salaryFormData.dailyRate || 0),
                  workloadRate: Number(salaryFormData.workloadRate || 0),
                  allowanceKC: Number(salaryFormData.allowanceKC || 0),
                  allowanceWM: Number(salaryFormData.allowanceWM || 0),
                  bonusAttendance: Number(salaryFormData.bonusAttendance || 0),
                  bonusCleanliness: Number(salaryFormData.bonusCleanliness || 0),
                  monthlySalaryAmount: Number(salaryFormData.monthlySalaryAmount || 0),
                  overtimePay: Number(salaryFormData.overtimePay || 0),
                  isMonthlyRoleActive: !!salaryFormData.isMonthlyRoleActive,
                  totalGaji: total,
                  status: 'Pending'
                };

                const currentPayrolls = dbState.weeklyPayrolls || [];
                if (salaryFormData.id) {
                    // Update
                    saveCollection('weeklyPayrolls', currentPayrolls.map(p => p.id === salaryFormData.id ? payrollEntry : p));
                    showToast(`Draft gaji untuk ${payrollEntry.employeeName} berhasil diperbarui.`, 'success');
                } else {
                    // Create
                    saveCollection('weeklyPayrolls', [...currentPayrolls, payrollEntry]);
                    showToast(`Draft gaji untuk ${payrollEntry.employeeName} berhasil dibuat.`, 'success');
                }
                
                setSalaryFormData({});
                setSalaryModalOpen(false);
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6"
            >
              {/* KOLOM KIRI: Identitas & Dropdown */}
              <div className="space-y-6">
                <div>
                  <label className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest block">Pilih Karyawan</label>
                  <select
                    required
                    disabled={!!salaryFormData.id}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold"
                    value={salaryFormData.employeeId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const emp = dbState.employees?.find(em => em.id === id);
                      const bonusCalc = calculateAutomatedBonus(id);
                      const overtimeVal = calculateOvertime(id);
                      const allowances = calculateAllowances(id);
                      const isMonthlyTime = isFirstSaturdayAfterFirst();
                      
                      setSalaryFormData({ 
                        ...salaryFormData, 
                        employeeId: id,
                        type: emp?.type || 'Harian',
                        dailyRate: emp?.type === 'Harian' ? 125000 : 0,
                        workloadRate: emp?.type === 'Borongan' ? 500000 : 0,
                        bonusAttendance: bonusCalc.bonus,
                        presenceDays: bonusCalc.days,
                        overtimePay: overtimeVal,
                        allowanceKC: allowances.kc,
                        allowanceWM: allowances.wm,
                        isMonthlyRoleActive: isMonthlyTime,
                        monthlySalaryAmount: emp?.baseSalary || 0
                      });
                    }}
                  >
                    <option value="">-- Nama Karyawan --</option>
                    {(dbState.employees || []).filter(em => 
                      !salaryFormData.id && !(dbState.weeklyPayrolls || []).some(p => p.status === 'Pending' && p.employeeId === em.id)
                    ).map(em => <option key={em.id} value={em.id}>{em.id} - {em.name}</option>)}
                  </select>
                </div>

                {salaryFormData.employeeId ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center">
                        {dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.photo_url ? (
                          <img 
                            src={dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.photo_url} 
                            alt="Foto Karyawan" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User className="w-12 h-12 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-900">{dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">ID: {salaryFormData.employeeId}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm border-dashed">
                      <QrCode className="w-20 h-20 text-slate-900" />
                      <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest uppercase">BARCODE ID 2D</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <User className="w-10 h-10 text-slate-300" />
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Pilih karyawan untuk detail</p>
                  </div>
                )}
              </div>

              {/* KOLOM TENGAH: Input Gaji & Status */}
              <div className="space-y-5">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Status Karyawan</label>
                  <p className="text-sm font-black text-blue-700 capitalize">
                    {dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.status || '-'} 
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] uppercase tracking-tighter">
                      {dbState.employees?.find(e => e.id === salaryFormData.employeeId)?.type || '-'}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  {salaryFormData.type === 'Harian' ? (
                    <div>
                      <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Gaji Harian (Rupiah)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                          value={salaryFormData.dailyRate || ''}
                          onChange={(e) => setSalaryFormData({ ...salaryFormData, dailyRate: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Gaji Borongan (Rupiah)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                          value={salaryFormData.workloadRate || ''}
                          onChange={(e) => setSalaryFormData({ ...salaryFormData, workloadRate: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Lembur (Rupiah)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                        value={salaryFormData.overtimePay || ''}
                        onChange={(e) => setSalaryFormData({ ...salaryFormData, overtimePay: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Gaji Bulanan</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400">AKTIFKAN</span>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                          checked={!!salaryFormData.isMonthlyRoleActive}
                          onChange={(e) => setSalaryFormData({...salaryFormData, isMonthlyRoleActive: e.target.checked})}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        disabled={!salaryFormData.isMonthlyRoleActive}
                        className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-all font-bold ${
                          !salaryFormData.isMonthlyRoleActive ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-slate-50 text-slate-800 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white'
                        }`}
                        value={salaryFormData.monthlySalaryAmount || ''}
                        onChange={(e) => setSalaryFormData({ ...salaryFormData, monthlySalaryAmount: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: Tunjangan & Bonus */}
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Tunjangan KC</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                      value={salaryFormData.allowanceKC || ''}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, allowanceKC: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Tunjangan WM</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                      value={salaryFormData.allowanceWM || ''}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, allowanceWM: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Bonus Kebersihan</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                      value={salaryFormData.bonusCleanliness || ''}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, bonusCleanliness: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Bonus Kerajinan</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                      value={salaryFormData.bonusAttendance || ''}
                      onChange={(e) => setSalaryFormData({ ...salaryFormData, bonusAttendance: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSalaryModalOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-500 rounded-xl p-4 flex items-center justify-center hover:bg-slate-200 transition-all border-none cursor-pointer"
                    title="Batal"
                  >
                    <X className="w-5 h-5 font-bold" />
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-[2] bg-blue-600 text-white rounded-xl p-4 flex items-center justify-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all focus:ring-4 focus:ring-blue-500/30 border-none cursor-pointer"
                    title={salaryFormData.id ? 'Simpan Perubahan' : 'Submit Draft Gaji'}
                  >
                    <Save className="w-5 h-5 font-bold" />
                  </button>
                </div>
              </div>
            </form>
          </Modal>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white p-6 flex flex-col">
             <h4 className="text-sm text-slate-800 mb-4 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Daftar Gaji</h4>
             <div className="overflow-x-auto flex-grow">
               <table className="w-full text-left text-xs border-collapse">
                 <thead>
                   <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                     <th className="px-5 py-3 whitespace-nowrap">Nama Pegawai</th>
                     <th className="px-5 py-3 whitespace-nowrap">Tipe</th>
                     <th className="px-5 py-3 whitespace-nowrap">Tunjangan</th>
                     <th className="px-5 py-3 whitespace-nowrap">Bonus</th>
                     <th className="px-5 py-3 whitespace-nowrap">Total Gaji</th>
                     <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {dbState.weeklyPayrolls?.filter(p => p.status === 'Pending').slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(pay => (
                     <tr key={pay.id} className="hover:bg-amber-500 hover:text-slate-950/20">
                       <td className="px-5 py-3.5 whitespace-nowrap">
                         <div className="font-bold text-slate-900">{pay.employeeName}</div>
                         <div className="text-[10px] text-slate-400">{pay.weekStartDate} - {pay.weekEndDate}</div>
                       </td>
                       <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pay.type === 'Harian' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {pay.type}
                          </span>
                       </td>
                       <td className="px-5 py-3.5 whitespace-nowrap">
                         <div className="text-slate-500">KC: {pay.allowanceKC.toLocaleString()}</div>
                         <div className="text-slate-500">WM: {pay.allowanceWM.toLocaleString()}</div>
                       </td>
                       <td className="px-5 py-3.5 whitespace-nowrap">
                         <div className="text-emerald-600">J: {pay.bonusAttendance.toLocaleString()}</div>
                         <div className="text-emerald-600">B: {pay.bonusCleanliness.toLocaleString()}</div>
                       </td>
                       <td className="px-5 py-3.5 font-black text-slate-900 whitespace-nowrap">Rp {pay.totalGaji.toLocaleString()}</td>
                       <td className="px-5 py-3.5 text-right whitespace-nowrap flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSalaryFormData({ ...pay, id: pay.id });
                              setSalaryModalOpen(true);
                            }}
                            className="p-1 px-2 text-indigo-500 hover:bg-indigo-50 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSalaryFormData({ ...pay, id: pay.id });
                              setSalaryModalOpen(true);
                            }}
                            className="p-1 px-2 text-amber-500 hover:bg-amber-50 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setDeleteConfirm({ id: pay.id, description: `Hapus draft gaji ${pay.employeeName}?`, type: 'payroll' });
                            }}
                            className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             {renderPagination(dbState.weeklyPayrolls?.filter(p => p.status === 'Pending').length || 0)}
          </div>
        </div>
      )}

      {/* VIEW SECTION 3: REKAP & PEMBAYARAN */}
      {activeTab === 'recap' && (
        <div className="space-y-6">
           <div className="overflow-hidden bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
             <h4 className="text-xs text-slate-800 p-5 pb-0 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Recap Absensi Karyawan Minggu Ini</h4>
             <table className="w-full text-left text-xs border-collapse">
               <thead>
                 <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                   <th className="px-5 py-4 whitespace-nowrap">Nama</th>
                   <th className="px-5 py-4 text-center whitespace-nowrap">Total Check-In</th>
                   <th className="px-5 py-4 text-center whitespace-nowrap">On-Time</th>
                   <th className="px-5 py-4 text-center whitespace-nowrap">Late</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {getAttendanceRecap().map(emp => (
                   <tr key={emp.id} className="hover:bg-amber-500 hover:text-slate-950/30">
                     <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">{emp.name}</td>
                     <td className="px-5 py-4 text-center whitespace-nowrap">{emp.totalIn}</td>
                     <td className="px-5 py-4 text-center text-teal-600 font-bold whitespace-nowrap">{emp.onTime}</td>
                     <td className="px-5 py-4 text-center text-rose-600 font-bold whitespace-nowrap">{emp.late}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>

           <div className="bg-white   -3xl overflow-hidden bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 font-mono">
                    <th className="px-5 py-4 whitespace-nowrap">Periode & Karyawan</th>
                    <th className="px-5 py-4 text-center whitespace-nowrap">Nominal</th>
                    <th className="px-5 py-4 text-center whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 text-right whitespace-nowrap">Approval Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dbState.weeklyPayrolls?.filter(pay => {
                     // Check if employee has attendance logs in the payroll range
                     return (dbState.attendance || []).some(log => 
                         log.employeeId === pay.employeeId && 
                         log.date >= pay.weekStartDate && 
                         log.date <= pay.weekEndDate
                     );
                  }).map(pay => (
                    <tr key={pay.id} className="hover:bg-amber-500 hover:text-slate-950/30">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{pay.employeeName}</div>
                        <div className="text-[10px] text-slate-400">Week: {pay.weekStartDate} s/d {pay.weekEndDate}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black text-slate-800 whitespace-nowrap">
                        Rp {pay.totalGaji.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                          pay.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          pay.status === 'Paid' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {pay.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex gap-1 justify-end">
                          {pay.status === 'Pending' && isSuperOrAdmin && (
                            <button
                              onClick={() => {
                                setSelectedPayroll(pay);
                                setApprovalModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                            >
                              APPROVE
                            </button>
                          )}
                          {(pay.status === 'Approved' || pay.status === 'Paid') && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  const msg = `SLIP GAJI MINGGUAN - ${dbState.settings.companyName.toUpperCase()}\n\nYth. ${pay.employeeName}\nPeriode: ${pay.weekStartDate} s/d ${pay.weekEndDate}\n\nTotal Gaji: *Rp ${pay.totalGaji.toLocaleString()}*\nStatus: ${pay.status === 'Paid' ? '✅ TERBAYAR' : '🕒 APPROVED (Antri Transfer)'}\n\nTerima kasih atas dedikasi Anda minggu ini.`;
                                  const emp = dbState.employees?.find(e => e.id === pay.employeeId);
                                  if (emp) {
                                    sendWhatsAppNotification({
                                      phone: emp.phone,
                                      message: msg,
                                      recipientName: emp.name
                                    });
                                    showToast(`Slip Gaji terkirim ke ${pay.employeeName}`, 'success');
                                  }
                                }}
                                className="p-1 px-3 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 flex items-center gap-1 text-[10px]"
                              >
                                <Send className="w-3 h-3" /> Slip WA
                              </button>
                              <button
                                onClick={() => generatePDFSlip(pay)}
                                className="p-1 px-3 bg-slate-50 text-slate-600 rounded-lg font-bold hover:bg-slate-100 flex items-center gap-1 text-[10px]"
                              >
                                <FileText className="w-3 h-3" /> PDF
                              </button>
                            </div>
                          )}
                          <button 
                            onClick={() => {
                              setDeleteConfirm({ id: pay.id, description: `Hapus record gaji ${pay.employeeName}?`, type: 'payroll' });
                            }}
                            className="p-2 border border-slate-100 text-slate-400 hover:text-rose-500 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {/* VIEW MODAL: Profile Detail */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Detail Profil Karyawan (Arsip Digital)"
        maxWidth="max-w-2xl"
      >
        {viewingItem && (
          <div className="space-y-6">
            <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
               <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                  {viewingItem.photo_url ? (
                    <img src={viewingItem.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-2xl">
                       {viewingItem.name.substring(0, 1)}
                    </div>
                  )}
               </div>
               <div className="flex-1">
                 <div className="flex items-center gap-2">
                    <h3 className="text-xl text-slate-900 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{viewingItem.name}</h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold border border-indigo-100 uppercase">{viewingItem.type}</span>
                 </div>
                 <p className="text-slate-500 text-sm font-mono">{viewingItem.id} | {viewingItem.department || viewingItem.role}</p>
                 <div className="mt-3 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${viewingItem.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                       Status: {viewingItem.status}
                    </span>
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold">
                       Masuk: {viewingItem.join_date}
                    </span>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
               <div className="space-y-3">
                  <h5 className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Data Personal</h5>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">NIK KTP</span>
                    <span className="font-bold text-slate-800 font-mono">{viewingItem.ktp_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-bold text-slate-800">{viewingItem.gender}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">TTL</span>
                    <span className="font-bold text-slate-800">{viewingItem.pob}, {viewingItem.dob}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Agama</span>
                    <span className="font-bold text-slate-800">{viewingItem.religion}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">Alamat</span>
                    <p className="font-bold text-slate-800 leading-relaxed">{viewingItem.address}</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <h5 className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Kontak & Finansial</h5>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">No WA</span>
                    <span className="font-bold text-emerald-600 font-mono">{viewingItem.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Email</span>
                    <span className="font-bold text-slate-800">{viewingItem.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Bank</span>
                    <span className="font-bold text-slate-800">{viewingItem.bank_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Rekening</span>
                    <span className="font-bold text-slate-800 font-mono">{viewingItem.bank_account}</span>
                  </div>
                  <div className="space-y-2 pt-2">
                    <span className="text-slate-500">Foto KTP Arsip</span>
                    {viewingItem.ktp_photo_url ? (
                      <img src={viewingItem.ktp_photo_url} className="w-full h-24 object-cover rounded-xl border border-slate-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-24 bg-slate-50 rounded-xl border-dashed border border-slate-200 flex items-center justify-center text-slate-300">No Image</div>
                    )}
                  </div>
               </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-end">
               <button onClick={() => setViewModalOpen(false)} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs">Tutup Profile</button>
            </div>
          </div>
        )}
      </Modal>

      {/* APPROVAL MODAL */}
      <Modal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        title="Konfirmasi Approval Gaji & Pembayaran"
        maxWidth="max-w-sm"
      >
        {selectedPayroll && (
          <div className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
               <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Total Cair</div>
               <div className="text-2xl font-black text-emerald-700">Rp {selectedPayroll.totalGaji.toLocaleString()}</div>
               <div className="text-[11px] text-emerald-600/80 font-medium mt-1">Nama: {selectedPayroll.employeeName}</div>
            </div>

            <div>
               <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Rekening Sumber Pembayaran</label>
               <select
                 className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                 onChange={(e) => setSelectedPayroll({ ...selectedPayroll, bankAccountId: e.target.value })}
               >
                 <option value="">-- Pilih Bank --</option>
                 {dbState.bank_accounts?.map(ba => (
                   <option key={ba.id} value={ba.id}>{ba.bank_name} - {ba.account_number} (Saldo: {ba.current_balance.toLocaleString()})</option>
                 ))}
               </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-800 leading-relaxed font-medium">
               Setujui pembayaran ini akan otomatis mencatat mutasi keluar bank dan menambah record transaksi di modul akuntansi.
            </div>

            <div className="flex gap-2 font-bold">
               <button onClick={() => setApprovalModalOpen(false)} className="w-full py-3 border border-slate-200 rounded-xl text-xs"><X className="w-4 h-4 mr-1" /> Batal</button>
               <button 
                 onClick={() => handleApprovePayrollExecution(selectedPayroll)}
                 className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
               >
                 SETUJUI & BAYAR SEKARANG
               </button>
            </div>
          </div>
        )}
      </Modal>

      {/* FORM DIALOG SHEET (Add & Edit Employees) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Profil Pegawai' : 'Daftarkan Rekaman Karyawan Baru'}
        maxWidth="max-w-4xl"
      >
        <p className="text-xs text-slate-500 mb-5 -mt-2 uppercase font-bold tracking-widest">Informasi Pokok Personalia & Validasi Data ESDM</p>
        <form onSubmit={handleSaveEmployee} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 px-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Section 1: Data Personal */}
            <div className="space-y-4">
              <h4 className="text-xs text-indigo-600 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                <User className="w-4 h-4" /> [1] Data Personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Panggilan</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.nickname || ''}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tgl Masuk</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.join_date || ''}
                    onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">NIK KTP (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.ktp_number || ''}
                    onChange={(e) => setFormData({ ...formData, ktp_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Jenis Kelamin</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.gender || 'Laki-laki'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Agama</label>
                  <select
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.religion || 'Islam'}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value as any })}
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Konghucu">Konghucu</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tempat Lahir</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.pob || ''}
                    onChange={(e) => setFormData({ ...formData, pob: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Tanggal Lahir</label>
                  <input
                    type="date"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.dob || ''}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alamat Domisili</label>
                  <textarea
                    rows={2}
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Kontak & Media */}
            <div className="space-y-4">
              <h4 className="text-xs text-indigo-600 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                <Smartphone className="w-4 h-4" /> [2] Kontak & Berkas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No Handphone (WhatsApp)</label>
                  <input
                    type="text"
                    required
                    placeholder="62812xxx"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">E-mail (Unique)</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Bank</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.bank_name || ''}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">No. Rekening</label>
                  <input
                    type="text"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.bank_account || ''}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Gaji Pokok Statis (Rp)</label>
                  <input
                    type="number"
                    className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                    value={formData.baseSalary || ''}
                    onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                  />
                </div>

                <div className="col-span-1">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Foto Diri</label>
                  <div className="flex flex-col items-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                    {formData.photo_url ? (
                      <div className="relative">
                        <img src={formData.photo_url} className="w-16 h-16 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <button onClick={() => setFormData({...formData, photo_url: ''})} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                         <Plus className="w-5 h-5 text-slate-400" />
                         <span className="text-[9px] text-slate-400">Upload Foto</span>
                         <input type="file" className="hidden font-medium font-sans" accept="image/*" onChange={(e) => handleFileChange(e, 'photo_url')} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Foto KTP</label>
                  <div className="flex flex-col items-center gap-2 p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                    {formData.ktp_photo_url ? (
                      <div className="relative">
                        <img src={formData.ktp_photo_url} className="w-16 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                        <button onClick={() => setFormData({...formData, ktp_photo_url: ''})} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider flex items-center justify-between">
                         <Plus className="w-5 h-5 text-slate-400" />
                         <span className="text-[9px] text-slate-400">Upload KTP</span>
                         <input type="file" className="hidden font-medium font-sans" accept="image/*" onChange={(e) => handleFileChange(e, 'ktp_photo_url')} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Atribut Kerja */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
               <div className="space-y-4">
                  <h4 className="text-xs text-indigo-600 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                    <Building className="w-4 h-4" /> [3] Atribut Kerja & Status
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Bagian</label>
                      <select
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={formData.department || 'Kitchenset'}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                      >
                        <option value="Kitchenset">Kitchenset</option>
                        <option value="Finishing">Finishing</option>
                        <option value="Wall Moulding">Wall Moulding</option>
                        <option value="Sipil">Sipil</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Type Karyawan</label>
                      <select
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={formData.type || 'Harian'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      >
                        <option value="Harian">Harian</option>
                        <option value="Borongan">Borongan</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Ukuran Baju</label>
                      <select
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={formData.shirt_size || 'M'}
                        onChange={(e) => setFormData({ ...formData, shirt_size: e.target.value as any })}
                      >
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                        <option value="XL">XL</option>
                        <option value="XXL">XXL</option>
                        <option value="XXXL">XXXL</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Ukuran Sepatu</label>
                      <input
                        type="number"
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                        value={formData.shoe_size || ''}
                        onChange={(e) => setFormData({ ...formData, shoe_size: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-xs text-indigo-600 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                    <AlertCircle className="w-4 h-4" /> Status Keaktifan
                  </h4>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                     <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Status Pegawai</label>
                     <div className="flex gap-4">
                        {['Aktif', 'Cuti', 'Keluar'].map(st => (
                          <label key={st} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="status"
                              value={st}
                              checked={formData.status === st}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                              className="bg-slate-50 w-4 h-4 text-indigo-600 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                            />
                            <span className="text-xs font-bold text-slate-600">{st}</span>
                          </label>
                        ))}
                     </div>
                  </div>
                  <div>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Role Jabatan (Sistem)</label>
                    <select
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none font-medium font-sans"
                      value={formData.role || 'craftsman'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="staff">Staff Office</option>
                      <option value="architect">Architect</option>
                      <option value="craftsman">Mandor / Tukang</option>
                    </select>
                  </div>
               </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 font-bold sticky bottom-0 bg-white pb-1">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer text-xs"><X className="w-4 h-4 mr-1" /> Batal</button>
            <button type="submit" className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer">
              <Check className="w-4 h-4" /> {editingId ? 'Update Data Pegawai' : 'Daftarkan Permanen'}
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

    </div>
  );
};
export default EsdmView;
