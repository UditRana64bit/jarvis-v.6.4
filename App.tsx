
import React, { useState, useRef, useEffect } from 'react';
import { JarvisCore } from './components/JarvisCore';
import { DashboardWidgets } from './components/DashboardWidgets';
import { LoginScreen } from './components/LoginScreen';
import { Message, MessageRole } from './types';
import { sounds } from './services/soundService';
import { 
  getGeminiClient, 
  decodeBase64, 
  encodeBase64, 
  decodeAudioData, 
  generateJarvisSpeech, 
  verifyProtocols,
  generateGroundedResponse,
  generateVisualization
} from './services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [textInput, setTextInput] = useState('');
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
        const envKey = process.env.API_KEY;
        setNeedsKeySync(!envKey);
        if (!envKey) setSystemError("KEY_MISSING");
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
  }, [messages, currentTranscription, isProcessing]);

  const addLog = (msg: string) => {
    setDiagnosticLog(prev => [msg, ...prev].slice(0, 10));
    sounds.playUiTick();
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;

    sounds.playUiTick();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: textInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    const input = textInput;
    setTextInput('');
    setIsProcessing(true);
    addLog(`Neural_Input: ${input.substring(0, 20)}...`);

    try {
      if (input.toLowerCase().includes('visualize') || input.toLowerCase().includes('render') || input.toLowerCase().includes('show me')) {
        addLog("INITIATING_VISUAL_RENDER...");
        const imageUrl = await generateVisualization(input);
        if (imageUrl) {
          sounds.playNotification();
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: MessageRole.JARVIS,
            content: "Tactical render complete, Sir. Displaying blueprint overlay.",
            imageUrl,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
          await speakResponse(botMessage.content);
        }
      } else {
        addLog("QUERYING_GLOBAL_DATABASE...");
        const result = await generateGroundedResponse(input);
        sounds.playNotification();
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: MessageRole.JARVIS,
          content: result.text,
          groundingLinks: result.links,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        await speakResponse(botMessage.content);
      }
    } catch (err: any) {
      console.error(err);
      sounds.playError();
      setSystemError(err?.message || "RESPONSE_FAILURE");
      addLog(`ERR: ${err?.message || "RESPONSE_FAILURE"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      const audio = await generateJarvisSpeech(text);
      const ctx = audioContextOutRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (!audioContextOutRef.current) audioContextOutRef.current = ctx;
      
      const buffer = await decodeAudioData(decodeBase64(audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) {
      setIsSpeaking(false);
      console.warn("Neural Speech failure:", e);
      addLog("NEURAL_VOICE_SYNC_FAIL");
      sounds.playError();
    }
  };

  const runDiagnostics = async () => {
    setDiagnosticStatus('testing');
    addLog("INITIATING_CORE_HANDSHAKE...");
    sounds.playScanHum(1.5);
    const result = await verifyProtocols();
    if (result.success) {
      setDiagnosticStatus('success');
      sounds.playAuthSuccess();
      addLog("LINK_ESTABLISHED: PROTOCOL_STABLE");
      setSystemError(null);
    } else {
      setDiagnosticStatus('fail');
      sounds.playError();
      addLog(`ERR: ${result.error}`);
    }
    setTimeout(() => setDiagnosticStatus('idle'), 5000);
  };

  const cleanupSession = () => {
    setIsLiveActive(false);
    setIsSpeaking(false);
    sounds.playUiTick();
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
    addLog("SYNCHRONIZING_VOICE_LINK...");
    sounds.playScanHum(1.0);
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
            sounds.playPowerUp();
            addLog("VOICE_LINK_ESTABLISHED");
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
                sounds.playNotification();
              }
            }
          },
          onclose: () => cleanupSession(),
          onerror: (e: any) => {
            console.error("Link Error:", e);
            sounds.playError();
            setSystemError("LINK_FAILURE");
            cleanupSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are JARVIS. Address me as Sir. Use a natural conversational speed. Be professional and efficient.`,
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      sounds.playError();
      setSystemError("SYNC_ERROR");
      cleanupSession();
    }
  };

  const handleUnlock = async (profile: string) => {
    setCurrentUser(profile);
    setIsUnlocked(true);
    const greeting = `Protocols established. Welcome back, Sir. All systems functioning within normal parameters. Ready for your command.`;
    setMessages([{ id: 'init-01', role: MessageRole.JARVIS, content: greeting, timestamp: new Date() }]);
    await speakResponse(greeting);
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className={`relative h-screen flex flex-col overflow-hidden bg-[#050201] text-amber-50 transition-all duration-500 ${isSpeaking ? 'brightness-[1.1]' : ''}`}>
      {/* Background Pulse when speaking */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 ${isSpeaking ? 'opacity-20' : 'opacity-0'}`}>
         <div className="absolute inset-0 bg-amber-500 animate-pulse-fast"></div>
      </div>

      <header className="relative z-20 glass-dark border-b border-amber-500/10 px-6 sm:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 border-2 border-amber-500/40 rounded flex items-center justify-center font-orbitron font-black text-xl text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]">J</div>
          <div className="flex flex-col">
            <h1 className="font-orbitron font-black tracking-[0.4em] text-xl sm:text-2xl text-amber-50">JARVIS</h1>
            <div className="flex items-center gap-2">
               <span className="text-[7px] font-orbitron text-amber-500/40 tracking-[0.4em] uppercase">SYSTEM_ONLINE</span>
               <span className="w-1 h-1 bg-amber-500/20 rounded-full"></span>
               <span className="text-[7px] font-orbitron text-amber-600/60 tracking-[0.4em] uppercase">{isVercel ? 'CLOUD_SECURE' : 'LOCAL_HOST'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          {isProcessing && <span className="text-[8px] font-orbitron text-amber-400 animate-pulse tracking-[0.2em] uppercase">Neural_Processing...</span>}
          <button onClick={() => { setIsSettingsOpen(true); sounds.playUiTick(); }} className="p-2.5 rounded-lg border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 transition-all group">
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </button>
          <button onClick={initLiveSession} className={`flex items-center gap-3 px-6 sm:px-10 py-3 rounded-lg border transition-all font-orbitron text-[9px] tracking-widest ${isLiveActive ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'bg-black/60 border-amber-500/20 text-amber-900 hover:border-amber-500/60 hover:text-amber-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-amber-400 animate-pulse' : 'bg-amber-950'}`}></span>
            {isLiveActive ? 'VOICE_LINK_ACTIVE' : 'INITIATE_VOICE'}
          </button>
        </div>
      </header>

<<<<<<< HEAD
=======
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

>>>>>>> b021bf0045df91920952f655e99464a1974300d8
      <main className="flex-1 flex overflow-hidden relative">
        <aside className="hidden xl:block p-8 border-r border-white/5 glass-dark z-20 w-96 overflow-y-auto">
          <DashboardWidgets layout="sidebar" />
        </aside>
        
        <section className="flex-1 flex flex-col relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none scale-125">
            <JarvisCore isProcessing={isLiveActive || isProcessing} isSpeaking={isSpeaking} />
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-20 py-10 space-y-10 z-10 scroll-smooth">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div className={`flex items-center gap-3 mb-2 ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-[8px] font-orbitron tracking-[0.4em] uppercase ${msg.role === MessageRole.USER ? 'text-amber-900' : 'text-amber-500 font-black'}`}>
                      {msg.role === MessageRole.USER ? 'USER_TOKEN' : 'JARVIS_CORE'}
                    </span>
                  </div>
                  <div className={`glass p-6 sm:p-8 rounded-2xl border-l-4 ${msg.role === MessageRole.USER ? 'border-amber-900/40 bg-amber-950/5' : 'border-amber-500 bg-black/60 shadow-[0_0_40px_rgba(245,158,11,0.08)]'}`}>
                    <p className="text-base sm:text-lg font-light leading-relaxed text-amber-50/90 whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.imageUrl && (
                      <div className="mt-8 relative group overflow-hidden rounded-2xl border border-amber-500/30">
                        <img src={msg.imageUrl} alt="Visualization" className="w-full h-auto opacity-90 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 scanline opacity-40 pointer-events-none"></div>
                        <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/80 text-[8px] font-orbitron text-amber-500/80 rounded border border-amber-500/20 uppercase tracking-[0.3em]">Neural_Render_MK_II</div>
                      </div>
                    )}

                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-amber-500/10 space-y-3">
                        <span className="text-[8px] font-orbitron text-amber-800 uppercase tracking-[0.5em] font-black">Data_Nodes:</span>
                        <div className="flex flex-wrap gap-4">
                          {msg.groundingLinks.map((link, i) => (
                            <a key={i} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-amber-400/70 hover:text-amber-400 flex items-center gap-2 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/10 transition-all hover:bg-amber-500/10 hover:border-amber-500/30">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              {link.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {currentTranscription && (
              <div className="flex justify-start">
                <div className="max-w-[80%] glass p-6 rounded-2xl border border-amber-500/30 bg-amber-950/10">
                  <p className="text-sm italic text-amber-300/50 tracking-widest font-mono">NEURAL_SYNCING: {currentTranscription}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="px-6 sm:px-20 py-8 glass-dark border-t border-amber-500/10 z-20">
            <form onSubmit={handleTextSubmit} className="relative max-w-4xl mx-auto w-full group">
              <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="INPUT NEURAL COMMAND..."
                className="w-full bg-black/50 border border-amber-500/20 rounded-2xl px-10 py-6 font-orbitron text-[10px] tracking-[0.4em] text-amber-400 placeholder:text-amber-900/40 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]"
                disabled={isProcessing}
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-6">
                 <button type="submit" className="p-2 text-amber-900 hover:text-amber-400 transition-all hover:scale-110">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                 </button>
                 <div className="h-8 w-[1px] bg-amber-500/10"></div>
                 <button type="button" onClick={initLiveSession} className={`p-2 transition-all ${isLiveActive ? 'text-amber-400 animate-pulse' : 'text-amber-950 hover:text-amber-500'}`}>
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                 </button>
              </div>
            </form>
            <p className="text-center mt-4 text-[7px] font-orbitron text-amber-900/60 tracking-[0.6em] uppercase">Tactical_Neural_Link_Active</p>
          </div>
        </section>
      </main>

      {/* Global Settings Panel */}
      <div className={`fixed inset-0 z-50 transition-all duration-700 ${isSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={() => { setIsSettingsOpen(false); sounds.playUiTick(); }}></div>
        <div className={`absolute right-0 top-0 bottom-0 w-full max-w-lg glass-dark border-l border-amber-500/20 p-10 transform transition-transform duration-700 ease-out ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center mb-16">
            <h2 className="font-orbitron text-2xl tracking-[0.4em] text-amber-500 uppercase font-black">SYSTEM_CFG</h2>
            <button onClick={() => { setIsSettingsOpen(false); sounds.playUiTick(); }} className="text-amber-950 hover:text-amber-500 transition-colors p-2"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
          <div className="space-y-10">
            <div className="glass p-8 rounded-3xl border-amber-500/20 shadow-2xl">
              <h3 className="text-[10px] font-orbitron tracking-[0.4em] text-amber-500/60 uppercase mb-6 font-black">NEURAL_DIAGNOSTICS</h3>
              <button onClick={runDiagnostics} className="w-full py-5 border border-amber-500/40 font-orbitron text-[10px] tracking-[0.5em] uppercase rounded-xl text-amber-400 hover:bg-amber-500/10 hover:border-amber-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.1)]">Execute_Core_Handshake</button>
              
              <div className="mt-8 bg-black/40 rounded-xl p-6 border border-amber-500/5">
                <h4 className="text-[8px] font-orbitron text-amber-900 uppercase mb-4 tracking-[0.3em]">Telemetry_Log</h4>
                <div className="space-y-2 h-40 overflow-y-auto font-mono">
                  {diagnosticLog.map((log, i) => (
                    <div key={i} className="text-[9px] text-amber-500/40 flex gap-3">
                      <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                      <span className="text-amber-500/70">> {log}</span>
                    </div>
                  ))}
                  {diagnosticLog.length === 0 && <div className="text-[9px] text-amber-900 italic">No telemetry data recorded.</div>}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-amber-500/10 pt-10">
               <p className="text-[8px] font-orbitron text-amber-900/40 leading-relaxed uppercase tracking-[0.2em]">
                 Unauthorized access to Stark Industries Neural Networks is strictly prohibited. Continuous monitoring active.
               </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.15; }
        }
        .animate-pulse-fast { animation: pulse-fast 0.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
