
/**
 * JARVIS Neural Sound Engine
 * Synthesizes futuristic UI sound effects using Web Audio API.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambientSource: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createGain(val: number = 0.1) {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(val, this.ctx!.currentTime);
    return gain;
  }

  playAmbientHum() {
    this.init();
    if (this.ambientSource) return;

    const osc1 = this.ctx!.createOscillator();
    const osc2 = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(50, this.ctx!.currentTime); // Sub-bass hum
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(51.5, this.ctx!.currentTime); // Slightly detuned for beating

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, this.ctx!.currentTime);

    gain.gain.setValueAtTime(0, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0.015, this.ctx!.currentTime + 2); // Slow fade in

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx!.destination);

    osc1.start();
    osc2.start();

    this.ambientSource = osc1; // Reference one for stopping
    this.ambientGain = gain;
  }

  stopAmbientHum() {
    if (this.ambientGain) {
      const now = this.ctx!.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.linearRampToValueAtTime(0, now + 1);
      setTimeout(() => {
        this.ambientSource?.stop();
        this.ambientSource = null;
        this.ambientGain = null;
      }, 1100);
    }
  }

  playUiTick() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.05);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  playScanHum(duration: number = 0.5) {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.03);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx!.currentTime);
    osc.frequency.linearRampToValueAtTime(440, this.ctx!.currentTime + duration);
    
    gain.gain.linearRampToValueAtTime(0.01, this.ctx!.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + duration);
  }

  playAuthSuccess() {
    this.init();
    const now = this.ctx!.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50];
    
    frequencies.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + (i * 0.05));
      
      gain.gain.setValueAtTime(0, now + (i * 0.05));
      gain.gain.linearRampToValueAtTime(0.1, now + (i * 0.05) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.05) + 0.8);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      osc.start(now + (i * 0.05));
      osc.stop(now + 1);
    });
  }

  playError() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.1);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, this.ctx!.currentTime);
    osc.frequency.linearRampToValueAtTime(55, this.ctx!.currentTime + 0.3);
    
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.3);
  }

  playPowerUp() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.05);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(40, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx!.currentTime + 1.5);
    
    gain.gain.linearRampToValueAtTime(0.1, this.ctx!.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 1.5);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 1.5);
  }

  playNotification() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.08);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx!.currentTime + 0.1);
    
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.4);
  }
}

export const sounds = new SoundEngine();
