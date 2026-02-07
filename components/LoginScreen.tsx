import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sounds } from '../services/soundService';

interface LoginScreenProps {
  onUnlock: (profile: string) => void;
}

type AuthMode = 'biometric' | 'signature';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('biometric');
  const [progress, setProgress] = useState(0);
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  const [status, setStatus] = useState('INITIALIZING_CORE');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isBooted, setIsBooted] = useState(false);
  const [hasNativeBiometrics, setHasNativeBiometrics] = useState(false);
  
  const [paths, setPaths] = useState<Array<{x: number, y: number}[]>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<number | null>(null);

  // Boot Sequence & Hardware Check
  useEffect(() => {
    const sequence = [
      { msg: 'LOADING_KERNEL', delay: 400 },
      { msg: 'SYNCING_NEURAL_ARRAY', delay: 800 },
      { msg: 'ENCRYPTING_STARK_TUNNEL', delay: 1200 },
      { msg: 'PROTOCOLS_LOCKED', delay: 1600 }
    ];

    sequence.forEach((step, i) => {
      setTimeout(() => {
        setStatus(step.msg);
        sounds.playUiTick();
      }, step.delay);
    });

    // Check for physical biometric support (Windows Hello, TouchID, etc.)
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          if (available) {
            setHasNativeBiometrics(true);
            setTimeout(() => {
              setStatus('HARDWARE_SENSOR_DETECTED');
              sounds.playNotification();
            }, 1800);
          }
        })
        .catch(console.error);
    }

    setTimeout(() => setIsBooted(true), 2000);

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      angle: Math.random() * 360,
      distance: 30 + Math.random() * 60,
      size: 0.8 + Math.random() * 2,
      speed: 0.8 + Math.random() * 2.2,
      rotationSpeed: (Math.random() - 0.5) * 4
    }));
  }, []);

  const handleNativeBiometric = async () => {
    if (isAuthInProgress) return;
    setIsAuthInProgress(true);
    setStatus('HANDSHAKING_WITH_OS_KERNEL');
    sounds.playScanHum(1.0);

    try {
      /**
       * To force Windows Hello / TouchID / FaceID PIN or Biometric prompt,
       * we use navigator.credentials.create with userVerification: "required".
       */
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userID = new Uint8Array(16);
      window.crypto.getRandomValues(userID);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: "Stark Industries JARVIS",
          id: window.location.hostname === 'localhost' ? undefined : window.location.hostname,
        },
        user: {
          id: userID,
          name: "tony.stark@starkindustries.com",
          displayName: "Tony Stark",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required", // CRITICAL: This forces the OS PIN/Biometric modal
          residentKey: "preferred",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (credential) {
        setStatus('HARDWARE_AUTH_SUCCESS');
        sounds.playAuthSuccess();
        setProgress(100);
        setTimeout(() => onUnlock('Stark_Primary'), 800);
      }
    } catch (err: any) {
      console.warn("Native Auth Error:", err);
      setIsAuthInProgress(false);
      
      if (err.name === 'NotAllowedError') {
        setStatus('USER_CANCELLED_AUTH');
      } else if (err.name === 'SecurityError') {
        setStatus('DOMAIN_MISMATCH_ERROR');
      } else {
        setStatus('HARDWARE_AUTH_FAILED');
      }
      
      sounds.playError();
      // On hardware failure, automatically switch to signature mode for fallback
      setTimeout(() => {
        setAuthMode('signature');
        setStatus('FALLBACK_TO_SIGNATURE');
      }, 1500);
    }
  };

  const startBiometricScan = () => {
    if (!isBooted || isAuthInProgress) return;
    setIsAuthInProgress(true);
    setStatus('SCANNING_RETINA_DATA');
    sounds.playScanHum(3);
    
    let currentProgress = 0;
    timerRef.current = window.setInterval(() => {
      currentProgress += Math.random() * 4 + 1;
      if (currentProgress >= 100) {
        setProgress(100);
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('LINK_SECURED: STARK_MK_45');
        sounds.playAuthSuccess();
        setTimeout(() => onUnlock('Stark'), 600);
      } else {
        setProgress(currentProgress);
        if (currentProgress > 30 && currentProgress < 35) setStatus('MAPPING_PUPIL_RESPONSE');
        if (currentProgress > 65 && currentProgress < 70) setStatus('VERIFYING_CLEARANCE_LVL_10');
      }
    }, 45);
  };

  const stopBiometricScan = () => {
    if (progress < 100) {
      setIsAuthInProgress(false);
      setProgress(0);
      setStatus('PROTOCOLS_LOCKED');
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
    if (!isBooted || isAuthInProgress) return;
    setIsDrawing(true);
    const pos = getPos(e);
    setPaths(prev => [...prev, [pos]]);
    sounds.playUiTick();
  };

  const handleSignatureMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    setPaths(prev => {
      const lastPath = prev[prev.length - 1];
      const lastPoint = lastPath[lastPath.length - 1];
      if (lastPoint && Math.abs(lastPoint.x - pos.x) < 2 && Math.abs(lastPoint.y - pos.y) < 2) return prev;
      return [...prev.slice(0, -1), [...lastPath, pos]];
    });
    if (Math.random() > 0.92) sounds.playUiTick();
  };

  const handleSignatureEnd = () => setIsDrawing(false);

  const verifySignature = () => {
    if (paths.length === 0) {
      sounds.playError();
      return setStatus('SIG_INPUT_REQUIRED');
    }
    setIsAuthInProgress(true);
    setStatus('ANALYTIC_PARSING...');
    sounds.playScanHum(3.0);
    
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      setProgress(current);
      
      if (current === 20) setStatus('EXTRACTING_VERTICES');
      if (current === 40) setStatus('NEURAL_PATTERN_MATCH');
      if (current === 60) setStatus('SYMMETRY_CHECK: 99.2%');
      if (current === 85) setStatus('DECRYPTING_STARK_HASH');

      if (current >= 100) {
        clearInterval(interval);
        setStatus('ACCESS_GRANTED');
        sounds.playAuthSuccess();
        setTimeout(() => onUnlock('Authorized_User'), 800);
      }
    }, 40);
  };

  const switchMode = (mode: AuthMode) => {
    if (isAuthInProgress) return;
    setAuthMode(mode);
    setProgress(0);
    setPaths([]);
    setStatus(mode === 'biometric' ? 'PROTOCOLS_LOCKED' : 'SIG_WAITING');
    sounds.playUiTick();
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  const vertices = useMemo(() => {
    const v: {x: number, y: number}[] = [];
    paths.forEach(p => {
      if (p.length > 0) v.push(p[0]);
      if (p.length > 5) v.push(p[Math.floor(p.length / 2)]);
      if (p.length > 1) v.push(p[p.length - 1]);
    });
    return v;
  }, [paths]);

  return (
    <div className={`fixed inset-0 z-[100] bg-[#050201] flex flex-col items-center justify-center p-6 sm:p-12 select-none overflow-hidden touch-none transition-all duration-1000 ${isBooted ? 'opacity-100 scale-100' : 'opacity-80 scale-105'}`}>
      
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06),transparent_70%)] pointer-events-none"></div>
      
      <div className="absolute top-8 left-8 w-24 h-24 border-l-2 border-t-2 border-amber-500/20 opacity-40 animate-pulse-slow"></div>
      <div className="absolute top-8 right-8 w-24 h-24 border-r-2 border-t-2 border-amber-500/20 opacity-40 animate-pulse-slow"></div>
      <div className="absolute bottom-8 left-8 w-24 h-24 border-l-2 border-b-2 border-amber-500/20 opacity-40 animate-pulse-slow"></div>
      <div className="absolute bottom-8 right-8 w-24 h-24 border-r-2 border-b-2 border-amber-500/20 opacity-40 animate-pulse-slow"></div>

      <div className={`absolute top-12 right-12 text-right transition-all duration-1000 transform ${isBooted ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="text-[9px] font-orbitron text-amber-500/30 tracking-[0.4em] mb-1 uppercase">Chronos_Sync_MK45</div>
        <div className="text-5xl font-orbitron font-black text-amber-500 tracking-tighter drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
          {formattedTime}
        </div>
        <div className="text-[8px] font-mono text-amber-600/50 tracking-[0.3em] mt-1">{formattedDate}</div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-xl">
        <div className="text-center">
          <h1 className={`font-orbitron text-5xl sm:text-7xl font-black tracking-[0.8em] text-amber-500 transition-all duration-1000 ${isBooted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} hologram-flicker`}>
            JARVIS_REFINE
          </h1>
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex items-center justify-center gap-6">
              <span className="h-[1px] w-12 bg-amber-500/10"></span>
              <p className="font-orbitron text-[10px] tracking-[0.6em] text-amber-600 uppercase font-black animate-pulse">
                {status}
              </p>
              <span className="h-[1px] w-12 bg-amber-500/10"></span>
            </div>
            {hasNativeBiometrics && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/5 border border-amber-500/20 rounded-full animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[7px] font-orbitron text-amber-500/60 tracking-widest uppercase">STARK_HARDWARE_LINK_ACTIVE</span>
              </div>
            )}
          </div>
        </div>

        <div className={`flex bg-black/40 border border-amber-500/5 p-1.5 rounded-2xl backdrop-blur-3xl shadow-2xl transition-all duration-1000 delay-300 transform ${isBooted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <button 
            onClick={() => switchMode('biometric')}
            className={`px-10 sm:px-14 py-4 rounded-xl font-orbitron text-[9px] tracking-widest transition-all duration-500 ${authMode === 'biometric' ? 'bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'text-amber-800 hover:text-amber-500'}`}
          >
            BIO_SCAN
          </button>
          <button 
            onClick={() => switchMode('signature')}
            className={`px-10 sm:px-14 py-4 rounded-xl font-orbitron text-[9px] tracking-widest transition-all duration-500 ${authMode === 'signature' ? 'bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'text-amber-800 hover:text-amber-500'}`}
          >
            SIG_AUTH
          </button>
        </div>

        {authMode === 'biometric' ? (
          <div className={`relative flex flex-col items-center gap-10 transition-all duration-1000 delay-500 ${isBooted ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
            
            <button
              onMouseDown={startBiometricScan}
              onMouseUp={stopBiometricScan}
              onMouseLeave={stopBiometricScan}
              onTouchStart={(e) => { e.preventDefault(); startBiometricScan(); }}
              onTouchEnd={stopBiometricScan}
              className={`relative w-72 h-72 sm:w-80 sm:h-80 rounded-full flex items-center justify-center transition-all duration-700 border border-white/5 bg-[#0a0602] backdrop-blur-3xl overflow-hidden group ${isAuthInProgress ? 'border-amber-400/40 shadow-[0_0_150px_rgba(245,158,11,0.2)] scale-[0.98]' : 'hover:border-amber-500/20 shadow-2xl hover:scale-105'}`}
            >
              <div className="absolute inset-0 transition-opacity duration-500 overflow-hidden rounded-full" style={{ opacity: isAuthInProgress ? 1 : 0 }}>
                <div className="absolute inset-0 bg-gradient-to-t from-amber-600/30 to-transparent" style={{ transform: `translateY(${100 - progress}%)`, transition: 'transform 0.1s linear' }}></div>
              </div>
              
              <div className={`relative z-10 flex flex-col items-center gap-6 transition-all duration-500 ${isAuthInProgress ? 'scale-110' : 'opacity-30 group-hover:opacity-60'}`}>
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" className={`w-28 h-28 text-amber-500 transition-all duration-300 ${isAuthInProgress ? 'drop-shadow-[0_0_20px_rgba(245,158,11,1)]' : ''}`}>
                    <path d="M12 11c0 3.517-2.103 6.542-5.11 7.794m10.22 0A9.001 9.001 0 0017 11V5.5M7 5.5a9 9 0 0113.844-7.5M10.5 5.5v5.5m0-11V2M3.5 17.5v-1.5M20.5 17.5v-1.5" />
                  </svg>
                </div>
                <span className={`text-[9px] font-orbitron tracking-[0.5em] font-black ${isAuthInProgress ? 'text-amber-200 animate-pulse' : 'text-amber-500'}`}>
                  {isAuthInProgress ? 'ANALYZING...' : 'HOLD_TO_SCAN'}
                </span>
              </div>

              {isAuthInProgress && (
                <div className="absolute inset-0 pointer-events-none z-20">
                   <div className="absolute top-0 w-full h-[2px] bg-amber-300 shadow-[0_0_30px_amber] animate-v-scan-fast opacity-80"></div>
                </div>
              )}
            </button>

            {hasNativeBiometrics && !isAuthInProgress && (
              <button 
                onClick={handleNativeBiometric}
                className="group flex items-center gap-5 px-10 py-5 bg-amber-500/10 border border-amber-500/40 rounded-2xl hover:bg-amber-500/20 transition-all animate-fade-in hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(245,158,11,0.15)]"
              >
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-orbitron font-black text-amber-500 tracking-[0.2em]">VERIFY_IDENTITY</span>
                  <span className="text-[8px] font-mono text-amber-600/60 uppercase mt-1">Triggers Windows Hello / TouchID</span>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-10 w-full transition-all duration-1000 delay-500 ${isBooted ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`relative w-full aspect-video bg-[#0a0501] border rounded-2xl overflow-hidden transition-all duration-500 ${isAuthInProgress ? 'border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.1)]' : 'border-amber-500/10 shadow-[inset_0_0_100px_rgba(0,0,0,1)]'}`}>
              <div className="absolute top-4 left-4 text-[7px] font-mono text-amber-500/20 uppercase tracking-widest z-20">Digital_Surface_Layer_Secure</div>
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
                {isAuthInProgress && vertices.map((v, i) => (
                   <g key={i} className="animate-fade-in">
                      <rect x={v.x - 4} y={v.y - 4} width={8} height={8} fill="none" stroke="#fbbf24" strokeWidth="0.5" className="animate-pulse" />
                      <line x1={v.x} y1={v.y} x2={v.x + 10} y2={v.y - 10} stroke="#fbbf24" strokeWidth="0.2" strokeOpacity="0.4" />
                      <text x={v.x + 12} y={v.y - 10} fill="#fbbf24" fontSize="5" className="font-mono opacity-40">PT_{i.toString().padStart(2, '0')}</text>
                   </g>
                ))}
              </svg>

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
                  <polyline 
                    key={i} 
                    points={path.map(p => `${p.x},${p.y}`).join(' ')} 
                    fill="none" 
                    stroke="#fbbf24" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={`transition-opacity duration-500 ${isAuthInProgress ? 'opacity-40' : 'opacity-100'} drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]`} 
                  />
                ))}
              </svg>
              
              {!isAuthInProgress && paths.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                   <span className="font-orbitron text-[9px] tracking-[1.2em] text-amber-500 uppercase animate-pulse">SIGN_TO_AUTHORIZE</span>
                </div>
              )}
              
              {isAuthInProgress && (
                <div className="absolute inset-0 pointer-events-none bg-amber-500/5 z-30">
                  <div className="w-full h-[2px] bg-amber-400 shadow-[0_0_40px_amber] absolute animate-v-scan-fast opacity-60"></div>
                  <div className="absolute inset-0 bg-grid opacity-20"></div>
                </div>
              )}
            </div>
            
            <div className="flex gap-6 w-full max-w-md">
              <button onClick={() => { setPaths([]); sounds.playUiTick(); }} className="flex-1 py-4 border border-amber-900/20 rounded-xl font-orbitron text-[9px] tracking-[0.4em] text-amber-900 hover:text-amber-500 hover:border-amber-500/30 transition-all uppercase">Purge_Buffer</button>
              <button 
                onClick={verifySignature} 
                disabled={isAuthInProgress || paths.length === 0} 
                className={`flex-1 py-4 rounded-xl font-orbitron text-[9px] tracking-[0.4em] transition-all uppercase ${paths.length > 0 ? 'bg-amber-500 text-black shadow-[0_0_50px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 animate-breathing-glow' : 'bg-amber-950/10 text-amber-950 cursor-not-allowed'}`}
              >
                AUTHORIZE_SIG
              </button>
            </div>
          </div>
        )}

        <div className={`text-center opacity-20 transition-all duration-1000 delay-700 ${isBooted ? 'translate-y-0' : 'translate-y-10'}`}>
           <p className="text-[7px] font-mono tracking-widest text-amber-700 uppercase">Property_Of_Stark_Industries_Level_7_Access_Only</p>
        </div>
      </div>

      <style>{`
        @keyframes breathing-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.2); }
          50% { box-shadow: 0 0 40px rgba(245,158,11,0.5); }
        }
        .animate-breathing-glow { animation: breathing-glow 2s ease-in-out infinite; }
        
        @keyframes v-scan-fast { 
          0% { transform: translateY(-100px); opacity: 0; } 
          10% { opacity: 1; } 
          90% { opacity: 1; } 
          100% { transform: translateY(400px); opacity: 0; } 
        }
        .animate-v-scan-fast { animation: v-scan-fast 2.0s ease-in-out infinite; }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
};
