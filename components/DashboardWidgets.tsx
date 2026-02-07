
import React, { useState, useEffect, useRef } from 'react';
import { SystemStats, IntelligenceEntry, Task } from '../types';
import { sounds } from '../services/soundService';

interface DashboardWidgetsProps {
  layout?: 'sidebar' | 'horizontal';
  tasks?: Task[];
  onToggleTask?: (id: string) => void;
  onClearTasks?: () => void;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ 
  layout = 'sidebar', 
  tasks = [], 
  onToggleTask,
  onClearTasks
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
  const [isSentryActive, setIsSentryActive] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authProgress, setAuthProgress] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const authTimerRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const tacticalMessages = [
    "NEURAL_LINK_STABLE",
    "ORBITAL_SYNC_VERIFIED",
    "SECTOR_4_SCAN_COMPLETE",
    "ENCRYPTION_KEY_ROTATED",
    "DEEP_SPACE_PULSE_DETECTED",
    "FIREWALL_INTEGRITY_100",
    "CORE_TEMP_OPTIMAL",
    "THREAT_ASSESSMENT_IDLE",
    "BIOMETRIC_HANDSHAKE_OK",
    "CLOUD_ARRAY_REDUNDANT",
    "PACKET_INTERCEPT_ACTIVE",
    "QUANTUM_ENCRYPTION_SYNC"
  ];

  useEffect(() => {
    if (isSentryActive && !cameraStream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          setCameraStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.warn("Camera access denied for Sentry protocol", err);
          sounds.playError();
        });
    } else if (!isSentryActive && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    return () => {
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    };
  }, [isSentryActive]);

  useEffect(() => {
    const generateEntry = () => {
      const entry: IntelligenceEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        node: `NODE_${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
        message: tacticalMessages[Math.floor(Math.random() * tacticalMessages.length)],
        status: Math.random() > 0.85 ? 'WARN' : 'OK'
      };
      setFeed(prev => [entry, ...prev].slice(0, 10));
    };

    const interval = setInterval(generateEntry, 3500);
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
        threatLevel: isSentryActive ? 'ALPHA' : (Math.random() > 0.98 ? 'BETA' : 'NULL')
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isSentryActive]);

  const startAuth = () => {
    if (isSentryActive) {
      setIsSentryActive(false);
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
        setIsSentryActive(true);
        setIsAuthorizing(false);
        sounds.playPowerUp();
        if (authTimerRef.current) clearInterval(authTimerRef.current);
      } else {
        setAuthProgress(current);
      }
    }, 30);
  };

  const stopAuth = () => {
    if (!isSentryActive) {
      setIsAuthorizing(false);
      setAuthProgress(0);
      if (authTimerRef.current) clearInterval(authTimerRef.current);
    }
  };

  return (
    <div className={`space-y-6 md:space-y-8 ${layout === 'sidebar' ? 'w-full pb-20' : 'grid grid-cols-1 md:grid-cols-2 gap-8'}`}>
      
      {/* Vitals Hub */}
      <div className="glass p-6 rounded-2xl relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.4em] uppercase font-bold flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            SYSTEM_VITALS
          </h3>
          <span className="text-[7px] font-orbitron text-amber-500/30 tracking-widest uppercase">CORE_STARK_45</span>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-8">
          <CircularMetric label="Reactor" value={stats.arcReactorEnergy} color="text-amber-500" />
          <CircularMetric label="Synapse" value={stats.neuralSync} color="text-orange-400" />
        </div>
        <div className="space-y-4">
          <LinearMetric label="THERMAL_LOAD" value={`${stats.coreTemp.toFixed(1)}°C`} progress={stats.coreTemp * 2.5} color="from-amber-600 to-amber-400" />
          <LinearMetric label="NEURAL_TRAFFIC" value={`${stats.packetRate} p/s`} progress={(stats.packetRate - 1300) / 4} color="from-orange-600 to-amber-300" />
        </div>
      </div>

      {/* Task Log Widget */}
      <div className="glass p-6 rounded-2xl border border-amber-500/10 bg-black/50 relative overflow-hidden">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-amber-500 text-[10px] font-orbitron tracking-[0.4em] uppercase font-bold flex items-center gap-3">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            TASK_PROTOCOL
          </h3>
          <button onClick={() => { onClearTasks?.(); sounds.playUiTick(); }} className="text-[7px] font-orbitron text-amber-900 hover:text-amber-500 transition-colors uppercase tracking-widest">PURGE_COMPLETE</button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
               <span className="text-[8px] font-orbitron tracking-[0.4em] text-amber-500 animate-pulse">NEURAL_BUFFER_EMPTY</span>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id} 
                onClick={() => { onToggleTask?.(task.id); sounds.playUiTick(); }}
                className={`group flex items-start gap-4 p-3 rounded-xl border transition-all cursor-pointer ${task.completed ? 'bg-amber-500/5 border-amber-500/10 opacity-40' : 'bg-white/5 border-white/5 hover:border-amber-500/30'}`}
              >
                <div className={`mt-1 w-3 h-3 rounded-full border flex items-center justify-center transition-all ${task.completed ? 'bg-amber-500 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]' : 'border-amber-500/40 group-hover:border-amber-500'}`}>
                  {task.completed && <svg className="w-2 h-2 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div className="flex-1">
                   <p className={`text-[11px] font-mono tracking-wider transition-all ${task.completed ? 'line-through text-amber-500/40' : 'text-amber-100'}`}>
                     {task.text}
                   </p>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-[6px] font-orbitron text-amber-800 uppercase tracking-widest">{task.priority}_PRIORITY</span>
                      <span className="text-[6px] font-mono text-amber-900">{new Date(task.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Intelligence Feed */}
      <div className="glass p-6 rounded-2xl border border-amber-500/10 bg-black/50 relative overflow-hidden h-64">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-orbitron tracking-[0.4em] text-amber-500/60 uppercase font-bold">TACTICAL_FEED</h3>
          <div className="flex gap-1">
             {[...Array(4)].map((_, i) => <div key={i} className="w-1 h-1 bg-amber-500/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}></div>)}
          </div>
        </div>
        <div ref={feedRef} className="space-y-3 h-40 overflow-y-hidden">
          {feed.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 animate-fade-in border-l-2 border-amber-500/10 pl-4 py-1">
              <div className="flex justify-between items-center text-[7px] font-mono">
                <span className="text-amber-500/30">[{entry.timestamp}]</span>
                <span className={`px-1.5 py-0.5 rounded-sm tracking-tighter ${entry.status === 'OK' ? 'bg-amber-500/5 text-amber-500/40' : 'bg-orange-500/20 text-orange-400'}`}>
                  {entry.status}
                </span>
              </div>
              <div className="text-[9px] font-mono tracking-widest">
                <span className="text-amber-900 font-bold mr-2">{entry.node}</span>
                <span className="text-amber-100/60">{entry.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentry HUD / Visualizer */}
      <div className={`glass p-6 rounded-2xl transition-all duration-1000 overflow-hidden relative ${isSentryActive ? 'border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.1)]' : 'border-white/5'}`}>
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className={`text-[11px] font-orbitron tracking-[0.4em] uppercase transition-all duration-500 ${isSentryActive ? 'text-amber-400 font-black tracking-[0.6em]' : 'text-amber-900'}`}>
              {isSentryActive ? 'PROTOCOL_SENTRY_ON' : 'SENTRY_STANDBY'}
            </h3>
            <div className="flex items-center gap-2">
               <span className="text-[8px] font-mono text-amber-600/40 tracking-widest uppercase">SEC_LVL: {isSentryActive ? 'OMEGA' : 'BETA'}</span>
               <span className={`w-1 h-1 rounded-full ${isSentryActive ? 'bg-orange-500 animate-ping' : 'bg-amber-950'}`}></span>
            </div>
          </div>
          <button
            onMouseDown={startAuth}
            onMouseUp={stopAuth}
            onMouseLeave={stopAuth}
            onTouchStart={(e) => { e.preventDefault(); startAuth(); }}
            onTouchEnd={stopAuth}
            className={`relative w-16 h-16 rounded-2xl border transition-all duration-500 transform active:scale-95 overflow-hidden ${isSentryActive ? 'bg-amber-950/20 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.4)]' : 'bg-black/60 border-white/10 hover:border-amber-500/40'}`}
          >
            {isAuthorizing && (
                <div className="absolute bottom-0 left-0 w-full bg-amber-400/40 transition-all duration-100" style={{ height: `${authProgress}%` }}></div>
            )}
            <div className={`relative z-10 transition-all duration-500 ${isAuthorizing ? 'text-amber-200 scale-110' : isSentryActive ? 'text-amber-400' : 'text-amber-900'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.52 3.868 10.133 9 11.24 5.132-1.107 9-5.72 9-11.24 0-1.306-.208-2.564-.598-3.744A11.959 11.959 0 0112 2.714z" />
              </svg>
            </div>
          </button>
        </div>
        <div className="relative aspect-video w-full bg-[#050301] rounded-2xl border border-amber-900/30 overflow-hidden flex items-center justify-center">
          {cameraStream && isSentryActive ? (
            <div className="relative w-full h-full grayscale sepia brightness-150 contrast-125">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,black_100%)]"></div>
              <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                 <div className="flex justify-between">
                    <div className="w-8 h-8 border-l-2 border-t-2 border-amber-400/40"></div>
                    <div className="w-8 h-8 border-r-2 border-t-2 border-amber-400/40"></div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border border-amber-400/20 rounded-full animate-ping-slow"></div>
                    <div className="w-4 h-4 border border-amber-400/60 rounded-full"></div>
                 </div>
                 <div className="flex justify-between">
                    <div className="w-8 h-8 border-l-2 border-b-2 border-amber-400/40"></div>
                    <div className="w-8 h-8 border-r-2 border-b-2 border-amber-400/40"></div>
                 </div>
              </div>
            </div>
          ) : (
            <>
              <div className={`absolute w-full h-full animate-sweep origin-center pointer-events-none ${isSentryActive ? 'bg-gradient-to-r from-transparent via-amber-500/10 to-amber-500/30' : 'opacity-10'}`}>
                 <div className="absolute right-0 top-1/2 w-full h-[1px] bg-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.5)]"></div>
              </div>
              <div className="relative z-10 text-center space-y-3">
                <span className={`text-[9px] font-orbitron tracking-[0.6em] transition-all duration-700 block ${isSentryActive ? 'text-amber-400 animate-pulse font-black' : 'text-amber-950'}`}>
                  {isSentryActive ? 'SENTRY_EYE_INITIATED' : 'OPTICAL_RADAR_OFF'}
                </span>
                {!isSentryActive && <div className="text-[6px] font-mono text-amber-900 tracking-widest uppercase opacity-40">Require_Auth_Signature</div>}
              </div>
            </>
          )}
          <div className="absolute inset-0 scanline opacity-30 pointer-events-none"></div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.1); border-radius: 10px; }
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-sweep { animation: sweep 6s linear infinite; }
        @keyframes ping-slow { 0% { transform: scale(0.8); opacity: 0; } 50% { opacity: 0.3; } 100% { transform: scale(1.5); opacity: 0; } }
        .animate-ping-slow { animation: ping-slow 3s ease-out infinite; }
        @keyframes fade-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

const CircularMetric: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col items-center gap-3 group">
    <div className="relative w-24 h-24 flex items-center justify-center" onClick={() => sounds.playUiTick()}>
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="0.5" fill="transparent" className="text-amber-950" strokeDasharray="3 5" />
        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="4" fill="transparent" 
          strokeDasharray={251} 
          strokeDashoffset={251 - (251 * value) / 100}
          className={`${color} transition-all duration-1000 group-hover:brightness-125`} 
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-orbitron font-black text-amber-500">{value.toFixed(1)}%</span>
        <span className="text-[6px] font-orbitron text-amber-800 tracking-[0.3em] uppercase">{label}</span>
      </div>
    </div>
  </div>
);

const LinearMetric: React.FC<{ label: string, value: string, progress: number, color: string }> = ({ label, value, progress, color }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[8px] font-orbitron uppercase tracking-[0.4em]">
      <span className="text-amber-900">{label}</span>
      <span className="text-amber-400 font-bold tracking-normal">{value}</span>
    </div>
    <div className="h-1 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
      <div 
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1500 shadow-[0_0_15px_rgba(245,158,11,0.3)]`} 
        style={{ width: `${Math.min(100, progress)}%` }}
      ></div>
    </div>
  </div>
);
