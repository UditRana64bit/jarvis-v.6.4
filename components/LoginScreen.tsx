
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface LoginScreenProps {
  onUnlock: (profile: string) => void;
}

type AuthMode = 'biometric' | 'signature';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('biometric');
  const [progress, setProgress] = useState(0);
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  const [status, setStatus] = useState('PROTOCOLS_LOCKED');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [paths, setPaths] = useState<Array<{x: number, y: number}[]>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<number | null>(null);

  // Clock Update Effect
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Decorative data particles for the biometric scan
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      angle: Math.random() * 360,
      distance: 40 + Math.random() * 40,
      size: 1 + Math.random() * 2,
      speed: 0.5 + Math.random() * 1.5
    }));
  }, []);

  const startBiometricScan = () => {
    setIsAuthInProgress(true);
    setStatus('SYNCING_ARC_CORE...');
    let currentProgress = 0;
    
    timerRef.current = window.setInterval(() => {
      currentProgress += 3;
      if (currentProgress >= 100) {
        setProgress(100);
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('LINK_SECURED: MK_45');
        setTimeout(() => onUnlock('Stark'), 800);
      } else {
        setProgress(currentProgress);
        if (currentProgress > 40 && currentProgress < 45) setStatus('MAPPING_SYNAPTIC_NODES...');
        if (currentProgress > 80 && currentProgress < 85) setStatus('VERIFYING_CLEARANCE...');
      }
    }, 40);
  };

  const stopBiometricScan = () => {
    if (progress < 100) {
      setIsAuthInProgress(false);
      setProgress(0);
      setStatus('RE-INITIALIZE_LINK');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleSignatureStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    setPaths(prev => [...prev, [pos]]);
  };

  const handleSignatureMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setPaths(prev => {
      const lastPath = prev[prev.length - 1];
      return [...prev.slice(0, -1), [...lastPath, pos]];
    });
  };

  const handleSignatureEnd = () => setIsDrawing(false);

  const verifySignature = () => {
    if (paths.length === 0) return setStatus('INPUT_REQUIRED');
    setIsAuthInProgress(true);
    setStatus('ANALYZING_SYNTAX...');
    let current = 0;
    const interval = setInterval(() => {
      current += 4;
      setProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        const profile = paths.length > 4 ? 'Stark' : 'Authorized_User';
        setStatus(`ACCESS_GRANTED: ${profile.toUpperCase()}`);
        setTimeout(() => onUnlock(profile), 1000);
      }
    }, 30);
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] bg-[#050201] flex flex-col items-center justify-center p-6 sm:p-12 select-none overflow-hidden touch-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-grid opacity-20"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08),transparent_70%)]"></div>

      {/* Top Left Status Box */}
      <div className="absolute top-8 left-8 border-l border-t border-amber-500/20 p-4 hidden md:block">
        <div className="text-[9px] font-orbitron text-amber-500/40 tracking-[0.3em] mb-1">SYSTEM_UPTIME</div>
        <div className="text-xs font-mono text-amber-500 tracking-wider">04:12:44:09</div>
      </div>

      {/* Top Right Tactical Clock */}
      <div className="absolute top-8 right-8 text-right border-r border-t border-amber-500/20 p-4">
        <div className="text-[10px] font-orbitron text-amber-500/40 tracking-[0.4em] mb-1 uppercase">Tactical_Chronograph</div>
        <div className="text-4xl font-orbitron font-black text-amber-500 tracking-widest drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
          {formattedTime}
        </div>
        <div className="text-[9px] font-mono text-amber-600 tracking-[0.2em] mt-1">{formattedDate}</div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-xl">
        {/* Logo Hub */}
        <div className="text-center space-y-3">
          <h1 className="font-orbitron text-5xl sm:text-7xl font-black tracking-[0.6em] text-amber-500 hologram-flicker">JARVIS</h1>
          <div className="flex items-center justify-center gap-4">
            <span className="h-[1px] w-12 bg-amber-500/20"></span>
            <p className="font-orbitron text-[9px] tracking-[0.5em] text-amber-700 uppercase font-black">{status}</p>
            <span className="h-[1px] w-12 bg-amber-500/20"></span>
          </div>
        </div>

        {/* Mode Switcher - Thumb Friendly */}
        <div className="flex bg-black/60 border border-amber-500/10 p-1.5 rounded-xl backdrop-blur-2xl shadow-2xl">
          <button 
            onClick={() => { setAuthMode('biometric'); setProgress(0); setStatus('PROTOCOLS_LOCKED'); }}
            className={`px-8 sm:px-12 py-3.5 rounded-lg font-orbitron text-[10px] tracking-widest transition-all ${authMode === 'biometric' ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'text-amber-800 hover:text-amber-500'}`}
          >
            BIO_AUTH
          </button>
          <button 
            onClick={() => { setAuthMode('signature'); setProgress(0); setStatus('SIG_INPUT'); }}
            className={`px-8 sm:px-12 py-3.5 rounded-lg font-orbitron text-[10px] tracking-widest transition-all ${authMode === 'signature' ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'text-amber-800 hover:text-amber-500'}`}
          >
            SIG_AUTH
          </button>
        </div>

        {authMode === 'biometric' ? (
          <div className="relative group p-10">
            {/* Multi-layered Rotating HUD Elements */}
            <div className={`absolute inset-0 rounded-full border-2 border-dashed border-amber-500/5 transition-transform duration-[60s] linear infinite ${isAuthInProgress ? 'animate-spin opacity-100' : 'opacity-40'}`}></div>
            <div className={`absolute -inset-4 rounded-full border border-amber-500/10 transition-transform duration-[45s] linear infinite ${isAuthInProgress ? 'animate-reverse-spin scale-110' : 'opacity-20'}`}></div>
            <div className={`absolute -inset-8 rounded-full border border-dotted border-amber-600/10 transition-transform duration-[90s] linear infinite ${isAuthInProgress ? 'animate-spin scale-105' : 'opacity-10'}`}></div>
            
            {/* Pulsing Energy Field */}
            <div className={`absolute inset-0 rounded-full bg-amber-500/5 blur-3xl transition-opacity duration-500 ${isAuthInProgress ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>

            <button
              onMouseDown={startBiometricScan}
              onMouseUp={stopBiometricScan}
              onMouseLeave={stopBiometricScan}
              onTouchStart={(e) => { e.preventDefault(); startBiometricScan(); }}
              onTouchEnd={stopBiometricScan}
              className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full flex items-center justify-center transition-all duration-700 border-2 bg-black/90 backdrop-blur-3xl overflow-hidden group/btn ${isAuthInProgress ? 'border-amber-400 shadow-[0_0_120px_rgba(245,158,11,0.4)] scale-[0.98]' : 'border-white/5 hover:border-amber-500/20 shadow-2xl'}`}
            >
              {/* Charge Up Fill */}
              <div className="absolute inset-0 bg-gradient-to-t from-amber-600/50 via-amber-400/20 to-transparent transition-all duration-500" style={{ transform: `translateY(${100 - progress}%)` }}></div>
              
              {/* Iconography & Internal Animations */}
              <div className={`relative z-10 flex flex-col items-center gap-4 transition-all duration-500 ${isAuthInProgress ? 'scale-110' : 'opacity-40'}`}>
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={`w-24 h-24 text-amber-500 transition-all duration-300 ${isAuthInProgress ? 'drop-shadow-[0_0_15px_rgba(245,158,11,1)]' : ''}`}>
                    <path d="M12 11c0 3.517-2.103 6.542-5.11 7.794m10.22 0A9.001 9.001 0 0017 11V5.5M7 5.5a9 9 0 0113.844-7.5M10.5 5.5v5.5m0-11V2M3.5 17.5v-1.5M20.5 17.5v-1.5" />
                  </svg>
                  
                  {/* Rotating Inner Ring */}
                  <div className={`absolute -inset-6 border border-amber-500/30 border-t-transparent rounded-full ${isAuthInProgress ? 'animate-spin' : 'opacity-0'}`} style={{ animationDuration: '1.5s' }}></div>
                </div>
                <span className={`text-[10px] font-orbitron tracking-[0.4em] transition-colors duration-300 font-black ${isAuthInProgress ? 'text-amber-200' : 'text-amber-500/80'}`}>
                  {isAuthInProgress ? 'AUTHENTICATING...' : 'HOLD_BIO_TRIGGER'}
                </span>
              </div>

              {/* Data Particles Display */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {particles.map(p => (
                  <div 
                    key={p.id}
                    className={`absolute rounded-full bg-amber-400 transition-opacity duration-1000 ${isAuthInProgress ? 'opacity-40' : 'opacity-0'}`}
                    style={{
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      top: '50%',
                      left: '50%',
                      transform: `rotate(${p.angle}deg) translate(${p.distance}px) rotate(-${p.angle}deg)`,
                      animation: isAuthInProgress ? `float-particle ${p.speed}s linear infinite` : 'none'
                    }}
                  ></div>
                ))}
              </div>

              {/* Holographic Scanline */}
              {isAuthInProgress && (
                <div className="absolute inset-0 pointer-events-none z-20">
                   <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_20px_amber] animate-v-scan-fast"></div>
                   <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0%,transparent_70%)] animate-pulse"></div>
                </div>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="relative w-full aspect-video bg-black/80 border border-amber-900/20 rounded-xl overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,1)]">
              <svg 
                ref={canvasRef}
                className="w-full h-full cursor-crosshair relative z-10"
                onMouseDown={handleSignatureStart}
                onMouseMove={handleSignatureMove}
                onMouseUp={handleSignatureEnd}
                onMouseLeave={handleSignatureEnd}
                onTouchStart={(e) => { e.preventDefault(); handleSignatureStart(e); }}
                onTouchMove={(e) => { e.preventDefault(); handleSignatureMove(e); }}
                onTouchEnd={handleSignatureEnd}
              >
                {paths.map((path, i) => (
                  <polyline key={i} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                ))}
              </svg>
              {!isAuthInProgress && paths.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                   <span className="font-orbitron text-[9px] tracking-[1em] text-amber-500 uppercase">Input_Signature_Required</span>
                </div>
              )}
              {isAuthInProgress && (
                <div className="absolute inset-0 pointer-events-none bg-amber-500/5">
                  <div className="w-full h-2 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_30px_amber] absolute animate-v-scan-fast"></div>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 w-full">
              <button onClick={() => setPaths([])} className="flex-1 py-4 border border-white/5 rounded-xl font-orbitron text-[9px] tracking-[0.5em] text-amber-900 hover:text-amber-500 transition-all uppercase">Purge_Buffer</button>
              <button onClick={verifySignature} disabled={isAuthInProgress || paths.length === 0} className={`flex-1 py-4 rounded-xl font-orbitron text-[9px] tracking-[0.5em] transition-all uppercase ${paths.length > 0 ? 'bg-amber-500 text-black shadow-[0_0_40px_rgba(245,158,11,0.4)]' : 'bg-amber-950/20 text-amber-950'}`}>Authenticate</button>
            </div>
          </div>
        )}

        <div className="text-center opacity-40">
           <p className="text-[7px] font-mono tracking-widest text-amber-700 uppercase">Mark_XLV_Security_Protocols_Active</p>
        </div>
      </div>

      <style>{`
        @keyframes v-scan-fast { 0% { transform: translateY(-50px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(350px); opacity: 0; } }
        .animate-v-scan-fast { animation: v-scan-fast 2s ease-in-out infinite; }
        
        @keyframes reverse-spin { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-reverse-spin { animation: reverse-spin linear infinite; }
        
        @keyframes float-particle {
          0% { transform: rotate(0deg) translate(40px) rotate(0deg); opacity: 0.2; }
          50% { opacity: 0.8; }
          100% { transform: rotate(360deg) translate(40px) rotate(-360deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};
