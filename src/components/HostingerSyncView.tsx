/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, CloudLightning, RefreshCw, Download, Upload, Globe, Check, Copy, Terminal, CheckCircle, AlertTriangle, Info, Server, FileText, Save } from 'lucide-react';
import { DBState, CompanySetting } from '../types';
import { isProductionHosting } from '../utils/database';

interface HostingerSyncViewProps {
  dbState: DBState;
  saveCollection: <K extends keyof DBState>(key: K, data: DBState[K]) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserRole: string;
}

export const HostingerSyncView: React.FC<HostingerSyncViewProps> = ({
  dbState,
  saveCollection,
  showToast,
  currentUserRole
}) => {
  const settings = dbState.settings;

  // Sync inputs locally
  const [syncEnabled, setSyncEnabled] = useState(settings.hostingerSyncEnabled || false);
  const [apiUrl, setApiUrl] = useState(settings.hostingerApiUrl || './api.php');
  const [autoPush, setAutoPush] = useState(settings.hostingerAutoPush || false);

  // States
  const [checking, setChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTED_JSON' | 'CONNECTED_MYSQL' | 'ERROR'>('DISCONNECTED');
  const [serverDetails, setServerDetails] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Auto-check connection on load
  useEffect(() => {
    handleCheckConnection(apiUrl);
  }, []);

  const handleCheckConnection = async (targetUrl: string) => {
    if (!targetUrl) return;

    // Skip testing relative paths in sandbox/preview to avoid fetching HTML instead of JSON
    const onHost = isProductionHosting();
    const isRelative = !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://');
    if (isRelative && !onHost) {
      setConnectionStatus('DISCONNECTED');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(`${targetUrl}?action=ping`);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || (contentType && !contentType.includes("application/json"))) {
        throw new Error("Respons bukan JSON");
      }
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (jErr) {
        throw new Error("Respons format JSON tidak valid");
      }
      
      if (data && data.status === 'ok') {
        setServerDetails(data);
        if (data.mode === 'MYSQL_DATABASE') {
          setConnectionStatus('CONNECTED_MYSQL');
          showToast('Terkoneksi ke Hostinger MySQL Database!', 'success');
        } else {
          setConnectionStatus('CONNECTED_JSON');
          showToast('Terkoneksi ke Hostinger File JSON Database!', 'success');
        }
      } else {
        setConnectionStatus('ERROR');
        setServerDetails(null);
      }
    } catch (e) {
      setConnectionStatus('ERROR');
      setServerDetails(null);
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: CompanySetting = {
      ...settings,
      hostingerSyncEnabled: syncEnabled,
      hostingerApiUrl: apiUrl,
      hostingerAutoPush: autoPush
    };
    saveCollection('settings', updatedSettings);
    showToast('Kredensial Hostinger Sync berhasil dikunci!', 'success');
    handleCheckConnection(apiUrl);
  };

  // Push All Data to Server
  const handlePushAll = async () => {
    if (!apiUrl) {
      showToast('Tentukan URL Api terlebih dahulu!', 'error');
      return;
    }
    setSyncLoading(true);
    try {
      const res = await fetch(`${apiUrl}?action=save_state&overwrite=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbState)
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || (contentType && !contentType.includes("application/json"))) {
        throw new Error("Respons server bukan JSON yang valid.");
      }
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (jErr) {
        throw new Error("Format respons JSON tidak valid.");
      }
      if (data && data.status === 'success') {
        showToast('Push Berhasil! Semua draf database berhasil dicadangkan ke Hostinger.', 'success');
      } else {
        showToast('Push Gagal: ' + (data.message || 'Error tidak dikenal'), 'error');
      }
    } catch (e: any) {
      showToast('Koneksi Gagal: ' + e.message, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // Pull All Data from Server
  const handlePullAll = async () => {
    if (!apiUrl) {
      showToast('Tentukan URL Api terlebih dahulu!', 'error');
      return;
    }
    let confirmed = false;
    try {
      confirmed = window.confirm('PERINGATAN: Menarik data server akan menimpa seluruh database lokal browser Anda. Lanjutkan?');
    } catch (e) {
      console.warn('Sandbox iframe confirm blocked, auto-confirming action.', e);
      confirmed = true;
    }
    if (!confirmed) return;
    
    setSyncLoading(true);
    try {
      const res = await fetch(`${apiUrl}?action=get_state`);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || (contentType && !contentType.includes("application/json"))) {
        throw new Error("Respons server bukan JSON yang valid.");
      }
      const text = await res.text();
      let resData: any = null;
      try {
        resData = JSON.parse(text);
      } catch (jErr) {
        throw new Error("Format respons JSON tidak valid.");
      }
      
      if (resData && resData.status === 'success' && resData.data) {
        const state = resData.data;
        // Seed each collection
        Object.keys(state).forEach((collectionKey) => {
          if (collectionKey in dbState) {
            saveCollection(collectionKey as keyof DBState, state[collectionKey]);
          }
        });
        showToast('Tarik Data Berhasil! Database terupdate sinkron dengan Hostinger.', 'success');
      } else {
        showToast('Gagal menarik data: Database Hostinger masih kosong atau data korup.', 'error');
      }
    } catch (e: any) {
      showToast('Koneksi Gagal: ' + e.message, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // Generate SQL export file contents for phpMyAdmin
  const handleDownloadSQL = () => {
    let sql = `-- LuxeLiving ERP Relational Schema Database Dump\n`;
    sql += `-- Generated At: ${new Date().toISOString()}\n`;
    sql += `-- Target: MySQL (Hostinger Cloud Database)\n\n`;
    
    sql += `CREATE TABLE IF NOT EXISTS erp_db_store (\n`;
    sql += `  key_name VARCHAR(100) PRIMARY KEY,\n`;
    sql += `  data_val LONGTEXT NOT NULL,\n`;
    sql += `  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\n`;
    sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

    // Dump values as inserts
    Object.keys(dbState).forEach((key) => {
      const jsonStr = JSON.stringify((dbState as any)[key]);
      const escapedJson = jsonStr.replace(/'/g, "''");
      sql += `INSERT INTO erp_db_store (key_name, data_val) VALUES ('erp_${key}', '${escapedJson}')\n`;
      sql += `ON DUPLICATE KEY UPDATE data_val = VALUES(data_val);\n\n`;
    });

    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `luxeliving_erp_hostinger_export.sql`;
    link.click();
    showToast('SQL Database Script berhasil dibuat & diunduh!', 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn text-left opacity-75 grayscale-[0.5] min-h-[calc(100vh-120px)] flex flex-col h-full">
      
      {/* HEADER HERO */}
      <div className="p-6 bg-slate-900 border border-slate-850 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute right-[-10%] top-[-20%] w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <span className={`text-white text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider mb-2.5 inline-block ${syncEnabled ? 'bg-emerald-600 animate-pulse' : 'bg-slate-600'}`}>
          {syncEnabled ? 'Sync Hostinger Aktif' : 'Sync Hostinger Standby'}
        </span>
        <h2 className="text-2xl text-white tracking-tight leading-none font-bold font-sans capitalize">
          Integrasi Database Hostinger (Cloud Sync)
        </h2>
        <p className="text-slate-400 text-xs mt-1.5 max-w-xl font-sans leading-relaxed">
          Hubungkan aplikasi ERP Anda dengan database eksternal di Hostinger (MySQL atau JSON). Data akan disinkronkan secara real-time untuk mendukung kolaborasi antar perangkat di luar jaringan lokal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* SYNC PANEL & CONNECTION CARD */}
        <div className="md:col-span-8 space-y-6">
          
          {/* SYNC CONFIGURATION FORM */}
          <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 space-y-5">
            <h3 className="text-base text-slate-900 flex items-center gap-1.5 font-semibold font-sans capitalize">
              <Server className="w-5 h-5 text-indigo-600" />
              Setelan Konektor Database Hostinger
            </h3>
            
            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs font-sans text-left font-bold text-slate-705">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="font-sans text-slate-850 font-bold block text-sm">Status Koneksi Hostinger</span>
                  <span className="text-[10px] text-slate-505 font-normal font-sans block mt-0.5">
                    Aktifkan sinkronisasi backend PHP (api.php) untuk penyimpanan cloud permanen.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={syncEnabled}
                    onChange={(e) => setSyncEnabled(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              {syncEnabled && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Target Endpoint API URL Hostinger (api.php):</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      placeholder="e.g. ./api.php atau https://domainanda.com/api.php"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      required
                    />
                    <span className="text-[10px] text-slate-400 font-normal block mt-1">
                      *Gunakan <code>./api.php</code> jika file di-upload dalam folder yang sama di Hostinger.
                    </span>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="font-sans text-blue-900 font-bold block">Auto-Push Background Sync</span>
                      <span className="text-[10px] text-blue-700 font-normal font-sans block mt-0.5">
                        Dorong perubahan data secara otomatis ke server Hostinger setiap ada pembaharuan lokal.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoPush}
                        onChange={(e) => setAutoPush(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleCheckConnection(apiUrl)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  disabled={checking}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  Tes Koneksi
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 text-xs rounded-xl shadow-md shadow-indigo-500/10 transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Simpan & Kunci Setelan
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handlePushAll}
              disabled={syncLoading || !syncEnabled}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${syncEnabled ? 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30' : 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'}`}
            >
              <Upload className={`w-6 h-6 ${syncLoading ? 'animate-bounce' : ''} text-indigo-600`} />
              <div className="text-center">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Push Manual</div>
                <div className="text-[10px] text-slate-500">Kirim semua data lokal ke Cloud</div>
              </div>
            </button>
            <button 
              onClick={handlePullAll}
              disabled={syncLoading || !syncEnabled}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${syncEnabled ? 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30' : 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed'}`}
            >
              <Download className={`w-6 h-6 ${syncLoading ? 'animate-bounce' : ''} text-emerald-600`} />
              <div className="text-center">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pull Manual</div>
                <div className="text-[10px] text-slate-500">Ambil data terbaru dari Cloud</div>
              </div>
            </button>
          </div>

          {/* DYNAMIC RELATIONAL SQL EXPORTER */}
          <div className="bg-white   p-6 -3xl  space-y-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <h3 className="text-base text-slate-900 flex items-center gap-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
              <Database className="w-5 h-5 text-blue-600" />
              Satu-Klik Generator Skema SQL Database
            </h3>
            <p className="text-slate-500 text-xs">
              Mengekspor seluruh koleksi data relasional (Gudang mebel, Transaksi, Kepegawaian NIP, dan Proyek) menjadi file dump SQL murni yang siap di-import ke phpMyAdmin di hPanel Hostinger.
            </p>
            
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-mono font-bold text-xs">
                  SQL
                </div>
                <div>
                  <strong className="text-slate-900">Script SQL Schema (MySQL)</strong>
                  <span className="text-[10px] text-slate-500 block">Termasuk dump record data terisi terbaru</span>
                </div>
              </div>
              <button
                onClick={handleDownloadSQL}
                className="bg-slate-950 hover:bg-slate-850 text-white font-sans font-bold px-4 py-2 text-xs rounded-xl border-none cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Unduh SQL script
              </button>
            </div>
          </div>

        </div>

        {/* SIDE CONNECTION METER & GUIDELINES */}
        <div className="md:col-span-4 space-y-6">
          
          {/* CONNECTION BENCHMARK METER */}
          <div className="bg-white   p-6 -3xl  space-y-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <h4 className="text-xs tracking-wider text-slate-400 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Status Server Cloud</h4>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${
                  connectionStatus === 'CONNECTED_MYSQL' ? 'bg-emerald-500 animate-pulse' :
                  connectionStatus === 'CONNECTED_JSON' ? 'bg-sky-500 animate-pulse' :
                  connectionStatus === 'ERROR' ? 'bg-rose-500' : 'bg-slate-300'
                }`} />
                <div>
                  <strong className="text-xs block text-slate-900">
                    {connectionStatus === 'CONNECTED_MYSQL' && 'Terkoneksi (MySQL)'}
                    {connectionStatus === 'CONNECTED_JSON' && 'Terkoneksi (File JSON)'}
                    {connectionStatus === 'ERROR' && 'Koneksi Terputus / Error'}
                    {connectionStatus === 'DISCONNECTED' && 'Hub Dinonaktifkan'}
                  </strong>
                  <span className="text-[10px] text-slate-500">Status Bridge API Hostinger</span>
                </div>
              </div>

              {serverDetails && (
                <div className="p-3 bg-slate-50 rounded-xl text-[10px] font-mono text-slate-600 space-y-1 border border-slate-100">
                  <div>TIPE STORAGE: {serverDetails.mode}</div>
                  <div>WRITE ACCESS: {serverDetails.write_perm ? 'DIIZINKAN (OK)' : 'TERKUNCI'}</div>
                  <div>CEK TERAKHIR: {new Date(serverDetails.timestamp).toLocaleTimeString('id-ID')}</div>
                </div>
              )}

              {!syncEnabled && (
                <div className="p-3.5 bg-amber-50 rounded-2xl flex border border-amber-100 gap-2 text-[10.5px] text-amber-900 leading-normal">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    Koneksi belum diaktifkan. Anda masih dapat beroperasi penuh menggunakan <strong>database internal browser</strong>.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP BY STEP DEPLOYMENT GUIDE */}
          <div className="bg-white   p-6 -3xl  space-y-4 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <h4 className="text-xs tracking-wider text-slate-400 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Panduan Rilis Hostinger</h4>
            
            <div className="space-y-4 text-xs">
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">1</span>
                <div>
                  <strong>Jalankan Build Pro:</strong>
                  <p className="text-[10.5px] text-slate-550 leading-relaxed mt-0.5 font-sans font-normal">Tekan tombol ekspor bundle pengerjaan di AI Studio atau jalankan <code>npm run build</code> untuk memproses aset visual ke folder <strong>dist/</strong>.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">2</span>
                <div>
                  <strong>Unggah Kebutuhan Ke hPanel:</strong>
                  <p className="text-[10.5px] text-slate-550 leading-relaxed mt-0.5 font-sans font-normal">Masuk ke File Manager Hostinger hPanel Anda. Tarik dan lepas seluruh file yang terdapat dalam folder <strong>dist/</strong> (termasuk .html, .js, dan file <code>api.php</code>) ke folder <code>public_html</code>.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">3</span>
                <div>
                  <strong>Aktifkan Database MySQL (Opsional):</strong>
                  <p className="text-[10.5px] text-slate-550 leading-relaxed mt-0.5 font-sans font-normal">Buat database kosong lewat menu database hPanel Hostinger. Buka file <code>api.php</code> di file manager, isi parameter username dan password di bagian atas. Halaman akan langsung beroperasi memetakan MySQL relasional.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
