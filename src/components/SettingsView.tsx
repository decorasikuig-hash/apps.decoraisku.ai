import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserRole, Role } from '../types';
import { saveCollection } from '../utils/database';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';

interface SettingsViewProps {
  dbState: any;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ dbState, showToast }) => {
  const users: UserRole[] = dbState.users || [];
  const customRoles = dbState.roles || [];
  
  const defaultRoles = ['super_admin', 'admin', 'staff', 'accounting', 'karyawan'];
  const allRoles = [...new Set([...defaultRoles, ...customRoles.map((r: any) => r.id)])];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'staff' as Role
  });

  const getRoleLabel = (roleId: string) => {
    const custom = customRoles.find((r: any) => r.id === roleId);
    if (custom) return custom.name;
    return roleId.replace('_', ' ').toUpperCase();
  };

  const handleCreateOrUpdateUser = () => {
    if (!formData.email || !formData.password) {
      showToast('Email dan password wajib diisi', 'error');
      return;
    }

    let updatedUsers = [...users];
    
    if (editingUser) {
      updatedUsers = updatedUsers.map(u => 
        u.uid === editingUser.uid ? { ...u, email: formData.email, password: formData.password, role: formData.role } : u
      );
      showToast('Pengguna berhasil diperbarui', 'success');
    } else {
      if (users.some(u => u.email === formData.email)) {
        showToast('Email sudah digunakan', 'error');
        return;
      }
      const newUser: UserRole = {
        uid: Date.now().toString(),
        email: formData.email,
        password: formData.password,
        role: formData.role
      };
      updatedUsers.push(newUser);
      showToast('Pengguna berhasil ditambahkan', 'success');
    }

    saveCollection('users', updatedUsers);
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', role: 'staff' });
  };

  const handleDeleteUser = (uid: string) => {
    if (confirm('Yakin ingin menghapus pengguna ini?')) {
      const updatedUsers = users.filter(u => u.uid !== uid);
      saveCollection('users', updatedUsers);
      showToast('Pengguna berhasil dihapus', 'success');
    }
  };

  const openEditModal = (user: UserRole) => {
    setEditingUser(user);
    setFormData({ email: user.email, password: user.password || '', role: user.role });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 bg-white -3xl    animate-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-120px)] flex flex-col h-full bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Manajemen Pengguna</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola akun dan kredensial login pengguna sistem</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ email: '', password: '', role: 'staff' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          title="Tambah Pengguna"
        >
          <Plus className="w-5 h-5 font-bold" />
        </button>
      </div>

      <div className="space-y-4">
        {users.map(u => (
          <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group">
            <div>
              <div className="text-sm font-bold text-slate-700">{u.email}</div>
              <div className="text-xs font-semibold text-indigo-600 mt-1">{getRoleLabel(u.role)}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => openEditModal(u)}
                className="p-2 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50     transition bg-white  shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
                title="Edit Pengguna"
              >
                <Edit className="w-4 h-4" />
              </button>
              {u.email !== 'admin@decorasiku.com' && (
                <button 
                  onClick={() => handleDeleteUser(u.uid)}
                  className="p-2 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50     transition bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
                  title="Hapus Pengguna"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">Belum ada pengguna. Silakan tambahkan.</div>
        )}
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl">
          <div className="bg-white -2xl  w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="p-6">
              <h3 className="text-lg text-slate-800 mb-4 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Email / Username</label>
                  <input
                    type="text"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-50 w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                    placeholder="Masukkan email..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="bg-slate-50 w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                    placeholder="Masukkan sandi..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Role / Jabatan</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    className="bg-slate-50 w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
                  >
                    {allRoles.map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-amber-500 hover:text-slate-950 transition"
                >
                  <X className="w-4 h-4 mr-1" /> Batal
                </button>
                <button
                  onClick={handleCreateOrUpdateUser}
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  <Save className="w-4 h-4 mr-1" /> Simpan
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
