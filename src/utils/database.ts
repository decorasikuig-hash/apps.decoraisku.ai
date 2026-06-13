/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  DBState,
  InventoryItem, 
  Project, 
  Employee, 
  Transaction, 
  CompanySetting, 
  AttendanceLog,
  AppNotification,
  InventoryCategory,
  InventoryWarehouse
} from '../types';

import {
  INITIAL_INVENTORY,
  INITIAL_PROJECTS,
  INITIAL_EMPLOYEES,
  INITIAL_TRANSACTIONS
} from '../data/menus';

export const INITIAL_CATEGORIES: InventoryCategory[] = [
  { id: 'cat-1', name: 'Premium Wood', description: 'Kayu jati solid harris & olahan panel interior kustom' },
  { id: 'cat-2', name: 'Wallpaper HPL', description: 'Lapisan finishing membran, pvc sheet, dan taco hpl premium' },
  { id: 'cat-3', name: 'Sofa & Fabric', description: 'Kain beludru, katun kanvas, and kulit sintetis upholstery furniture' },
  { id: 'cat-4', name: 'Lighting Fitting', description: 'Fitting lampu led strip gantung, downlight, & saklar kustom' },
  { id: 'cat-5', name: 'Paku & Logam', description: 'Angkur, sekrup drywall, engsel hidrolik kabinet, and dyna-bolt' }
];

export const INITIAL_WAREHOUSES: InventoryWarehouse[] = [
  { 
    id: 'wh-1', 
    name: 'Gudang Utama Kayu Kemang', 
    location: 'Jl. Kemang Raya No. 45B, Mampang Prapatan, Jakarta Selatan', 
    photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=60',
    description: 'Depo kayu jati gelondongan, solid wood panel, oven pengering' 
  },
  { 
    id: 'wh-2', 
    name: 'Gudang Aksesoris Margonda', 
    location: 'Jl. Margonda Raya No. 12, Beji, Kota Depok', 
    photoUrl: 'https://images.unsplash.com/photo-1553413530-5b42938f08a4?w=500&auto=format&fit=crop&q=60',
    description: 'Pusat penyimpanan hpl, lem mabel, fittings edging, aksesoris tarikan kabinet' 
  },
  { 
    id: 'wh-3', 
    name: 'Workshop Perakitan Cikarang', 
    location: 'Kawasan Industri Jababeka Tahap II, Cikarang, Bekasi', 
    photoUrl: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=60',
    description: 'Bengkel manufaktur mebel mentah, pengerjaan cat duco & semprot PU' 
  }
];

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  getDocFromServer,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, isFirebaseEnabled } from './firebaseAuth';

export type { DBState };

export const isProductionHosting = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Always consider as hosting if not localhost/127.0.0.1/AI Studio environments
  return hostname !== 'localhost' && 
         hostname !== '127.0.0.1' &&
         !hostname.includes('ais-dev-') &&
         !hostname.includes('ais-pre-') &&
         !hostname.includes('.run.app');
};

const CURRENT_DB_VERSION = 3;

// Global events listener system to trigger re-renders across components
type DBListener = () => void;
const listeners: Set<DBListener> = new Set();

export const subscribeToDB = (listener: DBListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

// Seed Notification
const getInitialNotifications = (): AppNotification[] => [
  {
    id: 'notif-1',
    title: 'Sistem Terbuka',
    message: 'ERP Interior Design siap digunakan. Database versi 3.0 diaktifkan otomatis.',
    timestamp: new Date().toISOString(),
    type: 'success',
    whatsappSent: false,
  }
];

export const getInitialSettings = (): CompanySetting => {
  const onHost = isProductionHosting();
  return {
    fonnteToken: 'FONNTE_DEMO_TOKEN_12345ABCDE',
    biometricEnabled: true,
    companyName: 'LuxeLiving Interior & Built-in',
    companyTagline: 'Luxe Smart Connected Furniture Architecture',
    companyAddress: 'Jl. Kemang Raya No. 45B, Mampang Prapatan, Jakarta Selatan',
    autoDatabaseMigration: true,
    dbVersion: CURRENT_DB_VERSION,
    hostingerSyncEnabled: true, // Always allow sync
    hostingerApiUrl: onHost ? './api.php' : '', // Default to local api on host
    hostingerAutoPush: true,
    // New customizable WhatsApp details defaults
    whatsappAutoProject: true,
    whatsappTemplateProjectNew: 'Selamat! Proyek interior baru Anda *{project_name}* di lokasi *{project_location}* telah resmi didaftarkan sistem. Mengawali pengerjaan *{project_status}*.',
    whatsappTemplateProjectUpdate: 'Kabar terbaru! Proyek interior Anda *{project_name}* resmi diupdate oleh pimpinan lapangan ke status: *{project_status}*. Terima kasih atas kepercayaan Anda!',
    whatsappAutoOrder: true,
    whatsappTemplateOrderSales: 'Yth. Ibu/Bapak *{client_name}*, kami telah membukukan pembayaran termin senilai *{order_amount}* dengan Faktur Tagihan *{order_code}*. Sisa Pelunasan: *{order_remains}*.',
    whatsappTemplateOrderPurchase: 'NOTIFIKASI PO: Berkas pesanan baru dengan Kode PO *{order_code}* telah diterbitkan untuk *{supplier_name}* senilai *{order_amount}* pada *{order_date}* silakan segera diproses.',
    whatsappAutoTask: true,
    whatsappTemplateTaskLoan: 'NOTIFIKASI GUDANG: Peminjaman Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dipinjam Oleh: {employee_name}, Untuk Proyek: {project_name}, Jam Pinjam: {task_date}. Mohon gunakan alat sesuai SOP.',
    whatsappTemplateTaskReturn: 'NOTIFIKASI GUDANG: Pengembalian Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dikembalikan Oleh: {employee_name}, Kondisi Akhir Alat: [{task_status}]. Terima kasih.',
    reportStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    reportEndDate: new Date().toISOString().split('T')[0]
  };
};

/**
 * Perform automatic data structure checks and seed if needed (database migration otomatis)
 */
export const runDatabaseMigration = (forceReset = false): string => {
  const onHost = isProductionHosting();
  
  // Anti-Wipe Security for Hosting
  if (onHost && localStorage.getItem('erp_db_version')) {
     const savedSettings = localStorage.getItem('erp_settings');
     if (savedSettings) {
        console.log("Hosting env detected with existing data. Migration will be non-destructive.");
        // We only bump version but keep existing data
        localStorage.setItem('erp_db_version', CURRENT_DB_VERSION.toString());
        return `Sistem diperbarui ke v${CURRENT_DB_VERSION}. Data Anda tetap aman.`;
     }
  }

  if (forceReset && onHost) {
    console.warn("Force database reset is blocked on production hosting for safety.");
    return "Keamanan Hosting: Penghapusan atau Reset database dibatasi untuk melindung data asli.";
  }

  const storedVersion = localStorage.getItem('erp_db_version');
  const currentVer = Number(storedVersion);

  if (forceReset || !storedVersion || currentVer < CURRENT_DB_VERSION) {
    const isUpdate = storedVersion && currentVer < CURRENT_DB_VERSION;
    
    // Backup existing to prevent loss during update
    const getBackup = (key: string) => {
       try {
          return JSON.parse(localStorage.getItem(`erp_${key}`) || 'null');
       } catch { return null; }
    };

    const oldInventory = getBackup('inventory') || [];
    const oldEmployees = getBackup('employees') || [];
    const oldSettings = getBackup('settings');
    const oldProjects = getBackup('projects') || [];
    const oldRoles = getBackup('roles') || [];
    const oldUsers = getBackup('users') || [];

    // Seeding logic
    localStorage.setItem('erp_db_version', CURRENT_DB_VERSION.toString());
    
    // If it's an update, preserve essential data even if seed arrays were empty in code
    if (isUpdate && !forceReset) {
       if (oldSettings) localStorage.setItem('erp_settings', JSON.stringify(oldSettings));
       if (oldRoles.length) localStorage.setItem('erp_roles', JSON.stringify(oldRoles));
       if (oldUsers.length) localStorage.setItem('erp_users', JSON.stringify(oldUsers));
       if (oldEmployees.length) localStorage.setItem('erp_employees', JSON.stringify(oldEmployees));
       if (oldInventory.length) localStorage.setItem('erp_inventory', JSON.stringify(oldInventory));
       if (oldProjects.length) localStorage.setItem('erp_projects', JSON.stringify(oldProjects));
    } else if (!storedVersion) {
       // First time setup - clean slate
       localStorage.setItem('erp_inventory', JSON.stringify([]));
       localStorage.setItem('erp_projects', JSON.stringify([]));
       localStorage.setItem('erp_employees', JSON.stringify([]));
       localStorage.setItem('erp_transactions', JSON.stringify([]));
       localStorage.setItem('erp_settings', JSON.stringify(getInitialSettings()));
       localStorage.setItem('erp_attendance', JSON.stringify([]));
       localStorage.setItem('erp_notifications', JSON.stringify(getInitialNotifications()));
       localStorage.setItem('erp_users', JSON.stringify([
         { uid: 'u1', email: 'admin@decorasiku.com', password: 'admin', role: 'super_admin' }
       ]));
    }

    notifyListeners();
    return `Sistem CRM/ERP Interior Design v${CURRENT_DB_VERSION} Siap.`;
  }

  // Double check that all keys exist to prevent runtime crashes
  const requiredKeys = [
    'erp_inventory', 'erp_projects', 'erp_employees', 'erp_transactions', 'erp_settings', 'erp_attendance', 'erp_notifications',
    'erp_customers', 'erp_suppliers', 'erp_vehicles', 'erp_equipments', 'erp_toolLoans',
    'erp_materialRequests', 'erp_purchaseOrders', 'erp_purchaseInvoices', 'erp_goodsReceipts', 
    'erp_surveys', 'erp_quotations', 'erp_salesInvoices', 'erp_salaries', 'erp_cashAdvances', 'erp_craftsmanReports',
    'erp_bank_accounts', 'erp_bank_mutations', 'erp_users', 'erp_roles', 'erp_categories', 'erp_warehouses', 'erp_stockLedgers', 'erp_catalogProducts'
  ];
  let keysFixed = false;
  requiredKeys.forEach(key => {
    if (!localStorage.getItem(key)) {
      keysFixed = true;
      if (key === 'erp_settings') localStorage.setItem(key, JSON.stringify(getInitialSettings()));
      else if (key === 'erp_notifications') localStorage.setItem(key, JSON.stringify(getInitialNotifications()));
      else if (key === 'erp_users') localStorage.setItem(key, JSON.stringify([{ uid: 'u1', email: 'admin@decorasiku.com', password: 'admin', role: 'super_admin' }]));
      else localStorage.setItem(key, JSON.stringify([]));
    }
  });

  if (keysFixed) {
    notifyListeners();
    return 'Beberapa kunci database kosong berhasil diperbaiki dan di-seeding ulang.';
  }

  return 'Database berjalan dengan performa penuh, skema sesuai.';
};

// Run on import to ensure DB is initialized immediately
runDatabaseMigration(false);

/**
 * Read Entire DB State
 */
export const getDBState = (): DBState => {
  const tryParse = (key: string, defaultValue: string = '[]') => {
    try {
      const val = localStorage.getItem(key);
      if (!val || val === 'null') return JSON.parse(defaultValue);
      const parsed = JSON.parse(val);
      return parsed || JSON.parse(defaultValue);
    } catch {
      return JSON.parse(defaultValue);
    }
  };

  try {
    const rawSettings = localStorage.getItem('erp_settings');
    let settings: CompanySetting;
    if (rawSettings && rawSettings !== 'null') {
      settings = JSON.parse(rawSettings) as CompanySetting;
      if (!settings) {
         settings = getInitialSettings();
      } else {
        // Hybrid Upgrade Check: configure Hostinger sync defaults on production hosting
        let changed = false;
        const onHost = isProductionHosting();
        if (onHost) {
          if (!settings.hostingerSyncEnabled) {
            settings.hostingerSyncEnabled = true;
            settings.hostingerAutoPush = true;
            if (!settings.hostingerApiUrl) {
              settings.hostingerApiUrl = './api.php';
            }
            changed = true;
          }
        } else {
          // Keep local preferences or disable by default
          if (settings.hostingerSyncEnabled !== false) {
            settings.hostingerSyncEnabled = false;
            settings.hostingerAutoPush = false;
            changed = true;
          }
        }
        if (settings.whatsappAutoProject === undefined) {
          settings.whatsappAutoProject = true;
          settings.whatsappTemplateProjectNew = 'Selamat! Proyek interior baru Anda *{project_name}* di lokasi *{project_location}* telah resmi didaftarkan sistem. Mengawali pengerjaan *{project_status}*.';
          settings.whatsappTemplateProjectUpdate = 'Kabar terbaru! Proyek interior Anda *{project_name}* resmi diupdate oleh pimpinan lapangan ke status: *{project_status}*. Terima kasih atas kepercayaan Anda!';
          changed = true;
        }
        if (settings.whatsappAutoOrder === undefined) {
          settings.whatsappAutoOrder = true;
          settings.whatsappTemplateOrderSales = 'Yth. Ibu/Bapak *{client_name}*, kami telah membukukan pembayaran termin senilai *{order_amount}* dengan Faktur Tagihan *{order_code}*. Sisa Pelunasan: *{order_remains}*.';
          settings.whatsappTemplateOrderPurchase = 'NOTIFIKASI PO: Berkas pesanan baru dengan Kode PO *{order_code}* telah diterbitkan untuk *{supplier_name}* senilai *{order_amount}* pada *{order_date}* silakan segera diproses.';
          changed = true;
        }
        if (settings.whatsappAutoTask === undefined) {
          settings.whatsappAutoTask = true;
          settings.whatsappTemplateTaskLoan = 'NOTIFIKASI GUDANG: Peminjaman Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dipinjam Oleh: {employee_name}, Untuk Project: {project_name}, Jam Pinjam: {task_date}. Mohon gunakan alat sesuai SOP.';
          settings.whatsappTemplateTaskReturn = 'NOTIFIKASI GUDANG: Pengembalian Alat Sukses! Kode: {task_code}, Alat: {task_name}, Dikembalikan Oleh: {employee_name}, Kondisi Akhir Alat: [{task_status}]. Terima kasih.';
          changed = true;
        }
        if (changed) {
          localStorage.setItem('erp_settings', JSON.stringify(settings));
        }
      }
    } else {
      settings = getInitialSettings();
      localStorage.setItem('erp_settings', JSON.stringify(settings));
    }

    return {
      inventory: tryParse('erp_inventory'),
      projects: tryParse('erp_projects'),
      employees: tryParse('erp_employees'),
      transactions: tryParse('erp_transactions'),
      attendance: tryParse('erp_attendance'),
      settings: settings,
      notifications: tryParse('erp_notifications'),
      dbVersion: Number(localStorage.getItem('erp_db_version') || CURRENT_DB_VERSION),
      customers: tryParse('erp_customers'),
      suppliers: tryParse('erp_suppliers'),
      vehicles: tryParse('erp_vehicles'),
      equipments: tryParse('erp_equipments'),
      toolLoans: tryParse('erp_toolLoans'),
      materialRequests: tryParse('erp_materialRequests'),
      purchaseOrders: tryParse('erp_purchaseOrders'),
      purchaseInvoices: tryParse('erp_purchaseInvoices'),
      goodsReceipts: tryParse('erp_goodsReceipts'),
      surveys: tryParse('erp_surveys'),
      quotations: tryParse('erp_quotations'),
      salesInvoices: tryParse('erp_salesInvoices'),
      salaries: tryParse('erp_salaries'),
      cashAdvances: tryParse('erp_cashAdvances'),
      craftsmanReports: tryParse('erp_craftsmanReports'),
      bank_accounts: tryParse('erp_bank_accounts'),
      bank_mutations: tryParse('erp_bank_mutations'),
      weeklyPayrolls: tryParse('erp_weeklyPayrolls'),
      users: tryParse('erp_users'),
      roles: tryParse('erp_roles'),
      categories: tryParse('erp_categories'),
      warehouses: tryParse('erp_warehouses'),
      stockLedgers: tryParse('erp_stockLedgers'),
      catalogProducts: tryParse('erp_catalogProducts'),
      customUnits: tryParse('erp_customUnits'),
    };
  } catch (e) {
    console.error("Failed to parse ERP DB state", e);
    runDatabaseMigration(true);
    return getDBState();
  }
};

/**
 * CRUD functions
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  if (!isFirebaseEnabled) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Koneksi Firestore terverifikasi.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Aplikasi berjalan offline. Menunggu koneksi Firestore kembali aktif.");
    }
  }
}

// Automatically test connection
testConnection();

export const saveCollection = <K extends keyof DBState>(key: K, data: DBState[K]) => {
  const prevDataRaw = localStorage.getItem(`erp_${key}`);
  localStorage.setItem(`erp_${key}`, JSON.stringify(data));
  notifyListeners();

  // Track local deletions to prevent background sync from resurrecting them
  if (Array.isArray(data)) {
    // 1. Detect and register deleted items
    if (prevDataRaw) {
      try {
        const prevData = JSON.parse(prevDataRaw);
        if (Array.isArray(prevData)) {
          const deletedKeys: string[] = [];
          prevData.forEach((prevItem: any) => {
            if (prevItem) {
              const pKey = prevItem.id || prevItem.uid || prevItem.code || prevItem.plateNumber || '';
              if (pKey && !data.some((newItem: any) => {
                const nKey = newItem?.id || newItem?.uid || newItem?.code || newItem?.plateNumber || '';
                return nKey === pKey;
              })) {
                deletedKeys.push(pKey);
              }
            }
          });

          if (deletedKeys.length > 0) {
            const deletedStorageKey = `erp_deleted_keys_${key}`;
            const currentDeletedRaw = localStorage.getItem(deletedStorageKey) || '[]';
            let currentDeleted: string[] = [];
            try {
              currentDeleted = JSON.parse(currentDeletedRaw);
              if (!Array.isArray(currentDeleted)) currentDeleted = [];
            } catch (e) {
              currentDeleted = [];
            }
            const updatedDeleted = Array.from(new Set([...currentDeleted, ...deletedKeys]));
            localStorage.setItem(deletedStorageKey, JSON.stringify(updatedDeleted));
          }
        }
      } catch (e) {
        console.error("Gagal mendeteksi penghapusan untuk sync:", e);
      }
    }

    // 2. Clean up any tombstone keys that are currently active
    const deletedStorageKey = `erp_deleted_keys_${key}`;
    const currentDeletedRaw = localStorage.getItem(deletedStorageKey);
    if (currentDeletedRaw) {
      try {
        const currentDeleted = JSON.parse(currentDeletedRaw);
        if (Array.isArray(currentDeleted) && currentDeleted.length > 0) {
          const activeKeys = new Set(data.map((item: any) => item?.id || item?.uid || item?.code || item?.plateNumber || ''));
          const remainingDeleted = currentDeleted.filter(k => k && !activeKeys.has(k));
          if (remainingDeleted.length !== currentDeleted.length) {
            localStorage.setItem(deletedStorageKey, JSON.stringify(remainingDeleted));
          }
        }
      } catch (e) {}
    }
  }

  // 1. Firebase Firestore Sync - disabled if running directly on Hostinger database as requested
  const settingsStrTemp = localStorage.getItem('erp_settings');
  let hostingerEnabledTemp = false;
  try {
    if (settingsStrTemp) {
      const s = JSON.parse(settingsStrTemp);
      if (s?.hostingerSyncEnabled) hostingerEnabledTemp = true;
    }
  } catch (e) {}

  if (isFirebaseEnabled && !isProductionHosting() && !hostingerEnabledTemp) {
    try {
      if (auth.currentUser) {
        if (key === 'settings') {
          const settingDocRef = doc(db, 'settings', 'config');
          setDoc(settingDocRef, data as any).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, 'settings/config');
          });
        } else if (key === 'customUnits') {
          const docRef = doc(db, 'customUnits', 'all');
          setDoc(docRef, { list: data }).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, 'customUnits/all');
          });
        } else if (Array.isArray(data)) {
          const getItemId = (item: any) => {
            if (!item) return '';
            return item.id || item.uid || item.code || item.plateNumber || '';
          };

          // Find deleted items to remove from Firestore. 
          if (prevDataRaw) {
            try {
              const prevData = JSON.parse(prevDataRaw);
              if (Array.isArray(prevData)) {
                const deletedItems = prevData.filter((prevItem: any) => {
                  const prevId = getItemId(prevItem);
                  return prevId && !data.some((newItem: any) => getItemId(newItem) === prevId);
                });
                deletedItems.forEach((deletedItem: any) => {
                  const delId = getItemId(deletedItem);
                  const itemDocRef = doc(db, key, delId);
                  deleteDoc(itemDocRef).catch((err) => {
                    console.warn(`Gagal menghapus dokumen di Firestore:`, err);
                  });
                });
              }
            } catch (pe) {
              console.error("Failed to compare for Firestore deletions", pe);
            }
          }

          data.forEach((item: any) => {
            if (item && typeof item === 'object') {
              const itemId = getItemId(item);
              if (itemId) {
                const itemDocRef = doc(db, key, itemId);
                setDoc(itemDocRef, item).catch((err) => {
                  console.warn(`Gagal menyimpan dokumen ${key}/${itemId} ke Firestore:`, err);
                });
              }
            }
          });
        }
      }
    } catch (fsErr) {
      console.warn("Gagal sinkron Firestore latar belakang:", fsErr);
    }
  }

  // 2. Hostinger Auto Push Background Sync
  const settingsStr = localStorage.getItem('erp_settings');
  if (settingsStr) {
    try {
      const settingsObj = JSON.parse(settingsStr);
      const hostingerUrl = settingsObj?.hostingerApiUrl || (isProductionHosting() ? './api.php' : '');
      const isSyncEnabled = settingsObj?.hostingerSyncEnabled || isProductionHosting();
      const isAutoPush = settingsObj?.hostingerAutoPush !== false;

      if (isSyncEnabled && isAutoPush && hostingerUrl) {
        fetch(`${hostingerUrl}?action=save_collection&key=${key}&overwrite=1`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(err => {
          console.warn("Hostinger auto-push error:", err);
        });
      }
    } catch (e) {
      console.warn("Hostinger auto-push trigger error:", e);
    }
  }
};

export const createNotification = (title: string, message: string, type: AppNotification['type'] = 'info', whatsappSent = false, whatsappMsg?: string) => {
  const current = getDBState().notifications;
  const newNotif: AppNotification = {
    id: `notif-${Date.now()}`,
    title,
    message,
    timestamp: new Date().toISOString(),
    type,
    whatsappSent,
    whatsappMessage: whatsappMsg
  };
  saveCollection('notifications', [newNotif, ...current].slice(0, 50)); // cap at 50
  return newNotif;
};

// Push all collections to Firestore Cloud
export const pushToFirestore = async (): Promise<void> => {
  if (!isFirebaseEnabled) throw new Error("Firebase tidak diaktifkan.");
  if (!auth.currentUser) {
    throw new Error("Silakan masuk (login) terlebih dahulu menggunakan Google.");
  }

  const keys: (keyof DBState)[] = [
    'inventory', 'projects', 'employees', 'transactions', 'attendance', 'notifications', 'settings',
    'customers', 'suppliers', 'vehicles', 'equipments', 'toolLoans', 'materialRequests', 'purchaseOrders',
    'purchaseInvoices', 'goodsReceipts', 'surveys', 'quotations', 'salesInvoices', 'salaries',
    'cashAdvances', 'craftsmanReports', 'bank_accounts', 'bank_mutations', 'categories', 'warehouses', 'catalogProducts'
  ];
  
  const state = getDBState();

  for (const key of keys) {
    try {
      if (key === 'settings') {
        await setDoc(doc(db, 'settings', 'config'), state.settings);
      } else {
        const list = state[key];
        if (Array.isArray(list)) {
          for (const item of list) {
            const itemId = (item as any).id || (item as any).uid;
            if (item && typeof item === 'object' && itemId) {
              await setDoc(doc(db, key, itemId), item as any);
            }
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, key);
    }
  }
};

// Pull all collections from Firestore Cloud
export const syncFromFirestore = async (): Promise<boolean> => {
  if (!isFirebaseEnabled) return false;
  if (!auth.currentUser) return false;

  const keys: (keyof DBState)[] = [
    'inventory', 'projects', 'employees', 'transactions', 'attendance', 'notifications', 'settings',
    'customers', 'suppliers', 'vehicles', 'equipments', 'toolLoans', 'materialRequests', 'purchaseOrders',
    'purchaseInvoices', 'goodsReceipts', 'surveys', 'quotations', 'salesInvoices', 'salaries',
    'cashAdvances', 'craftsmanReports', 'bank_accounts', 'bank_mutations', 'categories', 'warehouses', 'catalogProducts'
  ];

  let didUpdate = false;

  for (const key of keys) {
    try {
      if (key === 'settings') {
        const docRef = doc(db, 'settings', 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          localStorage.setItem('erp_settings', JSON.stringify(docSnap.data()));
          didUpdate = true;
        }
      } else {
        const querySnap = await getDocs(collection(db, key));
        if (!querySnap.empty) {
          const remoteList: any[] = [];
          querySnap.forEach((doc) => {
            remoteList.push(doc.data());
          });
          localStorage.setItem(`erp_${key}`, JSON.stringify(remoteList));
          didUpdate = true;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, key);
    }
  }

  if (didUpdate) {
    notifyListeners();
  }

  return didUpdate;
};

let activeSyncUnsubscribes: (() => void)[] = [];

export const stopRealtimeSync = () => {
  activeSyncUnsubscribes.forEach(unsub => {
    try {
      unsub();
    } catch (e) {
      console.warn("Gagal menghentikan listener onSnapshot:", e);
    }
  });
  activeSyncUnsubscribes = [];
  console.log("Realtime sync dihentikan.");
};

export const startRealtimeSyncFromFirestore = () => {
  const onHost = isProductionHosting();
  const settingsStr = localStorage.getItem('erp_settings');
  let hostingerEnabled = false;
  try {
    if (settingsStr) {
      const s = JSON.parse(settingsStr);
      if (s?.hostingerSyncEnabled) hostingerEnabled = true;
    }
  } catch (e) {}

  if (onHost || hostingerEnabled || !isFirebaseEnabled || !auth.currentUser) {
    if (onHost || hostingerEnabled) {
      console.log("Firestore sync disabled because Hostinger is active.");
    }
    return;
  }

  // Hentikan sinkronisasi aktif sebelumnya untuk mencegah duplikasi listener
  stopRealtimeSync();

  const keys: (keyof DBState)[] = [
    'inventory', 'projects', 'employees', 'transactions', 'attendance', 'notifications', 'settings',
    'customers', 'suppliers', 'vehicles', 'equipments', 'toolLoans', 'materialRequests', 'purchaseOrders',
    'purchaseInvoices', 'goodsReceipts', 'surveys', 'quotations', 'salesInvoices', 'salaries',
    'cashAdvances', 'craftsmanReports', 'bank_accounts', 'bank_mutations', 'categories', 'warehouses', 'catalogProducts',
    'weeklyPayrolls', 'users', 'roles', 'stockLedgers', 'customUnits'
  ];

  console.log("Memulai Sinkronisasi Realtime dengan Firestore...");

  keys.forEach((key) => {
    try {
      if (key === 'settings') {
        const docRef = doc(db, 'settings', 'config');
        const unsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            const localRaw = localStorage.getItem('erp_settings');
            if (localRaw) {
              try {
                const localData = JSON.parse(localRaw);
                if (JSON.stringify(localData) === JSON.stringify(remoteData)) {
                  return; // Tidak ada perbedaan data
                }
              } catch (e) {}
            }
            localStorage.setItem('erp_settings', JSON.stringify(remoteData));
            notifyListeners();
          }
        }, (err) => {
          console.warn(`Sinkronisasi realtime untuk settings gagal atau dibatasi:`, err);
        });
        activeSyncUnsubscribes.push(unsub);
      } else if (key === 'customUnits') {
        const docRef = doc(db, 'customUnits', 'all');
        const unsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const remoteList = docSnap.data()?.list || [];
            const localRaw = localStorage.getItem('erp_customUnits');
            let localList = [];
            try {
              localList = localRaw ? JSON.parse(localRaw) : [];
              if (!Array.isArray(localList)) localList = [];
            } catch (e) {}

            if (JSON.stringify(localList) === JSON.stringify(remoteList)) {
              return;
            }
            localStorage.setItem('erp_customUnits', JSON.stringify(remoteList));
            notifyListeners();
          }
        }, (err) => {
          console.warn(`Sinkronisasi realtime untuk customUnits gagal atau dibatasi:`, err);
        });
        activeSyncUnsubscribes.push(unsub);
      } else {
        const collRef = collection(db, key);
        const unsub = onSnapshot(collRef, (querySnap) => {
          const remoteList: any[] = [];
          querySnap.forEach((doc) => {
            remoteList.push(doc.data());
          });

          const getItemKey = (item: any) => {
            if (!item) return '';
            return item.id || item.uid || item.code || item.plateNumber || JSON.stringify(item);
          };

          const sortedRemote = [...remoteList].sort((a, b) => getItemKey(a).localeCompare(getItemKey(b)));

          const localRaw = localStorage.getItem(`erp_${key}`);
          let localList: any[] = [];
          try {
            localList = localRaw ? JSON.parse(localRaw) : [];
            if (!Array.isArray(localList)) localList = [];
          } catch (e) {
            localList = [];
          }

          const sortedLocal = [...localList].sort((a, b) => getItemKey(a).localeCompare(getItemKey(b)));

          if (JSON.stringify(sortedLocal) === JSON.stringify(sortedRemote)) {
            return; // Data sama, abaikan untuk mencegah callback looping
          }

          localStorage.setItem(`erp_${key}`, JSON.stringify(remoteList));
          notifyListeners();
        }, (err) => {
          console.warn(`Sinkronisasi realtime ${key} dibatasi atau error:`, err);
        });
        activeSyncUnsubscribes.push(unsub);
      }
    } catch (e) {
      console.error(`Gagal menginisialisasi listener realtime sync untuk ${key}:`, e);
    }
  });
};
