import React, { useState } from 'react';
import { 
  Save, 
  Image, 
  Type, 
  Palette, 
  FileText, 
  Upload, 
  Trash2, 
  Send, 
  Smartphone, 
  HelpCircle, 
  CheckCircle2, 
  Lock, 
  Layout, 
  ToggleLeft, 
  ToggleRight 
} from 'lucide-react';
import { CompanySetting, DBState } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';

interface SystemSettingsViewProps {
  dbState: DBState;
  saveCollection: (name: string, data: any) => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ dbState, saveCollection, showToast }) => {
  const currentSettings = dbState.settings || {
    fonnteToken: '', 
    biometricEnabled: false, 
    companyName: '', 
    companyAddress: '', 
    autoDatabaseMigration: false, 
    dbVersion: 1
  };

  const [settings, setSettings] = useState<CompanySetting>(currentSettings);

  const [testPhone, setTestPhone] = useState('');
  const [testName, setTestName] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testSending, setTestSending] = useState(false);

  const handleSave = () => {
    saveCollection('settings', settings);
    showToast('Pengaturan sistem berhasil disimpan', 'success');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: keyof CompanySetting) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran gambar maksimal 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, [key]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const fonts = [
    { value: 'Inter', label: 'Inter (Standard UI)' },
    { value: 'Roboto', label: 'Roboto (Modern)' },
    { value: 'Poppins', label: 'Poppins (Playful)' },
    { value: 'Playfair Display', label: 'Playfair Display (Elegant)' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono (Technical)' },
  ];

  const colors = [
    { value: 'zinc', label: 'Zinc (Neutral)' },
    { value: 'slate', label: 'Slate (Cool Minimal)' },
    { value: 'indigo', label: 'Indigo (Professional)' },
    { value: 'blue', label: 'Blue (Corporate)' },
    { value: 'emerald', label: 'Emerald (Success/Eco)' },
    { value: 'rose', label: 'Rose (Vibrant)' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight font-sans">
              Pengaturan Aplikasi
            </h2>
            <p className="text-xs text-slate-505 mt-0.5 font-sans font-medium text-slate-500">
              Identitas visual, token whatsapp gateway, dan template cetakan dokumen perusahaan.
            </p>
          </div>
        </div>
        
        {/* Save button: icon disket saja tanpa tulisan */}
        <button
          onClick={handleSave}
          type="button"
          className="flex items-center justify-center p-3.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-105 transition-all cursor-pointer border-none active:scale-95 shrink-0"
          title="Simpan Pengaturan"
          id="btn-save-settings"
        >
          <Save className="w-5 h-5 pointer-events-none" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identitas Aplikasi */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
              <Type className="w-5 h-5 text-blue-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">
                Identitas & Tampilan Web
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Nama Website / Perusahaan
                </label>
                <input 
                  type="text" 
                  value={settings.companyName || ''}
                  onChange={e => setSettings({...settings, companyName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 outline-none px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold placeholder:text-slate-405"
                  placeholder="PT Bangun Bersama Mandiri"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Tagline Website / Slogan
                </label>
                <input 
                  type="text" 
                  value={settings.companyTagline || ''}
                  onChange={e => setSettings({...settings, companyTagline: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 outline-none px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold placeholder:text-slate-405"
                  placeholder="Luxe Smart Connected Furniture Architecture"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Alamat Perusahaan
                </label>
                <textarea 
                  value={settings.companyAddress || ''}
                  onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 newline-prevent outline-none px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold placeholder:text-slate-405"
                  placeholder="Jl. Raya Utama No. 88, Jakarta Selatan"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Logo Website
                </label>
                <div className="flex gap-4 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="w-14 h-14 rounded-xl shadow-sm border border-slate-200 overflow-hidden bg-white flex items-center justify-center shrink-0">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Image className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold font-sans cursor-pointer transition-all shadow-sm hover:bg-slate-50">
                      <Upload className="w-3.5 h-3.5 text-slate-505" />
                      <span>Upload Logo</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handleImageUpload(e, 'logoUrl')} 
                      />
                    </label>
                    <p className="text-[9px] text-slate-400 mt-1 font-sans">JPG, PNG atau SVG. Maks 2MB.</p>
                  </div>
                  {settings.logoUrl && (
                    <button 
                      type="button"
                      onClick={() => setSettings({...settings, logoUrl: ''})}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                      title="Hapus Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 pt-0 border-t border-slate-50 mt-4 bg-slate-50/30">
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Tema Warna Utama
                </label>
                <select
                  value={settings.themeColor || 'indigo'}
                  onChange={e => setSettings({...settings, themeColor: e.target.value})}
                  className="w-full bg-white border border-slate-200 outline-none px-3 py-2 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold"
                >
                  {colors.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Font Website
                </label>
                <select
                  value={settings.fontFamily || 'Inter'}
                  onChange={e => setSettings({...settings, fontFamily: e.target.value})}
                  className="w-full bg-white border border-slate-200 outline-none px-3 py-2 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold"
                >
                  {fonts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pengaturan Cetakan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">
                Template Cetak Dokumen
              </h3>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Gambar Kop Surat (Tengah Atas)
                </label>
                
                <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center relative min-h-[96px] text-center">
                  {settings.reportLetterheadUrl ? (
                    <div className="w-full relative py-2">
                      <img src={settings.reportLetterheadUrl} alt="Kop Surat" className="w-full h-12 object-contain rounded-lg" />
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, reportLetterheadUrl: ''})}
                        className="absolute -top-1 -right-1 p-1 bg-white hover:bg-rose-50 text-rose-500 rounded-lg shadow-sm border border-slate-100 transition-colors cursor-pointer"
                        title="Hapus Kop Surat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-1.5 cursor-pointer select-none">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-600 font-sans">Klik untuk Upload Kop Surat</span>
                      <span className="text-[9px] text-slate-400 font-mono">PNG / JPEG ideal panjang</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handleImageUpload(e, 'reportLetterheadUrl')} 
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                  Tanda Tangan Pimpinan / Otoritas
                </label>
                
                <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center relative min-h-[96px] w-full max-w-xs text-center">
                  {settings.reportSignatureUrl ? (
                    <div className="w-full relative py-1">
                      <img src={settings.reportSignatureUrl} alt="Tanda Tangan" className="h-12 object-contain mx-auto mix-blend-multiply" />
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, reportSignatureUrl: ''})}
                        className="absolute -top-1 right-0 p-1 bg-white hover:bg-rose-50 text-rose-500 rounded-lg shadow-sm border border-slate-100 transition-colors cursor-pointer"
                        title="Hapus Tanda Tangan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-1.5 cursor-pointer select-none">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-600 font-sans">Upload Tanda Tangan</span>
                      <span className="text-[9px] text-slate-400 font-mono">PNG Transparan direkomendasikan</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handleImageUpload(e, 'reportSignatureUrl')} 
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 pt-0 border-t border-slate-50 mt-4 bg-slate-50/30">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans mt-4 mb-2">
              Model Model Layout Cetak
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Invoice</label>
                <select
                  value={settings.invoiceLayout || 'standard'}
                  onChange={e => setSettings({...settings, invoiceLayout: e.target.value as any})}
                  className="w-full bg-white border border-slate-200 outline-none px-3 py-2 rounded-xl focus:border-blue-600 transition-all text-slate-800 font-sans text-xs font-semibold"
                >
                  <option value="standard">Standard Elegan</option>
                  <option value="modern">Modern Terkini</option>
                  <option value="minimalist">Minimalis Struk</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Kwitansi</label>
                <select
                  value={settings.receiptLayout || 'standard'}
                  onChange={e => setSettings({...settings, receiptLayout: e.target.value as any})}
                  className="w-full bg-white border border-slate-200 outline-none px-3 py-2 rounded-xl focus:border-blue-600 transition-all text-slate-800 font-sans text-xs font-semibold"
                >
                  <option value="standard">Standard Elegan</option>
                  <option value="modern">Modern Terkini</option>
                  <option value="minimalist">Minimalis Kasir</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Surat Jalan (DO)</label>
                <select
                  value={settings.suratJalanLayout || 'standard'}
                  onChange={e => setSettings({...settings, suratJalanLayout: e.target.value as any})}
                  className="w-full bg-white border border-slate-200 outline-none px-3 py-2 rounded-xl focus:border-blue-600 transition-all text-slate-800 font-sans text-xs font-semibold"
                >
                  <option value="standard">Standard Pengiriman</option>
                  <option value="modern">Tabel Modern</option>
                  <option value="minimalist">Kompak & Simpel</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INTEGRASI WHATSAPP GATEWAY (FONNTE) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fadeIn mt-6">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-white to-blue-50/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <Smartphone className="w-5 h-5 text-emerald-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-sans">
                Modul Integrasi WhatsApp Gateway (Fonnte)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-sans font-medium">
                Konfigurasi API Token dan template triggers otomatis untuk proyek, janji temu, dan penagihan.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!settings.fonnteToken ? (
              <span className="bg-amber-50 text-amber-600 border border-amber-200/50 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wide inline-flex items-center gap-1 font-sans">
                ⚠️ Simulasi Gateway
              </span>
            ) : settings.fonnteToken === 'FONNTE_DEMO_TOKEN_12345ABCDE' ? (
              <span className="bg-blue-50 text-blue-600 border border-blue-200/50 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wide inline-flex items-center gap-1 font-sans">
                ● DEMO TOKENS
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200/50 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wide inline-flex items-center gap-1 animate-pulse font-sans">
                ● GATEWAY AKTIF
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Token input card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 max-w-xl">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between font-sans">
                  <span>Fonnte API Token</span>
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" title="Minta token API Anda melalui dashboard fonnte.com" />
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={settings.fonnteToken || ''}
                    onChange={e => setSettings({...settings, fonnteToken: e.target.value})}
                    className="w-full bg-white border border-slate-200 outline-none px-4 py-3 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-mono text-xs font-semibold placeholder:text-slate-400"
                    placeholder="Masukkan token API Fonnte (Contoh: FONNTE_DEMO_TOKEN_12345ABCDE)"
                  />
                </div>
                {!settings.fonnteToken && (
                  <p className="text-[10px] text-amber-600 leading-relaxed font-sans mt-1 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                    * Token kosong. Sistem akan menggunakan mode <strong>Simulasi WhatsApp</strong>. Notifikasi berhasil terpicu namun hanya terekam pada audit log dan simulasi visual untuk pengujian aman tanpa kuota pulsa.
                  </p>
                )}
                {settings.fonnteToken === 'FONNTE_DEMO_TOKEN_12345ABCDE' && (
                  <p className="text-[10px] text-blue-600 leading-relaxed font-sans mt-1 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                    * Mode <strong>Demo Token</strong> aktif. Sandbox simulasi visual di sudut kanan bawah akan muncul setiap ada trigger.
                  </p>
                )}
                {settings.fonnteToken && settings.fonnteToken !== 'FONNTE_DEMO_TOKEN_12345ABCDE' && (
                  <p className="text-[10px] text-emerald-600 leading-relaxed font-sans mt-1 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                    * Token kustom dikonfigurasi. Sistem akan melakukan pengiriman HTTP POST nyata ke server Fonnte secara real-time.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CUSTOMISABLE WHATSAPP EVENT TEMPLATES SECTION */}
          <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-6">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">
                Kustomisasi Template Pesan WhatsApp
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
                Konfigurasi pesan otomatis yang dikirimkan. Gunakan placeholders dinamis di dalam kurawal.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Event 1: Proyek */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sans">
                      1. Event Proyek Interior
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings({...settings, whatsappAutoProject: !settings.whatsappAutoProject})}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-sans uppercase transition-all tracking-wider border cursor-pointer ${
                        settings.whatsappAutoProject !== false 
                          ? 'bg-emerald-500 text-white border-transparent shadow-sm' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {settings.whatsappAutoProject !== false ? 'Otomatis' : 'Mati'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template Proyek Baru</span>
                      <textarea
                        value={settings.whatsappTemplateProjectNew || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateProjectNew: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template proyek baru..."
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template Update Proyek</span>
                      <textarea
                        value={settings.whatsappTemplateProjectUpdate || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateProjectUpdate: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template update proyek..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg text-[10px] text-slate-500 leading-relaxed font-sans mt-3">
                  <strong>Tags:</strong> <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{project_name}'}</code>, <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{project_status}'}</code>, <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{client_name}'}</code>
                </div>
              </div>

              {/* Event 2: Pesanan Baru */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sans">
                      2. Event Pesanan & PO
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings({...settings, whatsappAutoOrder: !settings.whatsappAutoOrder})}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-sans uppercase transition-all tracking-wider border cursor-pointer ${
                        settings.whatsappAutoOrder !== false 
                          ? 'bg-emerald-500 text-white border-transparent shadow-sm' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {settings.whatsappAutoOrder !== false ? 'Otomatis' : 'Mati'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template Invoice Termin Klien</span>
                      <textarea
                        value={settings.whatsappTemplateOrderSales || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateOrderSales: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template invoice penjualan..."
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template PO Supplier</span>
                      <textarea
                        value={settings.whatsappTemplateOrderPurchase || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateOrderPurchase: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template Purchase Order..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg text-[10px] text-slate-500 leading-relaxed font-sans mt-3">
                  <strong>Sales:</strong> <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{client_name}'}</code>, <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{order_code}'}</code>, <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{order_amount}'}</code>
                </div>
              </div>

              {/* Event 3: Penugasan / Peminjaman Alat */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sans">
                      3. Pinjam Alat & Tugas
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettings({...settings, whatsappAutoTask: !settings.whatsappAutoTask})}
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-sans uppercase transition-all tracking-wider border cursor-pointer ${
                        settings.whatsappAutoTask !== false 
                          ? 'bg-emerald-500 text-white border-transparent shadow-sm' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {settings.whatsappAutoTask !== false ? 'Otomatis' : 'Mati'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template Peminjaman Alat (Loan)</span>
                      <textarea
                        value={settings.whatsappTemplateTaskLoan || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateTaskLoan: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template peminjaman alat..."
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider font-sans block">Template Pengembalian Alat (Return)</span>
                      <textarea
                        value={settings.whatsappTemplateTaskReturn || ''}
                        onChange={e => setSettings({...settings, whatsappTemplateTaskReturn: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 outline-none p-3 rounded-lg focus:border-blue-600 focus:bg-white text-slate-700 font-mono text-[11px] leading-relaxed resize-none"
                        rows={3}
                        placeholder="Template pengembalian alat..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg text-[10px] text-slate-500 leading-relaxed font-sans mt-3">
                  <strong>Tags:</strong> <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{employee_name}'}</code>, <code className="bg-white px-1 leading-none rounded text-blue-600 font-mono text-[9px]">{'{task_name}'}</code>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Left side: Automation triggers detail */}
            <div className="space-y-4">
              <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                Informasi Otomatisasi Transmisi WA
              </h4>
              
              <div className="border border-slate-100 rounded-2xl bg-white divide-y divide-slate-100 text-xs">
                <div className="p-4 flex gap-3.5 hover:bg-slate-50 transition-colors rounded-t-2xl">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <div>
                    <strong className="text-slate-800 font-sans block mb-0.5 font-bold">1. Notifikasi Absensi Karyawan</strong>
                    <span className="text-[11px] text-slate-505 leading-relaxed font-sans text-slate-500">Pesan real-time dikirimkan ke HP Karyawan saat melakukan Check-In dan Check-Out absensi, memuat waktu tepat dan informasi denda keterlambatan berjalan.</span>
                  </div>
                </div>

                <div className="p-4 flex gap-3.5 hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <div>
                    <strong className="text-slate-800 font-sans block mb-0.5 font-bold">2. Janji Temu & Survei Ruang</strong>
                    <span className="text-[11px] text-slate-505 leading-relaxed font-sans text-slate-500">Saat jadwal peninjauan/survei baru didaftarkan, sistem otomatis menyapa pelanggan, menyertakan kode berkas, nama surveyor, dan tanggal janji temu.</span>
                  </div>
                </div>

                <div className="p-4 flex gap-3.5 hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                  <div>
                    <strong className="text-slate-800 font-sans block mb-0.5 font-bold">3. Tagihan / Termin Pembayaran</strong>
                    <span className="text-[11px] text-slate-505 leading-relaxed font-sans text-slate-500">Tanda terima pembayaran yang sah (Termin/DP) terkirim otomatis dengan detail jumlah pembayaran, faktur tagihan acuan, dan nominal sisa pelunasan.</span>
                  </div>
                </div>

                <div className="p-4 flex gap-3.5 hover:bg-slate-50 transition-colors rounded-b-2xl">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                  <div>
                    <strong className="text-slate-800 font-sans block mb-0.5 font-bold">4. Perubahan Status Proyek</strong>
                    <span className="text-[11px] text-slate-505 leading-relaxed font-sans text-slate-500">Begitu status pengerjaan interior diupdate (Planning, Design, Execution, Completed), klien langsung mendapatkan update otomatis kemajuan proyek.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Sandbox manual message tester */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest block font-sans mb-3">
                  Uji Pengetesan Sandbox (Manual Tester WA)
                </h4>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block font-sans">Nomor HP Penerima</label>
                      <input 
                        type="text"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        placeholder="Contoh: 0812345678"
                        className="w-full bg-white border border-slate-200 outline-none px-3.5 py-2.5 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block font-sans">Nama Penerima</label>
                      <input 
                        type="text"
                        value={testName}
                        onChange={e => setTestName(e.target.value)}
                        placeholder="Misal: Bapak Budi"
                        className="w-full bg-white border border-slate-200 outline-none px-3.5 py-2.5 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block font-sans">Isi Pesan Tes</label>
                    <textarea 
                      value={testMsg}
                      onChange={e => setTestMsg(e.target.value)}
                      placeholder="Tulis pesan pengujian WhatsApp Anda di sini..."
                      rows={3}
                      className="w-full bg-white border border-slate-200 outline-none px-3.5 py-2.5 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-sans text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={async () => {
                  if (!testPhone || !testName || !testMsg) {
                    showToast('Lengkapi nomor telepon, nama, dan isi pesan untuk tes!', 'error');
                    return;
                  }
                  setTestSending(true);
                  try {
                    const result = await sendWhatsAppNotification({
                      phone: testPhone,
                      recipientName: testName,
                      message: testMsg
                    });
                    if (result.success) {
                      showToast(`Uji transmisi berhasil! ${result.details}`, 'success');
                      setTestMsg('');
                    } else {
                      showToast(`Gagal: ${result.details}`, 'error');
                    }
                  } catch (err: any) {
                    showToast(`Koneksi error: ${err.message || err}`, 'error');
                  } finally {
                    setTestSending(false);
                  }
                }}
                disabled={testSending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 font-sans text-xs font-black tracking-widest uppercase transition-all shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] cursor-pointer border-none flex items-center justify-center gap-2 mt-4 disabled:bg-blue-400"
              >
                <Send className={`w-3.5 h-3.5 ${testSending ? 'animate-bounce' : ''}`} />
                <span>{testSending ? 'Membuka Sandbox API & Mengirim...' : 'Kirim Pesan Uji Coba'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
