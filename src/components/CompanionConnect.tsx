import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Copy, Check, X } from 'lucide-react';

interface CompanionConnectProps {
  /** Render as a centered modal overlay (true) or an inline card (false). */
  asModal?: boolean;
  onClose?: () => void;
}

/**
 * Shows the GSM call-sync webhook URL plus a scannable QR code so the
 * DHD CRM Companion Android app can be configured by scanning instead of
 * typing the long URL.
 *
 * The QR encodes a small JSON payload: { type, webhookUrl } so the app can
 * validate it is a genuine DHD CRM link before applying it.
 */
const CompanionConnect: React.FC<CompanionConnectProps> = ({ asModal = false, onClose }) => {
  const webhookUrl = `${window.location.origin}/api/whatsapp?action=addGSMCall`;
  const payload = JSON.stringify({ type: 'dhd-crm-companion', webhookUrl });

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [payload]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const card = (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Connect Companion App</h3>
        </div>
        {asModal && onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">
        In the Android app, open <span className="text-gray-200 font-medium">Settings → Scan QR Code</span>{' '}
        and point the camera here.
      </p>

      <div className="bg-white rounded-xl p-3 flex items-center justify-center mb-4">
        {qrDataUrl
          ? <img src={qrDataUrl} alt="Companion app QR code" width={216} height={216} />
          : <div className="w-[216px] h-[216px] animate-pulse bg-gray-200 rounded" />}
      </div>

      <p className="text-xs font-semibold text-gray-400 mb-1.5">Or paste this URL manually:</p>
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2.5">
        <code className="text-xs text-amber-400 break-all flex-1">{webhookUrl}</code>
        <button
          onClick={copy}
          className="shrink-0 w-7 h-7 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center justify-center"
          aria-label="Copy URL"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );

  if (!asModal) return card;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{card}</div>
    </div>
  );
};

export default CompanionConnect;
