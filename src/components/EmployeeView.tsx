
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Users, 
  MoreHorizontal,
  Eye,
  User 
} from 'lucide-react';
import { DBState, Employee } from '../types';
import { Modal } from './Modal';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onPrint: (employee: Employee) => void;
  onDelete: (id: string) => void;
  searchTerm?: string;
}

export const EmployeeView: React.FC<EmployeeViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole,
  onView,
  onEdit,
  onPrint,
  onDelete,
  searchTerm = ''
}) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Basic list handling
  const employees = dbState.employees || [];
  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Pagination Logic
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page on search
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="animate-fadeIn flex flex-col h-full space-y-6">
      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white flex-grow">
        <table className="w-full text-left text-xs text-slate-700 leading-normal border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100/80 text-[10px] font-bold text-slate-400 font-mono uppercase">
              <th className="px-4 py-3 text-center">No</th>
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Nama / NIP</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">No. WA</th>
              <th className="px-4 py-3">Bank (Rekening)</th>
              <th className="px-4 py-3">Role / Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {paginatedEmployees.map((emp, index) => (
              <tr key={emp.id} className="hover:bg-amber-500 hover:text-slate-950/50">
                <td className="px-4 py-3.5 text-center text-slate-500">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                <td className="px-4 py-3.5">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-mono font-bold">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-850">{emp.name}</div>
                    <div className="font-mono text-slate-400 text-[10px]">{emp.nip}</div>
                </td>
                <td className="px-4 py-3.5 text-slate-600">{emp.email}</td>
                <td className="px-4 py-3.5 font-mono text-slate-600">{emp.phone}</td>
                <td className="px-4 py-3.5 text-slate-600">
                    <div>{emp.bank_name || '-'}</div>
                    <div className="font-mono text-[10px] text-slate-400">{emp.bank_account || '-'}</div>
                </td>
                <td className="px-4 py-3.5">
                    <div className="text-slate-800">{emp.role}</div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${emp.status === 'Aktif' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-500'}`}>
                      {emp.status}
                    </span>
                </td>
                 <td className="px-4 py-3.5 text-right relative whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(activeDropdownId === emp.id ? null : emp.id);
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer border-none bg-transparent inline-flex items-center justify-center ${
                        activeDropdownId === emp.id
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                      title="Pilihan Aksi"
                    >
                      <MoreHorizontal className="w-5 h-5 pointer-events-none" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {activeDropdownId === emp.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute right-4 top-11 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.12)] py-1.5 z-40 text-left min-w-[145px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onView(emp);
                            setActiveDropdownId(null);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Detail & Riwayat
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onEdit(emp);
                            setActiveDropdownId(null);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-500" />
                          Ubah Data
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onPrint(emp);
                            setActiveDropdownId(null);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                        >
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          Cetak ID Card
                        </button>

                        {currentUserRole === 'super_admin' || currentUserRole === 'admin' ? (
                          <div className="border-t border-slate-100 my-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(emp.id);
                                setActiveDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-rose-50 text-rose-600 hover:text-rose-705 text-[11px] font-bold flex items-center gap-2 cursor-pointer border-none bg-transparent"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              Hapus Karyawan
                            </button>
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-xs font-medium">Belum ada data karyawan.</p>
          </div>
        )}
      </div>

      {/* PAGINATION UI */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-auto shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-slate-900">{totalItems}</span> results
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
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  totalPages <= 7 || 
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
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
