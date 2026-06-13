/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDBState, createNotification } from './database';

interface SendWhatsAppParams {
  phone: string;
  message: string;
  recipientName: string;
}

// Global hook to show a mock WhatsApp message floating on screen
type WAFloatingListener = (chat: { phone: string; message: string; name: string; timestamp: Date }) => void;
const waListeners: Set<WAFloatingListener> = new Set();

export const subscribeToWhatsAppAlerts = (listener: WAFloatingListener) => {
  waListeners.add(listener);
  return () => {
    waListeners.delete(listener);
  };
};

const triggerFloatingWAAlert = (phone: string, message: string, name: string) => {
  waListeners.forEach(listener => listener({ phone, message, name, timestamp: new Date() }));
};

/**
 * Sends a real or simulated WhatsApp notification via Fonnte API.
 * Uses the Fonnte token saved in Settings.
 */
export const sendWhatsAppNotification = async ({ phone, message, recipientName }: SendWhatsAppParams): Promise<{ success: boolean; details: string }> => {
  const state = getDBState();
  const token = state.settings.fonnteToken;

  if (!phone) {
    return { success: false, details: 'Nomor telepon penerima tidak ditemukan/kosong.' };
  }

  // Format phone number to international standard if it starts with 0
  let formattedPhone = phone.trim().replace(/[\s-+]/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.slice(1);
  }

  const cleanMessage = `*[${state.settings.companyName} - ERP INT]* \n\nHalo ${recipientName},\n${message}\n\n_Pesan otomatis dikirim oleh Sistem ERP._`;

  // Always show on-screen simulated bubble so user can see the trigger immediately
  triggerFloatingWAAlert(formattedPhone, cleanMessage, recipientName);

  // If the token appears to be a mock or empty, bypass the real HTTP request to avoid SSL or credential errors, but count as success!
  if (!token || token.includes('DEMO_TOKEN') || token === '') {
    createNotification(
      'WhatsApp Terkirim (Simulasi)',
      `Pesan dikirim ke *${recipientName}* (${formattedPhone}) via Fonnte.`,
      'success',
      true,
      cleanMessage
    );
    return { 
      success: true, 
      details: 'WhatsApp disimulasikan sukses (menggunakan Demo Token).' 
    };
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: new URLSearchParams({
        target: formattedPhone,
        message: cleanMessage,
      }),
    });

    const result = await response.json();
    
    if (result.status === true || response.ok) {
      createNotification(
        'WhatsApp Terkirim (Real API)',
        `Berhasil mengirim notifikasi ke *${recipientName}* menggunakan token Fonnte pilihan Anda.`,
        'success',
        true,
        cleanMessage
      );
      return { success: true, details: 'Berhasil dikirim via Fonnte!' };
    } else {
      createNotification(
        'WhatsApp Gagal Kirim',
        `Fonnte error: ${result.reason || 'Sebab tidak diketahui'}. Periksa token Anda di Pengaturan.`,
        'error',
        false,
        cleanMessage
      );
      return { success: false, details: `Fonnte menolak permintaan: ${result.reason || 'Token tidak valid'}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    createNotification(
      'Koneksi API WhatsApp Gagal',
      `Gagal menghubungi server Fonnte. Detail: ${errorMsg}`,
      'error',
      false,
      cleanMessage
    );
    return { success: false, details: `Gagal akses Fonnte API: ${errorMsg}` };
  }
};
