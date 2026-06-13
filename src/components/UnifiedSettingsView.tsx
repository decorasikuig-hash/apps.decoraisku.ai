import React, { useState, useEffect } from 'react';
import { 
  Cloud, Mail, Shield, Palette, Settings, Database, 
  ChevronRight, RefreshCw, AlertTriangle
} from 'lucide-react';
import { ModuleProps } from '../modules/registry';
import { checkPermission } from './RoleGuard';

// Direct Imports of Sub-views
import DriveIntegration from './DriveIntegration';
import GmailIntegration from './GmailIntegration';
import { RoleManagementView } from './RoleManagementView';
import { SystemSettingsView } from './SystemSettingsView';
import { SettingsView } from './SettingsView';
import { HostingerSyncView } from './HostingerSyncView';

const TAB_METADATA = [
  { 
    id: 'drive', 
    title: 'Google Drive Blueprint', 
    icon: Cloud,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50'
  },
  { 
    id: 'gmail', 
    title: 'Komunikasi Email', 
    icon: Mail,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  { 
    id: 'roles', 
    title: 'Pengaturan Akses Jabatan', 
    icon: Shield,
    color: 'text-purple-500',
    bg: 'bg-purple-50'
  },
  { 
    id: 'system-settings', 
    title: 'Pengaturan Aplikasi', 
    icon: Palette,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  { 
    id: 'users', 
    title: 'Manajemen Pengguna', 
    icon: Settings,
    color: 'text-slate-600',
    bg: 'bg-slate-100'
  },
  { 
    id: 'hostinger-sync', 
    title: 'Database Hostinger Cloud', 
    icon: Database,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  }
];

export const UnifiedSettingsView: React.FC<ModuleProps> = (props) => {
  const { 
    dbState, 
    showToast, 
    currentUserRole, 
    triggerManualMigration, 
    handleFirebaseLogin, 
    handleCloudPull, 
    handleCloudPush, 
    firebaseUser, 
    isSyncingFirestore 
  } = props;

  // Filter allowed tabs based on permissions
  const allowedTabs = TAB_METADATA.filter(tab => {
    // Check corresponding permission ID
    const permId = tab.id === 'users' ? 'settings' : tab.id;
    return checkPermission(currentUserRole, permId, 'view', dbState);
  });

  // Default to the first allowed tab
  const [activeTab, setActiveTab] = useState<string>(
    props.activeSettingsTab || (allowedTabs.length > 0 ? allowedTabs[0].id : '')
  );

  // Auto-switch away if current active tab is no longer allowed (should not happen, but safe)
  useEffect(() => {
    if (activeTab && !allowedTabs.some(t => t.id === activeTab)) {
      handleTabChange(allowedTabs.length > 0 ? allowedTabs[0].id : '');
    } else if (!activeTab && allowedTabs.length > 0) {
      handleTabChange(allowedTabs[0].id);
    }
  }, [allowedTabs, activeTab]);

  // Sync with prop changes from parent
  useEffect(() => {
    if (props.activeSettingsTab && props.activeSettingsTab !== activeTab) {
      setActiveTab(props.activeSettingsTab);
    }
  }, [props.activeSettingsTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (props.onActiveSettingsTabChange) {
      props.onActiveSettingsTabChange(tabId);
    }
  };

  if (allowedTabs.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Akses Ditolak</h3>
        <p className="text-slate-500 text-xs mt-1 max-w-sm">
          Anda tidak memiliki izin untuk mengakses bagian pengaturan sistem ini.
        </p>
      </div>
    );
  }

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'drive':
        return (
          <div className="space-y-6">
            <DriveIntegration 
              projects={dbState.projects || []} 
              showToast={showToast} 
            />
          </div>
        );
      case 'gmail':
        return (
          <div className="space-y-6">
            <GmailIntegration 
              projects={dbState.projects || []} 
              showToast={showToast} 
            />
          </div>
        );
      case 'roles':
        return (
          <RoleManagementView 
            dbState={dbState} 
            saveCollection={props.saveCollection} 
            showToast={showToast} 
          />
        );
      case 'system-settings':
        return (
          <SystemSettingsView 
            dbState={dbState} 
            saveCollection={props.saveCollection} 
            showToast={showToast} 
          />
        );
      case 'users':
        return (
          <div className="space-y-6">
            {/* Main user table */}
            <SettingsView 
              dbState={dbState} 
              showToast={showToast} 
            />

            {/* DB Migration & Seeding Center */}
            <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-wider">
                    Database Migration & Seeding Center
                  </h3>
                  <p className="text-slate-500 text-[11px] font-sans mt-1 max-w-xl leading-relaxed">
                    Migrasi data lokal kustom ke versi terbaru atau pulihkan data seeding pabrik.
                  </p>
                </div>
                <div>
                  <button
                    onClick={triggerManualMigration}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-sans shadow px-4 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border-none transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Setel Ulang Seeding Pabrik
                  </button>
                </div>
              </div>
            </div>

            {/* Firebase Cloud Sync Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-wider flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-emerald-500" />
                    Koneksi Cloud Database (Firebase Firestore)
                  </h3>
                  <p className="text-slate-500 text-[11px] font-sans mt-1.5 max-w-xl leading-relaxed">
                    Hubungkan dengan Google Firebase untuk menyimpan data secara aman di cloud Firestore.
                  </p>
                </div>
                <div>
                  {!firebaseUser ? (
                    <button
                      onClick={handleFirebaseLogin}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans shadow px-4 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border-none transition-colors"
                    >
                      Hubungkan Akun Google
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCloudPull}
                        disabled={isSyncingFirestore}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans shadow px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border-none disabled:opacity-50 transition-colors"
                      >
                        {isSyncingFirestore ? 'Memproses...' : 'Unduh (Pull)'}
                      </button>
                      <button
                        onClick={handleCloudPush}
                        disabled={isSyncingFirestore}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans shadow px-3.5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border-none disabled:opacity-50 transition-colors"
                      >
                        {isSyncingFirestore ? 'Memproses...' : 'Unggah (Push)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'hostinger-sync':
        return (
          <HostingerSyncView 
            dbState={dbState} 
            saveCollection={props.saveCollection} 
            showToast={showToast} 
            activeMenuId={props.activeMenuId}
            setActiveMenuId={props.setActiveMenuId}
            currentUserRole={currentUserRole}
            triggerPdfPrint={props.triggerPdfPrint}
            triggerHostingerSync={props.triggerHostingerSync}
            triggerManualMigration={props.triggerManualMigration}
            handleFirebaseLogin={props.handleFirebaseLogin}
            handleCloudPull={props.handleCloudPull}
            handleCloudPush={props.handleCloudPush}
            firebaseUser={props.firebaseUser}
            isSyncingFirestore={props.isSyncingFirestore}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {renderActiveContent()}
    </div>
  );
};
