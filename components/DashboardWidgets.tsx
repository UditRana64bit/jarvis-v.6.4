
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
    <div className="space-y-2 lg:space-y-3">
      {/* Defence HUD Module */}
      <div className={`hud-glass p-2 lg:p-3 rounded-lg border transition-all duration-700 ${isDefenceActive ? 'border-red-500 bg-red-950/20' : 'border-amber-500/5'}`}>
         <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
               <div className={`w-1 h-1 rounded-full ${isDefenceActive ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
               <span className={`text-[6px] lg:text-[7px] font-orbitron tracking-widest uppercase font-bold ${isDefenceActive ? 'text-red-500' : 'accent-text'}`}>
                 {isDefenceActive ? 'SEC_ACTIVE' : 'SEC_NOMINAL'}
               </span>
            </div>
            <button onClick={onToggleDefence} className={`px-1 py-0.5 rounded-[3px] text-[5px] font-orbitron border transition-all ${isDefenceActive ? 'bg-red-500 text-black border-red-400' : 'border-white/10 text-white/40 hover:border-amber-500'}`}>
              {isDefenceActive ? 'ABORT' : 'INIT'}
            </button>
         </div>
         
         <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 bg-black/40 rounded border border-white/5">
               <span className="block text-[4px] font-orbitron opacity-30 uppercase">Threat</span>
               <span className={`text-[7px] font-mono font-bold ${isDefenceActive ? 'text-red-500' : 'text-green-500'}`}>{isDefenceActive ? 'OMEGA' : 'NULL'}</span>
            </div>
            <div className="p-1.5 bg-black/40 rounded border border-white/5">
               <span className="block text-[4px] font-orbitron opacity-30 uppercase">Shield</span>
               <span className="text-[7px] font-mono font-bold accent-text">98%</span>
            </div>
         </div>
      </div>

      {/* Environmental Scan Module */}
      <div className="hud-glass p-2 lg:p-3 rounded-lg border border-amber-500/5">
         <span className="text-[6px] font-orbitron accent-text tracking-[0.1em] mb-2 block opacity-40 uppercase font-bold">Env_Sensors</span>
         <div className="grid grid-cols-3 gap-1">
            <div className="flex flex-col items-center p-1 bg-black/20 rounded border border-white/5">
               <span className="text-[4px] font-orbitron opacity-20 uppercase">Wind</span>
               <span className="text-[7px] font-mono accent-text">{stats.windSpeed.toFixed(0)}m/s</span>
            </div>
            <div className="flex flex-col items-center p-1 bg-black/20 rounded border border-white/5">
               <span className="text-[4px] font-orbitron opacity-20 uppercase">Hum</span>
               <span className="text-[7px] font-mono accent-text">{stats.humidity.toFixed(0)}%</span>
            </div>
            <div className="flex flex-col items-center p-1 bg-black/20 rounded border border-white/5">
               <span className="text-[4px] font-orbitron opacity-20 uppercase">Psi</span>
               <span className="text-[7px] font-mono accent-text">{stats.airPressure.toFixed(0)}</span>
            </div>
         </div>
      </div>

      {/* Metric Tiles - Compact */}
      <div className="space-y-1.5">
         <MetricHUD label="CPU_SYNC" value={stats.cpuUsage} suffix="%" />
         <MetricHUD label="ENERGY_L" value={stats.arcReactorEnergy} suffix="%" />
      </div>
    </div>
  );
};

const MetricHUD: React.FC<{ label: string, value: number, suffix: string }> = ({ label, value, suffix }) => (
  <div className="hud-glass p-2 rounded-lg flex justify-between items-center group border border-amber-500/5 hover:border-amber-500/20">
    <div className="flex flex-col">
       <span className="text-[5px] font-orbitron opacity-20 tracking-widest group-hover:opacity-40 transition-opacity uppercase">{label}</span>
       <span className="text-[8px] font-mono font-bold accent-text">{value.toFixed(1)}{suffix}</span>
    </div>
    <div className="h-4 w-10 bg-black/40 rounded border border-white/5 flex items-end gap-0.5 p-0.5 overflow-hidden">
       {[...Array(4)].map((_, i) => (
         <div key={i} className="flex-1 bg-amber-500/20" style={{ height: `${20 + Math.random() * 80}%` }}></div>
       ))}
    </div>
  </div>
);
