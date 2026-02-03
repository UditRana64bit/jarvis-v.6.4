
import React, { useState, useEffect, useRef } from 'react';
import { SystemStats } from '../types';

interface DashboardWidgetsProps {
  layout?: 'sidebar' | 'horizontal';
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ layout = 'sidebar' }) => {
  const [stats, setStats] = useState<SystemStats>({
    cpuUsage: 12,
    memoryUsage: 4.2,
    uptime: '14:22:05',
    networkLatency: 18,
    arcReactorEnergy: 98.4,
    neuralSync: 88.0,
    coreTemp: 34,
    threatLevel: 'NULL'
  });

  const [isSentryActive, setIsSentryActive] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authProgress, setAuthProgress] = useState(0);
  const [defenceTele, setDefenceTele] = useState({
    interceptProb: 99.9,
    activeSentries: 4,
    sectorClearance: 100
  });

  const authTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpuUsage: Math.floor(Math.random() * 10) + 5,
        networkLatency: Math.floor(Math.random() * 12) + 8,
        arcReactorEnergy: 98.5 + (Math.random() * 1.2),
        neuralSync: 89 + (Math.random() * 6),
        coreTemp: 32 + (Math.random() * 3),
      }));

      setDefenceTele({
        interceptProb: isSentryActive ? 97 + (Math.random() * 2) : 99.9,
        activeSentries: isSentryActive ? 16 : 4,
        sectorClearance: isSentryActive ? 92 + (Math.random() * 8) : 100
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isSentryActive]);

  const startAuth = () => {
    if (isSentryActive) {
      setIsSentryActive(false);
      return;
    }
    setIsAuthorizing(true);
    let current = 0;
    authTimerRef.current = window.setInterval(() => {
      current += 4;
      if (current >= 100) {
        setAuthProgress(100);
        setIsSentryActive(true);
        setIsAuthorizing(false);
        if (authTimerRef.current) clearInterval(authTimerRef.current);
      } else {
        setAuthProgress(current);
      }
    }, 45);
  };

  const stopAuth = () => {
    if (!isSentryActive) {
      setIsAuthorizing(false);
      setAuthProgress(0);
      if (authTimerRef.current) clearInterval(authTimerRef.current);
    }
  };

  return (
    <div className={`space-y-6 md:space-y-10 ${layout === 'sidebar' ? 'w-full' : 'grid grid-cols-1 md:grid-cols-2 gap-8'}`}>
      {/* Vitals Hub */}
      <div className="glass p-6 md:p-8 rounded-2xl relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.4em] uppercase font-bold flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            SY_VITALS_MK_II
          </h3>
          <span className="text-[7px] font-orbitron text-amber-500/30 tracking-widest uppercase">ENCRYPT_V4</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 md:gap-8 mb-10">
          <CircularMetric label="Reactor" value={stats.arcReactorEnergy} color="text-amber-500" />
          <CircularMetric label="Synapse" value={stats.neuralSync} color="text-orange-400" />
        </div>

        <div className="space-y-6">
          <LinearMetric label="CORE_THERMAL" value={`${stats.coreTemp.toFixed(1)}°C`} progress={stats.coreTemp * 2.5} color="from-amber-600 to-amber-400" />
          <LinearMetric label="AI_LOAD" value={`${stats.cpuUsage}%`} progress={stats.cpuUsage} color="from-orange-600 to-amber-300" />
        </div>
      </div>

      {/* Defense HUD */}
      <div className={`glass p-6 md:p-8 rounded-2xl transition-all duration-1000 overflow-hidden relative ${isSentryActive ? 'border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.1)]' : 'border-white/5'}`}>
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-2">
            <h3 className={`text-[11px] font-orbitron tracking-[0.4em] uppercase transition-colors ${isSentryActive ? 'text-amber-400 font-black' : 'text-amber-500/40'}`}>
              {isSentryActive ? 'DEFENSE_ENABLED' : 'DEFENSE_PASSIVE'}
            </h3>
            <span className="text-[8px] font-mono text-amber-600/30 block tracking-widest">GRID_MAP_STK_45</span>
          </div>
          
          <button
            onMouseDown={startAuth}
            onMouseUp={stopAuth}
            onMouseLeave={stopAuth}
            onTouchStart={(e) => { e.preventDefault(); startAuth(); }}
            onTouchEnd={stopAuth}
            className={`relative w-16 h-16 rounded-xl border flex items-center justify-center transition-all duration-500 transform active:scale-90 overflow-hidden ${isSentryActive ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)]' : 'bg-black/80 border-white/10 hover:border-amber-500/30'}`}
          >
            {isAuthorizing && (
                <div className="absolute bottom-0 left-0 w-full bg-amber-400/30 shadow-[0_-10px_20px_rgba(245,158,11,0.4)] transition-all duration-75" style={{ height: `${authProgress}%` }}></div>
            )}
            <div className={`relative z-10 transition-colors ${isAuthorizing ? 'text-amber-200' : isSentryActive ? 'text-amber-400' : 'text-amber-900'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-9 h-9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.52 3.868 10.133 9 11.24 5.132-1.107 9-5.72 9-11.24 0-1.306-.208-2.564-.598-3.744A11.959 11.959 0 0112 2.714z" />
              </svg>
            </div>
            {isAuthorizing && (
                <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-300 animate-v-scan shadow-[0_0_15px_amber] opacity-80"></div>
            )}
          </button>
        </div>

        {/* Radar Component */}
        <div className="relative aspect-square w-full bg-[#050301] rounded-xl border border-amber-900/20 overflow-hidden flex items-center justify-center">
          <div className={`absolute w-full h-full animate-sweep origin-center pointer-events-none ${isSentryActive ? 'bg-gradient-to-r from-transparent via-amber-500/10 to-amber-500/30' : 'opacity-10'}`}>
             <div className="absolute right-0 top-1/2 w-full h-[1px] bg-amber-400 shadow-[0_0_15px_amber] filter blur-[0.5px]"></div>
          </div>
          <div className="absolute inset-0 border-[0.5px] border-amber-900/10 rounded-full scale-75"></div>
          <div className="absolute inset-0 border-[0.5px] border-amber-900/10 rounded-full scale-50"></div>
          <div className="absolute inset-0 border-[0.5px] border-amber-900/10 rounded-full scale-25"></div>
          
          <div className="relative z-10 text-center">
            <span className={`text-[9px] font-orbitron tracking-[0.5em] transition-all ${isSentryActive ? 'text-amber-400 animate-pulse' : 'text-amber-950'}`}>
              {isSentryActive ? 'GRID_LOCKED' : 'GRID_PASSIVE'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-sweep { animation: sweep 8s linear infinite; }
        @keyframes v-scan { 0% { transform: translateY(0); } 100% { transform: translateY(64px); } }
        .animate-v-scan { animation: v-scan 1s linear infinite; }
      `}</style>
    </div>
  );
};

const CircularMetric: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col items-center gap-3">
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="0.5" fill="transparent" className="text-amber-900/10" strokeDasharray="3 4" />
        <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="4" fill="transparent" 
          strokeDasharray={238.7} 
          strokeDashoffset={238.7 - (238.7 * value) / 100}
          className={`${color} transition-all duration-1000 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]`} 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-orbitron font-black text-amber-500">{value.toFixed(1)}%</span>
        <span className="text-[5px] font-orbitron text-amber-500/40 tracking-[0.2em] uppercase">{label}</span>
      </div>
    </div>
  </div>
);

const LinearMetric: React.FC<{ label: string, value: string, progress: number, color: string }> = ({ label, value, progress, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[8px] font-orbitron uppercase tracking-[0.3em]">
      <span className="text-amber-500/30">{label}</span>
      <span className="text-amber-400 font-black">{value}</span>
    </div>
    <div className="h-[2px] bg-black rounded-full overflow-hidden relative border border-amber-900/10">
      <div 
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1000 shadow-[0_0_12px_rgba(245,158,11,0.4)]`} 
        style={{ width: `${Math.min(100, progress)}%` }}
      ></div>
    </div>
  </div>
);
