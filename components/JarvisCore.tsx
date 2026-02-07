
import React, { useMemo, useEffect, useState } from 'react';

interface JarvisCoreProps {
  isProcessing: boolean;
  isSpeaking?: boolean;
}

export const JarvisCore: React.FC<JarvisCoreProps> = ({ isProcessing, isSpeaking }) => {
  const [synapseOffset, setSynapseOffset] = useState(0);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setSynapseOffset(prev => (prev + 0.5) % 100);
      frame = requestAnimationFrame(animate);
    };
    if (isProcessing || isSpeaking) {
      frame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(frame);
  }, [isProcessing, isSpeaking]);

  const webElements = useMemo(() => {
    const lines = Array.from({ length: 60 }).map((_, i) => ({
      x1: Math.random() * 100,
      y1: Math.random() * 100,
      x2: Math.random() * 100,
      y2: Math.random() * 100,
      opacity: 0.05 + Math.random() * 0.4,
      duration: 3 + Math.random() * 5
    }));
    const dots = Array.from({ length: 100 }).map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.4 + Math.random() * 1.8,
      opacity: 0.1 + Math.random() * 0.8,
      delay: Math.random() * 4,
      pulseSpeed: 2 + Math.random() * 3
    }));
    return { lines, dots };
  }, []);

  return (
    <div className="relative w-72 h-72 sm:w-96 sm:h-96 md:w-[36rem] md:h-[36rem] flex items-center justify-center float">
      {/* Dynamic Background Energy */}
      <div className={`absolute inset-0 rounded-full bg-amber-600/5 blur-[100px] transition-all duration-1000 ${isSpeaking ? 'opacity-100 scale-110' : isProcessing ? 'opacity-60' : 'opacity-20'}`}></div>

      {/* Synaptic Neural Mesh */}
      <svg className={`absolute inset-0 w-full h-full opacity-30 ${isProcessing ? 'animate-spin-slower' : 'animate-spin-super-slow'}`} viewBox="0 0 100 100">
        <defs>
          <radialGradient id="neuralGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
          </radialGradient>
        </defs>
        {webElements.lines.map((l, i) => (
          <line 
            key={i} 
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} 
            stroke="url(#neuralGrad)" 
            strokeWidth="0.04" 
            strokeOpacity={l.opacity * (isSpeaking ? 1.5 : 1)} 
            className="transition-opacity duration-300"
          />
        ))}
      </svg>

      {/* Orbiting HUD Rings */}
      <div className={`absolute inset-0 border border-amber-500/10 rounded-full scale-110 ${isProcessing ? 'animate-spin-slow' : 'opacity-10'}`}></div>
      <div className={`absolute inset-8 border border-dotted border-amber-600/10 rounded-full scale-105 ${isProcessing ? 'animate-reverse-spin-slow' : 'opacity-5'}`}></div>
      
      {/* Active Neural Nodes */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {webElements.dots.map((d, i) => (
          <circle 
            key={i} 
            cx={d.x} 
            cy={d.y} 
            r={d.size * (isSpeaking ? 1.4 : 1)} 
            fill="#fbbf24" 
            className="transition-all duration-500"
            style={{ 
              opacity: isSpeaking ? d.opacity * 1.5 : d.opacity,
              animation: `node-pulse ${d.pulseSpeed}s infinite ease-in-out`
            }} 
          />
        ))}
      </svg>

      {/* Central Command Core */}
      <div className={`relative z-10 w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center`}>
        {/* Glow Foundation */}
        <div className={`absolute inset-0 bg-gradient-to-tr from-amber-600/30 via-orange-400/10 to-transparent rounded-full blur-3xl animate-pulse`}></div>
        
        {/* Main Interface Hub */}
        <div className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[#0a0501] border-2 border-amber-500/60 flex items-center justify-center shadow-[0_0_100px_rgba(245,158,11,0.4)] transition-all duration-500 ${isSpeaking ? 'scale-110 border-amber-400' : 'scale-100'}`}>
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500 shadow-[0_0_50px_rgba(251,191,36,0.9)] transition-all duration-300 ${isSpeaking ? 'scale-125 brightness-150 shadow-[0_0_70px_rgba(251,191,36,1)]' : ''}`}></div>
          
          {/* Internal Kinetic Rings */}
          <div className="absolute inset-2 border border-amber-500/30 rounded-full animate-spin" style={{ animationDuration: '4s' }}></div>
          <div className="absolute inset-5 border border-dashed border-amber-600/40 rounded-full animate-reverse-spin" style={{ animationDuration: '8s' }}></div>

          {/* Sensory Data Spikes */}
          {[...Array(24)].map((_, i) => (
            <div 
              key={i}
              className={`absolute w-[1.5px] bg-gradient-to-t from-amber-500 to-transparent transition-all duration-300 origin-bottom`}
              style={{ 
                height: isSpeaking ? `${30 + Math.random() * 40}px` : '20px',
                bottom: '50%',
                transform: `rotate(${i * 15}deg) translateY(-30px)`,
                opacity: isSpeaking ? 0.9 : 0.15
              }}
            ></div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes node-pulse {
          0%, 100% { transform: scale(1); opacity: inherit; }
          50% { transform: scale(1.2); opacity: 0.9; }
        }
        @keyframes spin-super-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-super-slow { animation: spin-super-slow 180s linear infinite; }
        
        @keyframes spin-slower { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slower { animation: spin-slower 60s linear infinite; }

        @keyframes reverse-spin-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-reverse-spin-slow { animation: reverse-spin-slow 30s linear infinite; }
      `}</style>
    </div>
  );
};
