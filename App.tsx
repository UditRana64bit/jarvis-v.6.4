
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
  decodeAudioData, 
  generateJarvisSpeech, 
  generateGroundedResponse,
  extractFacts,
  analyzeEnvironment,
  generateSystemBriefing
} from './services/geminiService';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [protocol, setProtocol] = useState<'classic' | 'stealth' | 'alert'>('classic');
  const [neuralCore, setNeuralCore] = useState<NeuralCoreType>('gemini-3-flash-preview');
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isOpticalActive, setIsOpticalActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [showWidgets, setShowWidgets] = useState(false);

  const audioContextOutRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Battery monitoring
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.floor(battery.level * 100));
        battery.onlevelchange = () => setBatteryLevel(Math.floor(battery.level * 100));
      });
    }

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        err => console.warn("Location access denied")
      );
    }

    const saved = localStorage.getItem('jarvis_v3_vault');
    if (saved) {
      try {
        const { m, mem } = JSON.parse(saved);
        setMessages((m || []).map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) }))); 
        setMemories((mem || []).map((me: any) => ({ ...me, id: me.id || Math.random().toString(), timestamp: new Date(me.timestamp) })));
      } catch (e) { console.error("Vault rehydration failed"); }
    }

    return () => {
      sounds.stopAmbientHum();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('jarvis_v3_vault', JSON.stringify({ m: messages, mem: memories }));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, memories]);

  const addDiagnostic = (msg: string) => {
    setDiagnosticLogs(prev => [msg, ...prev].slice(0, 8));
    sounds.playUiTick();
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    const input = textInput; 
    setTextInput(''); 
    setIsProcessing(true);
    sounds.playNotification();
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.USER, content: input, timestamp: new Date() }]);

    try {
      const context = memories.map(m => m.fact).join(". ");
      const result = await generateGroundedResponse(input, context, neuralCore, userLocation || undefined);
      
      const botMsg: Message = { 
        id: Date.now().toString(), 
        role: MessageRole.JARVIS, 
        content: result.text, 
        timestamp: new Date(),
        groundingLinks: result.links 
      };
      setMessages(prev => [...prev, botMsg]);
      await speakResponse(botMsg.content);
      runNeuralSync(input + " | " + result.text);
    } catch (err: any) {
      addDiagnostic("SYNC_ERR");
      setMessages(prev => [...prev, { id: 'err', role: MessageRole.JARVIS, content: "Sir, connectivity issue detected.", timestamp: new Date() }]);
    } finally { setIsProcessing(false); }
  };

  const handleOpticalCapture = async (base64Image: string) => {
    setIsOpticalActive(false);
    setIsProcessing(true);
    addDiagnostic("OPTICAL_ANALYSIS");
    sounds.playNotification();

    try {
      const prompt = "Analyze this image and tell me what you see, Sir. Keep it brief in Hinglish.";
      const analysis = await analyzeEnvironment(base64Image, prompt, neuralCore);
      
      const botMsg: Message = { 
        id: Date.now().toString(), 
        role: MessageRole.JARVIS, 
        content: analysis, 
        timestamp: new Date(),
        imageUrl: `data:image/jpeg;base64,${base64Image}`
      };
      setMessages(prev => [...prev, botMsg]);
      await speakResponse(analysis);
      runNeuralSync("Optical Scan Analysis: " + analysis);
    } catch (err) {
      addDiagnostic("OPTICAL_ERR");
      setMessages(prev => [...prev, { id: 'err', role: MessageRole.JARVIS, content: "Sir, optical uplink unstable.", timestamp: new Date() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const runNeuralSync = async (interaction: string) => {
    const newFacts = await extractFacts(interaction, neuralCore);
    if (newFacts.length > 0) {
      setMemories(prev => {
        const uniqueNew = newFacts.filter(f => !prev.some(p => p.fact.toLowerCase().includes(f.toLowerCase().slice(0, 15))));
        if (uniqueNew.length === 0) return prev;
        addDiagnostic(`VAULT_UP: ${uniqueNew.length}`);
        return [...uniqueNew.map(f => ({ id: Math.random().toString(), fact: f, timestamp: new Date(), importance: 1 })), ...prev].slice(0, 20);
      });
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      const audio = await generateJarvisSpeech(text);
      if (!audio) { setIsSpeaking(false); return; }
      const ctx = audioContextOutRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextOutRef.current = ctx;
      const buffer = await decodeAudioData(decodeBase64(audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer; 
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) { setIsSpeaking(false); }
  };

  const handleUnlock = async (profile: string) => {
    setIsUnlocked(true);
    setIsProcessing(true);
    addDiagnostic("CORE_AWAKEN");
    sounds.playPowerUp();
    sounds.playAmbientHum(); // Start ambient experience
    
    try {
      const vaultCtx = memories.map(m => m.fact).join(", ");
      const briefing = await generateSystemBriefing(userLocation, batteryLevel, vaultCtx, neuralCore);
      setMessages([{ id: 'init', role: MessageRole.JARVIS, content: briefing, timestamp: new Date() }]);
      speakResponse(briefing);
    } catch (e) {
      const fallback = "System ready, Sir. Sab kuch stable hai.";
      setMessages([{ id: 'init', role: MessageRole.JARVIS, content: fallback, timestamp: new Date() }]);
      speakResponse(fallback);
    } finally {
      setIsProcessing(false);
      if (window.innerWidth >= 1024) setShowWidgets(true);
    }
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#030100] font-orbitron selection:bg-amber-500/30">
      <header className="absolute top-0 inset-x-0 z-[60] p-4 lg:p-10 pointer-events-none flex justify-between items-center">
        <div className="pointer-events-auto flex items-center gap-3 lg:gap-6">
          <div className="w-8 h-8 lg:w-16 lg:h-16 hud-glass rounded-xl flex items-center justify-center font-black text-sm lg:text-3xl accent-text shadow-2xl border-2 border-amber-500/20">J</div>
          <div className="hidden xs:block">
            <h1 className="font-black tracking-[0.4em] text-[10px] lg:text-xl accent-text uppercase drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">JARVIS</h1>
            <span className="text-[6px] lg:text-xs opacity-30 tracking-[0.2em] uppercase block font-bold">STARK::NEURAL_HUB</span>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2 lg:gap-4">
          <button onClick={() => setShowWidgets(!showWidgets)} className="lg:hidden hud-glass px-3 py-1.5 rounded-lg text-[8px] tracking-widest uppercase font-bold border-amber-500/10">HUD</button>
          <button onClick={() => setIsOpticalActive(true)} className="hud-glass px-3 py-1.5 lg:px-6 lg:py-3 rounded-lg lg:rounded-xl text-[8px] lg:text-sm tracking-[0.2em] uppercase font-black border-amber-500/10 hover:border-amber-500/50 transition-all">SCAN_ENV</button>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        {/* Left Sidebar - Responsive sized */}
        <aside className={`absolute left-0 top-0 bottom-0 z-50 w-full sm:w-64 lg:w-80 p-4 lg:p-8 transition-all duration-500 backdrop-blur-3xl lg:backdrop-blur-none bg-black/95 lg:bg-transparent ${showWidgets ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100'}`}>
           <div className="flex justify-between items-center mb-6 lg:mb-10 lg:hidden">
              <span className="text-sm tracking-widest accent-text uppercase font-black">CORE_SYSTEMS</span>
              <button onClick={() => setShowWidgets(false)} className="text-3xl text-white/40">&times;</button>
           </div>
           <div className="h-full flex flex-col justify-start">
             <DashboardWidgets isDefenceActive={protocol === 'alert'} onToggleDefence={() => setProtocol(p => p === 'alert' ? 'classic' : 'alert')} />
             <div className="mt-6 lg:mt-10 border-t border-white/5 pt-6">
               <span className="text-[6px] lg:text-xs opacity-30 tracking-widest block mb-3 font-black uppercase">Live_Neural_Uplink</span>
               <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                 {diagnosticLogs.map((log, i) => <div key={i} className="text-[7px] lg:text-sm font-mono opacity-40 truncate flex items-center gap-2">
                   <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                    {log}
                 </div>)}
               </div>
             </div>
           </div>
        </aside>

        {/* HUD Visualization Area */}
        <section className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-0">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="w-[200px] h-[200px] sm:w-[350px] sm:h-[350px] lg:w-[600px] lg:h-[600px] opacity-20 lg:opacity-30">
              <JarvisCore isProcessing={isProcessing} isSpeaking={isSpeaking} />
            </div>
          </div>
          
          <div ref={scrollRef} className="absolute inset-0 flex flex-col justify-end p-4 lg:p-12 overflow-y-auto pt-24 lg:pt-32 pb-24 lg:pb-32 scroll-smooth custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-4 lg:space-y-6 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-3 lg:px-6 lg:py-4 rounded-2xl lg:rounded-3xl border transition-all ${msg.role === MessageRole.USER ? 'border-white/5 bg-black/40 text-right backdrop-blur-sm shadow-xl' : 'accent-border bg-black/80 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]'}`}>
                    <div className="text-[6px] lg:text-[10px] font-black opacity-20 mb-1 lg:mb-2 tracking-[0.2em] uppercase">{msg.role === MessageRole.USER ? 'USER_COMMAND' : 'JARVIS_RESPONSE'}</div>
                    {msg.imageUrl && (
                      <div className="mb-3 lg:mb-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                        <img src={msg.imageUrl} alt="Optical Feed" className="w-full h-auto opacity-90" />
                      </div>
                    )}
                    <p className={`text-[10px] lg:text-lg font-light leading-relaxed ${msg.role === MessageRole.USER ? 'opacity-70' : 'opacity-100 text-amber-500/90'}`}>{msg.content}</p>
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-3 lg:mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/5">
                        {msg.groundingLinks.map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[6px] lg:text-xs text-amber-500/30 hover:text-amber-500 underline truncate max-w-[120px] transition-all hover:scale-105"
                          >
                            {link.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && <div className="text-[6px] lg:text-xs animate-pulse accent-text text-center tracking-[1em] py-4 uppercase font-black drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">Neural_Computation_Active</div>}
            </div>
          </div>
        </section>

        {/* Right Vault Panel - Desktop Only */}
        <aside className="hidden lg:block w-72 lg:w-96 p-8 pointer-events-none">
          <div className="hud-glass p-6 rounded-3xl pointer-events-auto h-full flex flex-col border border-amber-500/5 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
               <span className="text-xs accent-text tracking-[0.4em] block font-black uppercase opacity-40">Memory_Vault_Alpha</span>
            </div>
            <div className="space-y-4 lg:space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {memories.map(m => (
                <div key={m.id} className="border-l-2 border-amber-500/10 pl-4 py-1 hover:border-amber-500/40 transition-all group">
                  <p className="text-[10px] lg:text-sm opacity-50 leading-relaxed font-medium group-hover:opacity-100 transition-opacity">{m.fact}</p>
                  <span className="text-[6px] lg:text-[8px] opacity-20 font-mono block mt-2 uppercase tracking-widest">RECORD_UID::0x{m.id.slice(-8).toUpperCase()}</span>
                </div>
              ))}
              {memories.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-10 space-y-4">
                  <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center text-xl">!</div>
                  <span className="text-[8px] lg:text-xs text-center italic uppercase tracking-[0.4em]">Neural_Link_Empty</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Input Field Fixed at Bottom */}
      <div className="absolute bottom-0 inset-x-0 z-[100] w-full max-w-2xl mx-auto px-4 pb-6 lg:pb-12">
        <form onSubmit={handleTextSubmit} className="relative group touch-auto">
          <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
          <input 
            ref={inputRef}
            type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
            placeholder="AWAITING_INPUT_COMMAND >>"
            className="w-full bg-black/90 border border-white/10 rounded-2xl lg:rounded-full px-6 py-4 lg:px-10 lg:py-6 text-[10px] lg:text-xl tracking-[0.2em] text-amber-500 focus:outline-none focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/5 transition-all uppercase font-black shadow-2xl placeholder:opacity-20 backdrop-blur-3xl"
          />
          <div className="absolute right-6 lg:right-10 top-1/2 -translate-y-1/2 flex gap-2 lg:gap-3">
            <div className={`w-1.5 h-1.5 lg:w-3 lg:h-3 rounded-full ${isProcessing ? 'bg-amber-500 animate-ping' : 'bg-amber-950/20'}`}></div>
            <div className={`w-1.5 h-1.5 lg:w-3 lg:h-3 rounded-full ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-blue-900/20'}`}></div>
          </div>
        </form>
      </div>

      <footer className="p-3 lg:p-6 flex justify-between items-center border-t border-white/10 bg-black/90 backdrop-blur-3xl relative z-[60]">
         <div className="text-[6px] lg:text-[10px] font-mono opacity-20 tracking-[0.5em] uppercase font-black">STARK_SYSTEMS_V3 // PROTOCOL_ESTABLISHED</div>
         <div className="flex gap-4 lg:gap-10">
           <div className="text-right">
             <span className="block text-[6px] lg:text-[10px] opacity-30 uppercase tracking-[0.3em] font-bold">Battery_Status</span>
             <span className={`text-[10px] lg:text-lg font-mono font-black ${batteryLevel < 20 ? 'text-red-500 animate-pulse' : 'accent-text'}`}>{batteryLevel}%</span>
           </div>
           <div className="text-right">
             <span className="block text-[6px] lg:text-[10px] opacity-30 uppercase tracking-[0.3em] font-bold">Neural_Integrity</span>
             <span className="text-[10px] lg:text-lg font-mono accent-text font-black uppercase">STABLE</span>
           </div>
         </div>
      </footer>
      <OpticalUplink isActive={isOpticalActive} onCapture={handleOpticalCapture} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--accent-rgb), 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--accent-rgb), 0.3); }
      `}</style>
    </div>
  );
};

export default App;
