
import React, { useState, useEffect, useRef } from 'react';
import { sounds } from '../services/soundService';
import { decodeBase64, encodeBase64 } from '../services/geminiService';

interface LoginScreenProps {
  onUnlock: (profile: string) => void;
}

type AuthMode = 'biometric' | 'signature' | 'pin' | null;

interface Point {
  x: number;
  y: number;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock }) => {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [progress, setProgress] = useState(0);
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  const [status, setStatus] = useState('SYSTEM_IDLE');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isBooted, setIsBooted] = useState(false);
  const [hasNativeBiometrics, setHasNativeBiometrics] = useState(false);
  
  // PIN Logic States
  const [pin, setPin] = useState<string>('');
  const [isPinError, setIsPinError] = useState(false);
  const [pinNodes, setPinNodes] = useState<Point[]>([]);
  const keypadRef = useRef<HTMLDivElement>(null);

  // Signature States
  const [paths, setPaths] = useState<Array<{x: number, y: number}[]>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<number | null>(null);

  const CORRECT_PIN = "4512367980";

  useEffect(() => {
    const sequence = [
      { msg: 'INITIALIZING_CORE', delay: 400 },
      { msg: 'SYNCING_NEURAL_ARRAY', delay: 800 },
      { msg: 'AWAITING_AUTHENTICATION', delay: 1200 }
    ];

    sequence.forEach((step) => {
      setTimeout(() => {
        setStatus(step.msg);
        sounds.playUiTick();
      }, step.delay);
    });

    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          if (available) setHasNativeBiometrics(true);
        })
        .catch(console.error);
    }

    setTimeout(() => setIsBooted(true), 1500);

    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Physical Keyboard Listener
  useEffect(() => {
    if (authMode === 'pin' && !isAuthInProgress) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          const btn = document.querySelector(`button[data-val="${e.key}"]`);
          if (btn) {
            const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
            btn.dispatchEvent(mousedownEvent);
          }
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          setPin(prev => prev.slice(0, -1));
          setPinNodes(prev => prev.slice(0, -1));
          sounds.playUiTick();
        } else if (e.key === 'Escape') {
          handleReturn();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [authMode, isAuthInProgress]);

  const handleNativeBiometric = async () => {
    if (isAuthInProgress) return;
    setIsAuthInProgress(true);
    const storedCredId = localStorage.getItem('stark_auth_cred_id');
    setStatus(storedCredId ? 'VERIFYING_VAULT_KEY' : 'REGISTERING_STARK_PROTOCOL');
    sounds.playScanHum(1.0);

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      if (storedCredId) {
        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
          challenge: challenge,
          allowCredentials: [{ id: decodeBase64(storedCredId), type: 'public-key' }],
          userVerification: "required",
          timeout: 60000,
        };
        const assertion = await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions });
        if (assertion) {
          setStatus('IDENTITY_VERIFIED');
          sounds.playAuthSuccess();
          setProgress(100);
          setTimeout(() => onUnlock('Stark_Primary'), 800);
        }
      } else {
        const userID = new Uint8Array(16);
        window.crypto.getRandomValues(userID);
        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
          challenge: challenge,
          rp: { name: "Stark Industries JARVIS", id: window.location.hostname === 'localhost' ? undefined : window.location.hostname },
          user: { id: userID, name: "tony.stark@starkindustries.com", displayName: "Tony Stark" },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred", requireResidentKey: false },
          timeout: 60000,
          attestation: "none",
        };
        const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions }) as PublicKeyCredential;
        if (credential) {
          localStorage.setItem('stark_auth_cred_id', encodeBase64(new Uint8Array(credential.rawId)));
          setStatus('PROTOCOL_REGISTERED');
          sounds.playAuthSuccess();
          setProgress(100);
          setTimeout(() => onUnlock('Stark_Primary'), 800);
        }
      }
    } catch (err: any) {
      setIsAuthInProgress(false);
      setStatus('HARDWARE_AUTH_FAILED');
      sounds.playError();
    }
  };

  const startBiometricScan = () => {
    if (!isBooted || isAuthInProgress) return;
    setIsAuthInProgress(true);
    setStatus('SCANNING_RETINA_DATA');
    sounds.playScanHum(1);
    
    let currentProgress = 0;
    timerRef.current = window.setInterval(() => {
      currentProgress += Math.random() * 15 + 10; 
      if (currentProgress >= 100) {
        setProgress(100);
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('LINK_SECURED: STARK_MK_45');
        sounds.playAuthSuccess();
        setTimeout(() => onUnlock('Stark'), 400); 
      } else {
        setProgress(currentProgress);
      }
    }, 25); 
  };

  const handlePinInput = (num: string, e: React.MouseEvent | React.TouchEvent) => {
    if (isAuthInProgress || pin.length >= CORRECT_PIN.length) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const keypadRect = keypadRef.current?.getBoundingClientRect();
    if (keypadRect) {
      const x = rect.left + rect.width / 2 - keypadRect.left;
      const y = rect.top + rect.height / 2 - keypadRect.top;
      setPinNodes(prev => [...prev, { x, y }]);
    }

    sounds.playUiTick();
    const newPin = pin + num;
    setPin(newPin);
    
    if (newPin.length === CORRECT_PIN.length) verifyPin(newPin);
  };

  const verifyPin = (code: string) => {
    setIsAuthInProgress(true);
    setStatus('VALIDATING_NEURAL_TOKEN...');
    sounds.playScanHum(1.0);
    
    setTimeout(() => {
      if (code === CORRECT_PIN) {
        setStatus('UPLINK_ESTABLISHED');
        sounds.playAuthSuccess();
        setProgress(100);
        setTimeout(() => onUnlock('Stark_Primary'), 800);
      } else {
        setIsPinError(true);
        sounds.playError();
        setStatus('ACCESS_TOKEN_INVALID');
        setTimeout(() => {
          setIsPinError(false);
          setIsAuthInProgress(false);
          setPin('');
          setPinNodes([]);
          setStatus('AWAITING_AUTHENTICATION');
        }, 1200);
      }
    }, 1000);
  };

  const selectMode = (mode: AuthMode) => {
    sounds.playUiTick();
    setAuthMode(mode);
    setStatus(mode === 'biometric' ? 'HOLD_FOR_LINK' : mode === 'signature' ? 'SIG_WAITING' : 'WAITING_FOR_TOKEN_SEQUENCE');
  };

  const handleReturn = () => {
    sounds.playUiTick();
    setAuthMode(null);
    setPin('');
    setPinNodes([]);
    setPaths([]);
    setStatus('AWAITING_AUTHENTICATION');
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const verifySignature = () => {
    if (paths.length === 0) return;
    setIsAuthInProgress(true);
    setStatus('ANALYTIC_PARSING...');
    sounds.playScanHum(1.5); 
    setTimeout(() => {
      setStatus('ACCESS_GRANTED');
      sounds.playAuthSuccess();
      setTimeout(() => onUnlock('Authorized_User'), 600);
    }, 1000); 
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`fixed inset-0 z-[100] bg-[#050201] flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-hidden transition-all duration-1000 ${isBooted ? 'opacity-100 scale-100' : 'opacity-80 scale-105'}`}>
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl h-full max-h-screen justify-between py-4">
        
        {/* Header Section */}
        <div className={`flex flex-col items-center transition-all duration-700 ease-in-out ${authMode !== null ? 'opacity-0 -translate-y-20 pointer-events-none absolute' : 'opacity-100 translate-y-0'}`}>
          <div className="text-3xl sm:text-6xl font-orbitron font-black text-amber-500 tracking-[0.2em] drop-shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-1 sm:mb-4">
            {formattedTime}
          </div>
          <div className="text-[8px] sm:text-[10px] font-orbitron text-amber-600/40 tracking-[0.4em] sm:tracking-[0.6em] mb-4 sm:mb-12 uppercase">{currentTime.toDateString().toUpperCase()}</div>
          
          <h1 className={`font-orbitron text-4xl sm:text-7xl font-black tracking-[0.2em] sm:tracking-[0.4em] text-amber-500 hologram-flicker transition-all duration-1000 transform ${isBooted ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
            JARVIS
          </h1>
          <p className={`font-orbitron text-[8px] sm:text-[10px] tracking-[0.4em] sm:tracking-[0.6em] text-amber-600 uppercase font-black mt-4 sm:mt-8 ${isPinError ? 'text-red-500' : 'animate-pulse'}`}>
            {status}
          </p>
        </div>

        {/* Auth Selection */}
        {authMode === null && (
          <div className="flex flex-col gap-4 w-full max-w-3xl animate-fade-in-up">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 w-full">
              <AuthCard icon="BIO" label="BIOMETRIC" sub="RETINA_SCAN" onClick={() => selectMode('biometric')} />
              <AuthCard icon="SIG" label="SIGNATURE" sub="HANDWRITING" onClick={() => selectMode('signature')} />
              <AuthCard icon="PIN" label="NEURAL_PIN" sub="10_DIGIT_KEY" onClick={() => selectMode('pin')} />
            </div>
            
            {hasNativeBiometrics && (
              <div className="mt-2">
                <button onClick={handleNativeBiometric} className="w-full py-2 sm:py-4 glass border-amber-500/20 text-amber-500 font-orbitron text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.4em] hover:bg-amber-500/10 transition-all rounded-xl flex items-center justify-center gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  HARDWARE_ENCLAVE_DETECTED
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Auth Modes */}
        {authMode !== null && (
          <div className="flex-1 w-full flex flex-col items-center justify-center animate-scale-in">
            <p className={`font-orbitron text-[10px] sm:text-[12px] tracking-[0.4em] text-amber-500 uppercase font-black mb-6 sm:mb-12 ${isPinError ? 'text-red-500' : 'animate-pulse'}`}>
              {status}
            </p>

            {authMode === 'biometric' && (
              <button                
                onMouseDown={startBiometricScan}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startBiometricScan();
                }}
                onMouseUp={() => { if(progress < 100) { setIsAuthInProgress(false); setProgress(0); setStatus('HOLD_FOR_LINK'); if(timerRef.current) clearInterval(timerRef.current); } }}
                className={`relative w-48 h-48 sm:w-80 sm:h-80 rounded-full flex items-center justify-center transition-all duration-700 border border-white/5 bg-[#0a0602] backdrop-blur-3xl overflow-hidden group shadow-[0_0_80px_rgba(0,0,0,0.8)] ${isAuthInProgress ? 'border-amber-400 shadow-[0_0_120px_rgba(245,158,11,0.25)] scale-[0.98]' : 'hover:border-amber-500/20 hover:scale-105'}`}
              >
                <div className="absolute inset-0 transition-opacity duration-500 overflow-hidden" style={{ opacity: isAuthInProgress ? 1 : 0 }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-600/30 to-transparent" style={{ transform: `translateY(${100 - progress}%)` }}></div>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.4" className={`w-16 h-16 sm:w-32 sm:h-32 text-amber-500 ${isAuthInProgress ? 'animate-pulse' : 'opacity-40'}`}><path d="M12 11c0 3.517-2.103 6.542-5.11 7.794m10.22 0A9.001 9.001 0 0017 11V5.5M7 5.5a9 9 0 0113.844-7.5M10.5 5.5v5.5m0-11V2M3.5 17.5v-1.5M20.5 17.5v-1.5" /></svg>
                </div>
                {isAuthInProgress && <div className="absolute top-0 w-full h-[3px] bg-amber-400 animate-v-scan opacity-90 shadow-[0_0_20px_rgba(251,191,36,0.8)]"></div>}
              </button>
            )}

            {authMode === 'pin' && (
              <div className="flex flex-col items-center gap-4 sm:gap-8 w-full max-w-sm">
                <div className={`flex gap-2 sm:gap-3 p-3 sm:p-6 glass border-2 rounded-2xl w-full justify-center shadow-inner overflow-hidden ${isPinError ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-amber-500/10'}`}>
                  {[...Array(CORRECT_PIN.length)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border transition-all duration-300 ${isPinError ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : (pin.length > i ? 'bg-amber-500 border-amber-400 scale-125 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'border-amber-900/30 bg-transparent')}`}></div>
                  ))}
                </div>

                <div ref={keypadRef} className="relative grid grid-cols-3 gap-2 sm:gap-4 w-full p-2">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <polyline points={pinNodes.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={isPinError ? "#ef4444" : "#fbbf24"} strokeWidth="2" strokeOpacity="0.4" strokeDasharray="5 3" />
                    {pinNodes.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={isPinError ? "#ef4444" : "#fbbf24"} fillOpacity="0.6" className="animate-pulse" />)}
                  </svg>

                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL'].map((val) => {
                    const isSelected = pin.includes(val);
                    return (
                      <button
                        key={val}
                        data-val={val}
                        disabled={isAuthInProgress && val !== 'CLR'}
                        onMouseDown={(e) => { if(val !== 'CLR' && val !== 'DEL') handlePinInput(val, e); }}
                        onClick={() => {
                          if (val === 'CLR') { setPin(''); setPinNodes([]); sounds.playUiTick(); }
                          else if (val === 'DEL') { setPin(prev => prev.slice(0, -1)); setPinNodes(prev => prev.slice(0, -1)); sounds.playUiTick(); }
                        }}
                        className={`relative z-10 aspect-square flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border transition-all duration-300 backdrop-blur-md group ${val === 'CLR' || val === 'DEL' ? 'border-amber-900/20 text-[7px] sm:text-[8px] font-orbitron text-amber-900 hover:text-amber-500' : `border-amber-500/10 bg-white/5 hover:border-amber-500/50 hover:bg-amber-500/10 active:scale-90 ${isSelected ? 'border-amber-500/80 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''}`}`}
                      >
                        <span className={`text-lg sm:text-2xl font-orbitron font-black ${val === 'CLR' || val === 'DEL' ? 'mb-0.5' : 'text-amber-500'}`}>{val}</span>
                        {isSelected && <div className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 border-amber-500 animate-pulse pointer-events-none"></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {authMode === 'signature' && (
              <div className="flex flex-col items-center gap-4 sm:gap-10 w-full max-w-2xl px-2">
                <div className={`relative w-full aspect-[2/1] sm:aspect-video bg-[#0a0501]/80 border-2 rounded-2xl overflow-hidden backdrop-blur-3xl ${isAuthInProgress ? 'border-amber-400' : 'border-amber-500/10'}`}>
                  <svg ref={canvasRef} className="w-full h-full cursor-crosshair relative z-10" onMouseDown={(e) => { setIsDrawing(true); const pos = getPos(e); setPaths(prev => [...prev, [pos]]); sounds.playUiTick(); }} onMouseMove={(e) => { if(!isDrawing) return; const pos = getPos(e); setPaths(prev => { const lp = prev[prev.length - 1]; return [...prev.slice(0, -1), [...lp, pos]]; }); if(Math.random() > 0.9) sounds.playUiTick(); }} onMouseUp={() => setIsDrawing(false)} onTouchStart={(e) => { e.preventDefault(); setIsDrawing(true); const pos = getPos(e); setPaths(prev => [...prev, [pos]]); sounds.playUiTick(); }} onTouchMove={(e) => { e.preventDefault(); if(!isDrawing) return; const pos = getPos(e); setPaths(prev => { const lp = prev[prev.length - 1]; return [...prev.slice(0, -1), [...lp, pos]]; }); }} onTouchEnd={() => setIsDrawing(false)}>
                    {paths.map((path, i) => <polyline key={i} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
                  </svg>
                  {paths.length === 0 && <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none font-orbitron text-[8px] sm:text-[10px] tracking-[1em] sm:tracking-[1.5em] text-amber-500 uppercase">SIGN_HERE</div>}
                </div>
                <div className="flex gap-4 w-full max-w-md">
                  <button onClick={() => setPaths([])} className="flex-1 py-3 sm:py-4 border border-amber-900/30 rounded-xl font-orbitron text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.4em] text-amber-900 uppercase">CLEAR</button>
                  <button onClick={verifySignature} disabled={paths.length === 0 || isAuthInProgress} className={`flex-1 py-3 sm:py-4 rounded-xl font-orbitron text-[8px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.4em] font-black ${paths.length > 0 ? 'bg-amber-500 text-black shadow-xl animate-pulse' : 'bg-amber-950/10 text-amber-950'}`}>AUTHORIZE</button>
                </div>
              </div>
            )}

            <button onClick={handleReturn} className="mt-6 sm:mt-12 text-[8px] sm:text-[10px] font-orbitron text-amber-900 hover:text-amber-500 tracking-widest uppercase transition-colors">
              <span className="mr-2">←</span> RETURN
            </button>
          </div>
        )}

        {/* Footer Section */}
        <p className={`text-[6px] sm:text-[7px] font-orbitron tracking-[0.4em] sm:tracking-[0.8em] text-amber-700 opacity-50 text-center uppercase ${authMode !== null ? 'mt-4' : 'mt-8'}`}>
          Property_Of_Stark_Industries // CHEIF::UDIT_RANA
        </p>
      </div>

      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out forwards; }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
        @keyframes v-scan { 0% { transform: translateY(-10px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(400px); opacity: 0; } }
        .animate-v-scan { animation: v-scan 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

const AuthCard: React.FC<{ icon: string, label: string, sub: string, onClick: () => void }> = ({ icon, label, sub, onClick }) => (
  <button onClick={onClick} className="group relative glass p-4 sm:p-8 rounded-xl sm:rounded-2xl flex flex-row sm:flex-col items-center gap-3 sm:gap-4 border border-amber-500/10 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all duration-500 hover:scale-105 shadow-2xl overflow-hidden text-left sm:text-center">
    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <div className="w-10 h-10 sm:w-16 sm:h-16 border border-amber-500/20 rounded-lg sm:rounded-xl flex items-center justify-center font-orbitron text-lg sm:text-xl text-amber-500 group-hover:text-amber-400 group-hover:border-amber-500/60 transition-all flex-shrink-0">
      {icon === 'BIO' && '⊗'}
      {icon === 'SIG' && '✎'}
      {icon === 'PIN' && '＃'}
    </div>
    <div className="flex flex-col items-start sm:items-center">
      <span className="text-[9px] sm:text-[10px] font-orbitron font-black text-amber-500 tracking-[0.2em] sm:tracking-[0.3em] uppercase">{label}</span>
      <span className="text-[6px] font-orbitron text-amber-900 tracking-widest uppercase mt-0.5 sm:mt-1">{sub}</span>
    </div>
  </button>
);
