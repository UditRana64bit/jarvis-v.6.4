
export enum MessageRole {
  USER = 'user',
  JARVIS = 'model'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  imageUrl?: string;
  groundingLinks?: Array<{ title: string; uri: string }>;
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
  networkLatency: number;
  arcReactorEnergy: number;
  neuralSync: number;
  coreTemp: number;
  threatLevel: 'ALPHA' | 'BETA' | 'GAMMA' | 'OMEGA' | 'NULL';
}
