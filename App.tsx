
import React, { useState, useRef, useEffect } from 'react';
import { JarvisCore } from './components/JarvisCore';
import { DashboardWidgets } from './components/DashboardWidgets';
import { LoginScreen } from './components/LoginScreen';
import { Message, MessageRole } from './types';
import { getGeminiClient, decodeBase64, encodeBase64, decodeAudioData, generateJarvisSpeech, verifyProtocols } from './services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [needsKeySync, setNeedsKeySync] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);
  const [isVercel, setIsVercel] = useState(false);

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasAiStudio = typeof (window as any).aistudio !== 'undefined';
    setIsVercel(!hasAiStudio);
    
    const checkKey = async () => {
      if (hasAiStudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setNeedsKeySync(!hasKey);
      } else {
        setNeedsKeySync(!process.env.API_KEY);
      }
    };
    
    checkKey();
    const interval = setInterval(checkKey, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentTranscription]);

  const addLog = (msg: string) => {
    setDiagnosticLog(prev => [msg, ...prev].slice(0, 5));
  };

  const runDiagnostics = async () => {
    setDiagnosticStatus('testing');
    addLog("INITIATING_CORE_HANDSHAKE...");
    
    const result = await verifyProtocols();
    
    if (result.success) {
      setDiagnosticStatus('success');
      addLog("LINK_ESTABLISHED: PROTOCOL_STABLE");
      setSystemError(null);
    } else {
      setDiagnosticStatus('fail');
      addLog(`LINK_FAILURE: ${result.error}`);
      if (result.error === "ENVIRONMENT_KEY_MISSING") {
        setSystemError(isVercel ? "VERCEL_ENV_MISSING" : "AUTH_KEY_SYNC_REQUIRED");
      }
    }
    
    setTimeout(() => setDiagnosticStatus('idle'), 5000);
  };

  const cleanupSession = () => {
    setIsLiveActive(false);
    setIsSpeaking(false);
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    scriptProcessorRef.current?.disconnect();
    inputSourceRef.current?.disconnect();
    sessionRef.current?.close();
    sessionRef.current = null;
  };

  const initLiveSession = async () => {
    if (isLiveActive) {
      cleanupSession();
      return;
    }

    setSystemError(null);

    if (!isVercel && (window as any).aistudio?.hasSelectedApiKey) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setSystemError("AUTH_KEY_SYNC_REQUIRED");
        await (window as any).aistudio.openSelectKey();
        return; 
      }
    }

    try {
      const ai = getGeminiClient();
      
      if (!audioContextOutRef.current) audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (!audioContextInRef.current) audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            inputSourceRef.current = source;
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBase64 = encodeBase64(new Uint8Array(int16.buffer));
              sessionPromise.then(session => {
                if (session && isLiveActive) session.sendRealtimeInput({ media: { data: pcmBase64, mimeType: 'audio/pcm' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const ctx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
            if (message.serverContent?.outputTranscription) {
              setCurrentTranscription(prev => prev + message.serverContent!.outputTranscription!.text);
            }
            if (message.serverContent?.turnComplete) {
              if (currentTranscription) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.JARVIS, content: currentTranscription, timestamp: new Date() }]);
                setCurrentTranscription('');
              }
            }
          },
          onclose: () => cleanupSession(),
          onerror: (e: any) => {
            console.error("Link Error:", e);
            setSystemError(e?.message?.includes("API_KEY") ? "AUTH_PROTOCOL_DENIED" : "LINK_FAILURE");
            cleanupSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are JARVIS. Address me as Sir. Concisely assist. Indian accent.`,
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Link Failure:", err);
      setSystemError("SYNC_ERROR");
      cleanupSession();
    }
  };

  const handleUnlock = async (profile: string) => {
    setCurrentUser(profile);
    setIsUnlocked(true);
    const greeting = `Welcome back, Sir. All systems initialized. Deployment node: ${isVercel ? 'VERCEL' : 'LOCAL'}.`;
    setMessages([{ id: 'init-01', role: MessageRole.JARVIS, content: greeting, timestamp: new Date() }]);
    try {
      const audio = await generateJarvisSpeech(greeting);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decodeBase64(audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {}
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#050201] text-amber-50">
      <header className="relative z-20 glass-dark border-b border-amber-500/10 px-6 sm:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 border-2 border-amber-500/40 rounded flex items-center justify-center font-orbitron font-black text-xl text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]">J</div>
          <div className="flex flex-col">
            <h1 className="font-orbitron font-black tracking-[0.4em] text-xl sm:text-2xl text-amber-50">JARVIS</h1>
            <div className="flex items-center gap-2">
               <span className="text-[7px] font-orbitron text-amber-500/40 tracking-[0.4em] uppercase">LINK_MARK_XLV_ONLINE</span>
               <span className="w-1 h-1 bg-amber-500/20 rounded-full"></span>
               <span className="text-[7px] font-orbitron text-amber-600/60 tracking-[0.4em] uppercase">{isVercel ? 'VERCEL_CLOUD_STABLE' : 'STARK_INT_LOCAL'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          {systemError && (
            <span className="text-[8px] font-orbitron text-red-500 animate-pulse tracking-widest uppercase bg-red-500/10 px-3 py-1 border border-red-500/20 rounded-sm">
              {systemError}
            </span>
          )}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-lg border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 transition-all group"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </button>
          <button 
            onClick={initLiveSession}
            className={`flex items-center gap-3 px-6 sm:px-10 py-3 rounded-lg border transition-all font-orbitron text-[9px] tracking-widest ${isLiveActive ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'bg-black/60 border-amber-500/20 text-amber-900 hover:border-amber-500/60 hover:text-amber-500'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-amber-400 animate-pulse' : 'bg-amber-950'}`}></span>
            {isLiveActive ? 'LINK_ACTIVE' : 'INITIATE_LINK'}
          </button>
        </div>
      </header>

      {/* Settings Panel with Diagnostic Log */}
      <div className={`fixed inset-0 z-50 transition-all duration-500 ${isSettingsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}></div>
        <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md glass-dark border-l border-amber-500/20 p-8 transform transition-transform duration-500 ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center mb-12">
            <h2 className="font-orbitron text-xl tracking-[0.3em] text-amber-500 uppercase">System_Config</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="text-amber-900 hover:text-amber-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>

          <div className="space-y-12">
            <div className="space-y-6">
              <h3 className="text-[10px] font-orbitron tracking-widest text-amber-800 uppercase">Neural_Link_Protocol</h3>
              <div className="glass p-6 rounded-xl border-amber-500/10 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-500/60 uppercase">Handshake_Status</span>
                  <span className={`text-[10px] font-orbitron uppercase tracking-widest ${needsKeySync ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                    {needsKeySync ? 'UNAUTHORIZED' : 'STABLE'}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {!isVercel ? (
                    <button 
                      onClick={() => (window as any).aistudio.openSelectKey()}
                      className="w-full py-4 bg-amber-500 text-black font-orbitron text-[10px] tracking-widest uppercase rounded-lg hover:bg-amber-400 shadow-lg"
                    >
                      Sync AI Studio Key
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-amber-950/20 border border-amber-500/20 text-amber-500/60 font-orbitron text-[8px] tracking-[0.2em] text-center uppercase rounded-lg">
                      Key Managed by Vercel Node
                    </div>
                  )}
                  
                  <button 
                    onClick={runDiagnostics}
                    disabled={diagnosticStatus === 'testing'}
                    className={`w-full py-4 border font-orbitron text-[10px] tracking-widest uppercase rounded-lg transition-all ${diagnosticStatus === 'testing' ? 'opacity-50 border-blue-500 text-blue-400' : diagnosticStatus === 'success' ? 'border-green-500 text-green-500' : diagnosticStatus === 'fail' ? 'border-red-500 text-red-500' : 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'}`}
                  >
                    {diagnosticStatus === 'testing' ? 'Pinging Core...' : 'Run Diagnostics'}
                  </button>
                </div>

                <div className="bg-black/40 p-3 rounded border border-white/5 space-y-2 min-h-[100px]">
                  <p className="text-[8px] font-orbitron text-amber-800 uppercase mb-2">Diagnostic_Log:</p>
                  {diagnosticLog.length === 0 ? (
                    <p className="text-[7px] font-mono text-amber-900 italic">No telemetry data...</p>
                  ) : (
                    diagnosticLog.map((log, i) => (
                      <p key={i} className="text-[7px] font-mono text-amber-500/80 uppercase tracking-tighter">[{new Date().toLocaleTimeString()}]{log}</p>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-[10px] font-orbitron tracking-widest text-amber-800 uppercase">Tactical_Telemetry</h3>
               <div className="grid grid-cols-2 gap-4">
                  <TelemetryCard label="Latency" value="18ms" />
                  <TelemetryCard label="Packet_Loss" value="0.0%" />
                  <TelemetryCard label="Security_Tier" value={isVercel ? 'DEPLOYED' : 'LOCAL'} />
                  <TelemetryCard label="Engine" value="GEMINI_3" />
               </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden relative">
        <aside className="hidden xl:block p-8 border-r border-white/5 glass-dark z-20 w-96 overflow-y-auto">
          <DashboardWidgets layout="sidebar" />
        </aside>
        
        {/* Tactical Overlay Grids */}
        <div className="absolute top-20 left-4 text-[7px] font-mono text-amber-600/40 opacity-50 z-0 pointer-events-none uppercase">
          LAT_37.7749 / LON_-122.4194 <br/> ALT_42.0m <br/> SPD_0.0km/h
        </div>
        <div className="absolute bottom-20 right-4 text-[7px] font-mono text-amber-600/40 opacity-50 z-0 pointer-events-none uppercase text-right">
          SYS_LOAD_4.2% <br/> ARC_PWR_98% <br/> TEMP_32C
        </div>

        <section className="flex-1 flex flex-col relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none scale-150">
            <JarvisCore isProcessing={isLiveActive} isSpeaking={isSpeaking} />
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-20 py-10 space-y-10 z-10 scroll-smooth">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div className={`flex items-center gap-3 mb-2 ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-[8px] font-orbitron tracking-widest uppercase ${msg.role === MessageRole.USER ? 'text-amber-800' : 'text-amber-500 font-bold'}`}>{msg.role === MessageRole.USER ? 'Auth_User' : 'Jarvis_Link'}</span>
                  </div>
                  <div className={`glass p-6 sm:p-8 rounded-xl border-l-2 ${msg.role === MessageRole.USER ? 'border-amber-900/50 bg-amber-950/10' : 'border-amber-500 bg-black/60 shadow-[0_0_30px_rgba(245,158,11,0.05)]'}`}>
                    <p className="text-base sm:text-lg font-light leading-relaxed text-amber-50/90">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {currentTranscription && (
              <div className="flex justify-start">
                <div className="max-w-[80%] glass p-6 rounded-xl border border-amber-500/20 bg-amber-950/10">
                  <p className="text-sm italic text-amber-300/60 tracking-wider">Listening: {currentTranscription}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="px-6 sm:px-20 py-10 glass-dark border-t border-amber-500/10 flex flex-col items-center gap-6 z-20">
            {needsKeySync && (
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => isVercel ? null : (window as any).aistudio.openSelectKey()} className={`text-[9px] font-orbitron uppercase tracking-[0.3em] transition-colors ${isVercel ? 'text-red-500/50' : 'text-amber-500/50 hover:text-amber-500 animate-pulse'}`}>
                  {isVercel ? 'Security_Alert: Check Vercel Env Variables' : 'Link_Required: Click to Sync Key'}
                </button>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4 cursor-pointer group" onClick={initLiveSession}>
              {isLiveActive ? (
                 <div className="flex items-center gap-10 w-full max-w-4xl">
                   <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center transition-all ${isSpeaking ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-white/10'}`}>
                     <svg className={`w-10 h-10 ${isSpeaking ? 'text-amber-400' : 'text-amber-950'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                   </div>
                   <div className="flex-1 flex gap-1.5 items-center justify-center h-12 overflow-hidden">
                     {[...Array(40)].map((_, i) => <div key={i} className={`w-1 transition-all rounded-full ${isSpeaking ? 'bg-amber-400' : 'bg-amber-950'}`} style={{ height: isSpeaking ? `${30 + Math.random() * 70}%` : '4px' }}></div>)}
                   </div>
                 </div>
              ) : (
                <>
                  <div className="flex gap-1.5">{[...Array(5)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-amber-500/20 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}</div>
                  <p className="font-orbitron text-[10px] text-amber-500/30 tracking-[0.5em] uppercase group-hover:text-amber-500 transition-colors">Establish_Protocol_Link</p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const TelemetryCard: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="glass p-4 rounded-lg border-amber-500/5">
    <span className="text-[8px] font-mono text-amber-900 block mb-1 uppercase tracking-widest">{label}</span>
    <span className="text-xs font-orbitron text-amber-50">{value}</span>
  </div>
);

export default App;
