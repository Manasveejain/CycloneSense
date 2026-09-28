import React, { useState } from 'react';
import { X, BellRing, ShieldAlert, Send, Copy, Download } from 'lucide-react';

export default function CapAlertModal({ isOpen, onClose, capAlerts = [], cycloneName = 'Cyclone' }) {
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const alerts = Array.isArray(capAlerts) ? capAlerts : [];
  if (alerts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Emergency Alert
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-300">No alert data available.</p>
        </div>
      </div>
    );
  }

  const currentAlert = alerts[selectedAlertIndex];
  const zoneColor = currentAlert?.zone === 'Red' ? 'red' : currentAlert?.zone === 'Orange' ? 'orange' : 'yellow';
  const zoneColorClasses = {
    red: 'bg-red-950/30 border-red-500/40 text-red-200',
    orange: 'bg-orange-950/30 border-orange-500/40 text-orange-200',
    yellow: 'bg-yellow-950/30 border-yellow-500/40 text-yellow-200'
  };

  const handleCopy = () => {
    const alertJson = JSON.stringify(alerts, null, 2);
    navigator.clipboard.writeText(alertJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const alertJson = JSON.stringify(alerts, null, 2);
    const blob = new Blob([alertJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CAP-Alerts-${cycloneName.replace(/\s+/g, '_')}-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Emergency Alert Dispatch (CAP)</h2>
              <p className="text-xs text-slate-400">Common Alerting Protocol for {cycloneName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-x divide-slate-800">
          {/* Alert List */}
          <div className="p-4 overflow-y-auto space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Districts ({alerts.length})</h3>
            {alerts.map((alert, idx) => {
              const isSelected = selectedAlertIndex === idx;
              const zoneClass = alert.zone === 'Red' ? 'border-red-500' : alert.zone === 'Orange' ? 'border-orange-500' : 'border-yellow-500';
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedAlertIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? `${zoneClass} bg-slate-800 shadow-md` 
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-100">{alert.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      alert.zone === 'Red' ? 'bg-red-500/30 text-red-300' :
                      alert.zone === 'Orange' ? 'bg-orange-500/30 text-orange-300' :
                      'bg-yellow-500/30 text-yellow-300'
                    }`}>
                      {alert.zone}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{alert.state}</p>
                </button>
              );
            })}
          </div>

          {/* Alert Details */}
          <div className="md:col-span-2 p-6 overflow-y-auto space-y-4">
            {/* Alert Box */}
            <div className={`p-4 rounded-lg border ${zoneColorClasses[zoneColor]}`}>
              <div className="flex items-center gap-2 font-bold text-base mb-2">
                <BellRing className="w-5 h-5 animate-bounce" />
                <span>{currentAlert.zone} Zone Alert</span>
              </div>
              <p className="text-sm leading-relaxed mb-2">
                <strong>{currentAlert.name}, {currentAlert.state}</strong> is in a <strong className="uppercase">{currentAlert.zone}</strong> risk zone.
              </p>
              <p className="text-sm leading-relaxed">
                {currentAlert.action}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricBox label="Risk Score" value={`${currentAlert.risk_score}/10`} />
              <MetricBox label="Distance" value={`${currentAlert.distance_to_path_km.toFixed(1)} km`} />
              <MetricBox label="Est. Damage" value={`$${currentAlert.estimated_damage_usd_m.toFixed(0)}M`} />
              <MetricBox label="Population" value={`${(currentAlert.population_affected / 1000000).toFixed(1)}M`} />
              <MetricBox label="Zone Type" value={currentAlert.zone} />
              <MetricBox label="Severity" value={currentAlert.risk_score > 8 ? 'CRITICAL' : currentAlert.risk_score > 5 ? 'HIGH' : 'MODERATE'} />
            </div>

            {/* Alert Message */}
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">CAP Alert Message</h4>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
{`<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${currentAlert.name}-${Date.now()}</identifier>
  <sender>CycloneSense</sender>
  <sent>${new Date().toISOString()}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Cyclone ${currentAlert.zone} Zone</event>
    <urgency>${currentAlert.zone === 'Red' ? 'Immediate' : 'Expected'}</urgency>
    <severity>${currentAlert.zone}</severity>
    <areaDesc>${currentAlert.name}, ${currentAlert.state}</areaDesc>
  </info>
</alert>`}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Alert {selectedAlertIndex + 1} of {alerts.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-all"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-all"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={() => {
                alert('✅ CAP Alert dispatched to NDMA emergency network');
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition-all"
            >
              <Send className="w-4 h-4" />
              Dispatch Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
      <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}
