// IntensityChart.jsx
// Single-storm intensity line graph shown to the right of the map.
// Displays wind speed (kt) from -18h observed through +24h forecast
// with IMD category bands as coloured background reference areas.

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';

// IMD category bands (min/max in kt)
const IMD_CATS = [
  { label: 'D',    name: 'Depression',           min: 0,   max: 33,  color: '#64748b' },
  { label: 'DD',   name: 'Deep Depression',       min: 34,  max: 47,  color: '#0ea5e9' },
  { label: 'CS',   name: 'Cyclonic Storm',        min: 48,  max: 63,  color: '#22c55e' },
  { label: 'SCS',  name: 'Severe CS',             min: 64,  max: 89,  color: '#eab308' },
  { label: 'VSCS', name: 'Very Severe CS',        min: 90,  max: 119, color: '#f97316' },
  { label: 'ESCS', name: 'Extremely Severe CS',   min: 120, max: 164, color: '#ef4444' },
  { label: 'SuCS', name: 'Super Cyclonic Storm',  min: 165, max: 220, color: '#a21caf' },
];

function imdCat(kt) {
  return [...IMD_CATS].reverse().find(c => kt >= c.min) || IMD_CATS[0];
}

// Per-storm timeline data
export const STORM_TIMELINES = {
  'storm-fani':     { name: 'Fani (2019)',      color: '#ef4444', category: 'ESCS', points: [
    { h: -18, w: 95  }, { h: -12, w: 110 }, { h: -6, w: 130 }, { h: 0, w: 150 },
    { h:   6, w: 120 }, { h:  12, w: 85  }, { h: 18, w: 55  }, { h: 24, w: 35  },
  ]},
  'storm-amphan':   { name: 'Amphan (2020)',    color: '#a21caf', category: 'SuCS', points: [
    { h: -18, w: 80  }, { h: -12, w: 110 }, { h: -6, w: 155 }, { h: 0, w: 140 },
    { h:   6, w: 100 }, { h:  12, w: 70  }, { h: 18, w: 50  }, { h: 24, w: 38  },
  ]},
  'storm-yaas':     { name: 'Yaas (2021)',      color: '#f97316', category: 'VSCS', points: [
    { h: -18, w: 65  }, { h: -12, w: 80  }, { h: -6, w: 100 }, { h: 0, w: 115 },
    { h:   6, w: 90  }, { h:  12, w: 65  }, { h: 18, w: 50  }, { h: 24, w: 40  },
  ]},
  'storm-biparjoy': { name: 'Biparjoy (2023)', color: '#eab308', category: 'VSCS', points: [
    { h: -18, w: 70  }, { h: -12, w: 85  }, { h: -6, w: 100 }, { h: 0, w: 105 },
    { h:   6, w: 80  }, { h:  12, w: 60  }, { h: 18, w: 45  }, { h: 24, w: 38  },
  ]},
  'storm-michaung': { name: 'Michaung (2023)', color: '#22c55e', category: 'SCS',  points: [
    { h: -18, w: 50  }, { h: -12, w: 60  }, { h: -6, w: 72  }, { h: 0, w: 80  },
    { h:   6, w: 60  }, { h:  12, w: 45  }, { h: 18, w: 38  }, { h: 24, w: 35  },
  ]},
  'storm-tauktae':  { name: 'Tauktae (2021)',  color: '#06b6d4', category: 'ESCS', points: [
    { h: -18, w: 90  }, { h: -12, w: 115 }, { h: -6, w: 135 }, { h: 0, w: 145 },
    { h:   6, w: 110 }, { h:  12, w: 80  }, { h: 18, w: 55  }, { h: 24, w: 40  },
  ]},
  'storm-gati':     { name: 'Gati (2020)',      color: '#8b5cf6', category: 'SuCS', points: [
    { h: -18, w: 75  }, { h: -12, w: 110 }, { h: -6, w: 160 }, { h: 0, w: 165 },
    { h:   6, w: 110 }, { h:  12, w: 75  }, { h: 18, w: 55  }, { h: 24, w: 45  },
  ]},
  'storm-nisarga':  { name: 'Nisarga (2020)',   color: '#f43f5e', category: 'SCS',  points: [
    { h: -18, w: 45  }, { h: -12, w: 60  }, { h: -6, w: 75  }, { h: 0, w: 85  },
    { h:   6, w: 65  }, { h:  12, w: 50  }, { h: 18, w: 40  }, { h: 24, w: 35  },
  ]},
};

// Tooltip
function Tip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const wind = payload[0] && payload[0].value;
  if (wind == null) return null;
  const cat = imdCat(wind);
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #334155',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 140,
    }}>
      <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#94a3b8' }}>Wind</span>
        <span style={{ fontWeight: 900, color: '#fff' }}>{wind} kt</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
        <span style={{ color: '#94a3b8' }}>km/h</span>
        <span style={{ color: '#e2e8f0' }}>{Math.round(wind * 1.852)}</span>
      </div>
      <div style={{
        marginTop: 8, padding: '3px 8px', borderRadius: 6, textAlign: 'center',
        fontWeight: 'bold', fontSize: 11,
        background: cat.color + '25', color: cat.color, border: '1px solid ' + cat.color + '44',
      }}>
        {cat.label} &mdash; {cat.name}
      </div>
    </div>
  );
}

// Main component
export default function IntensityChart({ selectedStormId, onStormSelect }) {
  const storm = STORM_TIMELINES[selectedStormId];

  const chartData = storm
    ? storm.points.map(p => ({
        label:    p.h < 0 ? p.h + 'h' : p.h === 0 ? 'Landfall' : '+' + p.h + 'h',
        observed: p.h <= 0 ? p.w : null,
        forecast: p.h >= 0 ? p.w : null,
      }))
    : [];

  const peakWind = storm ? Math.max(...storm.points.map(p => p.w)) : 0;
  const peakCat  = imdCat(peakWind);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 shadow-2xl backdrop-blur-sm overflow-hidden">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Intensity Evolution</div>
            <div className="text-[10px] text-slate-400">Wind (kt) &nbsp; -18h obs &rarr; +24h fcst</div>
          </div>
        </div>
        {storm && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: storm.color }}>{peakWind} kt</div>
            <div style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 'bold',
              background: peakCat.color + '22', color: peakCat.color,
            }}>{peakCat.label}</div>
          </div>
        )}
      </div>

      {/* Storm name pill */}
      {storm && (
        <div style={{
          marginBottom: 10, padding: '5px 10px', borderRadius: 10, display: 'flex',
          alignItems: 'center', gap: 7, flexShrink: 0,
          border: '1px solid ' + storm.color + '55', background: storm.color + '12',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: storm.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: storm.color }}>{storm.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b' }}>
            {storm.category}
          </span>
        </div>
      )}

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="#1e293b" vertical={false} />

            {/* Category background bands */}
            {IMD_CATS.slice(1).map(c => (
              <ReferenceArea key={c.label}
                y1={c.min} y2={Math.min(c.max, 220)}
                fill={c.color} fillOpacity={0.05} ifOverflow="extendDomain" />
            ))}

            {/* Category threshold lines with labels */}
            {IMD_CATS.slice(2).map(c => (
              <ReferenceLine key={'rl' + c.label} y={c.min}
                stroke={c.color} strokeDasharray="3 3" strokeOpacity={0.45}
                label={{ value: c.label, position: 'insideRight', fill: c.color, fontSize: 9 }} />
            ))}

            {/* Landfall vertical line */}
            <ReferenceLine x="Landfall" stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} />

            <XAxis dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis domain={[30, Math.max(220, peakWind + 20)]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false} tickLine={false} width={30} />

            <Tooltip content={<Tip />} />

            {/* Observed track -- solid line */}
            <Line type="monotone" dataKey="observed" name="Observed"
              stroke={storm ? storm.color : '#06b6d4'} strokeWidth={2.5}
              dot={{ r: 3, fill: storm ? storm.color : '#06b6d4', stroke: '#1e293b', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: storm ? storm.color : '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false} />

            {/* Forecast track -- dashed line */}
            <Line type="monotone" dataKey="forecast" name="Forecast"
              stroke={storm ? storm.color : '#06b6d4'} strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: storm ? storm.color : '#06b6d4', stroke: '#1e293b', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: storm ? storm.color : '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexShrink: 0 }}
        className="text-[10px] text-slate-400">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 18, height: 2,
            background: storm ? storm.color : '#06b6d4', borderRadius: 1 }} />
          Observed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 18, height: 2,
            borderTop: '2px dashed ' + (storm ? storm.color : '#06b6d4') }} />
          Forecast
        </div>
      </div>

      {/* Storm switcher */}
      <div style={{ flexShrink: 0, marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
        <div className="text-[10px] text-slate-500 mb-1.5">Switch storm</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {Object.entries(STORM_TIMELINES).map(([id, s]) => {
            const active = selectedStormId === id;
            return (
              <button key={id} onClick={() => onStormSelect && onStormSelect(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  borderColor: active ? s.color : '#334155',
                  background:  active ? s.color + '20' : 'transparent',
                  color:       active ? s.color : '#94a3b8',
                  transition:  'all 0.15s',
                  overflow: 'hidden',
                }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%',
                  background: s.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* IMD category mini-table */}
      <div style={{ flexShrink: 0, marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {IMD_CATS.slice(1).map(c => {
          const active = peakWind >= c.min && peakWind <= c.max;
          return (
            <div key={c.label} style={{
              borderRadius: 6, padding: '4px 2px', textAlign: 'center',
              border: '1px solid ' + (active ? c.color : c.color + '33'),
              background: active ? c.color + '25' : c.color + '08',
              transform: active ? 'scale(1.06)' : 'none',
              transition: 'transform 0.2s',
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: c.color }}>{c.label}</div>
              <div style={{ fontSize: 8, color: '#64748b' }}>{c.min}-{c.max === 220 ? '220+' : c.max}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
