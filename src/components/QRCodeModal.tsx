import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightningAddress: string;
  title: string;
}

export default function QRCodeModal({ isOpen, onClose, lightningAddress, title }: QRCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#111111] rounded-lg p-6 max-w-sm w-full mx-4 relative border border-gray-800">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>

        {/* Lightning address label */}
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Lightning address
        </h3>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-lg mb-4">
          <QRCodeSVG
            value={`lightning:${lightningAddress}`}
            size={256}
            level="H"
            className="w-full h-auto"
          />
        </div>

        {/* Lightning Address */}
        <p className="text-center text-sm text-gray-300">
          {lightningAddress}
        </p>
      </div>
    </div>
  );
}