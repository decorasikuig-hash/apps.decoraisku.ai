/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Edit, Trash2, Eye, X, Check, ArrowUpDown, Save } from 'lucide-react';

export interface CrudField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date';
  options?: string[]; // for select types
  required?: boolean;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}

interface CrudTableProps<T> {
  title: string;
  description: string;
  items: T[];
  fields: CrudField[];
  searchKey: keyof T;
  searchPlaceholder?: string;
  onSave: (item: T) => void;
  onDelete: (id: string) => void;
  renderRow?: (item: T) => React.ReactNode;
  whatsappNoticeHandler?: (action: 'create' | 'update', item: T) => void; // Option to send WhatsApp notification
}

import { Modal } from './Modal';

export function CrudTable<T extends { id: string }>({
  title,
  description,
  items,
  fields,
  searchKey,
  searchPlaceholder = 'Cari data...',
  onSave,
  onDelete,
  whatsappNoticeHandler,
}: CrudTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [viewingItem, setViewingItem] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter & Search
  const filteredItems = items.filter(item => {
    const value = item[searchKey];
    if (!value) return false;
    return String(value).toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = (a as any)[sortKey];
    const valB = (b as any)[sortKey];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  // Pagination Logic
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, sortAsc]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleOpenAdd = () => {
    const defaultData: Record<string, any> = { id: `id-${Date.now()}` };
    fields.forEach(f => {
      defaultData[f.key] = f.type === 'number' ? 0 : '';
    });
    setFormState(defaultData);
    setEditingItem(null);
    setValidationError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: T) => {
    setFormState({ ...item });
    setEditingItem(item);
    setValidationError(null);
    setIsFormOpen(true);
  };

  const handleOpenView = (item: T) => {
    setViewingItem(item);
  };

  const handleInputChange = (key: string, value: any, type: string) => {
    setFormState(prev => ({
      ...prev,
      [key]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate
    for (const field of fields) {
      if (field.required && !formState[field.key] && formState[field.key] !== 0) {
        setValidationError(`Kolom "${field.label}" wajib diisi.`);
        return;
      }
    }

    // Save
    const itemToSave = formState as T;
    onSave(itemToSave);

    // Optional WA hook
    if (whatsappNoticeHandler) {
      const mode = editingItem ? 'update' : 'create';
      whatsappNoticeHandler(mode, itemToSave);
    }

    setIsFormOpen(false);
  };

  return (
    <div className="bg-white   -3xl p-6  animate-fadeIn min-h-[calc(100vh-120px)] flex flex-col h-full uppercase bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
      {/* Header Panel */}
      <div className="flex flex-row items-center justify-between pb-6 border-b border-slate-100 gap-4 shrink-0">
        <div>
          <h3 className="text-lg text-slate-900 tracking-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{title}</h3>
          <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">{description}</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center bg-[#2563eb] text-white rounded-xl w-10 h-10 hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
          title="Tambah Baru"
        >
          <Plus className="w-5 h-5 font-bold" />
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="py-4 flex gap-3 max-w-md shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-slate-50 transition-all duration-250 font-medium focus:bg-white hover:bg-slate-100/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Grid Container Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/10 flex-grow scrollbar-hide">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-500 font-sans uppercase tracking-wider">
              {fields.map(f => (
                <th
                  key={f.key}
                  onClick={() => toggleSort(f.key)}
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none font-semibold text-slate-600 align-middle whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    {f.label}
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-amber-500 hover:text-slate-950/50 transition-colors font-sans text-slate-700"
                >
                  {fields.map(f => {
                    const val = (item as any)[f.key];
                    let displayVal = val;

                    // Formatter for values
                    if (f.key.toLowerCase().includes('price') || f.key.toLowerCase().includes('budget') || f.key.toLowerCase().includes('cost') || f.key.toLowerCase().includes('amount')) {
                      displayVal = `Rp ${Number(val).toLocaleString('id-ID')}`;
                    }

                    return (
                      <td key={f.key} className="px-6 py-4 font-sans font-medium whitespace-nowrap">
                        {f.type === 'select' ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                              String(val).toLowerCase() === 'active' || String(val).toLowerCase() === 'completed' || String(val).toLowerCase() === 'income' || String(val).toLowerCase() === 'lunas'
                                ? 'bg-teal-50 text-teal-605 border border-teal-100'
                                : String(val).toLowerCase() === 'pending' || String(val).toLowerCase() === 'design' || String(val).toLowerCase() === 'expense' || String(val).toLowerCase() === 'penerimaan'
                                ? 'bg-indigo-50 text-indigo-650 border border-indigo-100'
                                : 'bg-slate-50 text-slate-500 border border-slate-150'
                            }`}
                          >
                            {displayVal}
                          </span>
                        ) : (
                          <span className={`${f.type === 'number' ? 'font-mono' : ''}`}>
                            {f.prefix && `${f.prefix} `}
                            {displayVal}
                            {f.suffix && ` ${f.suffix}`}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenView(item)}
                        title="Detail"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer border-none bg-transparent"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Ubah"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer border-none bg-transparent"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        title="Hapus"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border-none bg-transparent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={fields.length + 1} className="px-6 py-12 text-center text-slate-400 font-sans font-medium uppercase">
                  Data tidak ditemukan atau inventori kosong.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION UI */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            Menampilkan <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari <span className="text-slate-900">{totalItems}</span> data
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
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  totalPages <= 5 || 
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center border ${
                        currentPage === pageNum 
                          ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm border-indigo-600 shadow-md shadow-indigo-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  (pageNum === 2 && currentPage > 3) || 
                  (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                }
                return null;
              })}
            </div>

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

      {/* MODAL 1: FORM (Add / Edit) */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingItem ? 'Perbarui Data' : 'Tambah Rekaman Baru'}
        maxWidth="max-w-2xl"
      >
        <p className="text-xs text-slate-500 mb-5 -mt-2 font-sans">Isi formulir dengan valid untuk menyimpan data interior.</p>
        <form onSubmit={handleFormSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(f => (
                  <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>

                    {f.type === 'textarea' ? (
                      <textarea
                        required={f.required}
                        value={formState[f.key] || ''}
                        onChange={(e) => handleInputChange(f.key, e.target.value, f.type)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                      />
                    ) : f.type === 'select' ? (
                      <select
                        required={f.required}
                        value={formState[f.key] || ''}
                        onChange={(e) => handleInputChange(f.key, e.target.value, f.type)}
                        className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                      >
                        <option value="">-- Pilih {f.label} --</option>
                        {f.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        {f.prefix && (
                          <span className="absolute left-3 top-3 text-[11px] font-semibold text-slate-450 uppercase">{f.prefix}</span>
                        )}
                        <input
                          type={f.type}
                          required={f.required}
                          value={formState[f.key] === 0 ? 0 : formState[f.key] || ''}
                          onChange={(e) => handleInputChange(f.key, e.target.value, f.type)}
                          placeholder={f.placeholder}
                          className={`w-full bg-slate-50 focus:bg-white transition-all border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all duration-200 ${f.prefix ? 'pl-9' : ''} ${f.suffix ? 'pr-9' : ''}`}
                        />
                        {f.suffix && (
                          <span className="absolute right-3 top-3 text-[11px] font-semibold text-slate-400 uppercase">{f.suffix}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {validationError && (
                  <div className="md:col-span-2 text-rose-500 font-sans text-xs bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                    {validationError}
                  </div>
                )}
          </div>

                <div className="pt-4 mt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4.5 py-2.5 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer select-none"
                  >
                    <X className="w-4 h-4 mr-1" /> Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                  >
                    <Save className="w-4 h-4 mr-1" /> Simpan Data
                  </button>
                </div>
              </form>
      </Modal>

      {/* MODAL 2: VIEW DETAILS */}
      <Modal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        title="Keterangan Detail Data"
        maxWidth="max-w-md"
      >
        {viewingItem && (
          <>
            <div className="space-y-3 font-sans text-xs">
                {fields.map(f => {
                  const val = (viewingItem as any)[f.key];
                  let displayVal = val;

                  if (f.key.toLowerCase().includes('price') || f.key.toLowerCase().includes('budget') || f.key.toLowerCase().includes('cost') || f.key.toLowerCase().includes('amount')) {
                    displayVal = `Rp ${Number(val).toLocaleString('id-ID')}`;
                  }

                  return (
                    <div key={f.key} className="pb-2.5 border-b border-slate-100 flex justify-between gap-4 items-start">
                      <span className="text-slate-500 font-semibold">{f.label}:</span>
                      <span className="text-slate-800 font-medium text-right max-w-[200px] break-words">
                        {f.prefix && `${f.prefix} `}
                        {displayVal}
                        {f.suffix && ` ${f.suffix}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  Tutup Rincian
                </button>
              </div>
          </>
        )}
      </Modal>
    </div>
  );
}
