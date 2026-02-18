
/**
 * JARVIS Neural Sound Engine v2.0
 * Synthesizes cinematic, futuristic UI sound effects using advanced Web Audio API techniques.
 * Features: Layered synthesis, FM-style modulation, automated filtering, and master bus processing.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambientSource: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Master Bus Setup
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private getDestination() {
    this.init();
    return this.compressor!;
  }

  playAmbientHum() {
    this.init();
    if (this.ambientSource) return;

    const now = this.ctx!.currentTime;
    const osc1 = this.ctx!.createOscillator();
    const osc2 = this.ctx!.createOscillator();
    const lfo = this.ctx!.createOscillator();
    const lfoGain = this.ctx!.createGain();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(50, now); // Deep base
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(50.5, now); // Beating effect

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.2, now); // Slow pulse
    lfoGain.gain.setValueAtTime(0.005, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.Q.setValueAtTime(5, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.02, now + 3);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx!.destination);

    lfo.start();
    osc1.start();
    osc2.start();

    this.ambientSource = osc1; 
    this.ambientGain = gain;
  }

  stopAmbientHum() {
    if (this.ambientGain) {
      const now = this.ctx!.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.linearRampToValueAtTime(0, now + 1.5);
      setTimeout(() => {
        this.ambientSource?.stop();
        this.ambientSource = null;
        this.ambientGain = null;
      }, 1600);
    }
  }

  /**
   * High-frequency cinematic UI click
   */
  playUiTick() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    
    const osc = this.ctx!.createOscillator();
    const noise = this.ctx!.createBufferSource();
    const noiseGain = this.ctx!.createGain();
    const oscGain = this.ctx!.createGain();

    // Noise component (the "click" transient)
    const bufferSize = this.ctx!.sampleRate * 0.02;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const noiseFilter = this.ctx!.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2000, now);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
    
    oscGain.gain.setValueAtTime(0.05, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    
    osc.connect(oscGain);
    oscGain.connect(dest);
    
    noise.start();
    osc.start();
    osc.stop(now + 0.05);
  }

  /**
   * Sonar-style scanning hum
   */
  playScanHum(duration: number = 0.5) {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    
    const osc = this.ctx!.createOscillator();
    const mod = this.ctx!.createOscillator();
    const modGain = this.ctx!.createGain();
    const gain = this.ctx!.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(660, now + duration);
    
    mod.type = 'sine';
    mod.frequency.setValueAtTime(50, now);
    modGain.gain.setValueAtTime(20, now);
    
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.linearRampToValueAtTime(400, now + duration);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    mod.start();
    osc.start();
    osc.stop(now + duration);
    mod.stop(now + duration);
  }

  /**
   * Heroic major-chord rising sequence
   */
  playAuthSuccess() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C Major scale
    
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const sub = this.ctx!.createOscillator();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + (i * 0.08));
      
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(f / 2, now + (i * 0.08));

      gain.gain.setValueAtTime(0, now + (i * 0.08));
      gain.gain.linearRampToValueAtTime(0.1, now + (i * 0.08) + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.08) + 1.2);
      
      osc.connect(gain);
      sub.connect(gain);
      gain.connect(dest);
      
      osc.start(now + (i * 0.08));
      sub.start(now + (i * 0.08));
      osc.stop(now + 2);
      sub.stop(now + 2);
    });
  }

  /**
   * Low-frequency warning buzz
   */
  playError() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    
    const osc1 = this.ctx!.createOscillator();
    const osc2 = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, now);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(82, now); // Dissonant beating
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  /**
   * Iconic Iron Man style reactor startup/power-up
   */
  playPowerUp() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(30, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 2.0);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(50, now);
    filter.frequency.exponentialRampToValueAtTime(5000, now + 1.8);
    filter.Q.setValueAtTime(15, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.3);
    gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    osc.start();
    osc.stop(now + 2.2);
  }

  /**
   * Dual-tone pleasant notification chime
   */
  playNotification() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    
    const tones = [880, 1174.66]; // A5 and D6
    tones.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + (i * 0.12));
      
      gain.gain.setValueAtTime(0, now + (i * 0.12));
      gain.gain.linearRampToValueAtTime(0.1, now + (i * 0.12) + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.12) + 0.6);
      
      osc.connect(gain);
      gain.connect(dest);
      
      osc.start(now + (i * 0.12));
      osc.stop(now + 1.0);
    });
  }

  /**
   * Glitch/Digital noise burst
   */
  playGlitch() {
    const dest = this.getDestination();
    const now = this.ctx!.currentTime;
    const duration = 0.2;
    
    const noise = this.ctx!.createBufferSource();
    const bufferSize = this.ctx!.sampleRate * duration;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        // Create digital-sounding static
        data[i] = Math.random() > 0.5 ? Math.random() : -Math.random();
    }
    noise.buffer = buffer;

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    noise.start();
  }
}

export const sounds = new SoundEngine();
