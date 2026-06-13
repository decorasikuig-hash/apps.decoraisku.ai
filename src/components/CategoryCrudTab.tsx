import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Layers, Save, X } from 'lucide-react';
import { DBState, InventoryCategory } from '../types';
import { Modal } from './Modal';

interface CategoryCrudTabProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
}

export const CategoryCrudTab: React.FC<CategoryCrudTabProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole
}) => {
  const categories = dbState.categories || [];
  const inventory = dbState.inventory || [];
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [viewingCategory, setViewingCategory] = useState<InventoryCategory | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: InventoryCategory) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || '' });
    setModalOpen(true);
  };

  const handleOpenView = (cat: InventoryCategory) => {
    setViewingCategory(cat);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Nama kategori wajib diisi!', 'error');
      return;
    }

    const newCat: InventoryCategory = {
      id: editingCategory ? editingCategory.id : `cat-${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description.trim()
    };

    const updated = editingCategory
      ? categories.map(c => c.id === editingCategory.id ? newCat : c)
      : [...categories, newCat];

    saveCollection('categories', updated);
    showToast(`Kategori "${newCat.name}" berhasil disimpan`, 'success');
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    
    // Check if there are items connected
    const connectedCount = inventory.filter(i => i.category === cat.name).length;
    if (connectedCount > 0) {
      if (!window.confirm(`Perhatian: Ada ${connectedCount} material terhubung dengan kategori "${cat.name}". Kategori akan tetap dihapus dari daftar master.`)) {
        return;
      }
    }

    const updated = categories.filter(c => c.id !== id);
    saveCollection('categories', updated);
    showToast(`Kategori telah berhasil dihapus`, 'info');
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 flex flex-col flex-grow">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div>
          <h4 className="text-sm text-slate-850 tracking-wider tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Manajemen Master Kategori Bahan</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Tambah, ubah, atau hapus kategori kustom untuk pengelompokan material mebel yang presisi.</p>
        </div>
        {isSuperOrAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            title="Tambah Kategori"
          >
            <Plus className="w-5 h-5 font-bold" />
          </button>
        )}
      </div>

      {/* CATEGORIES GRID LIST */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
        {categories.length > 0 ? (
          categories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((cat) => {
            const connectedItems = inventory.filter(i => i.category === cat.name);
            return (
              <div 
                key={cat.id} 
                className="bg-white hover:bg-amber-500 hover:text-slate-950/30 -2xl p-5 flex flex-col justify-between transition-all  hover: group bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
                      <Layers className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-600 font-bold px-2.5 py-1 rounded-full border border-slate-200/40">
                      {connectedItems.length} Material
                    </span>
                  </div>
                  <div>
                    <h5 className="font-sans font-extrabold text-slate-800 text-sm tracking-tight">{cat.name}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 min-h-[32px] font-medium leading-relaxed">
                      {cat.description || 'Tidak ada deskripsi tambahan untuk kategori ini.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4 justify-end">
                  <button
                    onClick={() => handleOpenView(cat)}
                    title="Lihat Detail Kategori"
                    className="p-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Lihat</span>
                  </button>
                  {isSuperOrAdmin && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        title="Ubah Kategori"
                        className="p-1.5 px-3 bg-slate-50 hover:bg-indigo-50 text-indigo-650 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Suntik</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(cat.id)}
                        title="Hapus Kategori"
                        className="p-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-sans text-xs">
            Belum ada data kategori master. Silakan klik "<Plus className="w-4 h-4 mr-1" /> Tambah Kategori" untuk menginisiasi data kustom.
          </div>
        )}
      </div>

      {/* Pagination UI */}
      {Math.ceil(categories.length / itemsPerPage) > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans uppercase">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Halaman <span className="text-slate-900">{currentPage}</span> dari <span className="text-slate-900">{Math.ceil(categories.length / itemsPerPage)}</span>
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(categories.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(categories.length / itemsPerPage)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                currentPage === Math.ceil(categories.length / itemsPerPage) 
                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
              }`}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* FORM INPUT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'Ubah Master Kategori' : 'Tambah Kategori Bahan Baru'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs font-sans text-left font-bold text-slate-700">
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Kategori:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Premium Wood, Wallpaper HPL..."
              maxLength={100}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Deskripsi / Spesifikasi Kategori:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tulis detail penjelasan kategori ini..."
              rows={3}
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl border-none cursor-pointer hover:bg-amber-500 hover:text-slate-950 font-bold"
            >
              <X className="w-4 h-4 mr-1" /> Batal
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Kategori</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL VIEW MODAL */}
      <Modal
        isOpen={!!viewingCategory}
        onClose={() => setViewingCategory(null)}
        title="Detail Master Kategori"
        maxWidth="max-w-md"
      >
        {viewingCategory && (
          <div className="space-y-4 text-xs font-sans text-left">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ID Referensi</span>
                <strong className="text-slate-700 font-mono text-xs block mt-0.5">{viewingCategory.id}</strong>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nama Kategori</span>
                <strong className="text-slate-800 text-sm block mt-0.5 font-sans font-black leading-tight">{viewingCategory.name}</strong>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Deskripsi Penjelasan</span>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed font-semibold">
                  {viewingCategory.description || 'Tidak ada deskripsi tertulis.'}
                </p>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Alokasi Material Terhubung</span>
                <strong className="text-indigo-600 text-xs block mt-0.5 font-black font-sans">
                  {inventory.filter(i => i.category === viewingCategory.name).length} barang logistik mebel kustom
                </strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingCategory(null)}
                className="bg-indigo-600 col-span-1 border-none cursor-pointer hover:bg-indigo-700 text-white font-bold p-2 px-6 rounded-xl text-xs shadow"
              >
                <X className="w-4 h-4 mr-1.5" /> Tutup Detail
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Konfirmasi Hapus Kategori"
        maxWidth="max-w-sm"
      >
        <div className="text-center pb-4 select-none font-sans">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-5 h-5 text-rose-500" />
          </div>
          <span className="text-xs text-slate-800 font-sans block font-semibold mb-1">Apakah Anda yakin?</span>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Menghapus kategori ini bersifat permanen dari database master logistik kustom.
          </p>
        </div>
        
        <div className="flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => setDeleteConfirmId(null)}
            className="bg-slate-150 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
          >
            <X className="w-4 h-4 mr-1" /> Batal
          </button>
          <button
            type="button"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Ya, Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
};
