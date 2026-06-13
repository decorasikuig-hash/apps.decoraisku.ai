/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, Sparkles, Volume2, Pencil } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { InventoryItem } from '../types';
import { getDBState } from '../utils/database';

interface BarcodeScannerProps {
  onScanSuccess: (item: InventoryItem) => void;
  onScanError?: (error: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const [typedCode, setTypedCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  
  // Camera selection states
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);

  interface CameraDevice {
    id: string;
    label: string;
  }

  // Keyboard/Physical Barcode Reader emulator logic
  useEffect(() => {
    let rawBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // If delay is tiny, it's likely a hardware USB/Bluetooth scanner
      if (now - lastKeyTime > 50) {
        rawBuffer = ''; // slow typing, reset buffer
      }
      
      lastKeyTime = now;

      // Handle barcode characters
      if (e.key === 'Enter') {
        if (rawBuffer.length >= 3) {
          processCode(rawBuffer);
          rawBuffer = '';
        }
      } else if (/^[a-zA-Z0-9_\-\.]$/.test(e.key)) {
        rawBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Process decoded code
  const processCode = (code: string) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();
    const items = getDBState().inventory || [];
    
    // Find item with exact code match
    const found = items.find(item => 
      item.code.toLowerCase() === cleanCode.toLowerCase() ||
      item.id.toLowerCase() === cleanCode.toLowerCase()
    );

    if (found) {
      // Play high-pitch beep sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 1100;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } catch (err) {
        console.warn("Audio Context could not play scan beep:", err);
      }

      setScannedItem(found);
      setErrorText(null);
      onScanSuccess(found);
      
      // Flash success indicator for user feedback
      setTimeout(() => {
        setScannedItem(null);
      }, 3000);
    } else {
      // Play low-pitch error sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 220;
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      } catch (err) {
        console.warn("Audio Context could not play error tone:", err);
      }

      setErrorText(`Barcode "${cleanCode}" tidak ditemukan atau belum terdaftar dalam inventori gudang.`);
      if (onScanError) onScanError(`Kode ${cleanCode} tidak terdaftar`);
    }
  };

  // Switch camera source on dropdown change
  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (cameraActive) {
      await stopCamera();
      await startScanning(deviceId);
    }
  };

  // Flip/Rotate between available camera devices
  const handleRotateCamera = async () => {
    let currentDevices = devices;
    
    // If devices list is empty or short, let's query again
    if (currentDevices.length === 0) {
      try {
        const cameraDevices = await Html5Qrcode.getCameras();
        if (cameraDevices && cameraDevices.length > 0) {
          currentDevices = cameraDevices.map(d => ({ 
            id: d.id, 
            label: d.label || `Kamera ${d.id.slice(0, 5)}` 
          }));
          setDevices(currentDevices);
        }
      } catch (err) {
        console.error("Gagal mendeteksi kamera saat rotasi:", err);
      }
    }

    if (currentDevices.length <= 1) {
      setErrorText("Hanya 1 perangkat kamera yang terdeteksi pada perangkat tablet/HP ini.");
      return;
    }

    // Find next lens in the list
    const currentIdx = currentDevices.findIndex(d => d.id === selectedDeviceId);
    const nextIdx = (currentIdx + 1) % currentDevices.length;
    const nextDevice = currentDevices[nextIdx];
    
    // Switch to next lens
    await handleDeviceChange(nextDevice.id);
  };

  // Start scanning
  const startScanning = async (deviceId?: string) => {
    setErrorText(null);
    setIsInitializing(true);
    setCameraActive(true);

    try {
      // Create HTML5QrCode instance on viewport element
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new Html5Qrcode('barcode-reader-viewport');
      }

      let activeId = deviceId || selectedDeviceId;

      // Fetch camera systems first if empty list
      if (devices.length === 0 || !activeId) {
        const cameraDevices = await Html5Qrcode.getCameras();
        if (cameraDevices && cameraDevices.length > 0) {
          const mappedDevices = cameraDevices.map(d => ({ id: d.id, label: d.label || `Kamera ${d.id.slice(0, 5)}` }));
          setDevices(mappedDevices);
          
          // Select environmental back camera by default if not specified
          const defaultDevice = cameraDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('belakang')
          ) || cameraDevices[0];
          
          setSelectedDeviceId(defaultDevice.id);
          activeId = defaultDevice.id;
        } else {
          throw new Error("Tidak ada perangkat kamera yang terdeteksi.");
        }
      }

      const activeIdFinal = activeId || selectedDeviceId;
      if (!activeIdFinal) {
        throw new Error("Silakan pilih perangkat kamera.");
      }

      // Setup scanner configuration optimized for mobile
      const config = {
        fps: 15,
        qrbox: (width: number, height: number) => {
          // Dynamic scaling viewport box for barcodes & QR codes
          const size = Math.min(width, height) * 0.7;
          return {
            width: size,
            height: size * 0.55 // elongated rectangle for typical 1D barcodes
          };
        },
        aspectRatio: 1.333334
      };

      await qrCodeInstanceRef.current.start(
        activeIdFinal,
        config,
        (decodedText) => {
          processCode(decodedText);
        },
        (errorMessage) => {
          // Quiet logs for verbose scanning loop frame errors
        }
      );

      setIsInitializing(false);
    } catch (err: any) {
      console.error("Camera scanner failed to mount:", err);
      setIsInitializing(false);
      setCameraActive(false);
      
      // Detailed user help message
      if (err.name === 'NotAllowedError' || err.message?.includes('permission')) {
        setErrorText("Izin akses kamera ditolak. Silakan berikan izin kamera pada browser Anda agar fitur barcode scanner dapat berfungsi.");
      } else {
        setErrorText(`Gagal membuka kamera: ${err.message || err}. Gunakan input pencarian / klik manual di bawah.`);
      }
    }
  };

  // Close camera cleanly
  const stopCamera = async () => {
    if (qrCodeInstanceRef.current) {
      if (qrCodeInstanceRef.current.isScanning) {
        try {
          await qrCodeInstanceRef.current.stop();
        } catch (err) {
          console.error("Failed to stop HTML5QrCode camera loop:", err);
        }
      }
    }
    setCameraActive(false);
    setIsInitializing(false);
  };

  // Mount/Unmount Cleanup & Proactive camera queries
  useEffect(() => {
    const fetchInitialDevices = async () => {
      try {
        const cameraDevices = await Html5Qrcode.getCameras();
        if (cameraDevices && cameraDevices.length > 0) {
          const mappedDevices = cameraDevices.map(d => ({ 
            id: d.id, 
            label: d.label || `Kamera ${d.id.slice(0, 5)}` 
          }));
          setDevices(mappedDevices);
          
          // Select back camera or environment camera by default
          const defaultDevice = cameraDevices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('belakang')
          ) || cameraDevices[0];
          
          setSelectedDeviceId(defaultDevice.id);
        }
      } catch (err) {
        // Silent block for proactive fetch if permissions are loaded on click
        console.log("Proactive camera detection skipped, waiting for manual start.", err);
      }
    };

    fetchInitialDevices();

    return () => {
      if (qrCodeInstanceRef.current) {
        if (qrCodeInstanceRef.current.isScanning) {
          qrCodeInstanceRef.current.stop().catch(err => {
            console.error("Unmount cleanup failure:", err);
          });
        }
      }
    };
  }, []);

  const allItems = getDBState().inventory || [];

  return (
    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-slate-100 shadow-2xl relative">
      {/* Visual active label */}
      <div className="absolute top-3 right-3 bg-indigo-500/15 text-indigo-400 text-[10px] font-mono px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-widest flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-500'}`} />
        {cameraActive ? 'Kamera Aktif' : 'Kamera Standby'}
      </div>

      <h3 className="text-base text-white mb-1.5 flex items-center gap-2 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
        <Camera className="w-5 h-5 text-indigo-400" />
        Pindai Barcode Material / Barang
      </h3>
      <p className="text-slate-400 text-[11px] mb-4 font-sans leading-relaxed">
        Posisikan barcode produk atau QR code tepat di tengah kotak merah pemindai kamera Anda.
      </p>

      {/* Main Barcode Viewport Container */}
      <div className="relative aspect-[4/3] w-full max-w-sm mx-auto bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center mb-4 shadow-inner">
        
        {/* The HTML5QrCode container */}
        <div 
          id="barcode-reader-viewport" 
          className={`w-full h-full object-cover transition-opacity duration-300 ${cameraActive && !isInitializing ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`} 
        />

        {/* Scanner overlay laser animations */}
        {cameraActive && !isInitializing && (
          <>
            {/* Pulsing overlay bounding target */}
            <div className="absolute inset-0 border-2 border-indigo-500/25 rounded-2xl pointer-events-none" />
            
            {/* Glowing red scanner beam line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_15px_#f43f5e] animate-bounce pointer-events-none" />
            
            {/* Micro target corners */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-indigo-400 pointer-events-none" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-indigo-400 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-indigo-400 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-indigo-400 pointer-events-none" />

            {/* Quick Rotate Overlay Button for instant action on mobile/tablet */}
            {devices.length > 1 && (
              <button 
                type="button"
                onClick={handleRotateCamera}
                className="absolute top-3 left-3 bg-indigo-600/90 hover:bg-indigo-500 active:scale-95 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-indigo-500 cursor-pointer backdrop-blur-sm shadow-md transition-all flex items-center gap-1.5 z-10"
              >
                <RefreshCw className="w-3 h-3" />
                Putar Kamera
              </button>
            )}

            <button 
              type="button"
              onClick={stopCamera}
              className="absolute bottom-3 right-3 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-slate-805 cursor-pointer backdrop-blur-sm shadow transition-all"
            >
              Tutup Kamera
            </button>
          </>
        )}

        {/* Loading Overlay */}
        {isInitializing && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-center p-4">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <h5 className="text-xs font-bold text-white mb-1">Menyiapkan Lensa Kamera...</h5>
            <p className="text-[10px] text-slate-400">Harap izinkan browser mengakses kamera Anda</p>
          </div>
        )}

        {/* Camera Start Button Overlay */}
        {!cameraActive && !isInitializing && (
          <div className="flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 border border-slate-700/50 mb-3 shadow">
              <Camera className="w-7 h-7 text-indigo-400" />
            </div>
            
            <button 
              type="button"
              onClick={() => startScanning()}
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-transform hover:scale-[1.03] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Aktifkan Kamera Scan
            </button>
            <p className="text-[10px] text-slate-500 font-sans mt-3 max-w-[200px]">
              Cocok digunakan untuk kamera HP, Android, iPhone, iPad, & tablet digital.
            </p>
          </div>
        )}
      </div>

      {/* Camera Selection Dropdown & Quick Shift Button Controls */}
      {cameraActive && (
        <div className="mb-4 text-center p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/60 max-w-sm mx-auto flex flex-col gap-2.5 items-center justify-center">
          <div className="flex items-center justify-center gap-2 w-full">
            <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
              Lensa Aktif:
            </label>
            {devices.length > 0 ? (
              <select 
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono py-1 px-3 text-indigo-300 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              >
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.label || `Lensa ${device.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-amber-500 font-bold italic animate-pulse">Menghubungkan Lensa...</span>
            )}
          </div>
          
          {devices.length > 1 && (
            <button
              type="button"
              onClick={handleRotateCamera}
              className="w-full bg-slate-800 hover:bg-indigo-600 active:scale-95 text-slate-100 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer border border-slate-700 flex items-center justify-center gap-2 transition-all hover:border-indigo-500 shadow"
            >
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              Putar Kamera (Depan / Belakang / Wide)
            </button>
          )}
        </div>
      )}

      {/* Manual Input Search fallback */}
      <div className="border-t border-slate-900 pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Input Kode / Barcode Manual</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Ketik barcode (misal: S01, P04)..." 
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    processCode(typedCode);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-805 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 focus:bg-slate-50 hover:bg-amber-500 hover:text-slate-950/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 focus:bg-white hover:bg-slate-100/50"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-2.5" />
            </div>
            <button 
              type="button"
              onClick={() => processCode(typedCode)}
              className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-colors"
            >
              Proses
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">
            Daftar Cepat (Simulasi Klik)
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
            {allItems.length > 0 ? (
              allItems.slice(0, 16).map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setTypedCode(item.code);
                    processCode(item.code);
                  }}
                  className="bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-805 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Layers className="w-3 h-3 text-indigo-400" />
                  {item.code} ({item.name.split(' ')[0]})
                </button>
              ))
            ) : (
              <span className="text-[10px] text-slate-600 italic">Inventori barang kosong.</span>
            )}
          </div>
        </div>
      </div>

      {/* Scan Results Overlay Alerts */}
      {scannedItem && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Item Ditemukan & Ditambahkan!
            </div>
            <div className="text-xs font-sans text-slate-300 mt-0.5 font-medium">
              {scannedItem.name} ({scannedItem.code}) - GUDANG: {scannedItem.location || 'Utama'}
            </div>
            <div className="text-[10px] font-mono text-slate-450 mt-1">
              Harga Satuan: Rp {scannedItem.price.toLocaleString('id-ID')} | Sisa Stok: {scannedItem.stock} {scannedItem.unit}
            </div>
          </div>
        </div>
      )}

      {errorText && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-305 rounded-xl flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs font-sans text-slate-300 font-medium leading-relaxed">
            {errorText}
          </div>
        </div>
      )}
    </div>
  );
};
