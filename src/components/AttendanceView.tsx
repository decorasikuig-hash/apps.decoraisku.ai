import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Fingerprint, 
  Smartphone, 
  CheckCircle2, 
  Watch, 
  Calendar, 
  BarChart3, 
  AlertCircle,
  ScanLine,
  LogIn,
  LogOut,
  Wifi,
  User,
  Search,
  Camera,
  Building2,
  Store,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { AttendanceLog, DBState, Employee } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';

interface AttendanceViewProps {
  dbState: DBState;
  saveCollection: (name: string, data: any) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ dbState, saveCollection }) => {
  const [time, setTime] = useState(new Date());
  const [category, setCategory] = useState<'KC' | 'WM' | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [plannedAction, setPlannedAction] = useState<'Check-In' | 'Check-Out' | 'Lembur-In' | 'Lembur-Out'>('Check-In');
  const [method, setMethod] = useState<'NFC' | 'Barcode' | 'Manual'>('NFC');
  const [lastAction, setLastAction] = useState<'Check-In' | 'Check-Out' | 'Lembur-In' | 'Lembur-Out' | null>(null);
  const [isLemburMode, setIsLemburMode] = useState(false);
  const [filterType, setFilterType] = useState<'Daily' | 'Weekly'>('Weekly');
  const [isScanning, setIsScanning] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [isManualDropdownOpen, setIsManualDropdownOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  useEffect(() => {
    setLastAction(null);
  }, [selectedEmployeeId]);

  // Analog Clock Logic
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours();

  const currentMinutes = hours * 60 + minutes;
  const isMainTime = currentMinutes >= 300 && currentMinutes <= 1020; // 05:00 AM - 17:00 PM (inclusive)
  const isOvertimeTime = currentMinutes >= 1021 || currentMinutes <= 360; // 17:01 PM - 06:00 AM (inclusive)

  // Auto adjust active action selection based on active time frames
  useEffect(() => {
    if (!isMainTime && (plannedAction === 'Check-In' || plannedAction === 'Check-Out')) {
      if (isOvertimeTime) {
        setPlannedAction('Lembur-In');
      }
    } else if (!isOvertimeTime && (plannedAction === 'Lembur-In' || plannedAction === 'Lembur-Out')) {
      if (isMainTime) {
        setPlannedAction('Check-In');
      }
    }
  }, [hours, minutes, plannedAction, isMainTime, isOvertimeTime]);

  const secondStyle = { transform: `rotate(${seconds * 6}deg)` };
  const minuteStyle = { transform: `rotate(${minutes * 6 + seconds * 0.1}deg)` };
  const hourStyle = { transform: `rotate(${hours * 30 + minutes * 0.5}deg)` };

  // Attendance Statistics Logic
  const getChartData = () => {
    if (filterType === 'Daily') {
      // Mock daily data for last 7 days based on presence count
      return [
        { name: 'Mon', count: 12 },
        { name: 'Tue', count: 15 },
        { name: 'Wed', count: 14 },
        { name: 'Thu', count: 18 },
        { name: 'Fri', count: 16 },
        { name: 'Sat', count: 9 },
        { name: 'Sun', count: 0 },
      ];
    }
    // Weekly aggregation (last 4 weeks)
    return [
      { name: 'Week 1', count: 85 },
      { name: 'Week 2', count: 92 },
      { name: 'Week 3', count: 78 },
      { name: 'Week 4', count: 96 },
    ];
  };

  const handleTap = (type: 'Check-In' | 'Check-Out' | 'Lembur-In' | 'Lembur-Out', targetEmpId?: string) => {
    const empId = targetEmpId || selectedEmployeeId;
    if (!empId) {
      alert('Pilih karyawan!');
      return;
    }

    const emp = (dbState.employees || []).find(e => e.id === empId);
    if (!emp) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = now.toISOString().split('T')[0];

    // Check if category is mandatory only for Check-In
    if (type === 'Check-In' && !category) {
       // Optional but recommended, we allow for now as per user "bsa d hilangkan karna opsional"
    }

    // Shift Logic & Fines
    let status = 'On-Time';
    let lateMinutes = 0;
    let lateFine = 0;
    const fineRate = 1000; // Rp 1.000 per minute

    if (type === 'Check-In') {
      const shiftLimit = new Date();
      shiftLimit.setHours(7, 30, 0);
      
      const toleranceLimit = new Date(shiftLimit);
      toleranceLimit.setMinutes(shiftLimit.getMinutes() + 30); // 08:00
      
      if (now > shiftLimit) {
        status = 'Terlambat';
        lateMinutes = Math.floor((now.getTime() - shiftLimit.getTime()) / 60000);
        
        // If late > 30 minutes, everything is fined. If <= 30 minutes, fine is 0.
        if (now > toleranceLimit) {
          lateFine = lateMinutes * fineRate;
        } else {
          lateFine = 0; // Tolerance period
          status = 'Terlambat (Toleransi)';
        }
      }
    }

    // Overtime Tap check
    const isOvertimeTap = type.startsWith('Lembur');
    const lastLogs = (dbState.attendance || []).filter(a => a.employeeId === empId && a.date === dateStr);
    const lastLog = lastLogs[lastLogs.length - 1];

    if (lastLog) {
      const lastTime = new Date(lastLog.timestamp);
      const diffMin = (now.getTime() - lastTime.getTime()) / (1000 * 60);
      // Cooldown for same type tap
      if (lastLog.type === type && diffMin < 5) {
        alert('Proteksi Anti-Double Tap! Mohon tunggu 5 menit sebelum tap kembali.');
        return;
      }
    }

    const newLog: AttendanceLog = {
      id: `att-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      nip: emp.id,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      method: method,
      type: type as any,
      category: category,
      status: status,
      lateMinutes: lateMinutes,
      lateFine: lateFine,
      isOvertime: isOvertimeTap
    };

    saveCollection('attendance', [...(dbState.attendance || []), newLog]);
    setLastAction(type);
    setIsLemburMode(false); // Reset mode after successful tap

    // WhatsApp Notification Logic
    const adminPhone = dbState.settings?.phoneNumber || '628123456789'; 
    const isLembur = type.startsWith('Lembur');
    const typeLabel = isLembur ? (type === 'Lembur-In' ? 'MULAI LEMBUR' : 'SELESAI LEMBUR') : (type === 'Check-In' ? 'MASUK' : 'PULANG');
    
    const msg = `*NOTIFIKASI ABSENSI / LEMBUR*
---------------------------
Nama: *${emp.name}*
Tipe: *${typeLabel}*
Waktu: *${timeStr}*
Unit: *${category}*
Status: *${status}*
${lateFine > 0 ? `Denda: *Rp ${lateFine.toLocaleString()}*` : ''}
---------------------------
_Dicatat otomatis oleh Sistem ERP Interior_`;
    
    // Notification for Employee
    if (emp.phone) {
      sendWhatsAppNotification({
        phone: emp.phone,
        recipientName: emp.name,
        message: msg
      });
    }

    // Notification for Super Admin
    sendWhatsAppNotification({
      phone: adminPhone,
      recipientName: 'Super Admin',
      message: msg
    });

    alert(`${typeLabel} Berhasil untuk ${emp.name}!${lateFine > 0 ? ` Denda Terlambat: Rp ${lateFine.toLocaleString()}` : ''}`);
  };

  const handleManualIndividualAttendance = (empId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa') => {
    const emp = (dbState.employees || []).find(e => e.id === empId);
    if (!emp) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const finalStatus = status === 'Hadir' ? 'On-Time' : status;
    const isOvertime = plannedAction.startsWith('Lembur');

    const newLog: AttendanceLog = {
      id: `att-manual-${Date.now()}-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      nip: emp.id,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      method: 'Manual',
      type: plannedAction as any,
      status: finalStatus,
      category: category || null,
      lateMinutes: 0,
      lateFine: 0,
      isOvertime: isOvertime
    };

    saveCollection('attendance', [...(dbState.attendance || []), newLog]);

    // Send WhatsApp to Admin/Employee
    const msg = `*LAPORAN ABSENSI (MANUAL)*\n---------------------------\nAdmin mencatat: *${emp.name}*\nStatus: *${finalStatus}*\nWaktu: *${timeStr}*\nTipe: *${plannedAction}*`;
    sendWhatsAppNotification({
      phone: dbState.settings?.phoneNumber || '628123456789',
      recipientName: 'Super Admin',
      message: msg
    });

    alert(`Berhasil mencatat ${emp.name} sebagai ${status}`);
  };

  const handleBulkAttendance = (status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa') => {
    if (selectedBulkIds.length === 0) {
      alert('Pilih setidaknya satu karyawan!');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    const employees = dbState.employees || [];
    const newLogs: AttendanceLog[] = [...(dbState.attendance || [])];

    selectedBulkIds.forEach(id => {
      const emp = employees.find(e => e.id === id);
      if (emp) {
        // Mapping status for "hitungan" (counts)
        // User: Sakit tetap masuk absen hadir hitungan nya, ijin dan alpah tidak hadir hitungan nya
        const finalStatus = status === 'Hadir' ? 'On-Time' : status;
        
        newLogs.push({
          id: `att-manual-${Date.now()}-${id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          nip: emp.id,
          timestamp: now.toISOString(),
          date: dateStr,
          time: timeStr,
          method: 'Manual',
          type: plannedAction as any,
          status: finalStatus,
          category: category || 'KC',
          lateMinutes: 0,
          lateFine: 0,
          isOvertime: plannedAction.startsWith('Lembur')
        });

        // WhatsApp to Admin
        const msg = `*LAPORAN ABSENSI MASAL (MANUAL)*\n---------------------------\nAdmin mencatat: *${emp.name}*\nStatus: *${finalStatus}*\nWaktu: *${timeStr}*\nTipe: *${plannedAction}*`;
        sendWhatsAppNotification({
          phone: dbState.settings?.phoneNumber || '628123456789',
          recipientName: 'Super Admin',
          message: msg
        });
      }
    });

    saveCollection('attendance', newLogs);
    setSelectedBulkIds([]);
    alert(`Berhasil mencatat ${selectedBulkIds.length} karyawan sebagai ${status}`);
  };

  const attendanceLogs = dbState.attendance || [];
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = attendanceLogs.filter(l => l.date === today);

  // Status counts for today
  const dailySummary = {
     hadir: todayLogs.filter(l => (l.status === 'On-Time' || l.status === 'Terlambat' || l.status === 'Terlambat (Toleransi)' || l.status === 'Sakit') && l.type === 'Check-In').length,
     izin: todayLogs.filter(l => l.status === 'Izin' && l.type === 'Check-In').length,
     alpha: todayLogs.filter(l => l.status === 'Alfa' && l.type === 'Check-In').length,
     sakit: todayLogs.filter(l => l.status === 'Sakit' && l.type === 'Check-In').length,
  };

  const totalItems = attendanceLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLogs = [...attendanceLogs].reverse().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAutoCheckout = () => {
    const today = new Date().toISOString().split('T')[0];
    const logs = dbState.attendance || [];
    const employees = dbState.employees || [];
    
    let updated = false;
    const newLogs: AttendanceLog[] = [...logs];
    
    employees.forEach(emp => {
      const todayLogs = logs.filter(l => l.employeeId === emp.id && l.date === today);
      const hasIn = todayLogs.some(l => l.type === 'Check-In');
      const hasOut = todayLogs.some(l => l.type === 'Check-Out');
      
      if (hasIn && !hasOut) {
        const autoOut: AttendanceLog = {
          id: `att-auto-${Date.now()}-${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          nip: emp.id,
          timestamp: new Date().toISOString(),
          date: today,
          time: '17:00',
          method: 'NFC',
          type: 'Check-Out',
          category: todayLogs.find(l => l.type === 'Check-In')?.category || 'KC',
          status: 'Auto-Checkout',
          lateMinutes: 0,
          lateFine: 0,
          isOvertime: false,
          autoCheckout: true
        };
        newLogs.push(autoOut);
        updated = true;
      }
    });

    if (updated) {
      saveCollection('attendance', newLogs);
      alert('Auto-Checkout Berhasil: Semua karyawan yang belum pulang telah di-checkout sistem pada pukul 17:00.');
    } else {
      alert('Tidak ada karyawan yang perlu auto-checkout hari ini.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn min-h-[calc(100vh-120px)] flex flex-col h-full uppercase">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-indigo-500/10 blur-3xl rounded-full" />
        <div className="flex flex-col md:flex-row items-center gap-10 relative">
          
          {/* ANALOG CLOCK */}
          <div className="relative w-48 h-48 bg-slate-800 rounded-full border-4 border-slate-700 shadow-2xl flex items-center justify-center shrink-0">
             {/* Clock numbers */}
             {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute inset-2 text-center" style={{ transform: `rotate(${i * 30}deg)` }}>
                   <div style={{ transform: `rotate(-${i * 30}deg)` }} className="text-[10px] font-black text-slate-600">
                      {i === 0 ? 12 : i}
                   </div>
                </div>
             ))}
             {/* Hands */}
             <div className="absolute w-1.5 h-1.5 bg-slate-400 rounded-full z-20" />
             <div className="absolute w-1.5 h-14 bg-white rounded-full origin-bottom bottom-1/2 transition-transform duration-1000" style={hourStyle} />
             <div className="absolute w-1 h-18 bg-indigo-400 rounded-full origin-bottom bottom-1/2 transition-transform duration-1000" style={minuteStyle} />
             <div className="absolute w-[1px] h-22 bg-rose-500 rounded-full origin-bottom bottom-1/2" style={secondStyle} />
          </div>

          <div className="flex-1 space-y-4">
             <h2 className="text-3xl tracking-tight font-bold text-white font-sans capitalize">Absensi Biometrik</h2>
             <p className="text-slate-400 text-sm max-w-lg">
                Terminal pencatatan kehadiran harian karyawan secara mandiri dan aman melalui NFC, Barcode, atau Manual.
             </p>
             <div className="flex gap-4">
               <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
                   <Clock className="w-4 h-4" />
                 </div>
                 <div>
                   <div className="text-[9px] uppercase font-bold text-slate-500">Batas Masuk</div>
                   <div className="text-xs font-black">06:00 - 07:30</div>
                 </div>
               </div>
               <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                   <Watch className="w-4 h-4" />
                 </div>
                 <div>
                   <div className="text-[9px] uppercase font-bold text-slate-500">Auto Checkout</div>
                   <div className="text-xs font-black">Pukul 18:00</div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
        
        {/* ATTENDANCE CONTROL PANEL */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white   -3xl p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <h4 className="text-slate-900 mb-4 flex items-center justify-between tracking-tight capitalize font-semibold font-sans">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-600" />
                  Terminal Tap Validasi
                </div>
                {isMainTime && (
                  <div className="flex gap-2">
                     <button 
                       onClick={() => setPlannedAction('Check-In')}
                       className={`p-2 rounded-xl border transition-all flex items-center justify-center gap-1 ${plannedAction === 'Check-In' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                       title="Absen Masuk"
                     >
                        <LogIn className="w-4 h-4" />
                     </button>
                     <button 
                       onClick={() => setPlannedAction('Check-Out')}
                       className={`p-2 rounded-xl border transition-all flex items-center justify-center gap-1 ${plannedAction === 'Check-Out' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                       title="Absen Pulang"
                     >
                        <LogOut className="w-4 h-4" />
                     </button>
                  </div>
                )}
              </h4>

              <div className="space-y-4">
                {/* OVERTIME TOGGLE */}
                {isOvertimeTime && (
                  <div className="grid grid-cols-2 gap-2">
                     <button 
                       onClick={() => setPlannedAction('Lembur-In')}
                       className={`px-3 py-2 text-[9px] font-black rounded-xl border transition-all flex items-center justify-center gap-1.5 ${plannedAction === 'Lembur-In' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                     >
                        <Clock className="w-3.5 h-3.5" /> MULAI
                     </button>
                     <button 
                       onClick={() => setPlannedAction('Lembur-Out')}
                       className={`px-3 py-2 text-[9px] font-black rounded-xl border transition-all flex items-center justify-center gap-1.5 ${plannedAction === 'Lembur-Out' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                     >
                        <Clock className="w-3.5 h-3.5" /> SELESAI
                     </button>
                  </div>
                )}
                {/* CHECKBOX OPTIONS */}
                {isMainTime && (
                  <div>
                    <label className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest block">Unit Kerja Pelayanan (Opsional)</label>
                    <div className="grid grid-cols-2 gap-3">
                       <button
                         onClick={() => setCategory(prev => prev === 'KC' ? null : 'KC')}
                         className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all font-bold text-xs relative ${category === 'KC' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                       >
                          <div className="absolute top-2 right-2">
                            {category === 'KC' ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <Building2 className={`w-8 h-8 ${category === 'KC' ? 'text-indigo-600' : 'text-slate-300'}`} /> 
                          <span className="text-[10px] uppercase tracking-widest mt-1">KC (Kitchenset)</span>
                       </button>
                       <button
                         onClick={() => setCategory(prev => prev === 'WM' ? null : 'WM')}
                         className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all font-bold text-xs relative ${category === 'WM' ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                       >
                          <div className="absolute top-2 right-2">
                            {category === 'WM' ? <CheckSquare className="w-4 h-4 text-amber-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <Store className={`w-8 h-8 ${category === 'WM' ? 'text-amber-600' : 'text-slate-300'}`} /> 
                          <span className="text-[10px] uppercase tracking-widest mt-1">WM (Wall Moulding)</span>
                       </button>
                    </div>
                  </div>
                )}


<div>
                  <label className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest block">Metode Validasi</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setMethod('NFC')}
                      className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${method === 'NFC' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}
                    >
                      <Wifi className="w-5 h-5 rotate-90" />
                      NFC
                    </button>
                    <button 
                      onClick={() => setMethod('Barcode')}
                      className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${method === 'Barcode' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}
                    >
                      <ScanLine className="w-5 h-5" />
                      BARCODE
                    </button>
                    <button 
                      onClick={() => setMethod('Manual')}
                      className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${method === 'Manual' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-50 hover:border-slate-200'}`}
                    >
                      <User className="w-5 h-5" />
                      MANUAL
                    </button>
                  </div>
                </div>

                {/* USER REQUESTED STATUS LABEL */}
                 <div className="px-4 py-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-3 shadow border border-slate-700 animate-in fade-in slide-in-from-top-2">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${plannedAction.includes('In') ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                   <span className="text-[10px] font-black tracking-[0.2em] uppercase">
                      {plannedAction === 'Check-In' && 'Saat ini absen masuk'}
                      {plannedAction === 'Check-Out' && 'Saat ini absen pulang'}
                      {plannedAction === 'Lembur-In' && 'Saat ini mulai lembur'}
                      {plannedAction === 'Lembur-Out' && 'Saat ini selesai lembur'}
                   </span>
                 </div>

                 {/* DYNAMIC INPUT AREA */}
                <div className="min-h-[160px] flex flex-col justify-center bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                  {method === 'NFC' && (
                    <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300 w-full">
                      <div className="relative">
                        <Wifi className="w-14 h-14 text-indigo-100 rotate-90" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-500 rounded-full animate-ping" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Menunggu Scan Kartu NFC...</p>
                      
                      <div className="w-full pt-2 border-t border-slate-100">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 text-center">SIMULASI TAP KARTU KARYAWAN</label>
                        <div className="max-h-[140px] overflow-y-auto space-y-1 p-2 bg-white rounded-xl border border-slate-200 shadow-inner w-full text-left">
                          {(dbState.employees || []).map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => handleTap(plannedAction, emp.id)}
                              className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-none text-left"
                            >
                              <span className="text-[11px] font-bold text-slate-700">{emp.name}</span>
                              <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded tracking-wider uppercase">TAP KARTU</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {method === 'Barcode' && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-300 w-full">
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full bg-white border-2 border-slate-200 text-slate-800 rounded-xl pl-10 pr-12 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                          placeholder="Masukkan Kode Barcode / NIK"
                          value={barcodeInput}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && selectedEmployeeId) {
                              handleTap(plannedAction, selectedEmployeeId);
                              setSelectedEmployeeId('');
                              setBarcodeInput('');
                            }
                          }}
                          onChange={(e) => {
                            setBarcodeInput(e.target.value);
                            const today = new Date().toISOString().split('T')[0];
                            const found = (dbState.employees || []).find(emp => {
                               if (emp.id !== e.target.value) return false;
                               // Filter: check if already clocked for today
                               const todayLogs = (dbState.attendance || []).filter(l => l.employeeId === emp.id && l.date === today);
                               // Only block if already done Check-In AND Check-Out or if we want single-entry daily
                               return todayLogs.length < 2; 
                            });
                            if (found) setSelectedEmployeeId(found.id);
                          }}
                        />
                        <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <button 
                          onClick={() => setIsScanning(!isScanning)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all border-none cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>
                      {selectedEmployeeId && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black">
                              { (dbState.employees || []).find(e => e.id === selectedEmployeeId)?.name?.charAt(0) || '?' }
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-600 uppercase">Karyawan Terpilih</p>
                              <p className="text-xs font-bold text-slate-800">{(dbState.employees || []).find(e => e.id === selectedEmployeeId)?.name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              handleTap(plannedAction, selectedEmployeeId);
                              setSelectedEmployeeId('');
                              setBarcodeInput('');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black px-3 py-1.5 rounded-lg border-none cursor-pointer tracking-wider"
                          >
                            ABSEN
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {method === 'Manual' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 w-full relative">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pencatatan Manual Karyawan</label>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsManualDropdownOpen(!isManualDropdownOpen)}
                          className="w-full flex items-center justify-between bg-white border-2 border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm group text-left"
                        >
                          <span className="flex items-center gap-2">
                            <User className="w-4 h-4 text-indigo-500" />
                            {selectedEmployeeId 
                              ? ((dbState.employees || []).find(e => e.id === selectedEmployeeId)?.name || 'Pilih Karyawan...')
                              : 'Pilih Karyawan...'}
                          </span>
                          <span className="text-slate-400 group-hover:text-slate-600">▼</span>
                        </button>

                        {isManualDropdownOpen && (
                          <div className="absolute left-0 right-0 z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3 max-h-[350px] overflow-hidden flex flex-col">
                            {/* Search Bar inside Dropdown */}
                            <div className="relative flex-shrink-0">
                              <input
                                type="text"
                                placeholder="Cari nama karyawan..."
                                value={manualSearch}
                                onChange={(e) => setManualSearch(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              />
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>

                            {/* Employee List inside Dropdown */}
                            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 max-h-[220px]">
                              {(dbState.employees || [])
                                .filter(emp => !manualSearch || emp.name.toLowerCase().includes(manualSearch.toLowerCase()))
                                .map(emp => {
                                  const today = new Date().toISOString().split('T')[0];
                                  const todayLogs = (dbState.attendance || []).filter(l => l.employeeId === emp.id && l.date === today);
                                  const hasLoggedAction = todayLogs.some(l => l.type === plannedAction);
                                  
                                  return (
                                    <div
                                      key={emp.id}
                                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 rounded-xl transition-all gap-2 border border-transparent ${selectedEmployeeId === emp.id ? 'bg-indigo-50/50 border-indigo-100' : 'hover:bg-slate-50'}`}
                                    >
                                      {/* Employee Name Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedEmployeeId(emp.id);
                                        }}
                                        className="flex items-center gap-2 text-left border-none bg-transparent cursor-pointer flex-1"
                                      >
                                        <div className={`w-3.5 h-3.5 rounded border border-slate-300 flex items-center justify-center shrink-0 ${selectedEmployeeId === emp.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white'}`}>
                                          {selectedEmployeeId === emp.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className={`text-[11px] font-bold ${hasLoggedAction ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{emp.name}</span>
                                          <span className="text-[8px] text-slate-400 font-bold uppercase">{emp.id} {hasLoggedAction && '(Selesai)'}</span>
                                        </div>
                                      </button>

                                      {/* Direct Status Checklist Buttons */}
                                      <div className="flex gap-1 items-center shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleManualIndividualAttendance(emp.id, 'Hadir');
                                            setIsManualDropdownOpen(false);
                                          }}
                                          className="px-2 py-1 text-[8px] font-black rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-100 transition-all font-mono"
                                          title="Pilih Masuk / Hadir"
                                        >
                                          HADIR
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleManualIndividualAttendance(emp.id, 'Izin');
                                            setIsManualDropdownOpen(false);
                                          }}
                                          className="px-2 py-1 text-[8px] font-black rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-100 transition-all font-mono"
                                          title="Pilih Izin"
                                        >
                                          IZIN
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleManualIndividualAttendance(emp.id, 'Sakit');
                                            setIsManualDropdownOpen(false);
                                          }}
                                          className="px-2 py-1 text-[8px] font-black rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 transition-all font-mono"
                                          title="Pilih Sakit"
                                        >
                                          SAKIT
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleManualIndividualAttendance(emp.id, 'Alfa');
                                            setIsManualDropdownOpen(false);
                                          }}
                                          className="px-2 py-1 text-[8px] font-black rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 transition-all font-mono"
                                          title="Pilih Alfa"
                                        >
                                          ALFA
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                              {(dbState.employees || []).filter(emp => !manualSearch || emp.name.toLowerCase().includes(manualSearch.toLowerCase())).length === 0 && (
                                <div className="py-6 text-center text-slate-400 text-[10px] font-bold uppercase">Nama Karyawan tidak ditemukan</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedEmployeeId && (
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                              {(dbState.employees || []).find(e => e.id === selectedEmployeeId)?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-indigo-600 uppercase">Karyawan Terpilih</p>
                              <p className="text-xs font-bold text-slate-800">{(dbState.employees || []).find(e => e.id === selectedEmployeeId)?.name}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button onClick={() => { handleManualIndividualAttendance(selectedEmployeeId, 'Hadir'); setSelectedEmployeeId(''); }} className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-xl text-[9px] font-black hover:bg-emerald-700 transition-[#1e1b4b] shadow-md shadow-emerald-500/10">HADIR</button>
                            <button onClick={() => { handleManualIndividualAttendance(selectedEmployeeId, 'Izin'); setSelectedEmployeeId(''); }} className="bg-indigo-50 text-indigo-700 py-2 rounded-xl text-[9px] font-black hover:bg-indigo-100 transition-colors">IZIN</button>
                            <button onClick={() => { handleManualIndividualAttendance(selectedEmployeeId, 'Sakit'); setSelectedEmployeeId(''); }} className="bg-amber-50 text-amber-700 py-2 rounded-xl text-[9px] font-black hover:bg-amber-100 transition-colors">SAKIT</button>
                            <button onClick={() => { handleManualIndividualAttendance(selectedEmployeeId, 'Alfa'); setSelectedEmployeeId(''); }} className="col-span-2 bg-rose-50 text-rose-700 py-2 rounded-xl text-[9px] font-black hover:bg-rose-100 transition-colors">ALFA (TIDAK HADIR)</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                </div>


              </div>
           </div>
        </div>

        {/* ANALYTICS SECTION */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           {/* DAILY HITUNGAN SUMMARY */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Hadir</div>
                 <div className="text-2xl font-black text-emerald-900">{dailySummary.hadir}</div>
                 <div className="text-[8px] text-emerald-500 font-bold">*TERMASUK SAKIT</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-400">
                 <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Sakit</div>
                 <div className="text-2xl font-black text-amber-900">{dailySummary.sakit}</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Izin</div>
                 <div className="text-2xl font-black text-indigo-900">{dailySummary.izin}</div>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-600">
                 <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Alpha</div>
                 <div className="text-2xl font-black text-rose-900">{dailySummary.alpha}</div>
              </div>
           </div>

           <div className="bg-white   -3xl p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                 <div>
                   <h4 className="text-slate-900 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                     <BarChart3 className="w-5 h-5 text-indigo-600" />
                     Grafik Kehadiran Real-time
                   </h4>
                   <p className="text-[10px] text-slate-400">Distribusi jumlah kehadiran berdasarkan periode terpilih.</p>
                 </div>
                 <div className="flex bg-slate-50 p-1 rounded-xl">
                   <button 
                     onClick={() => setFilterType('Daily')}
                     className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${filterType === 'Daily' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-sm' : 'text-slate-600 hover:bg-amber-500 hover:text-slate-950/50 p-1 rounded'}`}
                   >
                     Harian
                   </button>
                   <button 
                     onClick={() => setFilterType('Weekly')}
                     className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${filterType === 'Weekly' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm shadow-sm' : 'text-slate-600 hover:bg-amber-500 hover:text-slate-950/50 p-1 rounded'}`}
                   >
                     Mingguan
                   </button>
                 </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getChartData()}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                    />
                    <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white   -3xl p-6  flex flex-col flex-grow min-h-[400px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
             <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h4 className="text-slate-900 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Log Absensi Lengkap
                </h4>
             </div>
             <div className="overflow-x-auto flex-grow scrollbar-hide">
               <table className="w-full text-left text-[11px] border-collapse">
                 <thead>
                   <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Waktu</th>
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Karyawan</th>
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Unit</th>
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Metode</th>
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Tipe</th>
                     <th className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">Status/Late</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {paginatedLogs.map(log => (
                     <tr key={log.id} className="hover:bg-amber-500 hover:text-slate-950/50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-500 whitespace-nowrap">{log.time}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                           <div className="font-black text-slate-800">{log.employeeName}</div>
                           <div className="text-[9px] text-slate-400">{log.nip}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                           <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${log.category === 'KC' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                             {log.category}
                           </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-600 uppercase whitespace-nowrap">{log.method}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                           <span className={`px-2 py-0.5 rounded text-[9px] font-black ${log.type === 'Check-In' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {log.type}
                           </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                           <div className={`font-bold ${
                              log.status === 'On-Time' || log.status?.includes('Toleransi') ? 'text-emerald-600' : 
                              log.status === 'Sakit' ? 'text-amber-600' :
                              log.status === 'Izin' ? 'text-indigo-600' :
                              'text-rose-500'
                           }`}>
                              {log.status === 'Izin' || log.status === 'Sakit' ? (
                                 <span className="flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {log.status}
                                 </span>
                              ) : log.status}
                           </div>
                           {log.lateFine && log.lateFine > 0 && (
                             <div className="text-rose-400 font-mono text-[9px]">Fine: Rp {log.lateFine.toLocaleString()}</div>
                           )}
                        </td>
                     </tr>
                   ))}
                   {(!paginatedLogs || paginatedLogs.length === 0) && (
                     <tr>
                       <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium font-sans">Belum ada aktifitas absensi hari ini.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>

             {/* PAGINATION UI */}
             {totalPages > 1 && (
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
             )}
           </div>
        </div>

      </div>
    </div>
  );
};
