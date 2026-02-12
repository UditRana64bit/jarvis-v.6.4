
import React, { useState, useEffect, useRef } from 'react';
import { SystemStats, Task, MemoryEntry } from '../types';
import { sounds } from '../services/soundService';

interface DashboardWidgetsProps {
  layout?: 'sidebar' | 'horizontal';
  tasks?: Task[];
  memories?: MemoryEntry[];
  userLocation?: { latitude: number, longitude: number } | null;
  isDefenceActive?: boolean;
  onToggleDefence?: () => void;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ 
  layout = 'sidebar', 
  tasks = [], 
  memories = [],
  userLocation = null,
  isDefenceActive = false,
  onToggleDefence
}) => {
  const [stats, setStats] = useState<SystemStats>({
    cpuUsage: 12,
    memoryUsage: 4.2,
    uptime: '04:12:00',
    networkLatency: 18,
    arcReactorEnergy: 98.4,
    neuralSync: 88.0,
    coreTemp: 34,
    threatLevel: 'NULL',
    activeNodes: 412,
    packetRate: 1420,
    inferenceSpeed: 88
  });

  const [weatherData, setWeatherData] = useState({
    temp: 22,
    condition: 'CLEAR_SKIES',
    humidity: 45,
    pressure: 1012,
    radiation: 0.04,
    windSpeed: 12,
    visibility: 10,
    airQuality: 'OPTIMAL'
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Satellite Simulation
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, 300, 150);
      ctx.strokeStyle = isDefenceActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 191, 36, 0.2)';
      ctx.lineWidth = 0.5;

      // Draw Grid
      for(let i=0; i<300; i+=20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 150); ctx.stroke();
      }
      for(let i=0; i<150; i+=20) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(300, i); ctx.stroke();
      }

      // Draw Orbiting Nodes
      const time = Date.now() * 0.001;
      for(let i=0; i<5; i++) {
        const x = 150 + Math.cos(time + i) * 60;
        const y = 75 + Math.sin(time + i * 1.5) * 40;
        ctx.fillStyle = isDefenceActive ? 'rgba(239, 68, 68, 0.8)' : 'rgba(251, 191, 36, 0.6)';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(150, 75);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [isDefenceActive]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpuUsage: Math.floor(Math.random() * 8) + 4,
        arcReactorEnergy: 98.4 + (Math.random() * 0.4),
        coreTemp: isDefenceActive ? 42 + (Math.random() * 5) : 32 + (Math.random() * 3),
        packetRate: 1200 + Math.floor(Math.random() * 400),
      }));

      // Randomize environmental data slightly
      setWeatherData(prev => ({
        ...prev,
        temp: prev.temp + (Math.random() > 0.5 ? 0.05 : -0.05),
        windSpeed: Math.max(0, prev.windSpeed + (Math.random() > 0.5 ? 0.5 : -0.5)),
        condition: Math.random() > 0.98 ? 'ATMOSPHERIC_TURBULENCE' : 'CLEAR_SKIES',
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [isDefenceActive]);

  return (
    <div className="space-y-6">
      {/* Defence Dashboard */}
      <div className={`glass p-5 rounded-2xl border transition-all duration-500 ${isDefenceActive ? 'border-red-500 bg-red-950/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-[rgba(var(--accent),0.15)]'}`}>
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${isDefenceActive ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
               <span className={`text-[10px] font-orbitron tracking-widest uppercase font-bold ${isDefenceActive ? 'text-red-500' : 'accent-text'}`}>
                 {isDefenceActive ? 'DEFENCE_ENGAGED' : 'DEFENCE_STANDBY'}
               </span>
            </div>
            <button 
              onClick={onToggleDefence}
              className={`px-3 py-1 rounded-lg text-[8px] font-orbitron border transition-all ${isDefenceActive ? 'bg-red-500 text-black border-red-400' : 'border-amber-500/30 text-amber-500/50 hover:border-amber-500'}`}
            >
              {isDefenceActive ? 'ABORT' : 'INIT'}
            </button>
         </div>
         
         <div className="relative w-full h-32 bg-black/40 rounded-xl mb-4 overflow-hidden border border-white/5">
            <canvas ref={canvasRef} width={300} height={150} className="w-full h-full" />
            <div className="absolute top-2 left-2 text-[7px] font-mono opacity-30">ORBITAL_COVERAGE::GLOBAL</div>
            <div className="absolute bottom-2 right-2 text-[7px] font-mono opacity-30">SAT_LINK_0x88AF</div>
         </div>

         <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
               <span className="block text-[7px] font-orbitron opacity-30 uppercase mb-1">Threat_Level</span>
               <span className={`text-xs font-mono font-bold ${isDefenceActive ? 'text-red-500' : 'text-green-500'}`}>
                 {isDefenceActive ? 'OMEGA' : 'NULL'}
               </span>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
               <span className="block text-[7px] font-orbitron opacity-30 uppercase mb-1">Shield_Status</span>
               <span className="text-xs font-mono font-bold accent-text">98.2%</span>
            </div>
         </div>
      </div>

      {/* Environmental Status Node */}
      <div className="glass p-5 rounded-2xl border border-[rgba(var(--accent),0.1)] bg-gradient-to-b from-black/20 to-transparent">
         <h4 className="text-[9px] font-orbitron accent-text tracking-widest uppercase mb-4 font-bold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            ENVIRONMENT_INTEL
         </h4>
         <div className="space-y-4">
            <div className="flex justify-between items-center">
               <div className="flex flex-col">
                  <span className="text-[8px] font-orbitron opacity-30 uppercase">Atmospheric_State</span>
                  <span className="text-xs font-mono accent-text font-bold">{weatherData.condition}</span>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[8px] font-orbitron opacity-30 uppercase">Ext_Temp</span>
                  <span className="text-xs font-mono font-bold">{weatherData.temp.toFixed(1)}°C</span>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5">
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">WIND</span>
                  <span className="text-[10px] font-mono accent-text">{weatherData.windSpeed.toFixed(0)} km/h</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">VIS_RNG</span>
                  <span className="text-[10px] font-mono accent-text">{weatherData.visibility} km</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">AIR_QUAL</span>
                  <span className="text-[10px] font-mono text-green-400">{weatherData.airQuality}</span>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-3 border-b border-white/5">
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">HUMID</span>
                  <span className="text-[10px] font-mono accent-text">{weatherData.humidity}%</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">PRESS</span>
                  <span className="text-[10px] font-mono accent-text">{weatherData.pressure}</span>
               </div>
               <div className="flex flex-col items-center">
                  <span className="text-[7px] font-orbitron opacity-20 uppercase">RAD</span>
                  <span className={`text-[10px] font-mono ${weatherData.radiation > 0.05 ? 'text-red-400' : 'accent-text'}`}>{weatherData.radiation.toFixed(2)}</span>
               </div>
            </div>

            <div className="flex justify-between items-center pt-2">
               <span className="text-[8px] font-orbitron opacity-30 uppercase tracking-widest">Global_Satellite_Linked</span>
               <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                     <div key={i} className={`w-1 h-3 rounded-full ${i < 4 ? (isDefenceActive ? 'bg-red-500' : 'bg-blue-500') : 'bg-white/10'}`}></div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* Mini Performance HUD */}
      <div className="glass p-5 rounded-2xl hud-border">
         <div className="flex items-center justify-between mb-6">
            <span className="text-[9px] font-orbitron accent-text tracking-widest uppercase font-bold">CORE_HANDSHAKE</span>
            <span className="text-[8px] font-mono opacity-30">UPLINK_STABLE</span>
         </div>
         
         <div className="space-y-5">
            <MetricBar label="REACTOR_SYNC" value={stats.arcReactorEnergy} isAlert={isDefenceActive} />
            <MetricBar label="SYNAPSE_LOAD" value={isDefenceActive ? 85 : stats.cpuUsage * 8} isAlert={isDefenceActive} />
            <MetricBar label="NODE_RELIABILITY" value={92.4} />
         </div>
      </div>
    </div>
  );
};

const MetricBar: React.FC<{ label: string, value: number, isAlert?: boolean }> = ({ label, value, isAlert }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[8px] font-orbitron tracking-widest uppercase">
       <span className="opacity-40">{label}</span>
       <span className={`font-bold ${isAlert ? 'text-red-500' : 'accent-text'}`}>{value.toFixed(1)}%</span>
    </div>
    <div className="h-1 bg-black/60 rounded-full overflow-hidden flex gap-1">
       {[...Array(10)].map((_, i) => (
         <div 
           key={i} 
           className={`h-full flex-1 transition-all duration-1000 ${i * 10 < value ? (isAlert ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'accent-bg shadow-[0_0_8px_rgba(var(--accent),0.5)]') : 'bg-white/5'}`}
         ></div>
       ))}
    </div>
  </div>
);
