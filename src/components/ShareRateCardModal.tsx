import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommissionRate } from '../types';
import type { CurrencyCode } from '../utils/currencyUtils';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Share2,
  Check,
  Printer,
  Download,
  Globe,
  MessageSquare,
} from 'lucide-react';

interface ShareRateCardModalProps {
  rate: CommissionRate | null;
  currency: CurrencyCode;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareRateCardModal: React.FC<ShareRateCardModalProps> = ({
  rate,
  currency,
  isOpen,
  onClose,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const canViewCommission = role !== 'STAFF';
  const canViewRoute = role !== 'AGENT';

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [exporting, setExporting] = useState(false);
  const [includeMaster, setIncludeMaster] = useState(false);

  if (!isOpen || !rate) return null;

  const agentRateFormatted = formatCurrencyValue(rate.agentRate, currency, rate.isFlatFee);
  const masterRateFormatted = formatCurrencyValue(rate.masterRate, currency, rate.isFlatFee);
  const marginFormatted = formatCurrencyValue(rate.diffMargin, currency, rate.isFlatFee);

  // Formatted WhatsApp Markdown Text Quote (No Emojis)
  const generateWhatsAppQuote = () => {
    let text = `BASECHAN INTERNATIONAL OFFICIAL RATE QUOTE\n`;
    text += `--------------------------------------\n`;
    text += `University: ${rate.universityName}\n`;
    text += `Country: ${rate.country || 'United Kingdom'}\n`;
    text += `Intake: ${rate.intake}\n`;
    text += `Study Level: ${rate.studyLevel}\n`;
    text += `--------------------------------------\n`;
    if (canViewRoute) text += `Application Route: Use ${rate.aggregator || 'Direct'}\n`;
    if (canViewCommission) text += `Agent Commission: ${agentRateFormatted}\n`;

    if (isAdmin && includeMaster) {
      text += `Incoming Master Rate: ${masterRateFormatted}\n`;
      text += `Net Profit Margin: ${marginFormatted}\n`;
    }

    text += `--------------------------------------\n`;
    text += `Verified Corporate Schedule - Basechan CMS`;

    return text;
  };

  const fileName = `${rate.universityName}-${rate.intake}-rate-card`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'basechan-rate-card';

  const renderCardPng = async (): Promise<File> => {
    const width = 1200;
    const height = isAdmin && includeMaster ? 720 : 600;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the rate card image.');

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#17243a');
    background.addColorStop(0.55, '#0e1526');
    background.addColorStop(1, '#080d18');
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(0, 0, width, height, 42);
    context.fill();
    context.strokeStyle = 'rgba(251, 191, 36, .55)';
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = '#ffffff';
    context.font = '800 34px system-ui, sans-serif';
    context.fillText('Basechan International', 64, 86);
    context.fillStyle = '#fbbf24';
    context.font = '700 18px system-ui, sans-serif';
    context.letterSpacing = '3px';
    context.fillText('OFFICIAL RATE QUOTE', 64, 122);
    context.textAlign = 'right';
    context.fillStyle = '#34d399';
    context.font = '700 18px system-ui, sans-serif';
    context.fillText('VERIFIED', width - 64, 84);
    context.textAlign = 'left';
    context.letterSpacing = '0px';
    context.strokeStyle = '#28354a';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(64, 154);
    context.lineTo(width - 64, 154);
    context.stroke();

    context.fillStyle = '#ffffff';
    context.font = '800 40px system-ui, sans-serif';
    const schoolName = rate.universityName.length > 38 ? `${rate.universityName.slice(0, 35)}…` : rate.universityName;
    context.fillText(schoolName, 64, 224);
    context.fillStyle = '#a5b4fc';
    context.font = '600 23px system-ui, sans-serif';
    context.fillText(`${rate.country || 'United Kingdom'}  •  ${rate.intake}  •  ${rate.studyLevel}`, 64, 266);

    context.fillStyle = '#18181b';
    context.beginPath();
    context.roundRect(64, 310, width - 128, 142, 24);
    context.fill();
    if (canViewCommission) {
      context.fillStyle = '#94a3b8';
      context.font = '700 17px system-ui, sans-serif';
      context.fillText('AGENT COMMISSION', 92, 354);
      context.fillStyle = '#fbbf24';
      context.font = '800 46px ui-monospace, monospace';
      context.fillText(agentRateFormatted, 92, 408);
    }
    if (canViewRoute) {
      context.fillStyle = '#94a3b8';
      context.font = '700 17px system-ui, sans-serif';
      context.fillText('APPLICATION ROUTE', canViewCommission ? 630 : 92, 354);
      context.fillStyle = '#cbd5e1';
      context.font = '700 30px system-ui, sans-serif';
      context.fillText(`Use ${rate.aggregator || 'Direct'}`, canViewCommission ? 630 : 92, 408);
    }

    if (isAdmin && includeMaster) {
      context.fillStyle = '#111827';
      context.beginPath();
      context.roundRect(64, 482, 510, 118, 20);
      context.fill();
      context.fillStyle = '#94a3b8';
      context.font = '700 16px system-ui, sans-serif';
      context.fillText('MASTER RATE', 90, 520);
      context.fillStyle = '#ffffff';
      context.font = '700 24px ui-monospace, monospace';
      context.fillText(masterRateFormatted, 90, 564);
      context.fillStyle = '#064e3b';
      context.beginPath();
      context.roundRect(594, 482, 542, 118, 20);
      context.fill();
      context.fillStyle = '#a7f3d0';
      context.font = '700 16px system-ui, sans-serif';
      context.fillText('PROFIT MARGIN', 620, 520);
      context.fillStyle = '#34d399';
      context.font = '700 24px ui-monospace, monospace';
      context.fillText(`${marginFormatted}`, 620, 564);
    }

    context.strokeStyle = '#28354a';
    context.beginPath();
    context.moveTo(64, height - 66);
    context.lineTo(width - 64, height - 66);
    context.stroke();
    context.fillStyle = '#94a3b8';
    context.font = '500 16px ui-monospace, monospace';
    context.fillText(`Ref ID: ${rate.id.slice(0, 8)}`, 64, height - 34);
    context.textAlign = 'right';
    context.fillText(`Valid for ${rate.intake} Cycle  ·  Basechan CMS`, width - 64, height - 34);
    context.textAlign = 'left';

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The rate card image could not be created.')), 'image/png'));
    return new File([blob], `${fileName}.png`, { type: 'image/png' });
  };

  const copyWhatsAppQuote = async () => {
    const text = generateWhatsAppQuote();
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const temporary = document.createElement('textarea');
      temporary.value = text;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.appendChild(temporary);
      temporary.select();
      const copiedToClipboard = document.execCommand('copy');
      temporary.remove();
      if (!copiedToClipboard) throw new Error('Clipboard access is unavailable in this browser.');
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      await copyWhatsAppQuote();
      setCopied(true);
      setFeedback('WhatsApp quote copied.');
      window.setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not copy the quote.');
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const file = await renderCardPng();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('Rate card downloaded as PNG.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not download the rate card.');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const file = await renderCardPng();
      const text = generateWhatsAppQuote();
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: `${rate.universityName} rate card`, text });
        setFeedback('Rate card shared.');
      } else if (navigator.share) {
        await navigator.share({ title: `${rate.universityName} rate card`, text });
        setFeedback('Rate quote shared.');
      } else {
        await copyWhatsAppQuote();
        setFeedback('Sharing isn’t available here. The WhatsApp quote was copied instead.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback(error instanceof Error ? error.message : 'Could not share the rate card.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto max-w-lg w-full max-h-[90vh] bg-white dark:bg-[#0E1526] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-[#222F43] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop z-[10000]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#222F43] flex items-center justify-between bg-slate-50/90 dark:bg-[#18181B]/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/15 text-amber-500 rounded-xl border border-amber-400/30">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Shareable Rate Card & PDF Quote
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Formatted for 1-click WhatsApp sharing or official PDF export
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Admin White-Label Toggle */}
          {isAdmin && (
            <div className="p-3 bg-slate-50 dark:bg-[#18181B] rounded-2xl border border-slate-200 dark:border-[#222F43] flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Include Master Rate & Profit Yield:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMaster}
                  onChange={(e) => setIncludeMaster(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:peer-focus:ring-amber-400 peer-checked:bg-amber-400"></div>
              </label>
            </div>
          )}

          {/* VISUAL BRANDED RATE CARD PREVIEW */}
          <div id="printable-rate-card" className="p-5 bg-gradient-to-br from-slate-900 via-[#0E1526] to-slate-950 text-white rounded-3xl border border-amber-400/30 shadow-2xl space-y-4 relative overflow-hidden select-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Brand Logo */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Basechan Logo" className="w-8 h-8 rounded-xl object-cover border border-amber-400/40" />
                <div>
                  <h4 className="font-black text-sm text-white tracking-tight leading-tight">Basechan International</h4>
                  <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">Official Rate Quote</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                VERIFIED
              </span>
            </div>

            {/* University Content */}
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black text-white leading-snug">
                {rate.universityName}
              </h2>
              <p className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>{rate.country || 'United Kingdom'} • {rate.intake} • {rate.studyLevel}</span>
              </p>
            </div>

            {/* Rate Payout Callout */}
            <div className="p-4 bg-[#18181B]/80 rounded-2xl border border-[#222F43] flex flex-wrap items-center justify-between gap-3">
              {canViewCommission && <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Agent Commission</span>
                <span className="mt-1 block text-xl font-mono font-black text-amber-400">{agentRateFormatted}</span>
              </div>}
              {canViewRoute && <p className="text-xs text-slate-300 font-medium">Application Route: <strong>{rate.aggregator || 'Direct'}</strong></p>}
            </div>

            {/* Admin Extra Breakdown */}
            {isAdmin && includeMaster && (
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block font-bold uppercase">Master Rate</span>
                  <span className="font-mono font-bold text-white text-xs">{masterRateFormatted}</span>
                </div>
                <div className="p-2 bg-emerald-950/60 rounded-xl border border-emerald-800">
                  <span className="text-emerald-300 block font-bold uppercase">Profit Margin</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">{marginFormatted}</span>
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Ref ID: {rate.id.slice(0, 8)}</span>
              <span>Valid for {rate.intake} Cycle</span>
            </div>
          </div>

          {/* WhatsApp Text Preview Box */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Formatted WhatsApp Text Preview:
            </span>
            <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-2xl border border-slate-800 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {generateWhatsAppQuote()}
            </pre>
          </div>

          {/* Action Buttons */}
          {feedback && <p role="status" aria-live="polite" className="text-xs text-slate-600 dark:text-slate-300">{feedback}</p>}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button type="button" onClick={() => void handleShare()} disabled={exporting} className="min-h-11 rounded-2xl bg-indigo-600 px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">
              <span className="flex items-center justify-center gap-2"><Share2 className="h-4 w-4" />{exporting ? 'Preparing…' : 'Share Card'}</span>
            </button>
            <button type="button" onClick={() => void handleDownload()} disabled={exporting} className="min-h-11 rounded-2xl bg-slate-800 px-4 py-3 font-extrabold text-white shadow-md transition hover:bg-slate-900 disabled:cursor-wait disabled:opacity-50">
              <span className="flex items-center justify-center gap-2"><Download className="h-4 w-4" />{exporting ? 'Preparing…' : 'Download PNG'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="min-h-11 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <MessageSquare className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy WhatsApp Quote'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="min-h-11 py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-amber-400 dark:hover:bg-amber-500 text-white dark:text-slate-950 font-extrabold rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
