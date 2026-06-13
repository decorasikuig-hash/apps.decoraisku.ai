/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Trash2, 
  Search, 
  Plus, 
  X, 
  ExternalLink, 
  Check, 
  Loader2, 
  Download, 
  AlertTriangle, 
  LogOut, 
  RefreshCw,
  Inbox,
  User,
  Clock,
  ChevronRight,
  Sparkles,
  Paperclip,
  FileText
} from 'lucide-react';
import { initAuth, googleSignIn, googleSignOut } from '../utils/firebaseAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { Project } from '../types';

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyText?: string;
}

interface GmailIntegrationProps {
  projects: Project[];
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function GmailIntegration({ projects, showToast }: GmailIntegrationProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // App views: 'inbox' | 'compose'
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox');
  
  // Messages lists
  const [messages, setMessages] = useState<GmailMessageDetail[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose email states
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Sync auth state
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

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        showToast('Berhasil terhubung ke akun Gmail Anda!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mendaftar atau menghubungkan akun Google.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    const confirmOut = window.confirm('Apakah Anda ingin memutuskan koneksi akun Google Mail Anda?');
    if (!confirmOut) return;
    
    try {
      await googleSignOut();
      setCurrentUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setMessages([]);
      setSelectedMessage(null);
      showToast('Koneksi Gmail diputuskan.', 'info');
    } catch (err) {
      showToast('Kesalahan memutuskan sesi.', 'error');
    }
  };

  // Fetch Message list and their details
  const fetchInbox = async (q = '') => {
    if (!accessToken) return;
    setIsLoadingMessages(true);
    setSelectedMessage(null);
    try {
      let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8';
      if (q) {
        url += `&q=${encodeURIComponent(q)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsAuth(true);
          showToast('Sesi Google kedaluwarsa. Silakan masuk kembali.', 'error');
          return;
        }
        throw new Error('Gagal mengambil daftar email dari Gmail API.');
      }

      const listData = await response.json();
      const messageSummaries: GmailMessageDetail[] = [];

      if (listData.messages && listData.messages.length > 0) {
        // Fetch detailed content for each message concurrently (max 8)
        const detailPromises = listData.messages.map(async (msg: { id: string }) => {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();

            // Extract headers
            const headers = detail.payload?.headers || [];
            const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
            const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to');
            const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

            // Find plain text or html message body inside payload multipart
            let bodyText = '';
            if (detail.payload?.body?.data) {
              bodyText = decodeBase64Safe(detail.payload.body.data);
            } else if (detail.payload?.parts) {
              const textPart = findTextPart(detail.payload.parts);
              if (textPart && textPart.body?.data) {
                bodyText = decodeBase64Safe(textPart.body.data);
              }
            }

            return {
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || '',
              subject: subjectHeader ? subjectHeader.value : '(Tanpa Subjek)',
              from: fromHeader ? fromHeader.value : '(Tidak Diketahui)',
              to: toHeader ? toHeader.value : '',
              date: dateHeader ? dateHeader.value : '',
              bodyText: bodyText || detail.snippet || '',
            };
          } catch (err) {
            console.error('Error fetching detail msg:', err);
            return null;
          }
        });

        const detailedResults = await Promise.all(detailPromises);
        detailedResults.forEach((item) => {
          if (item) messageSummaries.push(item);
        });
      }

      setMessages(messageSummaries);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal membaca kotak masuk Gmail.', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Helper selectors for decoding email base64url bodies
  const findTextPart = (parts: any[]): any => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain') return part;
      if (part.parts) {
        const nestedResult = findTextPart(part.parts);
        if (nestedResult) return nestedResult;
      }
    }
    return null;
  };

  const decodeBase64Safe = (base64url: string): string => {
    try {
      let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) {
        b64 += '=';
      }
      return decodeURIComponent(escape(atob(b64)));
    } catch {
      return '';
    }
  };

  // Auto trigger load
  useEffect(() => {
    if (accessToken) {
      fetchInbox();
    }
  }, [accessToken]);

  // Handle compose templates
  const applyTemplate = (type: 'rab' | 'termin' | 'blueprint', project: Project) => {
    const client = project.clientName || 'Klien Kami';
    const projName = project.name || 'Proyek Interior';

    if (type === 'rab') {
      setEmailSubject(`[Rancangan RAB] Estimasi Biaya & Desain Interior: ${projName}`);
      setEmailTo(project.clientName ? `${project.clientName.toLowerCase().replace(/\s+/g, '')}@example.com` : '');
      setEmailBody(`Halo Bapak/Ibu ${client},\n\nTerkait kontrak perencanaan desain interior untuk "${projName}", kami tim LuxeLiving telah merumuskan estimasi draf Rincian Anggaran Biaya (RAB) sebesar Rp ${(project.budget || 0).toLocaleString('id-ID')}.\n\nRincian cetak biru detail, spesifikasi katalog material sofa, lantai panel SPC, serta pencahayaan Nordic kabinet dapat diakses secara real-time via folder Google Drive proyek Anda.\n\nMohon tinjau kesepakatan anggaran ini, kami siap merevisi atau melanjutkan ke tahap eksekusi pengadaan bahan.\n\nHormat kami,\nTim Utama & Principal LuxeLiving`);
    } else if (type === 'termin') {
      setEmailSubject(`[Tagihan Termin] Penagihan Biaya Proyek Aktif: ${projName}`);
      setEmailTo(project.clientName ? `${project.clientName.toLowerCase().replace(/\s+/g, '')}@example.com` : '');
      const sisa = (project.budget || 0) - (project.totalCost || 0);
      setEmailBody(`Yth. Bapak/Ibu ${client},\n\nMelalui pesan ini kami menginformasikan progress pengerjaan fisik di lokasi ${project.location} untuk proyek "${projName}" berjalan lancar.\n\nBerdasarkan kriteria pelunasan termin berjalan, kami melampirkan invoice tagihan saat ini. Anggaran terpakai aktual telah diperbarui di sistem ERP.\n\nSisa pagu kontrak berjalan:\n- Total Budget: Rp ${(project.budget || 0).toLocaleString('id-ID')}\n- Realisasi Biaya Saat Ini: Rp ${(project.totalCost || 0).toLocaleString('id-ID')}\n\nMohon koordinasi transfer termin diinfokan kembali agar tim administrasi dapat melakukan pencatatan kas masuk.\n\nTerima kasih atas kerja samanya.\n\nHormat kami,\nLuxeLiving Ledger Team`);
    } else if (type === 'blueprint') {
      setEmailSubject(`[Persetujuan Desain] Cetak Biru (Blueprint) Terbaru: ${projName}`);
      setEmailTo(project.clientName ? `${project.clientName.toLowerCase().replace(/\s+/g, '')}@example.com` : '');
      setEmailBody(`Halo Bapak/Ibu ${client},\n\nTim desainer senior kami telah mengunggah varian revisi 2 cetak biru ruang (Blueprint CAD) render 3D untuk proyek "${projName}".\n\nPerubahan mencakup penataan area furnitur sofa agar menghasilkan flow sirkulasi ruangan yang lebih bersih dan lega.\n\nKami mohon persetujuannya (approval) terhadap cetak biru terbaru ini melalui link Google Drive terlampir sebelum kami memicu eksekusi pemotongan bahan panel.\n\nSalam hangat,\nSherly Anastasya - Senior Interior Designer`);
    }
    showToast(`Template diterapkan untuk proyek ${project.name}`, 'info');
  };

  // Draft / Send email with mandatory confirmation
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo || !emailSubject || !emailBody) {
      showToast('Mohon lengkapi alamat email, subjek, dan isi pesan.', 'error');
      return;
    }

    const isConfirmed = window.confirm(
      `Kirim email ini kepada "${emailTo}" menggunakan akun Gmail Anda?`
    );
    if (!isConfirmed) return;

    setIsSending(true);
    try {
      // Build RFC 2822 raw email safely
      const rfcMessage = [
        `To: ${emailTo}`,
        `Subject: ${emailSubject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        emailBody,
      ].join('\r\n');

      const encodedMsg = btoa(unescape(encodeURIComponent(rfcMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMsg,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal meluncurkan pesan melalui server Gmail API.');
      }

      showToast(`Email berhasil dikirim ke "${emailTo}"!`, 'success');
      
      // Reset composer
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
      
      // Go to inbox & refresh list
      setActiveTab('inbox');
      setTimeout(() => {
        fetchInbox();
      }, 800);

    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Terjadi kesalahan saat mengirim email.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Safe split address strings
  const getCleanSenderName = (fromStr: string) => {
    const match = fromStr.match(/^(.*?)\s*<.*>$/);
    return match ? match[1] : fromStr;
  };

  // Login overlay
  if (needsAuth) {
    return (
      <div className="bg-white   p-8 -3xl  text-center max-w-2xl mx-auto my-12 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-inner">
          <Mail className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-lg text-slate-900 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Hubungkan dengan Google Gmail</h3>
        <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto leading-relaxed">
          Kirim persetujuan draf RAB, tagihan fungsional termin proyek, serta update blueprint revisi langsung ke email klien Anda dalam sekali klik menggunakan integrasi aman Gmail API.
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
                Membuka popup Google...
              </>
            ) : (
              <>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Otorisasikan Google Gmail</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-120px)] flex flex-col h-full">
      
      {/* HEADER BAR */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-850 p-5 rounded-3xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          {currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt="Google Profile" 
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border-2 border-blue-505" 
              style={{ borderColor: '#3b82f6' }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
              {currentUser?.displayName?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <div className="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-bold">Gmail API Active</div>
            <h4 className="text-sm text-slate-100 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{currentUser?.displayName || 'User Sesi Google'}</h4>
            <span className="text-[10px] text-slate-400 block">{currentUser?.email}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* VIEW TAB BUTTONS */}
          <button
            onClick={() => setActiveTab('inbox')}
            className={`text-xs px-4 py-2 rounded-xl border font-sans select-none flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'inbox' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm border-transparent shadow' : 'bg-slate-800 text-slate-350 border-slate-700 hover:text-slate-200'}`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Kotak Masuk
          </button>
          
          <button
            onClick={() => setActiveTab('compose')}
            className={`text-xs px-4 py-2 rounded-xl border font-sans select-none flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'compose' ? 'text-white bg-[#1e1b4b] border border-[#1e1b4b] hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm border-transparent shadow' : 'bg-slate-800 text-slate-350 border-slate-700 hover:text-slate-200'}`}
          >
            <Send className="w-3.5 h-3.5" />
            Tulis Email
          </button>

          <button
            onClick={handleLogout}
            title="Disconnect Google Sesi"
            className="p-2 text-slate-400 hover:text-rose-405 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
            style={{ color: '#f87171' }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeTab === 'inbox' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SEARCH & INBOX MESSAGE LIST (LEFT PANEL) */}
          <div className="lg:col-span-5 bg-white   p-5 -3xl  flex flex-col h-[650px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-105 mb-4">
              <h5 className="font-sans font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Inbox className="w-4 h-4 text-blue-500" />
                Email Klien & Supplier
              </h5>
              
              <button
                onClick={() => fetchInbox(searchQuery)}
                disabled={isLoadingMessages}
                title="Refresh Kotak Masuk"
                className="p-1 px-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-amber-500 hover:text-slate-950 border border-slate-100 transition-all flex items-center gap-1 text-[10px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                Segarkan
              </button>
            </div>

            {/* SEARCH */}
            <div className="relative mb-4 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 translate-y-[-50%] pointer-events-none" />
              <input 
                type="text" 
                placeholder="Cari kata kunci subjek / pengirim..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchInbox(searchQuery);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-400 focus:bg-slate-50 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white hover:bg-slate-100/50"
              />
            </div>

            {/* MESSAGES LISTING */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="w-7 h-7 text-blue-650 animate-spin mb-2" />
                  <span className="text-[11px] text-slate-450">Memuat kotak masuk Gmail...</span>
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => {
                  const isCurSelected = selectedMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left select-none ${
                        isCurSelected 
                          ? 'bg-blue-500/5 border-blue-200 shadow-sm' 
                          : 'bg-slate-50/40 hover:bg-amber-500 hover:text-slate-950 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-sans font-extrabold text-blue-600 truncate max-w-[170px]" title={msg.from}>
                          {getCleanSenderName(msg.from)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono font-medium shrink-0">
                          {msg.date ? msg.date.split(',')[1] || msg.date.slice(0, 15) : ''}
                        </span>
                      </div>
                      
                      <h4 className="text-[11px] text-slate-800 mt-1 lines-clamp truncate tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                        {msg.subject}
                      </h4>
                      
                      <p className="text-[10px] text-slate-450 mt-1.5 h-10 overflow-hidden line-clamp-2">
                        {msg.snippet}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200">
                  <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-[11px] font-bold text-slate-500 block">Daftar Kontak Kosong</span>
                  <p className="text-[9px] text-slate-400 px-3 mt-1 leading-normal max-w-[190px] mx-auto">
                    Tidak mendeteksi surat masuk yang cocok di folder Inbox.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MESSAGE VIEW DETAIL PANEL (RIGHT COVERAGE) */}
          <div className="lg:col-span-7 bg-white   p-6 -3xl  h-[650px] flex flex-col bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
            {selectedMessage ? (
              <div className="h-full flex flex-col">
                {/* HEADER DETAIL */}
                <div className="pb-4 border-b border-slate-100 shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm text-slate-900 leading-snug tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">{selectedMessage.subject}</h3>
                      <div className="mt-2 text-[10px] space-y-0.5 text-slate-500">
                        <div>
                          <span className="font-extrabold text-slate-700">Dari: </span>
                          <span className="font-mono">{selectedMessage.from}</span>
                        </div>
                        {selectedMessage.to && (
                          <div>
                            <span className="font-extrabold text-slate-700">Kepada: </span>
                            <span className="font-mono">{selectedMessage.to}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-extrabold text-slate-700">Waktu: </span>
                          <span className="font-mono">{selectedMessage.date}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Safe compose feedback reply
                        setEmailTo(selectedMessage.from.match(/<([^>]+)>/)?.[1] || selectedMessage.from);
                        setEmailSubject(`Re: ${selectedMessage.subject.replace(/^Re:\s*/i, '')}`);
                        setEmailBody(`\n\n--- Pada ${selectedMessage.date}, ${selectedMessage.from} menulis:\n> ${selectedMessage.snippet}`);
                        setActiveTab('compose');
                      }}
                      className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 font-sans font-bold hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      Balas Email
                    </button>
                  </div>
                </div>

                {/* CONTENT BODY */}
                <div className="flex-1 overflow-y-auto py-5 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap select-text pr-1 scrollbar-thin">
                  {selectedMessage.bodyText || selectedMessage.snippet}
                </div>

                <div className="pt-4 border-t border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-450">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Amankan Sesi Terenkripsi Gmail OAuth 2.0</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-205/60 px-2 py-0.5 rounded leading-none">ID: {selectedMessage.id}</span>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 mb-3 animate-[pulse_3s_ease_infinite]">
                  <Mail className="w-6 h-6 text-slate-350" />
                </div>
                <h4 className="text-xs text-slate-700 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">Pratinjau Surat Belum Terpilih</h4>
                <p className="text-[11px] text-slate-450 mt-1 max-w-sm px-6 leading-relaxed">
                  Pilih salah satu surat masuk di kolom sebelah kiri untuk memproses detail lampiran estimasi atau permintaan cetak biru furnitur dari klien interior.
                </p>
              </div>
            )}
          </div>

        </div>
      ) : (
        
        /* COMPOSE EMAIL VIEW (COMPOSE MODE) */
        <div className="bg-white   p-6 -3xl  text-left max-w-4xl mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
          
          <div className="pb-4 border-b border-slate-100 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm text-slate-905 flex items-center gap-1.5 tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                <Send className="w-4 h-4 text-blue-600" />
                Gubah & Kirim Dokumen Formal Proyek
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Mengirimkan pesan otomatis menggunakan template formal yang disesuaikan dengan progress invoice sistem ERP.
              </p>
            </div>
            
            {/* IN-SITE AI AUTOGEN TEMPLATES CHEAT SHEET */}
            {projects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2 flex items-center gap-2">
                  <span className="text-[9px] font-mono font-bold text-blue-600 uppercase">Apply formal template:</span>
                  <div className="flex gap-1.5">
                    {projects.slice(0, 2).map(p => (
                      <div key={p.id} className="flex gap-1 bg-white p-1    -2xs items-center bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-600 truncate max-w-[90px]">{p.name.split(' - ')[0]}</span>
                        <button 
                          onClick={() => applyTemplate('rab', p)}
                          className="bg-slate-900 text-white text-[8px] px-1 py-0.5 rounded font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                          RAB
                        </button>
                        <button 
                          onClick={() => applyTemplate('termin', p)}
                          className="bg-slate-900 text-white text-[8px] px-1 py-0.5 rounded font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                          Tagihan
                        </button>
                        <button 
                          onClick={() => applyTemplate('blueprint', p)}
                          className="bg-slate-900 text-white text-[8px] px-1 py-0.5 rounded font-bold cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                          Desain
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Alamat Email Tujuan (To):</label>
                <input 
                  type="email" 
                  required
                  placeholder="klien-mansion@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>

              <div>
                <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Subjek Formal Proyek:</label>
                <input 
                  type="text" 
                  required
                  placeholder="misal: [RAB Revisi 2] Penataan Sofa & Pendant Light Penthouse"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold text-[#8fa0be] uppercase tracking-wider block">Isi Pesan Surat (Body Text):</label>
              <textarea 
                rows={9}
                required
                placeholder="Tulis draf pemberitahuan Anda secara mendalam di sini, gunakan template kemudahan di atas untuk menyisipkan ringkasan anggaran secara cepat."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full bg-[#f1f5f9] text-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-all border-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[10px] text-slate-550 max-w-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>Format rujukan dijamin formal. Sistem akan meminta konfirmasi final sebelum mengirim via Gmail API.</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const confirmDiscard = window.confirm('Buang draf email Anda saat ini?');
                    if (confirmDiscard) {
                      setEmailTo('');
                      setEmailSubject('');
                      setEmailBody('');
                      setActiveTab('inbox');
                    }
                  }}
                  className="p-3 px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-amber-500 hover:text-slate-950 text-xs font-semibold select-none cursor-pointer"
                >
                  <X className="w-4 h-4 mr-1" /> Batal
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center justify-center gap-2 bg-[#2563eb] text-white rounded-xl py-3 px-5 font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-500/20 border-none cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Proses Transmit...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Kirim Email Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

        </div>
      )}

    </div>
  );
}
