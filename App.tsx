
import React, { useState, useRef, useEffect } from 'react';
import { JarvisCore } from './components/JarvisCore';
import { DashboardWidgets } from './components/DashboardWidgets';
import { LoginScreen } from './components/LoginScreen';
import { Message, MessageRole } from './types';
import { getGeminiClient, decodeBase64, encodeBase64, decodeAudioData, generateJarvisSpeech } from './services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [systemError, setSystemError] = useState<string | null>(null);

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentTranscription]);

  const stopAllAudio = () => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const cleanupSession = () => {
    setIsLiveActive(false);
    setIsSpeaking(false);
    stopAllAudio();
    
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
    try {
      const ai = getGeminiClient();
      
      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!audioContextInRef.current) {
        audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

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
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBase64 = encodeBase64(new Uint8Array(int16.buffer));
              
              sessionPromise.then(session => {
                if (session && isLiveActive) {
                  session.sendRealtimeInput({
                    media: { data: pcmBase64, mimeType: 'audio/pcm' }
                  });
                }
              }).catch(() => {});
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
              stopAllAudio();
              setIsSpeaking(false);
            }

            if (message.serverContent?.outputTranscription) {
              setCurrentTranscription(prev => prev + message.serverContent!.outputTranscription!.text);
            }
            if (message.serverContent?.turnComplete) {
              if (currentTranscription) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: MessageRole.JARVIS,
                  content: currentTranscription,
                  timestamp: new Date()
                }]);
                setCurrentTranscription('');
              }
            }
          },
          onclose: () => cleanupSession(),
          onerror: (e) => {
            console.error("Neural Link Error:", e);
            setSystemError("LINK_FAILURE: RE-INITIALIZING...");
            cleanupSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          systemInstruction: `You are JARVIS. Speak in an authoritative yet polite Indian accent. Address user as 'Sir' or 'Ma'am'. Profile: ${currentUser}. 
          Keep responses concise and high-tech. Reassure the user of system stability. Speak slowly and clearly.`,
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Link Failure:", err);
      setSystemError(err.message || "SYNC_ERROR");
      cleanupSession();
    }
  };

  const handleUnlock = async (profile: string) => {
    setCurrentUser(profile);
    setIsUnlocked(true);
    const greeting = `Protocols established. Welcome, ${profile}. Systems reporting nominal status. Initialization complete.`;
    
    setMessages([{
      id: 'init-01',
      role: MessageRole.JARVIS,
      content: greeting,
      timestamp: new Date()
    }]);

    try {
      const audio = await generateJarvisSpeech(greeting);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decodeBase64(audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.warn("Speech init failed.");
    }
  };

  if (!isUnlocked) return <LoginScreen onUnlock={handleUnlock} />;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#050201] text-amber-50">
      {/* HUD Frame Brackets */}
      <div className="absolute top-4 left-4 w-20 h-20 border-t-2 border-l-2 border-amber-500/30 pointer-events-none z-50"></div>
      <div className="absolute top-4 right-4 w-20 h-20 border-t-2 border-r-2 border-amber-500/30 pointer-events-none z-50"></div>
      <div className="absolute bottom-4 left-4 w-20 h-20 border-b-2 border-l-2 border-amber-500/30 pointer-events-none z-50"></div>
      <div className="absolute bottom-4 right-4 w-20 h-20 border-b-2 border-r-2 border-amber-500/30 pointer-events-none z-50"></div>

      <header className="relative z-20 glass-dark border-b border-amber-500/10 px-6 sm:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 border-2 border-amber-500/40 rounded flex items-center justify-center font-orbitron font-black text-xl text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">J</div>
          <div className="flex flex-col">
            <h1 className="font-orbitron font-black tracking-[0.4em] text-xl sm:text-2xl text-amber-500">JARVIS</h1>
            <span className="text-[7px] font-orbitron text-amber-500/40 tracking-[0.4em] uppercase">LINK_MARK_XLV_ONLINE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8">
          {systemError && (
            <span className="text-[8px] font-orbitron text-red-500 animate-pulse tracking-widest uppercase bg-red-500/10 px-3 py-1 border border-red-500/20 rounded-sm">
              {systemError}
            </span>
          )}
          <button 
            onClick={initLiveSession}
            className={`flex items-center gap-3 px-6 sm:px-10 py-3 rounded-lg border transition-all font-orbitron text-[9px] tracking-widest ${isLiveActive ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'bg-black/60 border-amber-500/20 text-amber-900 hover:border-amber-500/60 hover:text-amber-500'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-amber-400 animate-pulse' : 'bg-amber-950'}`}></span>
            {isLiveActive ? 'LINK_ACTIVE' : 'INITIATE_LINK'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="hidden xl:block p-8 border-r border-white/5 glass-dark z-20 w-96 overflow-y-auto">
          <DashboardWidgets layout="sidebar" />
        </aside>

        <section className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.02)_0%,transparent_80%)]">
          {/* Core Visual Backdrop */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none scale-150">
            <JarvisCore isProcessing={isLiveActive} isSpeaking={isSpeaking} />
          </div>

          {/* Conversation Console */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-20 py-10 space-y-10 z-10 scroll-smooth mobile-safe-p">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div className={`flex items-center gap-3 mb-2 ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-[8px] font-orbitron tracking-widest uppercase ${msg.role === MessageRole.USER ? 'text-amber-800' : 'text-amber-500 font-bold'}`}>
                      {msg.role === MessageRole.USER ? 'COMMAND_AUTH' : 'JARVIS_STREAM'}
                    </span>
                    <div className="h-[1px] w-8 bg-amber-500/10"></div>
                  </div>
                  <div className={`glass p-6 sm:p-8 rounded-xl border-l-2 ${msg.role === MessageRole.USER ? 'border-amber-900/50 bg-amber-950/10' : 'border-amber-500 bg-black/60 shadow-xl'}`}>
                    <p className="text-base sm:text-lg font-light leading-relaxed tracking-wide text-amber-50/90">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {currentTranscription && (
              <div className="flex justify-start">
                <div className="max-w-[80%] glass p-6 rounded-xl border border-amber-500/20 bg-amber-950/10">
                  <span className="text-[8px] font-orbitron text-amber-400 tracking-widest uppercase mb-2 block">DECODING...</span>
                  <p className="text-sm italic text-amber-300/60">{currentTranscription}</p>
                </div>
              </div>
            )}
          </div>

          {/* Controller HUD - Thumb Friendly Interaction */}
          <div className="px-6 sm:px-20 py-10 glass-dark border-t border-amber-500/10 flex flex-col items-center gap-6 z-20">
            {isLiveActive ? (
              <div className="flex items-center gap-10 w-full max-w-4xl">
                <div className="flex flex-col items-center gap-3">
                   <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center transition-all duration-700 ${isSpeaking ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'border-white/10 bg-black/40'}`}>
                      <svg className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${isSpeaking ? 'text-amber-400' : 'text-amber-950'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                      </svg>
                   </div>
                </div>

                <div className="flex-1 flex gap-1.5 items-center justify-center h-12 overflow-hidden">
                   {[...Array(40)].map((_, i) => (
                     <div key={i} className={`w-1 transition-all duration-150 rounded-full ${isSpeaking ? 'bg-amber-400 shadow-[0_0_8px_amber]' : 'bg-amber-950'}`} style={{ height: isSpeaking ? `${30 + Math.random() * 70}%` : '4px', opacity: isSpeaking ? 1 : 0.3 }}></div>
                   ))}
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1 font-mono text-[9px] text-amber-900">
                   <div className="flex gap-4"><span>SYNC:</span><span className="text-amber-500 font-bold">STABLE</span></div>
                   <div className="flex gap-4"><span>LOAD:</span><span className="text-amber-500">1.02%</span></div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={initLiveSession}>
                <div className="flex gap-1.5">
                   {[...Array(5)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-amber-500/20 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                </div>
                <p className="font-orbitron text-[10px] text-amber-500/30 tracking-[0.5em] uppercase group-hover:text-amber-500 transition-colors">ESTABLISH_NEURAL_LINK</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
