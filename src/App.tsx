/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Home, 
  Package, 
  Users, 
  Receipt, 
  Settings, 
  LogOut, 
  Smartphone, 
  Fingerprint, 
  CheckCircle2, 
  Database, 
  Bell, 
  Plus, 
  Search, 
  User, 
  Wallet, 
  Share2,
  FileText, 
  Check,
  Send,
  HelpCircle,
  Menu,
  Cloud,
  Mail,
  ChevronDown,
  ChevronRight,
  Printer,
  Shield,
  Palette,
  X,
  ShoppingCart,
  TrendingUp
} from 'lucide-react';

import { 
  Role, 
  InventoryItem, 
  Project, 
  Employee, 
  Transaction, 
  AttendanceLog, 
  CompanySetting, 
  AppNotification 
} from './types';

import { 
  getDBState, 
  saveCollection, 
  subscribeToDB,
  runDatabaseMigration,
  pushToFirestore,
  syncFromFirestore,
  startRealtimeSyncFromFirestore,
  stopRealtimeSync,
  isProductionHosting
} from './utils/database';
import { auth, googleSignIn, isFirebaseEnabled } from './utils/firebaseAuth';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

import { 
  sendWhatsAppNotification, 
  subscribeToWhatsAppAlerts 
} from './utils/whatsapp';

// Import our modularized ERP Section Components
import { MasterDataView } from './components/MasterDataView';
import { StockView } from './components/StockView';
import { PurchaseView } from './components/PurchaseView';
import { SalesView } from './components/SalesView';
import { FinanceView } from './components/FinanceView';
import { EsdmView } from './components/EsdmView';
import { AttendanceView } from './components/AttendanceView';
import { PrintPdfModal } from './components/PrintPdfModal';
import { RmrView } from './components/RmrView';

// Helper and Registry
import { getAvailableModules } from './modules/registry';

// Shared Integrations
import { BarcodeScanner } from './components/BarcodeScanner';
import { MobileDevice } from './components/MobileDevice';
import DriveIntegration from './components/DriveIntegration';
import GmailIntegration from './components/GmailIntegration';
import { HostingerSyncView } from './components/HostingerSyncView';
import { SettingsView } from './components/SettingsView';
import { BankModuleView } from './components/BankModuleView';
import { LoginOverlay } from './components/LoginOverlay';
import { RoleManagementView } from './components/RoleManagementView';
import { RoleGuard, checkPermission } from './components/RoleGuard';
import { SystemSettingsView } from './components/SystemSettingsView';
import { CrudTable } from './components/CrudTable';

export default function App() {
  const [currentUserRole, setCurrentUserRole] = useState<Role>('super_admin');
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState('dashboard');
  const [mobileSimulatorOpen, setMobileSimulatorOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('drive');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Helper
  const canView = (menuId: string) => checkPermission(currentUserRole, menuId, 'view', dbState);
  
  // Local Database State
  const [dbState, setDbState] = useState(getDBState());

  // Auto-switch Settings Tab if not authorized
  useEffect(() => {
    const list = ['drive', 'gmail', 'roles', 'system-settings', 'users', 'hostinger-sync'];
    const allowed = list.filter(t => {
      const permId = t === 'users' ? 'settings' : t;
      return checkPermission(currentUserRole, permId, 'view', dbState);
    });
    if (allowed.length > 0 && !allowed.includes(activeSettingsTab)) {
      setActiveSettingsTab(allowed[0]);
    }
  }, [currentUserRole, dbState, activeSettingsTab]);

  const handleMenuClick = (id: string) => {
    setActiveMenuId(id);
    setIsMobileMenuOpen(false);
  };

  // Firebase Auth & Cloud Firestore Sync States
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        console.log("Firebase User signed in, pulling cloud data...");
        setIsSyncingFirestore(true);
        try {
          await syncFromFirestore();
          // Muat listener realtime
          startRealtimeSyncFromFirestore();
        } catch (e) {
          console.warn("Auto-sync from Firestore aborted:", e);
        } finally {
          setIsSyncingFirestore(false);
        }
      } else {
        stopRealtimeSync();
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
      stopRealtimeSync();
    };
  }, []);

  // WhatsApp alerts list
  const [waPopups, setWaPopups] = useState<Array<{ id: number; phone: string; message: string; name: string }>>([]);
  const [appToast, setAppToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Print PDF Modal States
  const [pdfPrintOpen, setPdfPrintOpen] = useState(false);
  const [pdfPrintType, setPdfPrintType] = useState<'MaterialRequest' | 'PurchaseOrder' | 'PurchaseInvoice' | 'GoodsReceipt' | 'Survey' | 'Quotation' | 'InvoicePenjualan' | 'Payroll' | 'OpnamTukang'>('MaterialRequest');
  const [pdfPrintData, setPdfPrintData] = useState<any>(null);

  // Accordion Expand/Collapse States for Sidebar Groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    master: true,
    stock: false,
    purchase: false,
    sales: false,
    finance: false,
    esdm: false,
    system: true,
  });

  const availableModules = getAvailableModules(dbState, currentUserRole, checkPermission);
  const ActiveModuleObj = availableModules.find(m => m.id === activeMenuId);
  const ActiveComponent = ActiveModuleObj?.component;

  // Group modules
  const groupedModules = availableModules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = { title: mod.categoryTitle || '', items: [] };
    if (mod.categoryTitle) acc[mod.category].title = mod.categoryTitle;
    acc[mod.category].items.push(mod);
    return acc;
  }, {} as Record<string, { title: string, items: typeof availableModules }>);


  // Global UI & Branding Syncer
  useEffect(() => {
    if (dbState?.settings) {
      const { fontFamily, themeColor } = dbState.settings;
      
      if (fontFamily) {
        document.body.style.fontFamily = `"${fontFamily}", sans-serif`;
        let fontLink = document.getElementById('dynamic-font') as HTMLLinkElement;
        if (!fontLink) {
          fontLink = document.createElement('link');
          fontLink.id = 'dynamic-font';
          fontLink.rel = 'stylesheet';
          document.head.appendChild(fontLink);
        }
        fontLink.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700;800;900&display=swap`;
      }

      if (themeColor) {
        const themeMap: Record<string, any> = {
          emerald: { 50: '#ecfdf5', 100: '#d1fae5', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857' },
          rose: { 50: '#fff1f2', 100: '#ffe4e6', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
          blue: { 50: '#eff6ff', 100: '#dbeafe', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
          zinc: { 50: '#fafafa', 100: '#f4f4f5', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46' },
          slate: { 50: '#f8fafc', 100: '#f1f5f9', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155' }
        };
        const t = themeMap[themeColor];
        if (t) {
          let styleEl = document.getElementById('dynamic-theme') as HTMLStyleElement;
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-theme';
            document.head.appendChild(styleEl);
          }
          styleEl.innerHTML = `
            :root {
              --color-indigo-50: ${t[50]};
              --color-indigo-100: ${t[100]};
              --color-indigo-400: ${t[400]};
              --color-indigo-500: ${t[500]};
              --color-indigo-600: ${t[600]};
              --color-indigo-700: ${t[700]};
            }
          `;
        }
      }
    }
  }, [dbState?.settings]);

  // Sync state on DB changes
  useEffect(() => {
    const unsubscribe = subscribeToDB(() => {
      setDbState(getDBState());
    });
    return () => unsubscribe();
  }, []);

  // WhatsApp Alert Floating list synchronization
  useEffect(() => {
    let idCounter = 0;
    const unsubscribe = subscribeToWhatsAppAlerts((alert) => {
      const popupId = ++idCounter;
      setWaPopups(prev => [...prev, { id: popupId, ...alert }]);
      setTimeout(() => {
        setWaPopups(prev => prev.filter(p => p.id !== popupId));
      }, 7000);
    });
    return () => unsubscribe();
  }, []);

  // Synchronous State for Hostinger Cloud API Status
  const [hostingerSyncState, setHostingerSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  const triggerHostingerSync = async (isSilent = false) => {
    const stg = dbState.settings;
    const onHost = isProductionHosting();
    const isSyncEnabled = stg?.hostingerSyncEnabled || onHost;
    const apiUrl = stg?.hostingerApiUrl || (onHost ? './api.php' : '');

    // Skip testing or fetching relative paths on dev/preview sandbox to prevent non-JSON error
    if (apiUrl) {
      const isRelative = !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://');
      if (isRelative && !onHost) {
        return;
      }
    }

    if (isSyncEnabled && apiUrl) {
      if (!isSilent) setHostingerSyncState('syncing');
      try {
        const response = await fetch(`${apiUrl}?action=get_state`);
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || (contentType && !contentType.includes("application/json"))) {
          throw new Error("Returned content is not valid JSON");
        }
        const resText = await response.text();
        let resData: any = null;
        try {
          resData = JSON.parse(resText);
        } catch (jErr) {
          throw new Error("Response body is not a valid JSON string");
        }
        
        if (resData && resData.status === 'success') {
          const serverState = resData.data;

          // Simpan status pemuatan awal yang sukses
          localStorage.setItem('erp_has_pulled_hostinger', 'true');

          const isEmptyDB = !serverState || Object.keys(serverState).length === 0;

          if (isEmptyDB) {
            console.log("Database Hostinger kosong, mengunggah state local awal...");
            const currentState = getDBState();
            await fetch(`${apiUrl}?action=save_state`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(currentState)
            });
            if (!isSilent) {
              showToast("Inisialisasi database Hostinger sukses!", "success");
            }
            setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour12: false }));
            setHostingerSyncState('idle');
            return;
          }

          // Populate local states directly to mirror what is retrieved from Hostinger
          let localUpdatedAny = false;
          Object.keys(serverState).forEach((key) => {
            if (key in dbState) {
              const serverValStr = JSON.stringify(serverState[key]);
              const localValStr = localStorage.getItem(`erp_${key}`);
              
              if (serverValStr !== localValStr) {
                localStorage.setItem(`erp_${key}`, serverValStr);
                localUpdatedAny = true;
              }
            }
          });

          setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour12: false }));
          setHostingerSyncState('idle');

          if (localUpdatedAny) {
            setDbState(getDBState());
            if (!isSilent) {
              showToast("Berhasil mematangkan koneksi & memuat database Hostinger terbaru!", "success");
            }
          } else {
            if (!isSilent) {
              showToast("Koneksi Database Hostinger Terhubung: Sinkron", "success");
            }
          }
        } else {
          setHostingerSyncState('error');
        }
      } catch (e) {
        console.warn("Koneksi direct Hostinger gagal:", e);
        setHostingerSyncState('error');
      }
    }
  };

  // Membuka koneksi ke Hostinger saat startup & aktif kembali
  useEffect(() => {
    // 1. Ambil data database langsung saat pertama kali web dibuka
    const timer = setTimeout(() => {
      triggerHostingerSync(false);
    }, 1000);
    
    // 2. Refresh otomatis setiap 60 detik (lambat/aman saja agar menghemat baterai & resource)
    const intervalId = setInterval(() => {
      triggerHostingerSync(true);
    }, 60000);

    // 3. Ambil data terbaru kapan pun tab browser kembali aktif
    const handleFocus = () => {
      triggerHostingerSync(true);
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [dbState.settings?.hostingerSyncEnabled, dbState.settings?.hostingerApiUrl]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAppToast({ message, type });
    setTimeout(() => {
      setAppToast(null);
    }, 4000);
  };

  const handleLogin = (role: Role) => {
    setCurrentUserRole(role);
    setIsLoggedIn(true);
    setActiveMenuId('dashboard');
    showToast(`Masuk sebagai ${role.replace('_', ' ').toUpperCase()}`, 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    showToast('Berkeluar dari sistem ERP', 'info');
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyExpanded = prev[group];
      const next = {
        master: false,
        stock: false,
        purchase: false,
        sales: false,
        finance: false,
        esdm: false,
      };
      // Toggle only the clicked group
      next[group as keyof typeof next] = !isCurrentlyExpanded;
      return next;
    });
  };

  const handleOpenPrintPdf = (type: any, data: any) => {
    setPdfPrintType(type);
    setPdfPrintData(data);
    setPdfPrintOpen(true);
  };

  const handleSaveSettings = (stg: CompanySetting) => {
    saveCollection('settings', stg);
    showToast('Token Fonnte & setelan kantor berhasil diamankan.', 'success');
  };

  const triggerManualMigration = () => {
    const resultMsg = runDatabaseMigration(true); // force restore default seed values
    showToast(resultMsg, 'success');
  };

  const handleCloudPush = async () => {
    setIsSyncingFirestore(true);
    try {
      await pushToFirestore();
      showToast("Pencadangan Berhasil! Semua data lokal diunggah ke Firebase Cloud Firestore.", "success");
    } catch (e: any) {
      showToast(`Gagal mengunggah: ${e.message}`, "error");
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleCloudPull = async () => {
    let confirmed = false;
    try {
      confirmed = window.confirm("PERINGATAN: Mengunduh data dari Cloud Firestore akan menimpa seluruh data lokal browser saat ini. Lanjutkan?");
    } catch (e) {
      console.warn("Sandbox iframe confirm blocked, auto-confirming action.", e);
      confirmed = true;
    }
    if (!confirmed) return;
    setIsSyncingFirestore(true);
    try {
      const updated = await syncFromFirestore();
      if (updated) {
        showToast("Sinkronisasi Berhasil! Database diselaraskan dengan Cloud Firestore.", "success");
      } else {
        showToast("Database Anda sudah sinkron dengan Cloud Firestore (tidak ada perubahan baru).", "info");
      }
    } catch (e: any) {
      showToast(`Gagal mensinkronkan: ${e.message}`, "error");
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleFirebaseLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        showToast("Berhasil masuk dan terhubung dengan Google Firebase!", "success");
      } else {
        console.log("Login popup closed by user.");
      }
    } catch (e: any) {
      showToast(`Otorisasi gagal: ${e.message}`, "error");
    }
  };

  const formatIDR = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // Calculated Core Dashboard Metrics
  const totalProjectsNum = dbState.projects?.length || 0;
  const totalStockItems = dbState.inventory?.reduce((acc, i) => acc + i.stock, 0) || 0;
  const totalIncome = dbState.transactions?.filter(t => t.type === 'Pemasukan').reduce((acc, t) => acc + t.amount, 0) || 0;
  const totalExpense = dbState.transactions?.filter(t => t.type === 'Pengeluaran').reduce((acc, t) => acc + t.amount, 0) || 0;
  const netBalance = totalIncome - totalExpense;

  if (!isLoggedIn) {
    return <LoginOverlay onLogin={handleLogin} users={dbState.users} />;
  }

  // Detect isolated view mode
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isIsolatedAttendance = searchParams?.get('view') === 'attendance';

  if (isIsolatedAttendance) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans">
        <div className="max-w-6xl mx-auto">
          <AttendanceView 
            dbState={dbState} 
            saveCollection={saveCollection} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative pb-10">
      
      {/* Toast Alert Indicator */}
      {appToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-slate-950 border border-slate-800 text-slate-105 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3.5 text-xs font-semibold animate-bounce">
          <span className={`w-2.5 h-2.5 rounded-full ${appToast.type === 'success' ? 'bg-teal-400' : 'bg-blue-400'}`} />
          {appToast.message}
        </div>
      )}

      {/* FLOAT SIMULATED FONNTE WHATSAPP CONSOLE POPUP */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {waPopups.map((popup) => (
          <div key={popup.id} className="pointer-events-auto bg-slate-900/95 backdrop-blur border border-teal-500/30 text-white rounded-[20px] p-4 shadow-2xl animate-[slideIn_0.3s_ease-out] relative overflow-hidden">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-teal-900/40 mb-2.5">
              <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-xs">WA</span>
              <div>
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  WhatsApp Gateway (Fonnte API)
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div className="text-[9px] text-slate-450 font-mono">Ke: +{popup.phone} ({popup.name})</div>
              </div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl text-[10.5px] font-mono whitespace-pre-wrap leading-relaxed text-emerald-200 border border-slate-850">
              {popup.message}
            </div>
            <div className="text-[9px] text-slate-500 font-sans mt-2 flex justify-between">
              <span>Automatic Event Delivery</span>
              <span>Baru saja</span>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN ERP HEADER BANNER */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white py-4 px-6 sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {dbState.settings?.logoUrl ? (
              <img src={dbState.settings.logoUrl} className="w-10 h-10 rounded-xl object-contain bg-white/10 p-0.5" alt="Logo" />
            ) : (
              <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-900/40">
                {dbState.settings?.companyName?.charAt(0).toUpperCase() || 'D'}
              </span>
            )}
            <div className="hidden lg:block">
              <h1 className="text-sm tracking-tight text-white flex items-center gap-1.5 flex-wrap font-bold  font-sans tracking-tight capitalize">
                {dbState.settings?.companyName || 'Dutasari ERP Core'}
                <span className="bg-indigo-600 text-white text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  ERP v2.4
                </span>
                 {dbState.settings?.hostingerSyncEnabled && (
                  <button 
                    onClick={() => triggerHostingerSync(false)}
                    className={`text-[9px] font-sans px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 border transition-all cursor-pointer hover:bg-white/5 active:scale-95 ${
                      hostingerSyncState === 'syncing' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                      hostingerSyncState === 'error' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-extrabold animate-pulse' :
                      'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                    }`} 
                    title={hostingerSyncState === 'error' ? "Gagal terhubung ke Hostinger. Klik untuk mencoba lagi." : "Sistem terhubung real-time dengan aplikasi pusat. Klik untuk Sinkron Sekarang!"}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      hostingerSyncState === 'syncing' ? 'bg-indigo-400 animate-spin border border-t-transparent border-indigo-200' :
                      hostingerSyncState === 'error' ? 'bg-rose-400' :
                      'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    }`} />
                    {hostingerSyncState === 'syncing' ? 'MENGHUBUNGKAN...' : 
                     hostingerSyncState === 'error' ? 'KONEKSI TERPUTUS' : 'DATABASE HOSTINGER: AKTIF'}
                    {lastSyncedTime && hostingerSyncState !== 'error' && (
                      <span className="text-[8px] text-emerald-300/80 font-mono font-medium ml-0.5">({lastSyncedTime})</span>
                    )}
                  </button>
                )}
              </h1>
              <p className="text-[10px] text-slate-400 font-sans tracking-wide">
                {dbState.settings?.companyTagline || 'Luxe Smart Connected Furniture Architecture'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/?view=attendance"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-slate-700 transition-all flex items-center justify-center shadow-lg hover:shadow-indigo-500/10"
              title="Buka Panel Absensi Biometrik"
            >
              <Fingerprint className="w-5 h-5" />
            </a>

            <button
              onClick={() => setMobileSimulatorOpen(!mobileSimulatorOpen)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-sans flex items-center gap-1.5 transition-colors cursor-pointer ${mobileSimulatorOpen ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {mobileSimulatorOpen ? 'Sembunyikan HP Karyawan' : 'Tampilkan HP Karyawan'}
            </button>

            <div className="hidden md:flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
              <span className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-[9px] font-bold font-mono">
                {currentUserRole.substring(0, 2).toUpperCase()}
              </span>
              <div className="text-left leading-none pr-1">
                <div className="text-[10px] font-mono uppercase text-slate-300 font-extrabold">{currentUserRole.replace('_', ' ')}</div>
                <span className="text-[8px] text-slate-500">Sesi ERP Terbuka</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl border border-slate-700 text-slate-400 transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* BODY COLUMN MATRIX */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-[55] bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR ACCODION MENU */}
        <aside className={`${isMobileMenuOpen ? 'fixed inset-y-0 left-0 w-72 z-[60] overflow-y-auto block rounded-r-3xl rounded-l-none shadow-2xl bg-white/95' : 'hidden md:hidden lg:block'} ${isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} lg:static lg:w-auto lg:bg-white/70 backdrop-blur-md border border-slate-200/60 lg:rounded-3xl p-5 lg:shadow-sm space-y-5 lg:self-start lg:sticky lg:top-24 max-w-[80vw] pb-32 transition-all duration-300`}>
          
          <div className="flex items-center justify-between px-2">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Panel Kontrol ERP</span>
                <span className="text-[9px] bg-emerald-50 text-emerald-600 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-100 animate-pulse">LIVE</span>
              </div>
            )}
            <button 
              className="p-1 px-2 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors border-none flex items-center justify-center ml-auto" 
              onClick={() => isMobileMenuOpen ? setIsMobileMenuOpen(false) : setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
               {isSidebarCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-3 mt-4">
            {/* Top items (main) */}
            {groupedModules['main']?.items.map(mod => (
              <button
                key={mod.id}
                onClick={() => handleMenuClick(mod.id)}
                className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3.5 transition-all duration-200 cursor-pointer ${activeMenuId === mod.id ? 'bg-slate-900 text-white font-semibold shadow-md shadow-slate-900/10' : 'text-slate-600 hover:bg-indigo-50/80 hover:text-indigo-700 font-semibold'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={isSidebarCollapsed ? mod.title : ''}
              >
                <div className="shrink-0">{mod.icon}</div>
                {!isSidebarCollapsed && <span className="text-sm font-semibold truncate animate-in slide-in-from-left-2 duration-300">{mod.title}</span>}
              </button>
            ))}

            {/* Accordion Categories */}
            {['master', 'stock', 'purchase', 'sales', 'finance', 'esdm'].map(cat => {
              const group = groupedModules[cat];
              if (!group || group.items.length === 0) return null;
              const isExpanded = expandedGroups[cat] && !isSidebarCollapsed;
              
              const categoryIcons: Record<string, any> = {
                master: <Database className="w-5 h-5 shrink-0" />,
                stock: <Package className="w-5 h-5 shrink-0" />,
                purchase: <ShoppingCart className="w-5 h-5 shrink-0" />,
                sales: <TrendingUp className="w-5 h-5 shrink-0" />,
                finance: <Wallet className="w-5 h-5 shrink-0" />,
                esdm: <Users className="w-5 h-5 shrink-0" />,
              };
              
              return (
                <div key={cat} className="space-y-1">
                  <button
                    onClick={() => isSidebarCollapsed ? setIsSidebarCollapsed(false) : toggleGroup(cat)}
                    className={`w-full flex items-center justify-between p-2.5 px-3 rounded-xl text-left text-[10px] font-semibold uppercase tracking-widest cursor-pointer font-sans transition-all duration-200 ${isExpanded ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-indigo-50/70 hover:text-indigo-700'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    title={isSidebarCollapsed ? group.title : ''}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className={isExpanded ? 'text-indigo-500' : 'text-slate-400'}>
                        {categoryIcons[cat]}
                      </span>
                      {!isSidebarCollapsed && <span className="animate-in slide-in-from-left-2 duration-300">{group.title}</span>}
                    </div>
                    {!isSidebarCollapsed && (
                      isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && !isSidebarCollapsed && (
                    <div className="pl-3.5 space-y-1 border-l border-slate-100 mt-1 animate-in slide-in-from-top-1 duration-300">
                      {group.items.map(mod => (
                        <button 
                          key={mod.id}
                          onClick={() => handleMenuClick(mod.id)} 
                          className={`w-full py-2 px-3 text-left rounded-xl font-semibold text-[13px] flex items-center gap-2.5 cursor-pointer transition-all ${activeMenuId === mod.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'}`}
                        >
                          {mod.icon ? (
                            <span className={`transition-colors shrink-0 ${activeMenuId === mod.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {mod.icon}
                            </span>
                          ) : (
                            <span className={`w-1.5 h-1.5 ${mod.iconColor || 'bg-slate-500'} rounded-full shrink-0`} />
                          )}
                          <span className="truncate">{mod.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

             {/* Top-level system settings */}
            {groupedModules['system']?.items.length > 0 && (
              <div className={`pt-4 border-t border-slate-100 space-y-1 mt-6 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                {groupedModules['system'].items.map(mod => {
                  if (mod.id === 'settings') {
                    const settingSubTabs = [
                      { id: 'drive', title: 'Google Drive Blueprint', icon: <Cloud className="w-3.5 h-3.5" /> },
                      { id: 'gmail', title: 'Komunikasi Email', icon: <Mail className="w-3.5 h-3.5" /> },
                      { id: 'roles', title: 'Pengaturan Akses Jabatan', icon: <Shield className="w-3.5 h-3.5" /> },
                      { id: 'system-settings', title: 'Pengaturan Aplikasi', icon: <Palette className="w-3.5 h-3.5" /> },
                      { id: 'users', title: 'Manajemen Pengguna', icon: <Settings className="w-3.5 h-3.5" /> },
                      { id: 'hostinger-sync', title: 'Database Hostinger Cloud', icon: <Database className="w-3.5 h-3.5" /> },
                    ];

                    const allowedSubTabs = settingSubTabs.filter(tab => {
                      const permId = tab.id === 'users' ? 'settings' : tab.id;
                      return checkPermission(currentUserRole, permId, 'view', dbState);
                    });

                    return (
                      <div key={mod.id} className="space-y-1 w-full">
                        <button
                          onClick={() => {
                            handleMenuClick(mod.id);
                            setIsSettingsExpanded(!isSettingsExpanded);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                            activeMenuId === mod.id && !isSettingsExpanded
                              ? 'bg-slate-900 text-white font-semibold shadow-md'
                              : activeMenuId === mod.id
                              ? 'bg-slate-900 text-white font-semibold shadow-md shadow-slate-900/10'
                              : 'text-slate-600 hover:bg-indigo-50/80 hover:text-indigo-700 font-semibold'
                          } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                          title={isSidebarCollapsed ? mod.title : ''}
                        >
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">{mod.icon}</div>
                            {!isSidebarCollapsed && (
                              <span className="text-sm font-semibold truncate animate-in slide-in-from-left-2 duration-300">
                                {mod.title}
                              </span>
                            )}
                          </div>
                          {!isSidebarCollapsed && (
                            isSettingsExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-450 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                          )}
                        </button>
                        
                        {!isSidebarCollapsed && isSettingsExpanded && (
                          <div className="pl-3.5 space-y-1 border-l border-slate-100 mt-1 animate-in slide-in-from-top-1 duration-300">
                            {allowedSubTabs.map(tab => {
                              const isSubActive = activeMenuId === 'settings' && activeSettingsTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  onClick={() => {
                                    setActiveSettingsTab(tab.id);
                                    setActiveMenuId('settings');
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className={`w-full py-2 px-3 text-left rounded-xl font-semibold text-[13px] flex items-center gap-2.5 cursor-pointer transition-all ${
                                    isSubActive
                                      ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                                  }`}
                                >
                                  <span className={`transition-colors shrink-0 ${isSubActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {tab.icon}
                                  </span>
                                  <span className="truncate">{tab.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={mod.id}
                      onClick={() => handleMenuClick(mod.id)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 cursor-pointer ${activeMenuId === mod.id ? 'bg-slate-900 text-white font-semibold shadow-md shadow-slate-900/10' : 'text-slate-600 hover:bg-indigo-50/80 hover:text-indigo-700 font-semibold'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                      title={isSidebarCollapsed ? mod.title : ''}
                    >
                      <div className="shrink-0">{mod.icon}</div>
                      {!isSidebarCollapsed && <span className="text-sm font-semibold truncate animate-in slide-in-from-left-2 duration-300">{mod.title}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* COMPONENT BODY AREA ZONE */}
        <main className={`transition-all h-full flex flex-col min-w-0 max-w-full overflow-hidden ${
          mobileSimulatorOpen ? (isSidebarCollapsed ? 'lg:col-span-8' : 'lg:col-span-6') : (isSidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9')
        }`}>
           {ActiveComponent ? (
             <ActiveComponent 
               dbState={dbState}
               saveCollection={saveCollection}
               showToast={showToast}
               currentUserRole={currentUserRole}
               activeMenuId={activeMenuId}
               setActiveMenuId={setActiveMenuId}
               triggerPdfPrint={(type, data) => handleOpenPrintPdf(type, data)}
               triggerHostingerSync={() => triggerHostingerSync(false)}
               triggerManualMigration={triggerManualMigration}
               handleFirebaseLogin={handleFirebaseLogin}
               handleCloudPull={handleCloudPull}
               handleCloudPush={handleCloudPush}
               firebaseUser={firebaseUser}
               isSyncingFirestore={isSyncingFirestore}
               activeSettingsTab={activeSettingsTab}
               onActiveSettingsTabChange={setActiveSettingsTab}
             />
           ) : (
             <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
                <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight capitalize">Akses Ditolak / Modul Tidak Ditemukan</h2>
                <p className="text-slate-500 text-xs mt-2">Maaf, Anda tidak memiliki izin untuk melihat modul ini, atau modul belum dipasang.</p>
             </div>
           )}
        </main>

        {/* MOBILE DEVICE SIMULATOR IN THE MIDDLE COLUMN */}
        {mobileSimulatorOpen && (
          <aside className="lg:col-span-3">
            <MobileDevice />
          </aside>
        )}

      </div>

      {/* PRINT PDF GENERATOR MODAL VIEW */}
      <PrintPdfModal 
        isOpen={pdfPrintOpen} 
        onClose={() => setPdfPrintOpen(false)} 
        type={pdfPrintType} 
        data={pdfPrintData} 
        settings={dbState.settings}
      />

    </div>
  );
}
