
import React, { useState, useRef, useEffect } from 'react';
import { JarvisCore } from './components/JarvisCore';
import { DashboardWidgets } from './components/DashboardWidgets';
import { LoginScreen } from './components/LoginScreen';
import { OpticalUplink } from './components/OpticalUplink';
import { Message, MessageRole, Task, MemoryEntry, NeuralCoreType } from './types';
import { sounds } from './services/soundService';
import { 
  getGeminiClient, 
  decodeBase64, 
  encodeBase64, 
  decodeAudioData, 
  generateJarvisSpeech, 
  generateGroundedResponse,
  generateVisualization,
  extractFacts,
  analyzeEnvironment
} from './services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const SESSION_TIMEOUT_SECONDS = 600; 

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [protocol, setProtocol] = useState<'classic' | 'stealth' | 'alert'>('classic');
  const [neuralCore, setNeuralCore] = useState<NeuralCoreType>('gemini-3-flash-preview');
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isOpticalActive, setIsOpticalActive] = useState(false);
  
  const [latency, setLatency] = useState(85);
  const [tokenVelocity, setTokenVelocity] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [textInput, setTextInput] = useState('');
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_TIMEOUT_SECONDS);

  const audioContextOutRef = useRef<AudioContext | null>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!isUnlocked) return;

    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        inputRef.current?.focus();
        addDiagnostic("INPUT_FIELD_FOCUSED");
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        initLiveSession();
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        toggleDefenceProtocol();
      }
      if (e.key === 'Escape') {
        if (isLiveActive) cleanupSession();
        if (isOpticalActive) setIsOpticalActive(false);
        addDiagnostic("ALL_LINKS_TERMINATED");
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [isUnlocked, isLiveActive, isOpticalActive, protocol]);

  useEffect(() => {
    document.body.className = `theme-${protocol}`;
    addDiagnostic(`PROTOCOL_SYNC: ${protocol.toUpperCase()}`);
    if (protocol === 'alert') {
      sounds.playPowerUp();
      addDiagnostic("DEFENCE_PROTOCOL_ENGAGED");
    } else if (protocol === 'classic') {
      addDiagnostic("DEFENCE_PROTOCOL_ABORTED");
    }
  }, [protocol]);

  useEffect(() => {
    if (!isUnlocked) return;
    const interval = setInterval(() => {
      setLatency(prev => Math.max(15, Math.min(300, prev + (Math.random() * 20 - 10))));
      setTokenVelocity(isProcessing ? Math.floor(Math.random() * 120 + 60) : 0);
    }, 2000);
    return () => clearInterval(interval);
  }, [isUnlocked, isProcessing]);

  useEffect(() => {
    if (!isUnlocked) return;
    const resetTimer = () => setSecondsRemaining(SESSION_TIMEOUT_SECONDS);
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    const countdown = setInterval(() => {
      setSecondsRemaining(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearInterval(countdown);
    };
  }, [isUnlocked]);

  useEffect(() => {
    const saved = localStorage.getItem('jarvis_vault');
    if (saved) {
      const { t, m, mem } = JSON.parse(saved);
      setTasks(t); setMessages(m.map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) }))); setMemories(mem);
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => setUserLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jarvis_vault', JSON.stringify({ t: tasks, m: messages, mem: memories }));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [tasks, messages, memories]);

  const addDiagnostic = (msg: string) => {
    setDiagnosticLogs(prev => [msg, ...prev].slice(0, 20));
    sounds.playUiTick();
  };

  const toggleDefenceProtocol = () => {
    if (protocol === 'alert') {
      setProtocol('classic');
      addDiagnostic("DEFENCE_DEACTIVATED");
    } else {
      setProtocol('alert');
      addDiagnostic("DEFENCE_ACTIVATED");
    }
    sounds.playAuthSuccess();
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    const input = textInput; setTextInput(''); setIsProcessing(true);
    addDiagnostic("PACKET_TX_INIT...");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.USER, content: input, timestamp: new Date() }]);

    try {
      const context = memories.map(m => m.fact).join(". ");
      const result = await generateGroundedResponse(input, context, neuralCore, userLocation || undefined);
      const botMsg: Message = { id: Date.now().toString(), role: MessageRole.JARVIS, content: result.text, groundingLinks: result.links, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
      await speakResponse(botMsg.content);
      runNeuralSync(input + " " + result.text);
    } catch (err) {
      sounds.playError();
      addDiagnostic("NEURAL_SYNC_FAILED");
    } finally { setIsProcessing(false); }
  };

  const handleOpticalCapture = async (base64: string) => {
    setIsOpticalActive(false);
    setIsProcessing(true);
    addDiagnostic("ENVIRONMENT_ANALYSIS_INIT...");
    try {
      const analysis = await analyzeEnvironment(base64, "Describe the environment and identify any tactical features.", neuralCore);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.JARVIS, content: analysis, timestamp: new Date() }]);
      await speakResponse(analysis);
    } catch (e) { addDiagnostic("OPTICAL_ANALYSIS_FAILED"); }
    finally { setIsProcessing(false); }
  };

  const runNeuralSync = async (interaction: string) => {
    const newFacts = await extractFacts(interaction, neuralCore);
    if (newFacts.length > 0) {
      setMemories(prev => {
        const updated = [...prev];
        newFacts.forEach(fact => {
          if (!updated.some(m => m.fact.toLowerCase() === fact.toLowerCase())) {
            updated.unshift({ id: Math.random().toString(36).substr(2, 9), fact, timestamp: new Date(), importance: 1 });
          }
        });
        return updated.slice(0, 50);
      });
      addDiagnostic("SYNAPTIC_VAULT_UPDATED");
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      const audio = await generateJarvisSpeech(text);
      const ctx = audioContextOutRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextOutRef.current = ctx;
      const buffer = await decodeAudioData(decodeBase64(audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer; source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) { setIsSpeaking(false); }
  };

  const initLiveSession = async () => {
    if (isLiveActive) { cleanupSession(); return; }
    try {
      addDiagnostic("INITIATING_NEURAL_UPLINK...");
      const ai = getGeminiClient();
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true); sounds.playPowerUp();
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            inputSourceRef.current = source; scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(session => { if (session && isLiveActive) session.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm' } }); });
            };
            source.connect(scriptProcessor); scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const audio = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decodeBase64(audio), audioContextOutRef.current!, 24000, 1);
              const source = audioContextOutRef.current! .createBufferSource();
              source.buffer = buffer; source.connect(audioContextOutRef.current!.destination);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (m.serverContent?.outputTranscription) setCurrentTranscription(prev => prev + m.serverContent!.outputTranscription!.text);
            if (m.serverContent?.turnComplete) {
              if (currentTranscription) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.JARVIS, content: currentTranscription, timestamp: new Date() }]);
                runNeuralSync(currentTranscription); setCurrentTranscription('');
              }
            }
          },
          onclose: () => cleanupSession(), onerror: () => cleanupSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are JARVIS. Address me as Sir. Neural Vault: ${memories.map(m=>m.fact).join(". ")}`,
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { cleanupSession(); }
  };

  const cleanupSession = () => {
    setIsLiveActive(false); setIsSpeaking(false);
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear(); nextStartTimeRef.current = 0;
    scriptProcessorRef.current?.disconnect(); inputSourceRef.current?.disconnect();
    sessionRef.current?.close(); sessionRef.current = null;
    addDiagnostic("VOICE_LINK_TERMINATED");
  };

  const handleUnlock = async (profile: string) => {
    setIsUnlocked(true); sounds.playAmbientHum();
    setIsProcessing(true);
    try {
      const greeting = `Handshake complete. Terminal v2.6 online. Shall we begin, Sir?`;
      setMessages([{ id: 'init', role: MessageRole.JARVIS, content: greeting, timestamp: new Date() }]);
      await speakResponse(greeting);
    } finally { setIsProcessing(false); }
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className="relative h-screen flex flex-col bg-[#050201] text-amber-50">
      <OpticalUplink isActive={isOpticalActive} onCapture={handleOpticalCapture} />
      
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
         <JarvisCore isProcessing={isLiveActive || isProcessing} isSpeaking={isSpeaking} />
      </div>

      <header className="relative z-30 glass-dark border-b border-[rgba(var(--accent),0.1)] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 border-2 accent-border rounded-xl flex items-center justify-center font-orbitron font-black text-2xl accent-text bg-[rgba(var(--accent),0.1)] shadow-[0_0_25px_rgba(var(--accent),0.3)]">J</div>
             <div className="flex flex-col">
                <h1 className="font-orbitron font-black tracking-[0.4em] text-xl accent-text uppercase leading-none">JARVIS_v2.6</h1>
                <span className="text-[8px] font-orbitron opacity-40 tracking-[0.3em] uppercase mt-1">ORBITAL_ENVIRONMENT_LINK</span>
             </div>
          </div>
          <div className="hidden lg:flex gap-3">
             {(['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'] as NeuralCoreType[]).map(c => (
               <button key={c} onClick={() => setNeuralCore(c)} className={`px-4 py-2 rounded-xl font-orbitron text-[9px] tracking-widest uppercase transition-all ${neuralCore === c ? 'accent-bg text-black font-bold scale-105' : 'text-amber-500/20 hover:text-amber-500/50'}`}>
                 {c.includes('pro') ? 'PRO' : c.includes('lite') ? 'LPU' : 'FLSH'}
               </button>
             ))}
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden xl:flex gap-8">
             <div className="flex flex-col items-end"><span className="text-[7px] font-orbitron opacity-30 uppercase">LATENCY</span><span className="text-sm font-mono accent-text font-bold">{latency.toFixed(0)}ms</span></div>
             <div className="flex flex-col items-end"><span className="text-[7px] font-orbitron opacity-30 uppercase">THREAT</span><span className={`text-sm font-mono font-bold ${protocol === 'alert' ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>{protocol === 'alert' ? 'OMEGA' : 'NULL'}</span></div>
          </div>
          <button onClick={() => setIsOpticalActive(true)} className="px-6 py-3 border border-[rgba(var(--accent),0.4)] rounded-xl font-orbitron text-[10px] tracking-widest text-amber-500/60 hover:accent-text hover:accent-border transition-all">OPTICAL_LINK</button>
          <button onClick={initLiveSession} title="Shortcut: Ctrl+L" className={`px-10 py-3 rounded-xl border font-orbitron text-[10px] tracking-widest transition-all ${isLiveActive ? 'bg-[rgba(var(--accent),0.2)] accent-border accent-text font-bold' : 'bg-black/60 border-[rgba(var(--accent),0.3)] text-amber-900'}`}>{isLiveActive ? 'KILL_VOICE' : 'INIT_VOICE'}</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        <aside className="hidden xl:flex flex-col w-80 border-r border-[rgba(var(--accent),0.1)] glass-dark p-6 space-y-6">
           <span className="text-[8px] font-orbitron accent-text tracking-[0.4em] mb-4 uppercase opacity-50">DIAGNOSTIC_UPLINK</span>
           <div className="flex-1 space-y-2 overflow-hidden">
              {diagnosticLogs.map((log, i) => (
                <div key={i} className="text-[10px] font-mono accent-text tracking-tighter opacity-40 hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">
                  <span className="text-amber-900/60 mr-2">[{new Date().toLocaleTimeString('en-GB', {hour12: false})}]</span>
                  {log}
                </div>
              ))}
           </div>
           
           <div className="pt-6 border-t border-[rgba(var(--accent),0.1)]">
              <span className="text-[8px] font-orbitron accent-text tracking-[0.4em] mb-4 uppercase opacity-50">KEYBOARD_NODES</span>
              <div className="space-y-2">
                 <div className="flex justify-between text-[9px] font-mono opacity-40 italic"><span>Ctrl+L</span><span>LIVE_TOGGLE</span></div>
                 <div className="flex justify-between text-[9px] font-mono opacity-40 italic"><span>Ctrl+I</span><span>FOCUS_INPUT</span></div>
                 <div className="flex justify-between text-[9px] font-mono opacity-40 italic"><span>Ctrl+D</span><span>DEFENCE_TOGGLE</span></div>
                 <div className="flex justify-between text-[9px] font-mono opacity-40 italic"><span>Esc</span><span>KILL_ALL</span></div>
              </div>
           </div>
        </aside>

        <section className="flex-1 flex flex-col relative w-full overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-12 xl:px-40 py-12 space-y-12 scroll-smooth custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-scan-entry`}>
                <div className="max-w-[90%] sm:max-w-[80%] xl:max-w-[75%] group">
                  <div className={`glass p-8 rounded-3xl border-t-2 shadow-2xl transition-all ${msg.role === MessageRole.USER ? 'border-amber-900/20 bg-amber-950/5' : 'accent-border bg-black/90'}`}>
                    <div className="flex items-center gap-3 mb-6 opacity-30"><span className="text-[9px] font-orbitron tracking-[0.4em] uppercase">{msg.role === MessageRole.USER ? 'USER' : 'JARVIS'}</span><div className="h-[1px] flex-1 bg-[rgba(var(--accent),0.15)]"></div></div>
                    <p className="text-sm sm:text-[16px] font-light text-amber-50/90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-[rgba(var(--accent),0.1)] flex flex-wrap gap-4">
                        {msg.groundingLinks.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-[rgba(var(--accent),0.05)] border border-[rgba(var(--accent),0.2)] rounded-2xl text-[10px] font-mono accent-text hover:bg-[rgba(var(--accent),0.2)] transition-all">SOURCE::{link.title.toUpperCase()}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(isProcessing || currentTranscription) && (
               <div className="flex justify-start">
                  <div className="glass p-10 rounded-3xl border-l-4 accent-border bg-black/80 animate-pulse">
                     <span className="font-orbitron text-[11px] tracking-[0.6em] accent-text opacity-80 uppercase">{currentTranscription ? 'NEURAL_VOICE_LINK...' : 'SYNAPTIC_PROCESSING...'}</span>
                     {currentTranscription && <p className="mt-6 text-amber-100/60 font-mono text-xs italic">"{currentTranscription}"</p>}
                  </div>
               </div>
            )}
          </div>

          <div className="px-6 sm:px-12 xl:px-40 py-10 glass-dark border-t border-[rgba(var(--accent),0.15)] shadow-[0_-25px_100px_rgba(0,0,0,0.8)]">
            <form onSubmit={handleTextSubmit} className="relative max-w-6xl mx-auto w-full group">
              <input 
                ref={inputRef}
                type="text" 
                value={textInput} 
                onChange={(e) => setTextInput(e.target.value)} 
                placeholder="STRATEGIC_INPUT (Ctrl+I)..." 
                className="w-full bg-black/60 border border-[rgba(var(--accent),0.2)] rounded-3xl px-12 py-8 font-orbitron text-xs tracking-[0.6em] accent-text focus:outline-none focus:accent-border focus:bg-black/90 transition-all shadow-2xl placeholder:accent-text placeholder:opacity-10" 
              />
              <button type="submit" className={`absolute right-12 top-1/2 -translate-y-1/2 accent-text scale-125 transition-all ${textInput ? 'opacity-100' : 'opacity-10 pointer-events-none'}`}>
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </form>
          </div>
        </section>

        <aside className="hidden 2xl:flex flex-col w-96 border-l border-[rgba(var(--accent),0.1)] glass-dark p-8 space-y-8 overflow-y-auto custom-scrollbar">
           <DashboardWidgets 
             tasks={tasks} 
             memories={memories} 
             userLocation={userLocation} 
             isDefenceActive={protocol === 'alert'}
             onToggleDefence={toggleDefenceProtocol}
           />
           
           <span className="text-[10px] font-orbitron accent-text tracking-[0.4em] uppercase font-bold">NEURAL_SYNAPSE_MAP</span>
           <div className="relative flex-1 min-h-[300px] bg-[rgba(var(--accent),0.02)] border border-[rgba(var(--accent),0.1)] rounded-2xl overflow-hidden p-6 space-y-4">
              {memories.map((m, i) => (
                <div key={m.id} className="p-4 bg-[rgba(var(--accent),0.03)] border border-[rgba(var(--accent),0.1)] rounded-xl animate-scan-entry hover:bg-[rgba(var(--accent),0.1)] transition-all">
                  <div className="flex items-center gap-2 opacity-30 text-[7px] font-mono mb-1"><span>NODE_0x{i.toString(16).toUpperCase()}</span></div>
                  <p className="text-[10px] font-mono uppercase opacity-70">{m.fact}</p>
                </div>
              ))}
           </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
