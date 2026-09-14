import React, { useState } from 'react';
import { X, BellRing, CheckCircle2, Radio, Send, Copy, ShieldAlert, Download } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CapAlertModal({ isOpen, onClose, capAlerts, cycloneName, onDispatch, isDispatching }) {
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  if (!isOpen || !capAlerts || capAlerts.length === 0) return null;

  const currentAlert = capAlerts[selectedAlertIndex] || capAlerts[0];

  const handleBroadcast = async () => {
    await onDispatch();
    setDispatched(true);
    // Confetti effect for successful simulated emergency broadcast dispatch
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(capAlerts, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(capAlerts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CAP-Alerts-${cycloneName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Emergency Alert Dispatch Center (CAP v1.2)
              </h2>
              <p className="text-xs text-slate-400">
                Common Alerting Protocol standard for Indian National Disaster Management Authority (NDMA)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: District Alert List */}
          <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Generated District Bulletins ({capAlerts.length})
            </h3>
            {capAlerts.map((alert, idx) => {
              const isSelected = selectedAlertIndex === idx;
              const severity = alert.info.severity;
              const isRed = severity === 'Red';
              const isOrange = severity === 'Orange';

              return (
                <button
                  key={alert.identifier}
                  onClick={() => setSelectedAlertIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-slate-800 border-cyan-500 shadow-md' 
                      : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-200 truncate">
                      {alert.info.area.areaDesc}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isRed 
                        ? 'text-red-400 bg-red-950/50 border-red-500/40'
                        : isOrange 
                          ? 'text-orange-400 bg-orange-950/50 border-orange-500/40'
                          : 'text-yellow-400 bg-yellow-950/50 border-yellow-500/40'
                    }`}>
                      {severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">
                    {alert.info.instruction}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected CAP Detail & Raw Schema */}
          <div className="md:col-span-2 p-6 overflow-y-auto max-h-[60vh] space-y-4">
            {/* Alert Headline Box */}
            <div className={`p-4 rounded-xl border ${
              currentAlert.info.severity === 'Red'
                ? 'bg-red-950/30 border-red-500/40 text-red-200'
                : currentAlert.info.severity === 'Orange'
                  ? 'bg-orange-950/30 border-orange-500/40 text-orange-200'
                  : 'bg-yellow-950/30 border-yellow-500/40 text-yellow-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-base mb-1">
                <BellRing className="w-5 h-5 animate-bounce" />
                <span>{currentAlert.info.headline}</span>
              </div>
              <p className="text-xs leading-relaxed opacity-90 mt-1">
                {currentAlert.info.description}
              </p>
              <div className="mt-3 p-2.5 rounded-lg bg-black/40 border border-current/20 text-xs">
                <strong className="block text-white mb-0.5">Mandated Civil Protection Action:</strong>
                {currentAlert.info.instruction}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Urgency</span>
                <span className="font-semibold text-slate-200 font-mono">{currentAlert.info.urgency}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Certainty</span>
                <span className="font-semibold text-slate-200 font-mono">{currentAlert.info.certainty}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Category</span>
                <span className="font-semibold text-slate-200 font-mono">{currentAlert.info.category}</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Sender</span>
                <span className="font-semibold text-slate-200 font-mono truncate">{currentAlert.sender}</span>
              </div>
            </div>

            {/* Raw CAP JSON Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px]">CAP v1.2 Standard JSON Structure</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Copied!' : 'Copy Payload'}</span>
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
              <pre className="p-3 bg-slate-950 text-cyan-300 font-mono text-[11px] rounded-lg border border-slate-800 overflow-x-auto max-h-[160px]">
                {JSON.stringify(currentAlert, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer & Push Dispatch Action */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Target Channels: <strong>SMS Broadcast</strong>, <strong>Cell Broadcast Sirens</strong>, <strong>IMD-NDMA Gateway</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
            >
              Close
            </button>
            <button
              onClick={handleBroadcast}
              disabled={isDispatching || dispatched}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all shadow-lg ${
                dispatched 
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-600/30'
              }`}
            >
              {isDispatching ? (
                <span>Dispatching Radio & SMS Broadcast...</span>
              ) : dispatched ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Broadcast Dispatched to All Zones</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Push Immediate Broadcast Alert</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
