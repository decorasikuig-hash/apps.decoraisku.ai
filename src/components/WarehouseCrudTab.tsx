import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Home, MapPin, Save, X, Image as ImageIcon } from 'lucide-react';
import { DBState, InventoryWarehouse } from '../types';
import { Modal } from './Modal';
import { compressImageFile } from '../utils/imageCompressor';

interface WarehouseCrudTabProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
}

export const WarehouseCrudTab: React.FC<WarehouseCrudTabProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole
}) => {
  const warehouses = dbState.warehouses || [];
  const inventory = dbState.inventory || [];
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<InventoryWarehouse | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<InventoryWarehouse | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    location: '', 
    photoUrl: '', 
    description: '' 
  });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isSuperOrAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  // Image uploader & compressor states
  const [compressing, setCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const processAndSetPhoto = async (file: File) => {
    setCompressing(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setFormData(prev => ({ ...prev, photoUrl: compressedDataUrl }));
      showToast('Foto gudang berhasil dkompres dan diunggah!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengompres gambar.', 'error');
    } finally {
      setCompressing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndSetPhoto(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAndSetPhoto(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setFormData({ name: '', location: '', photoUrl: '', description: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (wh: InventoryWarehouse) => {
    setEditingWarehouse(wh);
    setFormData({ 
      name: wh.name, 
      location: wh.location || '', 
      photoUrl: wh.photoUrl || '', 
      description: wh.description || '' 
    });
    setModalOpen(true);
  };

  const handleOpenView = (wh: InventoryWarehouse) => {
    setViewingWarehouse(wh);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Nama gudang wajib diisi!', 'error');
      return;
    }

    const defaultUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=60';
    const newWh: InventoryWarehouse = {
      id: editingWarehouse ? editingWarehouse.id : `wh-${Date.now()}`,
      name: formData.name.trim(),
      location: formData.location.trim(),
      photoUrl: formData.photoUrl.trim() || defaultUrl,
      description: formData.description.trim()
    };

    const updated = editingWarehouse
      ? warehouses.map(w => w.id === editingWarehouse.id ? newWh : w)
      : [...warehouses, newWh];

    saveCollection('warehouses', updated);
    showToast(`Gudang "${newWh.name}" berhasil disimpan`, 'success');
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    if (!wh) return;

    // Check if there are items inside
    const connectedItems = inventory.filter(i => i.location === wh.name);
    if (connectedItems.length > 0) {
      if (!window.confirm(`Perhatian: Gudang ini saat ini mencatat ${connectedItems.length} produk tersimpan. Hapus gudang dan biarkan alokasi material tetap ada?`)) {
        return;
      }
    }

    const updated = warehouses.filter(w => w.id !== id);
    saveCollection('warehouses', updated);
    showToast(`Gudang telah berhasil dihapus`, 'info');
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn flex flex-col flex-grow">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div>
          <h4 className="text-sm text-slate-850 tracking-wider tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Tab Gudang & Depo Logistik Terpusat</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Kelola fisik gudang penyimpanan, pantau penyebaran loker kayu jati, finishing HPL, dan workshop lapangan Kemang.</p>
        </div>
        {isSuperOrAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            title="Tambah Depo Gudang"
          >
            <Plus className="w-5 h-5 font-bold" />
          </button>
        )}
      </div>

      {/* WAREHOUSE CARDS WITH PHOTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {warehouses.length > 0 ? (
          warehouses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((wh) => {
            const connectedItems = inventory.filter(i => i.location === wh.name);
            const totalStockCount = connectedItems.reduce((sum, item) => sum + (item.stock || 0), 0);

            return (
              <div 
                key={wh.id} 
                className="bg-white -3xl overflow-hidden  hover: transition-all flex flex-col justify-between group bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
              >
                {/* Visual Area */}
                <div className="relative h-44 bg-slate-100 overflow-hidden">
                  <img 
                    src={wh.photoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=60'} 
                    alt={wh.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-indigo-700 flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    <span>{connectedItems.length} Katalog</span>
                  </div>
                </div>

                {/* Body Area */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h5 className="font-sans font-black text-slate-800 text-sm leading-tight group-hover:text-indigo-650 transition-colors">
                      {wh.name}
                    </h5>
                    <div className="flex items-start gap-1 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-relaxed line-clamp-2">{wh.location || 'Lokasi tidak dispesifikasikan'}</span>
                    </div>
                    {wh.description && (
                      <p className="text-[11px] text-slate-450 italic font-medium leading-relaxed">
                        "{wh.description}"
                      </p>
                    )}
                  </div>

                  {/* Stock distribution counters and actions */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="bg-slate-50/70 p-2.5 rounded-xl flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500 font-sans">Total Penyimpanan Fisik:</span>
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-mono">
                        {totalStockCount} Unit
                      </span>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleOpenView(wh)}
                        className="p-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Detail</span>
                      </button>
                      {isSuperOrAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(wh)}
                            className="p-1.5 px-3 bg-slate-50 hover:bg-indigo-50 text-indigo-650 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Ubah</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(wh.id)}
                            className="p-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold cursor-pointer border-none flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-sans text-xs">
            Belum ada data depo gudang terdaftar. Silakan buat gudang baru sekarang.
          </div>
        )}
      </div>

      {/* Pagination UI */}
      {Math.ceil(warehouses.length / itemsPerPage) > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0 font-sans uppercase">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Halaman <span className="text-slate-900">{currentPage}</span> dari <span className="text-slate-900">{Math.ceil(warehouses.length / itemsPerPage)}</span>
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(warehouses.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(warehouses.length / itemsPerPage)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                currentPage === Math.ceil(warehouses.length / itemsPerPage) 
                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer shadow-sm'
              }`}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* CREATION / EDITING FORM MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarehouse ? 'Ubah Informasi Gudang' : 'Pendaftaran Fisik Gudang Baru'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs font-sans text-left font-bold text-slate-700">
          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Nama Gudang/Depo:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Gudang Utama Kayu Kemang..."
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alamat Fisik / Lokasi:</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Contoh: Jl. Kemang Raya No. 45B, Mampang Prapatan..."
              className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
              Foto / Gambar Gudang:
            </label>
            
            {formData.photoUrl ? (
              <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-center gap-3 animate-fadeIn">
                <img 
                  src={formData.photoUrl} 
                  alt="Preview" 
                  className="w-16 h-16  object-cover bg-white bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 space-y-1 text-left">
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    ✓ OK - Terkompresi Ringan
                  </span>
                  <p className="text-[9px] text-slate-400 leading-none">Foto gudang terkompresi otomatis agar hemat kuota server dan loading instan.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                  className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border-none p-2 rounded-xl text-xs cursor-pointer font-bold shrink-0 transition"
                ><Trash2 className="w-4 h-4"/>&nbsp;<Trash2 className="w-4 h-4 mr-1" /> Hapus</button>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
                    : 'border-slate-200 bg-slate-50/50 hover:bg-amber-500 hover:text-slate-950'
                }`}
                onClick={() => document.getElementById('warehouse-file-upload')?.click()}
              >
                <input
                  id="warehouse-file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden font-medium font-sans"
                  onChange={handleFileChange}
                />
                
                {compressing ? (
                  <div className="space-y-2 py-2">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
                    <span className="text-[11px] text-indigo-700 font-bold block animate-pulse">
                      Sedang Mengompres Gambar... ⚡
                    </span>
                    <p className="text-[9px] text-slate-400">Memperkecil file agar hemat penyimpanan & loading secepat kilat</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-1 select-none">
                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                    <span className="text-[11px] text-slate-700 font-black block">
                      Tarik & Lepas Foto di Sini, atau Klik untuk Memilih
                    </span>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Format JPG / PNG langsung dikompres otomatis
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Catatan Operasional / Keterangan:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Spesifikasi jenis penyimpanan mebel, jam buka operasional, atau PIC..."
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
              <span>Simpan Gudang</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL VIEW MODAL */}
      <Modal
        isOpen={!!viewingWarehouse}
        onClose={() => setViewingWarehouse(null)}
        title="Detail Depo Gudang"
        maxWidth="max-w-md"
      >
        {viewingWarehouse && (
          <div className="space-y-4 text-xs font-sans text-left">
            <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
              <img 
                src={viewingWarehouse.photoUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=60'} 
                alt={viewingWarehouse.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ID Gudang</span>
                <strong className="text-slate-700 font-mono text-xs block mt-0.5">{viewingWarehouse.id}</strong>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Nama Gudang</span>
                <strong className="text-slate-800 text-sm block mt-0.5 font-sans font-black leading-tight">{viewingWarehouse.name}</strong>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Alamat Fisik Lokasi</span>
                <p className="text-slate-700 font-medium font-sans flex items-center gap-1 text-xs mt-0.5 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500 inline shrink-0" />
                  <span>{viewingWarehouse.location || 'Tidak ditentukan.'}</span>
                </p>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Catatan Operasional</span>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed font-semibold">
                  {viewingWarehouse.description || 'Tidak ada catatan khusus.'}
                </p>
              </div>
              <hr className="border-slate-150" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Aliran Produk Terhubung</span>
                <strong className="text-emerald-600 text-xs block mt-0.5 font-black font-sans">
                  {inventory.filter(i => i.location === viewingWarehouse.name).reduce((sum, item) => sum + (item.stock || 0), 0)} unit material tersimpan di depo ini.
                </strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingWarehouse(null)}
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
        title="Konfirmasi Hapus Gudang"
        maxWidth="max-w-sm"
      >
        <div className="text-center pb-4 select-none font-sans">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-5 h-5 text-rose-500" />
          </div>
          <span className="text-xs text-slate-800 font-sans block font-semibold mb-1">Membatalkan pendaftaran depo?</span>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Menghapus gudang ini dari daftar master bersifar permanen.
          </p>
        </div>
        
        <div className="flex gap-2 font-sans">
          <button
            type="button"
            onClick={() => setDeleteConfirmId(null)}
            className="bg-slate-150 hover:bg-amber-500 hover:text-slate-950 text-slate-705 font-bold px-4 py-2.5 rounded-xl border-none cursor-pointer w-full text-center text-xs"
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
