/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Smartphone, Fingerprint, Wifi, Battery, Radio, AlertCircle, Bell, Clock, LogIn, Lock, CheckCircle2 } from 'lucide-react';
import { Employee, AttendanceLog } from '../types';
import { getDBState, saveCollection, createNotification } from '../utils/database';
import { sendWhatsAppNotification } from '../utils/whatsapp';

export const MobileDevice: React.FC = () => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('emp-1');
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcSuccess, setNfcSuccess] = useState<string | null>(null);
  
  // Biometric login simulation
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'absen' | 'info'>('absen');

  const [activeBioUser, setActiveBioUser] = useState<string>('');

  const db = getDBState();
  const employees = db.employees || [];

  const handleNfcTap = async () => {
    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) return;

    setNfcScanning(true);
    setNfcSuccess(null);

    // Simulate standard NFC connection latency
    setTimeout(async () => {
      setNfcScanning(false);
      setNfcSuccess(`Kartu NFC "${employee.nfcUid}" terbaca!`);

      // Determine Check-in or Check-out (alternate or based on last log)
      const logs: AttendanceLog[] = JSON.parse(localStorage.getItem('erp_attendance') || '[]');
      const empLogs = logs.filter(l => l.employeeId === employee.id);
      const isCheckIn = empLogs.length % 2 === 0; // if even logs, check in. If odd, check out

      const type: 'In' | 'Out' = isCheckIn ? 'In' : 'Out';
      const timestamp = new Date().toISOString();
      const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Create log
      const newLog: AttendanceLog = {
        id: `att-${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        timestamp,
        method: 'NFC',
        type
      };

      const updated = [newLog, ...logs];
      saveCollection('attendance', updated);

      // Create notification in ERP DB
      const actionText = type === 'In' ? 'Masuk Kerja (Check-In)' : 'Pulang Kerja (Check-Out)';
      createNotification(
        `Absensi NFC: ${employee.name}`,
        `Berhasil melakukan ${actionText} via alat Tap NFC Mobile pada pukul ${timeString}.`,
        'success'
      );

      // SENDS THE WHATSAPP NOTIFICATION AUTONOMOUSLY VIA FONNTE!
      const waMsg = `Melakukan Absensi NFC untuk: \n*${actionText}* pada pukul *${timeString}* WIB. \n\nSemangat bekerja dan jaga kesehatan selalu!`;
      await sendWhatsAppNotification({
        phone: employee.phone,
        recipientName: employee.name,
        message: waMsg,
      });

      // Reset success banner after 4s
      setTimeout(() => {
        setNfcSuccess(null);
      }, 4000);

    }, 1500);
  };

  const handleBiometricAuth = () => {
    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) return;

    setBiometricScanning(true);
    setBioSuccess(false);

    setTimeout(() => {
      setBiometricScanning(false);
      setBioSuccess(true);
      setActiveBioUser(employee.name);

      createNotification(
        `Biometric Approved: ${employee.name}`,
        `Verifikasi identitas sidik jari (biometrik) berhasil dilakukan pada smartphone.`,
        'info'
      );

      setTimeout(() => {
        setBioSuccess(false);
      }, 3000);

    }, 2000);
  };

  return (
    <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
      <div className="text-center mb-4">
        <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full font-mono border border-blue-500/20 inline-flex items-center gap-1.5 uppercase font-semibold">
          <Smartphone className="w-3.5 h-3.5" />
          Simulator Android / iOS
        </span>
        <h4 className="text-xs text-slate-400 mt-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
          Menguji respon layar HP, absensi NFC, & Biometric Login
        </h4>
      </div>

      {/* Elegant phone chassis frame */}
      <div className="w-[310px] h-[610px] bg-slate-900 border-8 border-slate-800 rounded-[40px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative">
        
        {/* Notch / Speaker bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-32 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center">
          <div className="w-10 h-1 bg-slate-950 rounded-full" />
        </div>

        {/* Status bar */}
        <div className="h-9 pt-1.5 px-6 flex justify-between items-center bg-slate-950 text-[10px] font-mono text-slate-400 select-none z-40">
          <span className="font-semibold text-white">08:45</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <Radio className="w-3 h-3 text-blue-500 animate-pulse" />
            <div className="flex items-center gap-0.5">
              <span className="text-[9px]">4G</span>
              <Battery className="w-3.5 h-3.5 text-slate-350" />
            </div>
          </div>
        </div>

        {/* Simulated Mobile App Container */}
        <div className="flex-1 bg-slate-950 text-slate-200 flex flex-col p-4 relative overflow-y-auto">
          {/* Main App Title inside Mobile */}
          <div className="text-center mt-3 mb-4">
            <h5 className="font-sans font-bold text-sm tracking-tight text-white">{db.settings.companyName}</h5>
            <p className="text-[10px] text-teal-400 font-mono tracking-widest uppercase">ERP Mobile Companion</p>
          </div>

          {/* Quick Menu Tabs inside App */}
          <div className="grid grid-cols-3 bg-slate-900 p-1 rounded-xl text-center text-[10px] font-sans font-semibold mb-4 border border-slate-880">
            <button 
              onClick={() => setActiveTab('absen')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'absen' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              NFC Absen
            </button>
            <button 
              onClick={() => setActiveTab('login')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'login' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sidik Jari
            </button>
            <button 
              onClick={() => setActiveTab('info')}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'info' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Device Info
            </button>
          </div>

          {/* TAB 1: NFC Absen */}
          {activeTab === 'absen' && (
            <div className="flex flex-col flex-1">
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl text-center flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-center mb-2">
                    <span className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </span>
                  </div>
                  <h6 className="text-[11px] font-semibold text-white">Simulasi Pengetukan Kartu NFC</h6>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal font-sans">
                    Pilih staf di bawah, lalu seret kartu virtual ke dekat sensor NFC handphone.
                  </p>

                  <div className="mt-3.5 text-left">
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Karyawan:</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.nip})
                        </option>
                      ))}
                    </select>

                    {/* Display selected employee NFC UID info */}
                    <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-850 text-[9px] font-mono text-slate-400 flex justify-between">
                      <span>NFC Token UID:</span>
                      <span className="text-blue-400">{employees.find(e => e.id === selectedEmployeeId)?.nfcUid || '04:AA:FF'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {nfcScanning ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-1.5" />
                      <span className="text-[10px] text-blue-500 font-medium">Menempelkan Kartu NFC...</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleNfcTap}
                      className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Tap Kartu NFC
                    </button>
                  )}

                  {nfcSuccess && (
                    <div className="mt-3 p-2 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-300 text-[10px] font-sans font-medium flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 inline shrink-0" />
                      <span>{nfcSuccess}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Biometric verification */}
          {activeTab === 'login' && (
            <div className="flex flex-col flex-1">
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl text-center flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-center mb-2">
                    <span className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                      <Fingerprint className="w-6 h-6 animate-pulse" />
                    </span>
                  </div>
                  <h6 className="text-[11px] font-semibold text-white">Biometric SDK Verification</h6>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal font-sans">
                    Di iOS / Android rakitan (Minyak, Capacitor/Cordova), modul sidik jari membaca sidik jari lokal untuk verifikasi instan.
                  </p>

                  <div className="mt-4 text-left">
                    <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Mencocokkan Profil Sidik Jari:</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.nip})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  {biometricScanning ? (
                    <div className="flex flex-col items-center justify-center py-2 animate-pulse">
                      <Fingerprint className="w-10 h-10 text-blue-500 animate-bounce mb-1" />
                      <span className="text-[9px] text-blue-500 font-mono">MEMINDAI SIDIK JARI...</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleBiometricAuth}
                      className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                    >
                      <Fingerprint className="w-4 h-4 text-blue-505" style={{ color: '#3b82f6' }} />
                      Pindai Sidik Jari
                    </button>
                  )}

                  {bioSuccess && (
                    <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-[10px] font-sans font-medium flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Benar! {activeBioUser} terverifikasi.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Device Info */}
          {activeTab === 'info' && (
            <div className="flex flex-col flex-1 text-xs">
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex-1 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <h6 className="text-[11px] font-semibold text-white flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-4 h-4 text-blue-400" />
                    Status Rilis Bundling
                  </h6>

                  <div className="bg-slate-950 p-2 rounded border border-slate-850 text-[10px] font-mono leading-relaxed space-y-1">
                    <div className="text-slate-500">Android Build: <span className="text-slate-350">v1.0.4-APK</span></div>
                    <div className="text-slate-500">iOS IPA Target: <span className="text-slate-350">iOS 16+ SDK</span></div>
                    <div className="text-slate-500">NFC Reader: <span className="text-emerald-400">READY (NDEF)</span></div>
                    <div className="text-slate-500">Biometric: <span className="text-emerald-400">AVAILABLE</span></div>
                  </div>

                  <p className="text-[9px] text-slate-400 leading-normal font-sans">
                    Aplikasi web ini sepenuhnya kompatibel untuk diubah menjadi aplikasi Android (.apk) & iOS (.ipa) menggunakan **CapacitorJS** atau **Apache Cordova**.
                  </p>

                  <div className="p-2 bg-blue-500/5 text-blue-400 text-[9px] font-mono border border-blue-500/10 rounded flex items-center gap-1.5 leading-normal mt-2">
                    <Clock className="w-3.5 h-3.5 stretch-0" />
                    <span>Database terhubung global dengan dashboard admin via localStorage/cloud.</span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 text-center font-mono mt-4">
                  Sumbu NFC: Antena Dekat Kamera Belakang
                </div>
              </div>
            </div>
          )}

          {/* Simple Bottom Home Indicator */}
          <div className="mt-4 pt-1 flex justify-center">
            <div className="w-24 h-1 bg-slate-800 rounded-full" />
          </div>
        </div>

      </div>
    </div>
  );
};
