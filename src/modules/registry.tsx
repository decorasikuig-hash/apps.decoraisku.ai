import React from 'react';
import { 
  LayoutDashboard, Home, Package, Users, Receipt, Cloud, Mail, Shield, Palette, Settings, Database, 
  ChevronRight, ChevronDown, Truck, HardHat, Warehouse, ClipboardList, FileSpreadsheet,
  FileSignature, ShoppingCart, ClipboardCheck, Tag, Compass, Layers, FileText, Banknote,
  Landmark, FilePieChart, TrendingUp, Briefcase, CheckSquare, Fingerprint, Calendar
} from 'lucide-react';

// Main Views
import { MasterDataView } from '../components/MasterDataView';
import { StockView } from '../components/StockView';
import { PurchaseView } from '../components/PurchaseView';
import { SalesView } from '../components/SalesView';
import { FinanceView } from '../components/FinanceView';
import { EsdmView } from '../components/EsdmView';
import { BankModuleView } from '../components/BankModuleView';
import { AttendanceView } from '../components/AttendanceView';
import { RmrView } from '../components/RmrView';

// Top-level / Standalone Views
import DriveIntegration from '../components/DriveIntegration';
import GmailIntegration from '../components/GmailIntegration';
import { SettingsView } from '../components/SettingsView';
import { HostingerSyncView } from '../components/HostingerSyncView';
import { RoleManagementView } from '../components/RoleManagementView';
import { SystemSettingsView } from '../components/SystemSettingsView';
import { UnifiedSettingsView } from '../components/UnifiedSettingsView';

import DashboardView from './DashboardView'; // We will Extract the Dashboard part into this

import { RoleGuard } from '../components/RoleGuard';

export interface ModuleProps {
  dbState: any;
  saveCollection: (col: string, data: any) => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  activeMenuId: string;
  setActiveMenuId: (id: string) => void;
  triggerPdfPrint: (type: any, data: any) => void;
  triggerHostingerSync: () => void;
  triggerManualMigration: () => void;
  handleFirebaseLogin: () => void;
  handleCloudPull: () => void;
  handleCloudPush: () => void;
  firebaseUser: any;
  isSyncingFirestore: boolean;
  activeSettingsTab?: string;
  onActiveSettingsTabChange?: (tabId: string) => void;
}

export type ModuleCategory = 'main' | 'master' | 'stock' | 'purchase' | 'sales' | 'finance' | 'esdm' | 'system';

export interface ModuleDefinition {
  id: string; // The active menu ID
  title: string;
  category: ModuleCategory;
  categoryTitle?: string; // Group label
  icon?: any;
  iconColor?: string; // Tailwind bg color for dot
  allowedRoles: string[]; // Fallback, override by RoleGuard checking dbState
  component: React.FC<ModuleProps>;
  isStandalone?: boolean; // Don't wrap in common layout if it's already doing it
}

export const ERP_MODULES: ModuleDefinition[] = [
  // --- MAIN ---
  {
    id: 'dashboard',
    title: 'Dashboard Utama',
    category: 'main',
    icon: <LayoutDashboard className="w-4 h-4 text-slate-500" />,
    allowedRoles: ['super_admin', 'admin', 'staff', 'accounting', 'karyawan'],
    component: (props) => <DashboardView {...props} />
  },

  // --- MASTER DATA ---
  {
    id: 'master-mitra',
    title: 'Mitra (Customer/Supplier)',
    category: 'master',
    categoryTitle: 'Master Data',
    icon: <Users className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <MasterDataView {...props} activeTab="mitra" />
  },
  {
    id: 'master-vehicle',
    title: 'Aset Kendaraan',
    category: 'master',
    icon: <Truck className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <MasterDataView {...props} activeTab="vehicle" />
  },
  {
    id: 'master-equipment',
    title: 'Peralatan & Workshop',
    category: 'master',
    icon: <HardHat className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <MasterDataView {...props} activeTab="equipment" />
  },

  // --- STOK INVENTORI ---
  {
    id: 'stock-goods',
    title: 'Nama Barang & Gudang',
    category: 'stock',
    categoryTitle: 'Stok Inventori',
    icon: <Warehouse className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <StockView {...props} activeTab="goods" triggerPoCreation={() => {
      props.setActiveMenuId('purchase-po');
      props.showToast('Dialihkan otomatis ke draf PO dari permintaan bahan RMR!', 'info');
    }} />
  },
  {
    id: 'stock-card',
    title: 'Kartu Stok Ledger',
    category: 'stock',
    icon: <ClipboardList className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <StockView {...props} activeTab="card" triggerPoCreation={() => {}} />
  },
  {
    id: 'stock-report',
    title: 'Laporan Stok',
    category: 'stock',
    icon: <FileSpreadsheet className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <StockView {...props} activeTab="report" triggerPoCreation={() => {}} />
  },
  {
    id: 'stock-request',
    title: 'Permintaan Bahan (RMR)',
    category: 'stock',
    icon: <FileSignature className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <RmrView {...props} />
  },

  // --- PEMBELIAN ---
  {
    id: 'purchase-po',
    title: 'PO Pesanan Bahan',
    category: 'purchase',
    categoryTitle: 'Pembelian (Sourcing)',
    icon: <ShoppingCart className="w-4 h-4 text-indigo-600" />,
    iconColor: 'bg-indigo-550',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <PurchaseView {...props} activeTab="po" />
  },
  {
    id: 'purchase-invoice',
    title: 'Invoice Pembelian',
    category: 'purchase',
    icon: <Receipt className="w-4 h-4 text-indigo-600" />,
    iconColor: 'bg-indigo-550',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <PurchaseView {...props} activeTab="invoice" />
  },
  {
    id: 'purchase-receipt',
    title: 'Surat Terima Barang (STB)',
    category: 'purchase',
    icon: <ClipboardCheck className="w-4 h-4 text-indigo-600" />,
    iconColor: 'bg-indigo-550',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <PurchaseView {...props} activeTab="receipt" />
  },

  // --- PENJUALAN ---
  {
    id: 'sales-catalog',
    title: 'Katalog Produk (WA Biz)',
    category: 'sales',
    categoryTitle: 'Penjualan Komersial',
    icon: <Tag className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <SalesView {...props} activeTab="catalog" onTabChange={(tab) => props.setActiveMenuId('sales-' + tab)} />
  },
  {
    id: 'sales-survey',
    title: 'Survei Lokasi / Ruang',
    category: 'sales',
    icon: <Compass className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <SalesView {...props} activeTab="survey" onTabChange={(tab) => props.setActiveMenuId('sales-' + tab)} />
  },
  {
    id: 'sales-quotation',
    title: 'Penawaran RAB',
    category: 'sales',
    icon: <Layers className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <SalesView {...props} activeTab="quotation" onTabChange={(tab) => props.setActiveMenuId('sales-' + tab)} />
  },
  {
    id: 'sales-invoice',
    title: 'Invoice Penjualan',
    category: 'sales',
    icon: <FileText className="w-4 h-4 text-indigo-500" />,
    iconColor: 'bg-indigo-500',
    allowedRoles: ['super_admin', 'admin', 'staff'],
    component: (props) => <SalesView {...props} activeTab="invoice" onTabChange={(tab) => props.setActiveMenuId('sales-' + tab)} />
  },

  // --- KEUANGAN ---
  {
    id: 'finance-cash',
    title: 'Kas Harian',
    category: 'finance',
    categoryTitle: 'Keuangan & Buku Kas',
    icon: <Banknote className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="cash" />
  },
  {
    id: 'finance-bank',
    title: 'Kas Bank Perusahaan',
    category: 'finance',
    icon: <Landmark className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <BankModuleView {...props} />
  },
  {
    id: 'finance-payable',
    title: 'Laporan Hutang (A/P)',
    category: 'finance',
    icon: <FilePieChart className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="payable" />
  },
  {
    id: 'finance-receivable',
    title: 'Laporan Piutang (A/R)',
    category: 'finance',
    icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="receivable" />
  },
  {
    id: 'finance-payroll',
    title: 'Payroll Gaji Bulanan',
    category: 'finance',
    icon: <Briefcase className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="payroll" />
  },
  {
    id: 'finance-cashadvance',
    title: 'Laporan Kasbon Staff',
    category: 'finance',
    icon: <ClipboardList className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="cashadvance" />
  },
  {
    id: 'finance-craftsman',
    title: 'Laporan Opnam Tukang',
    category: 'finance',
    icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
    iconColor: 'bg-emerald-500',
    allowedRoles: ['super_admin', 'admin', 'accounting'],
    component: (props) => <FinanceView {...props} activeTab="craftsman" />
  },

  // --- ESDM ---
  {
    id: 'esdm-employees',
    title: 'Daftar Karyawan',
    category: 'esdm',
    categoryTitle: 'Personalia ESDM',
    icon: <Users className="w-4 h-4 text-purple-500" />,
    iconColor: 'bg-purple-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <EsdmView {...props} initialTab="employees" />
  },
  {
    id: 'esdm-attendance',
    title: 'Absensi Biometrik',
    category: 'esdm',
    icon: <Fingerprint className="w-4 h-4 text-purple-500" />,
    iconColor: 'bg-purple-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    // Using AttendanceView directly as it's separate in App.tsx originally
    component: (props) => <AttendanceView dbState={props.dbState} saveCollection={props.saveCollection} />
  },
  {
    id: 'esdm-recap',
    title: 'Rekap Absensi',
    category: 'esdm',
    icon: <Calendar className="w-4 h-4 text-purple-500" />,
    iconColor: 'bg-purple-500',
    allowedRoles: ['super_admin', 'admin', 'staff', 'karyawan'],
    component: (props) => <EsdmView {...props} initialTab="recap" />
  },

  // --- SYSTEM ---
  {
    id: 'settings',
    title: 'Menu Setting',
    category: 'system',
    icon: <Settings className="w-4 h-4 text-slate-500" />,
    allowedRoles: ['super_admin', 'admin', 'staff', 'accounting'],
    component: (props) => <UnifiedSettingsView {...props} />
  }
];

// Helper to filter modules based on checkPermission logic from RoleGuard
export function getAvailableModules(dbState: any, userRole: string, checkPermission: (cRole: string, menuId: string, action: string, dbState: any) => boolean) {
  // First, we get all active modules (in the future we could read dbState.settings.modules to toggle these)
  return ERP_MODULES.filter(mod => {
    // If it's settings, let anyone who has access to any of the nested setting tabs view it
    if (mod.id === 'settings') {
      return checkPermission(userRole, 'settings', 'view', dbState) ||
             checkPermission(userRole, 'drive', 'view', dbState) ||
             checkPermission(userRole, 'gmail', 'view', dbState) ||
             checkPermission(userRole, 'roles', 'view', dbState) ||
             checkPermission(userRole, 'system-settings', 'view', dbState) ||
             checkPermission(userRole, 'hostinger-sync', 'view', dbState);
    }

    // Some legacy menu IDs map backwards, so we use checkPermission with the id or mapping.
    let mappedId = mod.id;
    if(mod.id === 'purchase-po') mappedId = 'po'; // The legacy check logic uses 'po' sometimes, but checkPermission handles real IDs mostly.
    return checkPermission(userRole, mod.id, 'view', dbState) || checkPermission(userRole, mappedId, 'view', dbState);
  });
}
