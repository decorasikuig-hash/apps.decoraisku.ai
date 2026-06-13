import React, { useState } from 'react';
import { Shield, Plus, Edit, Trash2, Save, X, Search, Pencil } from 'lucide-react';
import { RoleDefinition, DBState, UserRole } from '../types';
import { Modal } from './Modal';

// List of available page accesses (Menu IDs)
const AVAILABLE_PERMISSIONS: { id: string; label: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard Utama', group: 'Dashboard' },
  { id: 'master-customer', label: 'Master Pelanggan', group: 'Data Master' },
  { id: 'master-supplier', label: 'Master Pemasok', group: 'Data Master' },
  { id: 'master-vehicle', label: 'Master Kendaraan', group: 'Data Master' },
  { id: 'master-equipment', label: 'Master Alker', group: 'Data Master' },
  { id: 'stock-goods', label: 'Data Stok Gudang', group: 'Gudang' },
  { id: 'stock-card', label: 'Kartu Stok', group: 'Gudang' },
  { id: 'stock-report', label: 'Laporan Stok', group: 'Gudang' },
  { id: 'stock-request', label: 'Permintaan Material', group: 'Gudang' },
  { id: 'purchase-po', label: 'Purchase Order (PO)', group: 'Pembelian' },
  { id: 'purchase-invoice', label: 'Invoice Pembelian', group: 'Pembelian' },
  { id: 'purchase-receipt', label: 'Penerimaan Barang', group: 'Pembelian' },
  { id: 'sales-survey', label: 'Survey / Rencana', group: 'Penjualan' },
  { id: 'sales-quotation', label: 'Quotation (Penawaran)', group: 'Penjualan' },
  { id: 'sales-invoice', label: 'Invoice Penjualan', group: 'Penjualan' },
  { id: 'finance-cash', label: 'Arus Kas', group: 'Keuangan' },
  { id: 'finance-bank', label: 'Rekening Bank', group: 'Keuangan' },
  { id: 'finance-payable', label: 'Hutang', group: 'Keuangan' },
  { id: 'finance-receivable', label: 'Piutang', group: 'Keuangan' },
  { id: 'finance-payroll', label: 'Gajian (Payroll)', group: 'Keuangan' },
  { id: 'finance-cashadvance', label: 'Kasbon', group: 'Keuangan' },
  { id: 'finance-craftsman', label: 'Opname Tukang', group: 'Keuangan' },
  { id: 'esdm-employees', label: 'Data Karyawan', group: 'ESDM' },
  { id: 'esdm-attendance', label: 'Log Kehadiran', group: 'ESDM' },
  { id: 'esdm-recap', label: 'Rekap Presensi', group: 'ESDM' },
  { id: 'drive', label: 'Drive Blueprint', group: 'Google Workspace' },
  { id: 'gmail', label: 'Gmail Komunikasi', group: 'Google Workspace' },
  { id: 'settings', label: 'Manajemen Pengguna & Token', group: 'Sistem' },
  { id: 'roles', label: 'Pengaturan Akses Jabatan (Role)', group: 'Sistem' },
  { id: 'system-settings', label: 'Pengaturan Tampilan Aplikasi', group: 'Sistem' },
  { id: 'hostinger-sync', label: 'Database Sync', group: 'Sistem' },
  // Sub-tab page access controls
  { id: 'esdm-employees_tab-employees', label: 'Tab: Karyawan (di Menu Karyawan)', group: 'Akses Sub-Tab' },
  { id: 'esdm-employees_tab-salary', label: 'Tab: Input Gaji (di Menu Karyawan)', group: 'Akses Sub-Tab' },
  { id: 'esdm-employees_tab-recap', label: 'Tab: Approval & Recap (di Menu Karyawan)', group: 'Akses Sub-Tab' }
];

interface RoleManagementProps {
  dbState: DBState;
  saveCollection: (name: string, data: any) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const RoleManagementView: React.FC<RoleManagementProps> = ({ dbState, saveCollection, showToast }) => {
  const customRoles = dbState.roles || [];
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  
  // Form State
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [activePermTab, setActivePermTab] = useState('Semua');

  const handleOpenModal = (role?: RoleDefinition) => {
    setActivePermTab('Semua');
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setSelectedPermissions([...role.permissions]);
    } else {
      setEditingRole(null);
      setRoleName('');
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const handleToggleGroup = (groupName: string) => {
    const groupPerms = AVAILABLE_PERMISSIONS.filter(p => p.group === groupName).map(p => p.id);
    const hasAll = groupPerms.every(p => selectedPermissions.includes(p));
    
    if (hasAll) {
      setSelectedPermissions(prev => prev.filter(p => !groupPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => {
        const newSelected = new Set(prev);
        groupPerms.forEach(p => newSelected.add(p));
        return Array.from(newSelected);
      });
    }
  };

  const handleSaveRole = () => {
    if (!roleName.trim()) {
      showToast('Nama role wajib diisi', 'error');
      return;
    }
    if (selectedPermissions.length === 0) {
      showToast('Minimal pilih 1 menu yang dapat diakses', 'error');
      return;
    }

    if (editingRole) {
      const updatedRoles = customRoles.map(r => 
        r.id === editingRole.id 
          ? { ...r, name: roleName, permissions: selectedPermissions }
          : r
      );
      saveCollection('roles', updatedRoles);
      showToast(`Role ${roleName} berhasil diperbarui`, 'success');
    } else {
      const newRole: RoleDefinition = {
        id: `ROLE-${Date.now()}`,
        name: roleName,
        permissions: selectedPermissions
      };
      saveCollection('roles', [...customRoles, newRole]);
      showToast(`Role ${roleName} berhasil ditambahkan`, 'success');
    }
    setIsModalOpen(false);
  };

  const handleDeleteRole = (id: string, name: string) => {
    if (confirm(`Anda yakin ingin menghapus role / jabatan: ${name}?`)) {
      const updatedRoles = customRoles.filter(r => r.id !== id);
      saveCollection('roles', updatedRoles);
      showToast(`Role ${name} berhasil dihapus`, 'success');
    }
  };

  // Grouping permissions for presentation
  const groupedPermissions: Record<string, typeof AVAILABLE_PERMISSIONS> = {};
  AVAILABLE_PERMISSIONS.forEach(p => {
    if (!groupedPermissions[p.group]) groupedPermissions[p.group] = [];
    groupedPermissions[p.group].push(p);
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-120px)] flex flex-col h-full uppercase">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 -3xl bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Pengaturan Akses Jabatan</h2>
            <p className="text-sm text-slate-500 mt-1">Kelola pembagian wewenang hak akses menu sistem berdasarkan jabatan divisi.</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          title="Tambah Jabatan Baru"
        >
          <Plus className="w-5 h-5 font-bold" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-grow content-start">
        {/* Render built-in / root roles as info only if needed, but for now we focus on dynamic custom roles */}
        {currentPage === 1 && (
          <div className="bg-white p-6 -3xl    flex flex-col justify-between relative overflow-hidden group bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative">
              <h3 className="text-lg text-slate-800 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                Super Admin 
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-lg tracking-wider font-semibold uppercase">Bawaan</span>
              </h3>
              <p className="text-sm text-slate-500 mt-2">Akses penuh ke seluruh modul konfigurasi dan sistem.</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Akses Semua Menu</span>
            </div>
          </div>
        )}

        {customRoles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(role => (
          <div key={role.id} className="bg-white p-6 -3xl    flex flex-col justify-between hover: transition- group bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div>
              <h3 className="text-lg text-slate-800 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{role.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {role.permissions.map(pId => {
                  const perm = AVAILABLE_PERMISSIONS.find(p => p.id === pId);
                  return perm ? (
                    <span key={pId} className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs rounded-lg font-medium">
                      {perm.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{role.permissions.length} Akses Menu</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenModal(role)}
                  className="p-2 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Edit Jabatan"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  className="p-2 bg-slate-50 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Jabatan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination UI */}
      {Math.ceil((customRoles.length + 1) / itemsPerPage) > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans uppercase">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Halaman <span className="text-slate-900">{currentPage}</span> dari <span className="text-slate-900">{Math.ceil((customRoles.length + 1) / itemsPerPage)}</span>
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil((customRoles.length + 1) / itemsPerPage)))}
              disabled={currentPage === Math.ceil((customRoles.length + 1) / itemsPerPage)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                currentPage === Math.ceil((customRoles.length + 1) / itemsPerPage) 
                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
              }`}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRole ? "Edit Role & Jabatan" : "Tambah Jabatan Baru"} maxWidth="max-w-4xl">
        <div className="space-y-6">
          {/* Input Nama Jabatan */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block font-sans">
              Nama Jabatan / Role
            </label>
            <input 
              type="text"
              className="w-full bg-slate-50 border border-slate-200 outline-none px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold placeholder:text-slate-400"
              placeholder="Contoh: Manager Gudang, Admin Keuangan..."
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
            />
          </div>

          {/* Matrix Hak Akses */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest block font-sans">
                Pilih Hak Akses Menu
              </h4>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-sans">
                Terpilih: {(() => {
                  const checkedCount = AVAILABLE_PERMISSIONS.filter(p => 
                    selectedPermissions.some(sel => sel === p.id || sel.startsWith(`${p.id}_`))
                  ).length;
                  return `${checkedCount} / ${AVAILABLE_PERMISSIONS.length} Menu`;
                })()}
              </span>
            </div>

            {/* Category Tab Row */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl max-h-[120px] overflow-y-auto">
              {['Semua', ...Array.from(new Set(AVAILABLE_PERMISSIONS.map(p => p.group)))].map(group => {
                const isActive = activePermTab === group;
                let statsStr = '';
                if (group === 'Semua') {
                  const checked = AVAILABLE_PERMISSIONS.filter(p => 
                    selectedPermissions.some(sel => sel === p.id || sel.startsWith(`${p.id}_`))
                  ).length;
                  statsStr = `(${checked}/${AVAILABLE_PERMISSIONS.length})`;
                } else {
                  const groupPerms = AVAILABLE_PERMISSIONS.filter(p => p.group === group);
                  const checked = groupPerms.filter(p => 
                    selectedPermissions.some(sel => sel === p.id || sel.startsWith(`${p.id}_`))
                  ).length;
                  statsStr = `(${checked}/${groupPerms.length})`;
                }

                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActivePermTab(group)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1 border-none ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/40'
                    }`}
                  >
                    <span>{group}</span>
                    <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {statsStr}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 h-[420px] overflow-y-auto">
              <div className="space-y-6">
                {Object.entries(groupedPermissions)
                  .filter(([groupName]) => activePermTab === 'Semua' || groupName === activePermTab)
                  .map(([groupName, perms]) => {
                    const groupPermsIds = perms.map(p => p.id);
                    const isAllSelected = groupPermsIds.length > 0 && groupPermsIds.every(id => selectedPermissions.includes(id));
                    const isPartiallySelected = groupPermsIds.some(id => selectedPermissions.includes(id)) && !isAllSelected;

                    return (
                      <div key={groupName} className="space-y-3 bg-white p-4 rounded-xl border border-slate-105 shadow-sm">
                        {/* Group Header Checkbox */}
                        <div className="flex items-center pb-2 border-b border-slate-100">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all bg-white"
                              checked={isAllSelected}
                              ref={input => { if (input) input.indeterminate = isPartiallySelected }}
                              onChange={() => handleToggleGroup(groupName)}
                            />
                            <span className="font-extrabold text-slate-800 text-xs tracking-wider font-sans uppercase">
                              {groupName}
                            </span>
                          </label>
                        </div>

                        {/* Permissions Matrix Checklist Table */}
                        <div className="space-y-1.5">
                          {/* Table Header Row (Sejajar) */}
                          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 pb-2 border-b border-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <div className="text-left py-1 pl-2">Nama Menu / Modul</div>
                            <div className="text-center py-1">Lihat</div>
                            <div className="text-center py-1">Tambah</div>
                            <div className="text-center py-1">Edit</div>
                            <div className="text-center py-1">Hapus</div>
                          </div>

                          {/* Table Permission Item Rows */}
                          {perms.map(perm => (
                            <div key={perm.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center hover:bg-slate-50 p-2 rounded-lg transition-colors group">
                              <span className="text-xs font-bold text-slate-700 tracking-wide font-sans pl-2">
                                {perm.label}
                              </span>
                              
                              {['view', 'create', 'edit', 'delete'].map(action => (
                                <div key={action} className="flex justify-center items-center">
                                  <input 
                                    type="checkbox" 
                                    className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all bg-white hover:border-blue-400 hover:scale-105 shadow-sm"
                                    checked={selectedPermissions.includes(`${perm.id}_${action}`) || selectedPermissions.includes(perm.id)} // Support legacy checks
                                    onChange={(e) => {
                                      const pId = `${perm.id}_${action}`;
                                      setSelectedPermissions(prev => {
                                        let next = prev.filter(p => p !== perm.id); // Remove legacy if any
                                        if (e.target.checked) {
                                          next = [...next, pId];
                                          if (action !== 'view' && !next.includes(`${perm.id}_view`)) {
                                            next = [...next, `${perm.id}_view`]; // Auto checked 'view' if other action is checked
                                          }
                                        } else {
                                          next = next.filter(p => p !== pId);
                                          if (action === 'view') {
                                            // Uncheck all if view is unchecked
                                            next = next.filter(p => !p.startsWith(`${perm.id}_`));
                                          }
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-800 font-sans text-xs font-extrabold tracking-widest uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4 text-slate-500" /> 
              <span>Batal</span>
            </button>
            <button 
              type="button"
              onClick={handleSaveRole}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/10 font-sans text-xs font-extrabold tracking-widest uppercase transition-all border-none cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Jabatan</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
