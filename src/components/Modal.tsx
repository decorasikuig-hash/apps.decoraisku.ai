import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-lg' 
}) => {
  // Kunci scroll halaman belakang (body overflow: hidden) saat pop-up muncul
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden print:relative print:block print:inset-auto print:p-0 print:overflow-visible">
          {/* Backdrop Blur & Dimming */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-[8px] print:hidden"
          />

          {/* Modal Container dengan Slide/Scale Transisi */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`relative w-full ${maxWidth} bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden print:overflow-visible z-10 flex flex-col max-h-[90vh] print:max-h-none modal-container`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-6 pb-4 border-b border-slate-50 print:hidden`}>
              {title ? (
                <h3 className="text-xl text-slate-800 tracking-tight tracking-tight capitalize font-semibold font-sans tracking-tight capitalize">
                  {title}
                </h3>
              ) : <div />}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors cursor-pointer group"
                title="Tutup Form"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 print:p-0 overflow-y-auto print:overflow-visible scrollbar-hide">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(modalContent, document.body);
};
