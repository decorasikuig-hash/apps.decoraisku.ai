/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Trash2, Link2, Search, Plus, X, ExternalLink, FileText, Image, FileSpreadsheet, Check, Loader2, Download, AlertTriangle, LogOut, RefreshCw, FolderOpen, Save } from 'lucide-react';
import { initAuth, googleSignIn, googleSignOut } from '../utils/firebaseAuth';
import { User } from 'firebase/auth';
import { Project } from '../types';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
  createdTime?: string;
}

interface FileAssociation {
  id: string;
  fileId: string;
  fileName: string;
  fileLink: string;
  projectId: string;
  projectName: string;
  timestamp: string;
}

interface DriveIntegrationProps {
  projects: Project[];
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

import { Modal } from './Modal';

export default function DriveIntegration({ projects, showToast }: DriveIntegrationProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [associations, setAssociations] = useState<FileAssociation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('erp_drive_associations') || '[]');
    } catch {
      return [];
    }
  });

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Dialog state
  const [activeLinkFile, setActiveLinkFile] = useState<DriveFile | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Handle Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch files from Google Drive
  const fetchDriveFiles = async (queryStr = '') => {
    if (!accessToken) return;
    setIsLoadingFiles(true);
    try {
      let q = "trashed = false";
      if (queryStr) {
        // Safe sanitization of file search query
        q += ` and name contains '${queryStr.replace(/'/g, "\\'")}'`;
      }
      
      const endpoint = `https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink,size,createdTime)&q=${encodeURIComponent(q)}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          setNeedsAuth(true);
          showToast('Token Google Drive kedaluwarsa. Silakan masuk kembali.', 'error');
          return;
        }
        throw new Error('Gagal memuat daftar file dari Google Drive');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal membaca berkas Google Drive', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Fetch on token changes
  useEffect(() => {
    if (accessToken) {
      fetchDriveFiles();
    }
  }, [accessToken]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        showToast('Berhasil terhubung ke Google Drive!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mendaftar atau menghubungkan akun Google.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const confirmOut = window.confirm('Apakah Anda ingin memutuskan koneksi akun Google Drive Anda?');
    if (!confirmOut) return;
    
    try {
      await googleSignOut();
      setCurrentUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setFiles([]);
      showToast('Koneksi Google Drive diputuskan.', 'info');
    } catch (err) {
      showToast('Kesalahan memutuskan sesi.', 'error');
    }
  };

  // Google Drive File Uploader with correct multi-part formatting
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = async () => {
        setUploadProgress(40);
        const contentType = file.type || 'application/octet-stream';
        const metadata = {
          name: file.name,
          mimeType: contentType
        };

        const boundary = 'xx_luxeliving_boundary_xx';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        // String payload conversion safely handling binary values
        const binaryString = new Uint8Array(reader.result as ArrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '');
        const base64Data = btoa(binaryString);

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${contentType}\r\n` +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          base64Data +
          closeDelimiter;

        setUploadProgress(70);

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );

        if (!response.ok) {
          throw new Error('Gagal mentransmisikan data file ke server Google Drive API.');
        }

        const resFile = await response.json();
        setUploadProgress(100);
        showToast(`Berkas "${file.name}" berhasil diunggah ke Google Drive!`, 'success');
        
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        // Fetch fresh list
        fetchDriveFiles(searchQuery);

        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(null);
        }, 1200);
      };
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Pengunggahan galat.');
      setIsUploading(false);
      setUploadProgress(null);
      showToast('Gagal mengunggah file.', 'error');
    }
  };

  // Delete file with mandatory user confirmation
  const handleDeleteFile = async (file: DriveFile) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus berkas "${file.name}" dari Google Drive Anda secara permanen? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus file dari Google Drive API');
      }

      showToast(`Berkas "${file.name}" berhasil dihapus dari Drive.`, 'success');
      
      // Remove any local linkages
      const filteredAssoc = associations.filter(a => a.fileId !== file.id);
      setAssociations(filteredAssoc);
      localStorage.setItem('erp_drive_associations', JSON.stringify(filteredAssoc));
      
      // Refresh list
      fetchDriveFiles(searchQuery);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus file.', 'error');
    }
  };

  // Add Link Association
  const handleCreateAssociation = () => {
    if (!activeLinkFile || !selectedProjectId) return;
    
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;

    // Check if duplicate linkage exists
    const duplicate = associations.some(a => a.fileId === activeLinkFile.id && a.projectId === selectedProjectId);
    if (duplicate) {
      showToast('Berkas ini sudah tertaut dengan proyek bersangkutan.', 'info');
      setActiveLinkFile(null);
      return;
    }

    const newAssoc: FileAssociation = {
      id: `assoc-${Date.now()}`,
      fileId: activeLinkFile.id,
      fileName: activeLinkFile.name,
      fileLink: activeLinkFile.webViewLink || `https://drive.google.com/file/d/${activeLinkFile.id}/view`,
      projectId: selectedProjectId,
      projectName: proj.name,
      timestamp: new Date().toISOString()
    };

    const updated = [newAssoc, ...associations];
    setAssociations(updated);
    localStorage.setItem('erp_drive_associations', JSON.stringify(updated));

    showToast(`Dokumen "${activeLinkFile.name}" berhasil ditautkan ke proyek "${proj.name}"`, 'success');
    setActiveLinkFile(null);
    setSelectedProjectId('');
  };

  // Remove Link Association with confirmation
  const handleRemoveAssociation = (assocId: string, docName: string) => {
    const conf = window.confirm(`Apakah Anda ingin mencabut tautan berkas "${docName}" dari proyek ERP ini?`);
    if (!conf) return;

    const filtered = associations.filter(a => a.id !== assocId);
    setAssociations(filtered);
    localStorage.setItem('erp_drive_associations', JSON.stringify(filtered));
    showToast('Tautan dokumen berhasil dicabut.', 'info');
  };

  // Render MimeType icon
  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (mimeType.includes('image')) return <Image className="w-5 h-5 text-emerald-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-teal-600" />;
    }
    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  const getFriendlySize = (bytesStr?: string) => {
    if (!bytesStr) return 'Tdk Diketahui';
    const bytes = Number(bytesStr);
    if (isNaN(bytes)) return 'Tdk Diketahui';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Sign in wrapper
  if (needsAuth) {
    return (
      <div className="bg-white   p-8 -3xl  text-center max-w-2xl mx-auto my-12 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-inner">
          <Cloud className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-lg text-slate-900 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Hubungkan dengan Google Drive</h3>
        <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto leading-relaxed">
          Unggah cetak biru ruangan (blueprint), render gambar CAD, list RAB revisi, & dokumen klien secara langsung ke Google Drive dan tautkan ke proyek aktif di sistem ERP Anda.
        </p>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-3 bg-white   hover:bg-amber-500 hover:text-slate-950 active:scale-[0.98] transition-all px-6 py-2.5   font-semibold cursor-pointer text-slate-700 font-sans text-xs select-none disabled:opacity-50 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Masuk Sesi Google...
              </>
            ) : (
              <>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Hubungkan Google Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-120px)] flex flex-col h-full">
      
      {/* DRIVE HEADER WITH LOGGED IN STATUS */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-850 p-5 rounded-3xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          {currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt="Google Profile" 
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border-2 border-blue-500" 
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
              {currentUser?.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <div className="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-bold">Google account terhubung</div>
            <h4 className="text-sm text-slate-100 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{currentUser?.displayName || 'Developer Account'}</h4>
            <span className="text-[10px] text-slate-400 block">{currentUser?.email}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs bg-slate-800/80 text-rose-400 hover:text-white hover:bg-rose-600/80 px-4 py-2 rounded-xl transition-all cursor-pointer font-sans flex items-center gap-1.5 self-start md:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          Putuskan Akun
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: FILE ACTION & UPLOADER */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white   p-5 -3xl bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <h4 className="text-xs text-slate-905 tracking-wide mb-3 flex items-center gap-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
              <Cloud className="w-4 h-4 text-blue-500" />
              Unggah Dokumen Baru
            </h4>
            <p className="text-slate-500 text-[10px] mb-4 leading-relaxed">
              Pilih file cetak biru, estimasi RAB, atau kesepakatan desain untuk langsung disimpan ke akun Google Drive Anda.
            </p>

            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 p-6 rounded-2xl text-center transition-all bg-slate-50/20 relative group">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleUploadFile}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed font-medium font-sans" 
              />
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto group-hover:bg-blue-50 transition-colors">
                  <Plus className="w-5 h-5 text-slate-500 group-hover:text-blue-500" />
                </div>
                <div>
                  <span className="text-[11px] font-sans font-bold text-slate-700 block">Klik untuk memilih file</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Mendukung PDF, PNG, JPG, XLSX up to 10MB</span>
                </div>
              </div>
            </div>

            {isUploading && (
              <div className="mt-4 p-3 bg-blue-50/30 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[10px] text-blue-600">
                  <span className="font-medium flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengunggah file ke Google Drive...
                  </span>
                  <span className="font-mono font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-[10px] text-rose-600">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Error: {uploadError}</span>
              </div>
            )}
          </div>

          {/* PROJECT LINKAGES / MAPPINGS LIST */}
          <div className="bg-white   p-5 -3xl bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <h4 className="text-xs text-slate-905 tracking-wide mb-3.5 flex items-center gap-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
              <Link2 className="w-4 h-4 text-blue-500" />
              Tautan Proyek Aktif
            </h4>
            <p className="text-slate-550 text-[10px] mb-4 leading-relaxed">
              Daftar file di Google Drive yang terasosiasi langsung dengan kontrak proyek interior active.
            </p>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {associations.length > 0 ? (
                associations.map(assoc => (
                  <div key={assoc.id} className="p-3 bg-slate-50 hover:bg-slate-100/60 rounded-2xl border border-slate-100 flex flex-col justify-between transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-sans font-bold text-slate-800 break-words block truncate" title={assoc.fileName}>
                          {assoc.fileName}
                        </span>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[8px] font-mono font-bold tracking-wide uppercase truncate max-w-[130px]" title={assoc.projectName}>
                            {assoc.projectName}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <a 
                          href={assoc.fileLink} 
                          target="_blank" 
                          rel="noreferrer" 
                          title="Buka File di Drive"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleRemoveAssociation(assoc.id, assoc.fileName)}
                          title="Putus Tautan"
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-white rounded transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="text-[10px] text-slate-400 font-sans">Belum ada dokumen yang ditautkan ke proyek interior.</div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN DRIVE FILE EXPLORER LIST */}
        <div className="lg:col-span-8 bg-white   p-6 -3xl bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
            <div>
              <h3 className="text-base text-slate-850 flex items-center gap-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                Folder Explorer Google Drive
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Mencari and mengelola seluruh aset blueprint klien yang aman di bawah Cloud Google.
              </p>
            </div>
            
            <button
              onClick={() => fetchDriveFiles(searchQuery)}
              disabled={isLoadingFiles}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-amber-500 hover:text-slate-950 border border-slate-100 transition-all flex items-center gap-1 text-xs self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              Sincronize
            </button>
          </div>

          {/* SEARCH BAR */}
          <div className="flex gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 translate-y-[-50%] pointer-events-none" />
              <input 
                type="text" 
                placeholder="Cari file dokumen di Drive Anda..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchDriveFiles(searchQuery);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-slate-50 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white hover:bg-slate-100/50"
              />
            </div>
            <button
              onClick={() => fetchDriveFiles(searchQuery)}
              disabled={isLoadingFiles}
              className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
            >
              Cari
            </button>
          </div>

          {/* DRIVE FILES LIST TABLE */}
          {isLoadingFiles ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <span className="text-xs text-slate-400 font-medium">Memuat katalog Google Drive...</span>
            </div>
          ) : files.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 font-sans uppercase">
                    <th className="px-3 py-2.5">File Name / Format</th>
                    <th className="px-3 py-2.5">Ukuran</th>
                    <th className="px-3 py-2.5">Tanggal Dibuat</th>
                    <th className="px-3 py-2.5 text-right">Navigasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {files.map((file) => {
                    // Check if file is associated with any project
                    const linkedProjects = associations.filter(a => a.fileId === file.id);
                    
                    return (
                      <tr key={file.id} className="hover:bg-amber-500 hover:text-slate-950/50 transition-colors">
                        <td className="px-3 py-3 text-slate-800">
                          <div className="flex items-center gap-2 max-w-[280px]">
                            <span className="shrink-0">{getFileIcon(file.mimeType)}</span>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 font-sans break-all block leading-tight">{file.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">{file.mimeType}</span>
                              
                              {linkedProjects.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {linkedProjects.map(p => (
                                    <span key={p.id} className="px-1 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-semibold rounded block uppercase">
                                      Terkandung: {p.projectName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-500">{getFriendlySize(file.size)}</td>
                        <td className="px-3 py-3 text-slate-450 font-mono">
                          {file.createdTime 
                            ? new Date(file.createdTime).toLocaleDateString('id-ID', { year: '2-digit', month: 'short', day: '2-digit' })
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Link project button */}
                            <button
                              onClick={() => {
                                setActiveLinkFile(file);
                                setSelectedProjectId('');
                              }}
                              title="Tautkan ke Proyek"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            >
                              <Link2 className="w-4 h-4" />
                            </button>

                            {/* View link */}
                            {file.webViewLink && (
                              <a 
                                href={file.webViewLink} 
                                target="_blank" 
                                rel="noreferrer"
                                title="Buka di Google Drive"
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            {/* Delete File button */}
                            <button
                              onClick={() => handleDeleteFile(file)}
                              title="Hapus Permanen"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Cloud className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="text-xs text-slate-500 font-bold">Tidak menemukan berkas di Google Drive</div>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Tulis kata kunci lain atau upload berkas baru untuk memulai.</p>
            </div>
          )}
        </div>

      </div>

      {/* OVERLAY LINKING MODAL */}
      <Modal
        isOpen={!!activeLinkFile}
        onClose={() => {
          setActiveLinkFile(null);
          setSelectedProjectId('');
        }}
        title="Tautkan Dokumen ke Proyek ERP"
        maxWidth="max-w-md"
      >
        {activeLinkFile && (
          <div className="animate-in fade-in zoom-in duration-200">
            <p className="text-slate-500 text-[11px] mb-4 -mt-2">
              Menghubungkan berkas <strong className="text-slate-800 break-all">{activeLinkFile.name}</strong> dengan salah satu Proyek Interior terdaftar pada sistem database.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Pilih Proyek Kontrak:</label>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                >
                  <option value="">-- Pilih Proyek Interior --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setActiveLinkFile(null);
                    setSelectedProjectId('');
                  }}
                  className="p-2 px-4 shadow-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-amber-500 hover:text-slate-950 text-xs font-semibold select-none cursor-pointer border-none"
                >
                  <X className="w-4 h-4 mr-1" /> Batal
                </button>
                <button
                  onClick={handleCreateAssociation}
                  disabled={!selectedProjectId}
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  <Save className="w-4 h-4 mr-1" /> Simpan Tautan
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
