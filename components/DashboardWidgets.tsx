
import React, { useState, useEffect, useRef } from 'react';
import { SystemStats, IntelligenceEntry, Task, MemoryEntry } from '../types';
import { sounds } from '../services/soundService';

interface DashboardWidgetsProps {
  layout?: 'sidebar' | 'horizontal';
  tasks?: Task[];
  memories?: MemoryEntry[];
  userLocation?: { latitude: number, longitude: number } | null;
  onToggleTask?: (id: string) => void;
  onClearTasks?: () => void;
  onExportMemory?: () => void;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ 
  layout = 'sidebar', 
  tasks = [], 
  memories = [],
  userLocation = null,
  onToggleTask,
  onClearTasks,
  onExportMemory
}) => {
  const [stats, setStats] = useState<SystemStats>({
    cpuUsage: 12,
    memoryUsage: 4.2,
    uptime: '14:22:05',
    networkLatency: 18,
    arcReactorEnergy: 98.4,
    neuralSync: 88.0,
    coreTemp: 34,
    threatLevel: 'NULL',
    activeNodes: 124,
    packetRate: 1420
  });

  const [feed, setFeed] = useState<IntelligenceEntry[]>([]);
  const [isDefenceActive, setIsDefenceActive] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authProgress, setAuthProgress] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const authTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const tacticalMessages = [
    "NEURAL_LINK_STABLE",
    "ORBITAL_SYNC_VERIFIED",
    "BUFFER_OPTIMIZED",
    "KEY_ROTATED",
    "SYNC_COMPLETE",
    "THREAT_MINIMAL",
    "HANDSHAKE_OK",
    "VAULT_SECURE"
  ];

  useEffect(() => {
    if (isDefenceActive && !cameraStream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          setCameraStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.warn("Defence Auth: Camera access denied", err);
          sounds.playError();
        });
    } else if (!isDefenceActive && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    };
  }, [isDefenceActive]);

  useEffect(() => {
    const generateEntry = () => {
      const entry: IntelligenceEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        node: `NODE_${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
        message: tacticalMessages[Math.floor(Math.random() * tacticalMessages.length)],
        status: Math.random() > 0.95 ? 'WARN' : 'OK'
      };
      setFeed(prev => [entry, ...prev].slice(0, 8));
    };

    const interval = setInterval(generateEntry, 4000);
    generateEntry();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        cpuUsage: Math.floor(Math.random() * 8) + 4,
        networkLatency: Math.floor(Math.random() * 12) + 6,
        arcReactorEnergy: 98.2 + (Math.random() * 1.2),
        neuralSync: 90 + (Math.random() * 6),
        coreTemp: 32 + (Math.random() * 3),
        packetRate: 1350 + Math.floor(Math.random() * 300),
        threatLevel: isDefenceActive ? 'ALPHA' : (Math.random() > 0.99 ? 'BETA' : 'NULL')
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isDefenceActive]);

  const startAuth = () => {
    if (isDefenceActive) {
      setIsDefenceActive(false);
      sounds.playUiTick();
      return;
    }
    setIsAuthorizing(true);
    sounds.playScanHum(1.0);
    let current = 0;
    authTimerRef.current = window.setInterval(() => {
      current += 4;
      if (current >= 100) {
        setAuthProgress(100);
        setIsDefenceActive(true);
        setIsAuthorizing(false);
        sounds.playPowerUp();
        if (authTimerRef.current) clearInterval(authTimerRef.current);
      } else {
        setAuthProgress(current);
      }
    }, 30);
  };

  const stopAuth = () => {
    if (!isDefenceActive) {
      setIsAuthorizing(false);
      setAuthProgress(0);
      if (authTimerRef.current) clearInterval(authTimerRef.current);
    }
  };

  return (
    <div className={`space-y-6 md:space-y-8 ${layout === 'sidebar' ? 'w-full pb-20' : 'grid grid-cols-1 md:grid-cols-2 gap-8'}`}>
      
      {/* System Vitals */}
      <div className="glass p-5 rounded-2xl relative overflow-hidden group shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.2em] uppercase font-bold flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>
            SYSTEM_VITALS
          </h3>
          <button onClick={onExportMemory} className="text-[7px] font-orbitron text-amber-500/30 hover:text-amber-500 transition-colors uppercase">DUMP</button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <CircularMetric label="Reactor" value={stats.arcReactorEnergy} color="text-amber-500" />
          <CircularMetric label="Synapse" value={stats.neuralSync} color="text-orange-400" />
        </div>
        <div className="space-y-3">
          <LinearMetric label="THERMAL" value={`${stats.coreTemp.toFixed(1)}°C`} progress={stats.coreTemp * 2.5} color="from-amber-600 to-amber-400" />
          <LinearMetric label="DB_SYNC" value={`100%`} progress={100} color="from-green-600 to-amber-300" />
        </div>
      </div>

      {/* Neural Vault */}
      <div className="glass p-5 rounded-2xl border border-amber-500/10 bg-black/50 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.2em] uppercase font-bold flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            NEURAL_VAULT
          </h3>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {memories.length === 0 ? (
            <div className="text-center py-6 opacity-10 font-orbitron text-[7px] tracking-widest">EMPTY</div>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="p-2 bg-amber-500/5 border border-amber-500/5 rounded-lg animate-fade-in">
                 <p className="text-[8px] font-mono text-amber-200/70 leading-relaxed uppercase tracking-tight">{m.fact}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Protocol */}
      <div className="glass p-5 rounded-2xl border border-amber-500/10 bg-black/50 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.2em] uppercase font-bold flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            TASK_PROTOCOL
          </h3>
          <button onClick={onClearTasks} className="text-[7px] font-orbitron text-amber-900 hover:text-amber-500 uppercase">PURGE</button>
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
          {tasks.map((task) => (
            <div key={task.id} onClick={() => onToggleTask?.(task.id)} className={`flex items-start gap-3 p-2 rounded-lg border transition-all cursor-pointer ${task.completed ? 'bg-amber-500/5 border-amber-500/10 opacity-30' : 'bg-white/5 border-white/5 hover:border-amber-500/30'}`}>
              <div className={`mt-0.5 w-2.5 h-2.5 rounded-full border ${task.completed ? 'bg-amber-500 border-amber-500' : 'border-amber-500/40'}`}></div>
              <p className={`text-[10px] font-mono tracking-tight ${task.completed ? 'line-through text-amber-500/40' : 'text-amber-100'}`}>{task.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Defence Protocol */}
      <div className={`glass p-5 rounded-2xl transition-all duration-500 relative ${isDefenceActive ? 'border-amber-400 shadow-2xl' : 'border-white/5'}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-0.5">
            <h3 className={`text-[10px] font-orbitron tracking-[0.2em] uppercase transition-all flex items-center gap-2 ${isDefenceActive ? 'text-amber-400 font-bold' : 'text-amber-900'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              {isDefenceActive ? 'DEFENCE_ACTIVE' : 'DEFENCE_IDLE'}
            </h3>
            <span className="text-[7px] font-mono text-amber-600/30 uppercase">SEC_LVL: {isDefenceActive ? 'OMEGA' : 'STARK_CORE'}</span>
          </div>
          <button onMouseDown={startAuth} onMouseUp={stopAuth} onMouseLeave={stopAuth} onTouchStart={(e) => { e.preventDefault(); startAuth(); }} onTouchEnd={stopAuth} className={`relative w-12 h-12 rounded-xl border transition-all overflow-hidden flex items-center justify-center ${isDefenceActive ? 'bg-amber-950/20 border-amber-400 shadow-xl' : 'bg-black/60 border-white/10'}`}>
            {isAuthorizing && <div className="absolute bottom-0 left-0 w-full bg-amber-400/30" style={{ height: `${authProgress}%` }}></div>}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={`w-7 h-7 ${isDefenceActive ? 'text-amber-400' : 'text-amber-900'}`}><path d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.52 3.868 10.133 9 11.24 5.132-1.107 9-5.72 9-11.24 0-1.306-.208-2.564-.598-3.744A11.959 11.959 0 0112 2.714z" /></svg>
          </button>
        </div>
        <div className="relative aspect-video w-full bg-[#050301] rounded-xl border border-amber-900/30 overflow-hidden flex items-center justify-center">
          {cameraStream && isDefenceActive ? (
            <div className="relative w-full h-full grayscale sepia brightness-110">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,black_100%)]"></div>
            </div>
          ) : (
            <div className={`absolute w-full h-full animate-sweep origin-center pointer-events-none ${isDefenceActive ? 'bg-gradient-to-r from-transparent via-amber-500/5 to-amber-500/20' : 'opacity-5'}`}><div className="absolute right-0 top-1/2 w-full h-[1px] bg-amber-400/40"></div></div>
          )}
          <span className={`text-[8px] font-orbitron tracking-widest ${isDefenceActive ? 'text-amber-400 animate-pulse' : 'text-amber-950'}`}>{isDefenceActive ? 'RADAR_ACTIVE' : 'SIG_REQ'}</span>
        </div>
      </div>

      {/* Environmental Intel (New Widget) */}
      <div className="glass p-5 rounded-2xl border border-amber-500/10 bg-black/50 relative overflow-hidden transition-all hover:border-amber-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.2em] uppercase font-bold flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.065M15 3.102V5a2 2 0 01-2 2h-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ENVIRONMENT_SCAN
          </h3>
          <div className="flex items-center gap-1.5">
             <span className={`w-1 h-1 rounded-full ${userLocation ? 'bg-green-500' : 'bg-amber-900'} animate-pulse`}></span>
             <span className="text-[6px] font-orbitron text-amber-500/40 tracking-widest uppercase">{userLocation ? 'LINKED' : 'SEARCHING'}</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[6px] font-orbitron text-amber-800 uppercase tracking-widest block mb-1">COORDINATES</span>
                <p className="text-[9px] font-mono text-amber-400/90 tracking-tighter">
                  {userLocation ? `${userLocation.latitude.toFixed(4)}N / ${userLocation.longitude.toFixed(4)}E` : 'LOCATING_GPS...'}
                </p>
             </div>
             <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[6px] font-orbitron text-amber-800 uppercase tracking-widest block mb-1">ALTITUDE</span>
                <p className="text-[9px] font-mono text-amber-400/90 tracking-tighter">124M MSL</p>
             </div>
          </div>

          <div className="space-y-3">
             <LinearMetric label="TRAFFIC_DENSITY" value="MODERATE" progress={45} color="from-amber-600/40 to-amber-500" />
             <LinearMetric label="ATMOS_PRESSURE" value="1013 HPA" progress={72} color="from-orange-600/40 to-orange-400" />
          </div>

          <div className="pt-2 border-t border-amber-500/5">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[7px] font-orbitron text-amber-200 uppercase tracking-widest">WEATHER_SUMMARY</span>
                      <span className="text-[9px] font-mono text-amber-500">OPTIMAL</span>
                   </div>
                   <p className="text-[8px] font-mono text-amber-600/60 uppercase leading-none">Scattered Cloud Cover • 24°C</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.05); }
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-sweep { animation: sweep 8s linear infinite; }
      `}</style>
    </div>
  );
};

const CircularMetric: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="0.5" fill="transparent" className="text-amber-950" strokeDasharray="2 4" />
        <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={213} strokeDashoffset={213 - (213 * value) / 100} className={`${color} transition-all duration-1000`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-orbitron font-black text-amber-500">{value.toFixed(0)}%</span>
        <span className="text-[5px] font-orbitron text-amber-800 tracking-widest uppercase">{label}</span>
      </div>
    </div>
  </div>
);

const LinearMetric: React.FC<{ label: string, value: string, progress: number, color: string }> = ({ label, value, progress, color }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[7px] font-orbitron uppercase tracking-widest">
      <span className="text-amber-900">{label}</span>
      <span className="text-amber-400">{value}</span>
    </div>
    <div className="h-0.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
      <div className={`h-full bg-gradient-to-r ${color} transition-all duration-1000`} style={{ width: `${Math.min(100, progress)}%` }}></div>
    </div>
  </div>
);
