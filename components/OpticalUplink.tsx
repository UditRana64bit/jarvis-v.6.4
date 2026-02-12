
import React, { useRef, useEffect, useState } from 'react';

interface OpticalUplinkProps {
  isActive: boolean;
  onCapture: (base64: string) => void;
}

export const OpticalUplink: React.FC<OpticalUplinkProps> = ({ isActive, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 } })
        .then(setStream)
        .catch(err => console.error("Optical uplink failed:", err));
    } else {
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    return () => stream?.getTracks().forEach(track => track.stop());
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureFrame = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 360);
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
        onCapture(base64);
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-4 sm:p-20">
      <div className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border-2 border-[rgba(var(--accent),0.3)] shadow-[0_0_100px_rgba(0,0,0,0.9)]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        
        {/* Tactical HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-[40px] border-black/20"></div>
          <div className="absolute top-10 left-10 w-32 h-32 border-t-2 border-l-2 accent-border"></div>
          <div className="absolute top-10 right-10 w-32 h-32 border-t-2 border-r-2 accent-border"></div>
          <div className="absolute bottom-10 left-10 w-32 h-32 border-b-2 border-l-2 accent-border"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 border-b-2 border-r-2 accent-border"></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-[rgba(var(--accent),0.2)] rounded-full animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 accent-bg rounded-full"></div>

          <div className="absolute bottom-20 left-20 space-y-2">
            <span className="block text-[10px] font-orbitron accent-text tracking-[0.5em] uppercase">STARK_OPTICAL_SENSORS::ACTIVE</span>
            <div className="flex gap-1">
              {[...Array(20)].map((_, i) => <div key={i} className="w-1 h-3 accent-bg opacity-40 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>)}
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 pointer-events-auto">
          <button onClick={captureFrame} className="px-12 py-4 bg-[rgba(var(--accent),0.2)] border-2 accent-border backdrop-blur-xl rounded-2xl font-orbitron text-xs tracking-widest accent-text hover:bg-[rgba(var(--accent),0.4)] transition-all">ANALYZE_FEED</button>
        </div>
      </div>
    </div>
  );
};
