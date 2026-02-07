
import React, { useState, useRef, useEffect } from 'react';
import { JarvisCore } from './components/JarvisCore';
import { DashboardWidgets } from './components/DashboardWidgets';
import { LoginScreen } from './components/LoginScreen';
import { Message, MessageRole, Task, MemoryEntry } from './types';
import { sounds } from './services/soundService';
import { 
  getGeminiClient, 
  decodeBase64, 
  encodeBase64, 
  decodeAudioData, 
  generateJarvisSpeech, 
  generateGroundedResponse,
  generateVisualization,
  extractFacts
} from './services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [textInput, setTextInput] = useState('');
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTasks = localStorage.getItem('jarvis_tasks');
    const savedMessages = localStorage.getItem('jarvis_messages');
    const savedMemories = localStorage.getItem('jarvis_memories');

    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedMemories) setMemories(JSON.parse(savedMemories));
    if (savedMessages) {
      const parsed = JSON.parse(savedMessages);
      setMessages(parsed.slice(-20).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          addLog("LOC_SYNC_OK");
        },
        () => addLog("LOC_OFFLINE")
      );
    }
  }, []);

  useEffect(() => { localStorage.setItem('jarvis_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('jarvis_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('jarvis_memories', JSON.stringify(memories)); }, [memories]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentTranscription, isProcessing]);

  const addLog = (msg: string) => {
    setDiagnosticLog(prev => [msg, ...prev].slice(0, 10));
    sounds.playUiTick();
  };

  const handleExportMemory = () => {
    const data = { tasks, messages, memories, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stark_neural_dump_${new Date().getTime()}.json`;
    link.click();
    addLog("CORE_DUMP_EXPORTED");
    sounds.playAuthSuccess();
  };

  const runBackgroundNeuralSync = async (latestInteraction: string) => {
    const newFacts = await extractFacts(latestInteraction);
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
      addLog("DATABASE_SYNCED");
    }
  };

  const handleTaskCommand = (input: string): boolean => {
    const lowercase = input.toLowerCase();
    if (lowercase.includes('add task') || lowercase.includes('remind me to')) {
      const taskText = input.replace(/add task|remind me to|jarvis/gi, '').trim();
      if (taskText) {
        setTasks(prev => [{ id: Math.random().toString(36).substr(2, 9), text: taskText, completed: false, timestamp: new Date(), priority: 'MED' }, ...prev]);
        addLog(`TASK_LOGGED`);
        sounds.playNotification();
        return true;
      }
    }
    return false;
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    sounds.playUiTick();
    const userMessage: Message = { id: Date.now().toString(), role: MessageRole.USER, content: textInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const input = textInput;
    setTextInput('');
    setIsProcessing(true);
    addLog(`PROCESSING_QUERY...`);
    if (handleTaskCommand(input)) { setIsProcessing(false); return; }
    try {
      if (input.toLowerCase().includes('visualize')) {
        const imageUrl = await generateVisualization(input);
        if (imageUrl) {
          const botMessage: Message = { id: (Date.now()+1).toString(), role: MessageRole.JARVIS, content: "Neural render complete, Sir.", imageUrl, timestamp: new Date() };
          setMessages(prev => [...prev, botMessage]);
          await speakResponse(botMessage.content);
        }
      } else {
        const context = memories.map(m => m.fact).join(". ");
        const result = await generateGroundedResponse(input, context, userLocation || undefined);
        const botMessage: Message = { id: (Date.now()+1).toString(), role: MessageRole.JARVIS, content: result.text, groundingLinks: result.links, timestamp: new Date() };
        setMessages(prev => [...prev, botMessage]);
        await speakResponse(botMessage.content);
        runBackgroundNeuralSync(input + " " + result.text);
      }
    } catch (err: any) {
      sounds.playError();
      addLog("LINK_TIMEOUT");
    } finally { setIsProcessing(false); }
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
    } catch (e) { setIsSpeaking(false); }
  };

  const initLiveSession = async () => {
    if (isLiveActive) { cleanupSession(); return; }
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
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            inputSourceRef.current = source;
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBase64 = encodeBase64(new Uint8Array(int16.buffer));
              sessionPromise.then(session => { if (session && isLiveActive) session.sendRealtimeInput({ media: { data: pcmBase64, mimeType: 'audio/pcm' } }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const ctx = audioContextOutRef.current!;
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setCurrentTranscription(prev => prev + text);
              handleTaskCommand(text);
            }
            if (message.serverContent?.turnComplete) {
              if (currentTranscription) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.JARVIS, content: currentTranscription, timestamp: new Date() }]);
                runBackgroundNeuralSync(currentTranscription);
                setCurrentTranscription('');
              }
            }
          },
          onclose: () => cleanupSession(),
          onerror: () => cleanupSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are JARVIS. Address me as Sir. Neural memory: ${memories.map(m=>m.fact).join(". ")}`,
          outputAudioTranscription: {}
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { cleanupSession(); }
  };

  const cleanupSession = () => {
    setIsLiveActive(false); setIsSpeaking(false);
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    scriptProcessorRef.current?.disconnect();
    inputSourceRef.current?.disconnect();
    sessionRef.current?.close();
    sessionRef.current = null;
  };

  const handleUnlock = async (profile: string) => {
    setCurrentUser(profile);
    setIsUnlocked(true);
    addLog("WELCOME_BACK");
    const firstNameFact = memories.find(m => m.fact.toLowerCase().includes("name is"))?.fact.split("is").pop()?.trim();
    const name = firstNameFact || "Sir";
    setIsProcessing(true);
    try {
      const context = memories.map(m => m.fact).join(". ");
      const briefQuery = `Greetings for ${name}. Provide a concise environmental status brief: weather, traffic, and time. Reference our memory vault.`;
      const brief = await generateGroundedResponse(briefQuery, context, userLocation || undefined);
      const greetingMsg: Message = { id: 'greet', role: MessageRole.JARVIS, content: brief.text, groundingLinks: brief.links, timestamp: new Date() };
      setMessages(prev => [...prev, greetingMsg]);
      await speakResponse(brief.text);
    } catch (e) {
      const fallback = `Interface established. Welcome back, ${name}. Neural sync optimal.`;
      setMessages(prev => [...prev, { id: 'greet-fallback', role: MessageRole.JARVIS, content: fallback, timestamp: new Date() }]);
      await speakResponse(fallback);
    } finally { setIsProcessing(false); }
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#050201] text-amber-50">
      {/* Dynamic Background Visualization */}
      <div className="fixed inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0">
         <JarvisCore isProcessing={isLiveActive || isProcessing} isSpeaking={isSpeaking} />
      </div>

      <header className="relative z-30 glass-dark border-b border-amber-500/10 px-6 sm:px-12 py-4 flex items-center justify-between backdrop-blur-3xl">
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="xl:hidden p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
          </button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-amber-500/40 rounded flex items-center justify-center font-orbitron font-black text-lg sm:text-xl text-amber-400">J</div>
          <div className="flex flex-col">
            <h1 className="font-orbitron font-black tracking-[0.4em] text-lg sm:text-xl text-amber-50 uppercase">JARVIS</h1>
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${userLocation ? 'bg-green-500' : 'bg-amber-900'}`}></div>
               <span className="text-[7px] sm:text-[8px] font-orbitron text-amber-500/40 tracking-[0.3em] uppercase">{userLocation ? 'LOC_ACTIVE' : 'LOC_PENDING'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={initLiveSession} className={`px-5 sm:px-8 py-2 rounded-lg border font-orbitron text-[8px] sm:text-[9px] tracking-widest transition-all ${isLiveActive ? 'bg-amber-500/10 border-amber-400 text-amber-400 font-bold' : 'bg-black/60 border-amber-500/20 text-amber-900'}`}>
            {isLiveActive ? 'LINK_ACTIVE' : 'INIT_LINK'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        {/* Responsive Tactical Sidebar */}
        <aside className={`fixed xl:relative z-40 inset-y-0 left-0 w-80 sm:w-96 bg-[#050201] xl:bg-transparent border-r border-white/5 glass-dark xl:glass-none transform transition-transform duration-500 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'} overflow-y-auto custom-scrollbar p-6 sm:p-8`}>
          <div className="xl:hidden flex justify-end mb-4">
             <button onClick={() => setSidebarOpen(false)} className="text-amber-900 hover:text-amber-500 font-orbitron text-[10px] tracking-widest uppercase">CLOSE_HUD</button>
          </div>
          <DashboardWidgets 
            layout="sidebar" 
            tasks={tasks} 
            memories={memories}
            userLocation={userLocation}
            onToggleTask={(id) => setTasks(prev => prev.map(t=>t.id===id?{...t, completed: !t.completed}:t))}
            onClearTasks={() => setTasks(prev => prev.filter(t=>!t.completed))}
            onExportMemory={handleExportMemory}
          />
        </aside>
        
        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 xl:hidden"></div>}

        <section className="flex-1 flex flex-col relative w-full overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-12 xl:px-24 py-10 space-y-10 scroll-smooth custom-scrollbar">
            {messages.length === 0 && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 animate-pulse text-center space-y-4">
                <span className="font-orbitron text-[12px] tracking-[1em] uppercase">NEURAL_IDLE</span>
                <span className="font-mono text-[8px] tracking-[0.2em] uppercase max-w-xs leading-relaxed">System awaiting environmental data or neural command input...</span>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className="max-w-[92%] sm:max-w-[80%] xl:max-w-[70%] group">
                  <div className={`glass p-5 sm:p-8 rounded-2xl border-l-4 shadow-[0_15px_35px_rgba(0,0,0,0.4)] ${msg.role === MessageRole.USER ? 'border-amber-900/40 bg-amber-950/5' : 'border-amber-500 bg-black/60 backdrop-blur-2xl'}`}>
                    <p className="text-sm sm:text-base font-light text-amber-50/90 whitespace-pre-wrap leading-relaxed tracking-wide">{msg.content}</p>
                    {msg.imageUrl && <img src={msg.imageUrl} className="mt-8 rounded-xl border border-amber-500/20 shadow-2xl transition-transform hover:scale-[1.02]" />}
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-amber-500/10 space-y-4">
                        <span className="text-[8px] font-orbitron text-amber-500/40 tracking-[0.4em] uppercase block">INTELLIGENCE_VAULT</span>
                        <div className="flex flex-wrap gap-3">
                          {msg.groundingLinks.map((link, idx) => (
                            <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] font-mono text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-3">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {link.title.toUpperCase()}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(isProcessing || currentTranscription) && (
               <div className="flex justify-start animate-pulse">
                  <div className="glass p-6 rounded-2xl border-l-4 border-amber-500/20 bg-black/40">
                     <span className="font-orbitron text-[9px] tracking-[0.5em] text-amber-500/60 uppercase">{currentTranscription ? 'NEURAL_LINKING...' : 'PARSING_NODES...'}</span>
                     {currentTranscription && <p className="mt-2 text-amber-100/60 font-mono text-xs">{currentTranscription}</p>}
                  </div>
               </div>
            )}
          </div>

          <div className="px-4 sm:px-12 xl:px-24 py-6 sm:py-10 glass-dark border-t border-amber-500/10 backdrop-blur-3xl">
            <form onSubmit={handleTextSubmit} className="relative max-w-5xl mx-auto w-full group">
              <input 
                type="text" 
                value={textInput} 
                onChange={(e) => setTextInput(e.target.value)} 
                placeholder="COMMAND_INPUT_STRATEGY..." 
                className="w-full bg-black/60 border border-amber-500/20 rounded-2xl px-8 sm:px-10 py-4 sm:py-6 font-orbitron text-[10px] sm:text-xs tracking-[0.4em] text-amber-400 focus:outline-none focus:border-amber-500/60 transition-all shadow-2xl placeholder:text-amber-900/40" 
              />
              <button type="submit" className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 text-amber-900 hover:text-amber-500 transition-colors">
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </form>
          </div>
        </section>
      </main>
<<<<<<< HEAD
=======

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
                      <span className="text-amber-500/70"> {log}</span>
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

>>>>>>> e5d9f8d3c9eb8d4ce74f291e16b7b02a1e21fe48
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251, 191, 36, 0.2); }
      `}</style>
    </div>
  );
};

export default App;
