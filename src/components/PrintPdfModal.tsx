/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, ShieldCheck, Signature } from 'lucide-react';
import { getDBState } from '../utils/database';
import { Modal } from './Modal';
import { CompanySetting } from '../types';

interface PrintPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'MaterialRequest' | 'PurchaseOrder' | 'PurchaseInvoice' | 'GoodsReceipt' | 'Survey' | 'Quotation' | 'InvoicePenjualan' | 'Payroll' | 'OpnamTukang' | 'Kwitansi';
  data: any;
  settings?: CompanySetting;
}

export const PrintPdfModal: React.FC<PrintPdfModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  settings
}) => {
  if (!isOpen || !data) return null;

  const handlePrintTrigger = () => {
    window.print();
  };

  const formatIDR = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const dbState = getDBState();
  const companyName = dbState.settings?.companyName || 'Decorasiku ERP';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pratinjau Lembar Bukti Fisik SPK / Invoice"
      maxWidth="max-w-2xl"
    >
      <div className="flex justify-end gap-2 -mt-12 mb-6 print:hidden relative z-10">
        <button
          onClick={handlePrintTrigger}
          className="bg-indigo-900 border border-indigo-900 hover:bg-emerald-600 text-white font-bold transition-all duration-200 cursor-pointer shadow-sm text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 border-none"
        >
          <Printer className="w-4 h-4 mr-2" /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 space-y-6 print:border-none print:p-0">
          
          {/* Official Letterhead */}
          <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
            <div>
              {settings?.reportLetterheadUrl ? (
                 <img src={settings.reportLetterheadUrl} alt="Kop Surat" className="h-16 object-contain mb-2" />
              ) : (
                <>
                  <h2 className="text-xl tracking-tight tracking-tight font-bold text-slate-800 font-sans tracking-tight capitalize">{companyName}</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-normal max-w-sm">
                    {settings?.companyAddress || 'Graha Desain Cipta, Lantai 4, No. 89, Sudirman, Jakarta Selatan.\nEmail: cs@decorasiku.co.id | Telp: +62 21-8910-1209'}
                  </p>
                </>
              )}
            </div>
            <div className="text-right">
              <span className="text-[9px] bg-slate-950 text-white px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                LUXE CONTRACTOR
              </span>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date().toLocaleDateString('id-ID')}</p>
            </div>
          </div>

          {/* Document Title header details */}
          <div className="text-center space-y-1 py-1 bg-slate-50 border border-slate-100 rounded-xl print:bg-white print:border-none">
            <h3 className="text-sm text-slate-900 tracking-wide tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
              {type === 'MaterialRequest' && 'FORM PERMINTAAN BAHAN MATERIAL (RMR)'}
              {type === 'PurchaseOrder' && 'SURAT PERINTAH BELANJA BARANG (PO)'}
              {type === 'PurchaseInvoice' && 'FAKTUR PENTUNTASAN PEMBELIAN'}
              {type === 'GoodsReceipt' && 'SURAT SURAT TERIMA FISIK BARANG (STB)'}
              {type === 'Survey' && 'TANDA MASUK JAMINAN DEPOSIT SURVEI'}
              {type === 'Quotation' && 'BERITA ACARA PENAWARAN HARGA (RAB Kontrak)'}
              {type === 'InvoicePenjualan' && 'FAKTUR RESMI TAGIHAN PEMILIK PROYEK'}
              {type === 'Payroll' && 'SLIP GAJI BULANAN RESPONSEN (CONFIDENTIAL)'}
              {type === 'OpnamTukang' && 'BERITA ACARA OPNAM PRESTASI KERJA WEEKLY'}
              {type === 'Kwitansi' && 'VOUCHER KAS / BUKTI PEMBAYARAN KWITANSI'}
            </h3>
            <p className="font-mono text-[10px] font-bold text-slate-500">KODE DOKUMEN: {data.code || `DOC-${data.id || 'N/A'}`}</p>
          </div>

          {/* Dynamic Content layout matching types */}
          <div className="grid grid-cols-2 gap-6 leading-relaxed">
            
            {/* General Sender/Recipient details */}
            <div>
              <span className="text-[9.5px] text-slate-400 font-bold block uppercase font-mono">
                {type === 'Kwitansi' ? 'AKUN FINANSIAL BUKU KAS:' : 'Identitas Terkait:'}
              </span>
              <strong className="text-sm text-slate-900 block mt-0.5">
                {type === 'Kwitansi' ? (data.account || 'Buku Kas Harian') : (data.customerName || data.supplierName || data.craftsmanName || data.employeeName || 'Staff Proyek')}
              </strong>
              <span className="text-slate-550 block mt-0.5 font-bold text-indigo-700">
                {type === 'Kwitansi' ? `Metode Log: ${data.type || 'Transaksi'}` : (data.surveyAddress || data.projectName || data.nip || 'Sektor Utama')}
              </span>
              {data.surveyorName && (
                <span className="text-[9px] text-slate-500 font-medium block mt-1">
                  Surveyor / PIC: <strong className="text-slate-700">{data.surveyorName}</strong>
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[9.5px] text-slate-400 font-bold block uppercase">Tanggal Release:</span>
              <strong className="text-xs text-slate-800 block mt-0.5">{data.date || data.paymentDate || '-'}</strong>
              {type === 'InvoicePenjualan' && data.paymentMethod === 'Tempo' && data.dueDate && (
                <div className="mt-1">
                  <span className="text-[9px] text-amber-700 font-bold block uppercase">Batas Jatuh Tempo:</span>
                  <strong className="text-xs text-amber-800 block">{new Date(data.dueDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})} ({data.tempoDays || 30} Hari)</strong>
                </div>
              )}
              <span className="text-[9.5px] text-indigo-650 bg-indigo-50 border border-indigo-100 font-bold px-2.5 py-0.5 rounded mt-1.5 inline-block print:border-none print:bg-white text-right">
                Otoritas: {data.status || 'RELEASED'}
              </span>
            </div>
            
          </div>

          {/* Table / Details values lists */}
          <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
            <div className="p-3 bg-slate-100 font-black text-[10px] uppercase border-b border-slate-200 tracking-wider">
              Rincian Item & Spesifikasi BoQ
            </div>
            <div className="p-4 leading-loose bg-white font-mono text-xs whitespace-pre-line text-slate-705">
              {(() => {
                if (data.itemsList) {
                  try {
                    const parsed = JSON.parse(data.itemsList);
                    if (Array.isArray(parsed)) {
                      return parsed.map((item: any, i: number) => {
                        if (item.targetRoom || item.targetAction) {
                          if (item.targetRoom && !item.targetAction && !item.areaSize) {
                            return `${i + 1}. ${item.targetRoom}`;
                          }
                          const room = item.targetRoom || 'Area Umum';
                          const action = item.targetAction || 'Pemeriksaan Ruang';
                          const size = item.areaSize ? `${item.areaSize} m²` : '-';
                          const note = item.itemNotes ? ` | Catatan: ${item.itemNotes}` : '';
                          return `${i + 1}. [Ruang: ${room}] - Rencana Tindakan: ${action} | Estimasi Luas: ${size}${note}`;
                        }
                        const desc = item.description || item.name || 'Material Sourcing';
                        const notes = item.notes ? ` (${item.notes})` : '';
                        const qty = item.qty !== undefined ? item.qty : (item.volume !== undefined ? item.volume : 0);
                        const unit = item.unit || 'PCS';
                        const price = item.price || 0;
                        const sub = item.subtotal || item.subTotal || (qty * price);
                        return `${i + 1}. [${desc}${notes}] - ${qty} ${unit} @ ${formatIDR(price)} = ${formatIDR(sub)}`;
                      }).join('\n');
                    }
                  } catch (e) {
                    // Fallback to raw text if parsing fails
                  }
                }
                if (type === 'Kwitansi') {
                  return `Sebab Deskripsi / Alokasi Penggunaan:\n"${data.description || 'Tanpa keterangan'}"\n\nKategori: ${data.category || 'Umum'}\nPembukuan Akun: ${data.account || 'Kas Harian'}\nTipe Aliran Kas: ${data.type || 'Transaksi'}`;
                }
                return data.itemsList || data.itemsReceived || data.workDescription || data.notes || `Deskripsi detail:\n- Sourcing material premium interior design\n- Gaji dasar & tunjangan transport lapangan\n- Nominal: ${formatIDR(data.totalAmount || data.basicSalary || data.depositAmount || data.appraisalValue || data.amount)}`;
              })()}
            </div>
          </div>

          {/* Numerical Accounting Summary Row */}
          {(type === 'Quotation' || type === 'InvoicePenjualan') && (
            <div className="space-y-1 text-right text-[10px] pb-2 border-b border-slate-100 mt-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-slate-400 uppercase font-mono tracking-tighter">SUBTOTAL:</span>
                <span className="font-bold text-slate-800">{formatIDR(data.subTotal || data.itemsSubTotal || (data.totalAmount + (data.discount || 0) - (data.ppn || 0) - (data.shipping || 0) + (data.surveyDeposit || 0)))}</span>
              </div>
              {data.hasDiscount && (
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 uppercase font-mono tracking-tighter">DISKON:</span>
                  <span className="font-bold text-rose-600">-{formatIDR(data.discount || 0)}</span>
                </div>
              )}
              {data.hasPpn && (
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 uppercase font-mono tracking-tighter">PPN 11%:</span>
                  <span className="font-bold text-slate-800">+{formatIDR(data.ppn || 0)}</span>
                </div>
              )}
              {data.hasShipping && (
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 uppercase font-mono tracking-tighter">ONGKIR / KIRIM:</span>
                  <span className="font-bold text-slate-800">+{formatIDR(data.shipping || 0)}</span>
                </div>
              )}
              {data.hasSurveyDeposit && (
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 uppercase font-mono tracking-tighter text-rose-500">DEPOSIT SURVEI (POTONG):</span>
                  <span className="font-bold text-rose-600">-{formatIDR(data.surveyDeposit || 0)}</span>
                </div>
              )}
            </div>
          )}

          {(type === 'Quotation' || type === 'InvoicePenjualan') && data.skNotes && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
              <div className="p-2 bg-slate-50 font-black text-[9px] uppercase border-b border-slate-200 tracking-wider">
                Syarat & Ketentuan (S&K)
              </div>
              <div className="p-3 font-mono text-[9px] whitespace-pre-line text-slate-600 italic">
                {data.skNotes}
              </div>
            </div>
          )}

          {(data.totalAmount || data.basicSalary || data.depositAmount || data.appraisalValue || data.amount) && (
            <div className="flex justify-end pt-2 border-t border-slate-100 leading-normal">
              <div className="text-right space-y-1">
                <span className="text-[9.5px] text-slate-400 font-bold uppercase block">GRAND TOTAL NILAI TERBUKTI</span>
                <strong className="text-lg text-indigo-700 font-mono font-black">
                  {formatIDR(data.totalAmount || data.totalPaid || data.depositAmount || data.appraisalValue || data.basicSalary || data.amount)}
                </strong>
                {data.paidAmount !== undefined && (
                  <div className="text-[10px] text-slate-500">
                    Sisa Outstanding Piutang: <span className="font-bold text-rose-500">{formatIDR(data.totalAmount - data.paidAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legal Signatures / Stamp area */}
          <div className="grid grid-cols-2 pt-10 text-[10px] items-end font-sans">
            <div className="flex flex-col items-center">
              <div className="h-16 flex items-center justify-center relative">
                {settings?.reportSignatureUrl ? (
                  <img src={settings.reportSignatureUrl} alt="Signature" className="h-14 object-contain absolute -top-4 opacity-80" />
                ) : (
                  <div className="w-16 h-16 border-2 border-dashed border-teal-500/20 rounded-full flex items-center justify-center text-teal-600 rotate-12 absolute -top-4 opacity-50">
                    <span className="font-mono text-[8px] font-black tracking-widest text-center">LUXE<br/>STAMP</span>
                  </div>
                )}
              </div>
              <span className="w-40 border-b border-slate-900 border-solid" />
              <strong className="text-slate-905 mt-1 block">{data.signerName || dbState.settings?.reportSignerName || 'Tim Administrasi Keuangan'}</strong>
              <span className="text-slate-450">{data.signerTitle || dbState.settings?.reportSignerTitle || companyName}</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="h-16 flex items-center justify-center relative">
                <Signature className="w-8 h-8 text-indigo-500 opacity-60 -top-2 absolute" />
              </div>
              <span className="w-40 border-b border-slate-900 border-solid" />
              <strong className="text-slate-905 mt-1 block">{data.customerName || data.supplierName || data.craftsmanName || 'Direktur Utama'}</strong>
              <span className="text-slate-450">Pihak Penerima / Klien</span>
            </div>
          </div>

          {/* Verified Footer stamp */}
          <div className="pt-6 border-t border-slate-100 text-center text-[9px] text-slate-400 font-mono flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Dokumen elektronik ini sah secara hukum & dicetak melalui sistem {companyName} ERP v2.4-STABLE
          </div>

        </div>
    </Modal>
  );
};
