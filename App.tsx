
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
      <header className="absolute top-0 inset-x-0 z-[60] p-2 lg:p-6 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto flex items-center gap-1.5 lg:gap-3">
          <div className="w-7 h-7 lg:w-9 lg:h-9 hud-glass rounded-lg flex items-center justify-center font-black text-[10px] lg:text-base accent-text shadow-lg">J</div>
          <div className="hidden xs:block">
            <h1 className="font-black tracking-widest text-[8px] lg:text-[11px] accent-text uppercase">JARVIS</h1>
            <span className="text-[5px] lg:text-[7px] opacity-30 tracking-widest uppercase block -mt-1">STARK::CHIEF</span>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <button onClick={() => setShowWidgets(!showWidgets)} className="lg:hidden hud-glass px-2 py-1 rounded-md text-[6px] tracking-widest uppercase">HUD</button>
          <button onClick={() => setIsOpticalActive(true)} className="hud-glass px-2 py-1 rounded-md text-[6px] lg:text-[8px] tracking-widest uppercase">SCAN</button>
        </div>
      </header>

      <main className="flex-1 relative flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`absolute left-0 top-0 bottom-0 z-50 w-full sm:w-56 p-3 lg:p-5 transition-all duration-500 backdrop-blur-3xl lg:backdrop-blur-none bg-black/95 lg:bg-transparent ${showWidgets ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
           <div className="flex justify-between items-center mb-4 lg:hidden">
              <span className="text-[7px] tracking-widest accent-text uppercase font-bold">CORE_SYSTEMS</span>
              <button onClick={() => setShowWidgets(false)} className="text-base text-white/40">×</button>
           </div>
           <DashboardWidgets isDefenceActive={protocol === 'alert'} onToggleDefence={() => setProtocol(p => p === 'alert' ? 'classic' : 'alert')} />
           <div className="mt-4 border-t border-white/5 pt-3">
             <span className="text-[5px] opacity-30 tracking-widest block mb-1.5 font-bold uppercase">Uplink Activity</span>
             <div className="space-y-1 max-h-20 overflow-y-auto">
               {diagnosticLogs.map((log, i) => <div key={i} className="text-[6px] font-mono opacity-40 truncate"> {log}</div>)}
             </div>
           </div>
        </aside>

        {/* HUD Visualization Area */}
        <section className="flex-1 flex flex-col items-center justify-center p-2 relative min-h-0">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="w-[200px] h-[200px] sm:w-[320px] sm:h-[320px] opacity-25">
              <JarvisCore isProcessing={isProcessing} isSpeaking={isSpeaking} />
            </div>
          </div>
          
          <div ref={scrollRef} className="absolute inset-0 flex flex-col justify-end p-2 lg:p-8 overflow-y-auto pt-16 pb-20 scroll-smooth">
            <div className="max-w-lg mx-auto space-y-2 w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-3 py-2 rounded-xl border max-w-[90%] transition-all ${msg.role === MessageRole.USER ? 'border-white/5 bg-black/40 text-right backdrop-blur-sm shadow-sm' : 'accent-border bg-black/80 backdrop-blur-xl shadow-lg'}`}>
                    <div className="text-[5px] font-black opacity-20 mb-1 tracking-[0.1em] uppercase">{msg.role === MessageRole.USER ? 'U_CMD' : 'J_RES'}</div>
                    {msg.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                        <img src={msg.imageUrl} alt="Optical Feed" className="w-full h-auto opacity-90" />
                      </div>
                    )}
                    <p className={`text-[8px] lg:text-[11px] font-light leading-snug ${msg.role === MessageRole.USER ? 'opacity-60' : 'opacity-100'}`}>{msg.content}</p>
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pt-1.5 border-t border-white/5">
                        {msg.groundingLinks.map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[5px] lg:text-[6px] text-amber-500/40 hover:text-amber-500 underline truncate max-w-[80px] transition-colors"
                          >
                            {link.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && <div className="text-[5px] animate-pulse accent-text text-center tracking-[0.8em] py-2 uppercase font-bold">Neural Uplink Active</div>}
            </div>
          </div>
        </section>

        {/* Right Vault Panel */}
        <aside className="hidden lg:block w-52 p-5 pointer-events-none">
          <div className="hud-glass p-3.5 rounded-xl pointer-events-auto h-full flex flex-col border border-amber-500/5">
            <span className="text-[6px] accent-text tracking-[0.2em] mb-3 block font-bold uppercase opacity-30">Memory Vault</span>
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {memories.map(m => (
                <div key={m.id} className="border-l border-amber-500/10 pl-2 py-0.5">
                  <p className="text-[7px] opacity-40 leading-tight font-light">{m.fact}</p>
                  <span className="text-[4px] opacity-20 font-mono block mt-0.5 uppercase tracking-tighter">NODE_0x{m.id.slice(-4)}</span>
                </div>
              ))}
              {memories.length === 0 && <div className="text-[6px] opacity-10 text-center py-2 italic uppercase tracking-widest">Null Link</div>}
            </div>
          </div>
        </aside>
      </main>

      {/* Input Field Fixed at Bottom */}
      <div className="absolute bottom-0 inset-x-0 z-[100] w-full max-w-lg mx-auto px-4 pb-4 lg:pb-6">
        <form onSubmit={handleTextSubmit} className="relative group touch-auto">
          <div className="absolute inset-0 bg-amber-500/5 blur-lg rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          <input 
            ref={inputRef}
            type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
            placeholder="INPUT COMMAND >>"
            className="w-full bg-black/80 border border-white/5 rounded-full px-5 py-2.5 lg:py-3 text-[8px] lg:text-[11px] tracking-widest text-amber-500 focus:outline-none focus:border-amber-500/50 transition-all uppercase font-bold shadow-2xl placeholder:opacity-20"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
            <div className={`w-0.5 h-0.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-ping' : 'bg-amber-900/20'}`}></div>
            <div className={`w-0.5 h-0.5 rounded-full ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-blue-900/20'}`}></div>
          </div>
        </form>
      </div>

      <footer className="p-2 lg:p-3 flex justify-between items-center border-t border-white/5 bg-black/80 backdrop-blur-md relative z-[60]">
         <div className="text-[5px] lg:text-[6px] font-mono opacity-10 tracking-[0.4em] uppercase font-bold">UDIT_RANA // STARK_INDUSTRIES_BUILD</div>
         <div className="flex gap-3">
           <div className="text-right">
             <span className="block text-[4px] lg:text-[5px] opacity-20 uppercase tracking-widest">Bat</span>
             <span className={`text-[7px] lg:text-[9px] font-mono font-bold ${batteryLevel < 20 ? 'text-red-500 animate-pulse' : 'accent-text'}`}>{batteryLevel}%</span>
           </div>
           <div className="text-right">
             <span className="block text-[4px] lg:text-[5px] opacity-20 uppercase tracking-widest">Core</span>
             <span className="text-[7px] lg:text-[9px] font-mono accent-text font-bold uppercase">Stable</span>
           </div>
         </div>
      </footer>
      <OpticalUplink isActive={isOpticalActive} onCapture={handleOpticalCapture} />
    </div>
  );
};

export default App;
