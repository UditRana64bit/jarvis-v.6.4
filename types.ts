
export enum MessageRole {
  USER = 'user',
  JARVIS = 'model'
}

export type NeuralCoreType = 'gemini-3-pro-preview' | 'gemini-3-flash-preview' | 'gemini-flash-lite-latest';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  imageUrl?: string;
  groundingLinks?: Array<{ title: string; uri: string }>;
}

export interface IntelligenceEntry {
  id: string;
  timestamp: string;
  node: string;
  message: string;
  status: 'INFO' | 'OK' | 'WARN' | 'ALERT';
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  timestamp: Date;
  priority: 'LOW' | 'MED' | 'HIGH';
}

export interface MemoryEntry {
  id: string;
  fact: string;
  timestamp: Date;
  importance: number;
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
  activeNodes: number;
  packetRate: number;
  inferenceSpeed: number; // tokens/sec
}
