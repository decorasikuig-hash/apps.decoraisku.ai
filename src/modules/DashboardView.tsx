import React from 'react';
import { Home, Package, Wallet, CheckCircle2, Bell, Send } from 'lucide-react';
import type { ModuleProps } from './registry';

export default function DashboardView({ dbState }: ModuleProps) {
  const totalProjectsNum = dbState.projects?.length || 0;
  const totalStockItems = dbState.inventory?.reduce((acc: number, i: any) => acc + i.stock, 0) || 0;
  const totalIncome = dbState.transactions?.filter((t: any) => t.type === 'Pemasukan').reduce((acc: number, t: any) => acc + t.amount, 0) || 0;
  const totalExpense = dbState.transactions?.filter((t: any) => t.type === 'Pengeluaran').reduce((acc: number, t: any) => acc + t.amount, 0) || 0;
  const netBalance = totalIncome - totalExpense;

  const formatIDR = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="pb-4 font-sans mb-6">
        <h2 className="text-xl tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">Dashboard Utama</h2>
        <p className="text-slate-500 text-[11px] mt-0.5">
          Ringkasan aktivitas operasional, status proyek mebel, sediaan barang gudang, dan posisi likuiditas kas secara real-time.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-5 flex items-center gap-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Home className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] text-[#8fa0be] font-sans tracking-wider uppercase font-extrabold">Aktif Proyek</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{totalProjectsNum} <span className="text-xs font-semibold text-slate-400">Kontrak</span></div>
          </div>
        </div>

        <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-5 flex items-center gap-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Package className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] text-[#8fa0be] font-sans tracking-wider uppercase font-extrabold">Mebel Gudang</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{totalStockItems} <span className="text-xs font-semibold text-slate-400">Pcs</span></div>
          </div>
        </div>

        <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-5 flex items-center gap-4 col-span-2 sm:col-span-1 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wallet className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="text-[10px] text-[#8fa0be] font-sans tracking-wider uppercase font-extrabold">Dana Likuid Bersih</div>
            <div className="text-lg font-black text-emerald-600 mt-0.5">{formatIDR(netBalance)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <h4 className="text-sm text-slate-900 mb-2 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
            <Wallet className="w-4 h-4 text-blue-600" />
            Arus Finansial Akuntansi (IDR)
          </h4>
          <p className="text-[#8fa0be] text-xs font-medium font-sans mb-4 leading-relaxed">
            Visualisasi modal masuk dari penagihan DP termin klien dibanding pengeluaran upah opnam & material.
          </p>
          <div className="p-4 rounded-xl bg-[#f1f5f9]">
            <div className="h-28 flex items-end justify-between gap-4 pt-3.5">
              <div className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-8 bg-slate-200/50 hover:bg-slate-300 rounded-t-lg transition-colors" style={{ height: '35%' }} />
                <span className="text-[9px] text-[#8fa0be] font-medium mt-2">Mar</span>
              </div>
              <div className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-8 bg-slate-200/50 hover:bg-slate-300 rounded-t-lg transition-colors" style={{ height: '62%' }} />
                <span className="text-[9px] text-[#8fa0be] font-medium mt-2">Apr</span>
              </div>
              <div className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-8 bg-blue-200 rounded-t-lg" style={{ height: '80%' }} />
                <span className="text-[9px] text-blue-500 font-semibold mt-2">Mei</span>
              </div>
              <div className="flex flex-col items-center flex-1 h-full justify-end">
                <div className="w-8 bg-[#2563eb] rounded-t-lg shadow-[0_-2px_10px_rgba(37,99,235,0.2)]" style={{ height: '95%' }} />
                <span className="text-[9px] text-slate-600 font-bold mt-2">Jun</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <h4 className="text-sm text-slate-900 mb-2 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Status Produksi Mebel & Site
          </h4>
          <p className="text-[#8fa0be] text-xs font-medium font-sans mb-4 leading-relaxed">
            Distribusi progres tahap pengerjaan mebel klasik {dbState.settings.companyName} saat ini.
          </p>
          <div className="space-y-5 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Penyusunan Desain & RAB</span>
                <strong className="text-blue-600">33%</strong>
              </div>
              <div className="text-[10px] text-[#8fa0be] mb-2 font-medium">1 Proyek Klien aktif</div>
              <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: '33.3%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Manufaktur Woodworking</span>
                <strong className="text-emerald-500">66%</strong>
              </div>
              <div className="text-[10px] text-[#8fa0be] mb-2 font-medium">2 Proyek Sourcing aktif</div>
              <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: '66.6%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white -2xl -[0_4px_20px_rgba(0,0,0,0.03)]  p-6 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <h4 className="text-sm text-slate-900 mb-4 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
          <Bell className="w-4 h-4 text-blue-500 animate-pulse" />
          Audit Log Notifikasi Real-time & Gateway Transmisi Fonnte
        </h4>
        
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 text-xs">
          {dbState.notifications && dbState.notifications.map((notif: any) => (
            <div 
              key={notif.id} 
              className={`p-4 rounded-2xl flex items-start gap-3 transition-all ${
                notif.type === 'success' ? 'bg-[#f1f5f9]' :
                notif.type === 'warning' ? 'bg-[#f1f5f9]' :
                'bg-[#f1f5f9]'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {notif.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>
              
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-800 font-bold">{notif.title}</span>
                  <span className="text-[10px] text-[#8fa0be] font-medium">
                    {new Date(notif.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 font-medium mt-1 leading-relaxed">{notif.message}</p>
                
                {notif.whatsappSent && (
                  <div className="mt-3 p-3 bg-white     flex items-start gap-2 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                    <Send className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="break-words w-full">
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">Fonnte API Delivered</div>
                      <div className="text-slate-500 italic font-medium">"{notif.whatsappMessage}"</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
