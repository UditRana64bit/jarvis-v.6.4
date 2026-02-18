
import React, { useState, useEffect } from 'react';
import { SystemStats } from '../types';

interface DashboardWidgetsProps {
  memories?: any[];
  isDefenceActive?: boolean;
  onToggleDefence?: () => void;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ 
  isDefenceActive = false,
  onToggleDefence
}) => {
  const [stats, setStats] = useState<SystemStats>({
    cpuUsage: 12, memoryUsage: 4.2, uptime: '04:12', networkLatency: 18,
    arcReactorEnergy: 98.4, neuralSync: 88.0, coreTemp: 34,
    threatLevel: 'NULL', activeNodes: 412, packetRate: 1420,
    inferenceSpeed: 88,
    windSpeed: 4.5, humidity: 45, airPressure: 1012
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpuUsage: 8 + Math.floor(Math.random() * 10),
        arcReactorEnergy: 98.2 + Math.random() * 0.4,
        packetRate: 1200 + Math.floor(Math.random() * 400),
        windSpeed: 3 + Math.random() * 5,
        humidity: 40 + Math.random() * 10,
        airPressure: 1010 + Math.random() * 5
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3 lg:space-y-6">
      {/* Defence HUD Module */}
      <div className={`hud-glass p-3 lg:p-5 rounded-xl border transition-all duration-700 ${isDefenceActive ? 'border-red-500 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-amber-500/10'}`}>
         <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${isDefenceActive ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
               <span className={`text-[7px] lg:text-sm font-orbitron tracking-widest uppercase font-black ${isDefenceActive ? 'text-red-500' : 'accent-text'}`}>
                 {isDefenceActive ? 'SEC_ACTIVE' : 'SEC_NOMINAL'}
               </span>
            </div>
            <button onClick={onToggleDefence} className={`px-2 py-1 lg:px-3 lg:py-1.5 rounded-md text-[6px] lg:text-xs font-orbitron border transition-all ${isDefenceActive ? 'bg-red-500 text-black border-red-400 font-bold' : 'border-white/10 text-white/40 hover:border-amber-500 hover:text-amber-500'}`}>
              {isDefenceActive ? 'ABORT' : 'INIT'}
            </button>
         </div>
         
         <div className="grid grid-cols-2 gap-2 lg:gap-3">
            <div className="p-2 lg:p-3 bg-black/40 rounded-lg border border-white/5">
               <span className="block text-[5px] lg:text-[10px] font-orbitron opacity-30 uppercase tracking-tighter">Threat_Level</span>
               <span className={`text-[8px] lg:text-lg font-mono font-black ${isDefenceActive ? 'text-red-500' : 'text-green-500'}`}>{isDefenceActive ? 'OMEGA' : 'NULL'}</span>
            </div>
            <div className="p-2 lg:p-3 bg-black/40 rounded-lg border border-white/5">
               <span className="block text-[5px] lg:text-[10px] font-orbitron opacity-30 uppercase tracking-tighter">Shield_Sync</span>
               <span className="text-[8px] lg:text-lg font-mono font-black accent-text">98%</span>
            </div>
         </div>
      </div>

      {/* Environmental Scan Module */}
      <div className="hud-glass p-3 lg:p-5 rounded-xl border border-amber-500/5">
         <span className="text-[7px] lg:text-sm font-orbitron accent-text tracking-[0.2em] mb-3 lg:mb-5 block opacity-40 uppercase font-black">Environmental_Scan</span>
         <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-2 lg:p-3 bg-black/20 rounded-lg border border-white/5">
               <span className="text-[5px] lg:text-[9px] font-orbitron opacity-20 uppercase">Wind</span>
               <span className="text-[8px] lg:text-base font-mono accent-text font-bold">{stats.windSpeed.toFixed(0)}m/s</span>
            </div>
            <div className="flex flex-col items-center p-2 lg:p-3 bg-black/20 rounded-lg border border-white/5">
               <span className="text-[5px] lg:text-[9px] font-orbitron opacity-20 uppercase">Hum</span>
               <span className="text-[8px] lg:text-base font-mono accent-text font-bold">{stats.humidity.toFixed(0)}%</span>
            </div>
            <div className="flex flex-col items-center p-2 lg:p-3 bg-black/20 rounded-lg border border-white/5">
               <span className="text-[5px] lg:text-[9px] font-orbitron opacity-20 uppercase">Psi</span>
               <span className="text-[8px] lg:text-base font-mono accent-text font-bold">{stats.airPressure.toFixed(0)}</span>
            </div>
         </div>
      </div>

      {/* Metric Tiles - Normal Size for Desktop */}
      <div className="space-y-3 lg:space-y-4">
         <MetricHUD label="CPU_NEURAL_SYNC" value={stats.cpuUsage} suffix="%" />
         <MetricHUD label="ARC_ENERGY_LVL" value={stats.arcReactorEnergy} suffix="%" />
      </div>
    </div>
  );
};

const MetricHUD: React.FC<{ label: string, value: number, suffix: string }> = ({ label, value, suffix }) => (
  <div className="hud-glass p-3 lg:p-4 rounded-xl flex justify-between items-center group border border-amber-500/5 hover:border-amber-500/20 transition-all duration-300">
    <div className="flex flex-col">
       <span className="text-[6px] lg:text-xs font-orbitron opacity-20 tracking-widest group-hover:opacity-40 transition-opacity uppercase font-bold">{label}</span>
       <span className="text-[10px] lg:text-xl font-mono font-black accent-text">{value.toFixed(1)}{suffix}</span>
    </div>
    <div className="h-6 w-12 lg:h-10 lg:w-20 bg-black/40 rounded-md border border-white/5 flex items-end gap-0.5 lg:gap-1 p-1 overflow-hidden">
       {[...Array(4)].map((_, i) => (
         <div key={i} className="flex-1 bg-amber-500/30 rounded-t-sm" style={{ height: `${20 + Math.random() * 80}%` }}></div>
       ))}
    </div>
  </div>
);
