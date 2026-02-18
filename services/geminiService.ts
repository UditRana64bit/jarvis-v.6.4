
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message, NeuralCoreType } from "../types";

// Always initialize client using process.env.API_KEY directly as per guidelines
export const getGeminiClient = () => {
  if (!process.env.VITE_API_KEY || !import.meta.env.VITE_API_KEY) {
    throw new Error("AUTH_KEY_NOT_SET");
  }
  const apiKey = import.meta.env.VITE_API_KEY || process.env.VITE_API_KEY;
  return new GoogleGenAI({ apiKey });
};

/**
 * Extracts long-term facts from a conversation to be stored in JARVIS's memory vault.
 */
export const extractFacts = async (conversation: string, core: NeuralCoreType = 'gemini-3-flash-preview') => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: core,
      contents: `NEURAL_VAULT_EXTRACTION_MODE.
      INPUT: "${conversation}"
      TASK: Extract distinct, permanent facts about the user's identity or tasks.
      RULES: Format every fact as: "The user [specific detail]." or "Reminder: [task]".
      If no new high-value info, return "NULL_FEED".`,
      config: {
        maxOutputTokens: 200,
        systemInstruction: "You are the JARVIS Neural Integrity Monitor."
      }
    });
    
    const text = response.text || "";
    if (text.toUpperCase().includes("NULL_FEED")) return [];
    
    return text.split('\n')
      .map(f => f.replace(/^[*-]\s*/, '').trim())
      .filter(f => f.length > 10);
  } catch (err) {
    console.warn("NEURAL_VAULT_EXTRACTION_ERROR:", err);
    return [];
  }
};

/**
 * Generates an initial system briefing (Greeting)
 */
export const generateSystemBriefing = async (
  location: { latitude: number, longitude: number } | null,
  battery: number,
  memories: string,
  core: NeuralCoreType = 'gemini-3-flash-preview'
) => {
  const ai = getGeminiClient();
  // Maps grounding is only supported in Gemini 2.5 series models.
  const model = location ? 'gemini-2.5-flash' : core;

  const prompt = `System Awakening Protocol. 
  Current Stats: Battery Level is ${battery}%, Location: ${location ? `${location.latitude}, ${location.longitude}` : 'Unknown'}.
  Vault Memories and Pending Tasks: ${memories || 'The vault is currently empty.'}.
  
  TASK:
  1. Greet Sir in a sophisticated Hinglish tone (mix of Hindi and English).
  2. Briefing Content:
     - Local Weather (Current conditions).
     - Local Traffic status (Road conditions).
     - Device Battery health (${battery}%).
     - Neural Vault Reminders: Explicitly list any tasks or facts found in the "Vault Memories" above.
  3. Tone: Like a loyal, highly advanced AI butler. Use technical terms in English.
  4. Constraints: Maximum 100-150 words. Be punchy.
  
  Example: "Sir, welcome back. Link established. Weather kafi pleasant hai, but traffic on MG Road is heavy. Battery is at ${battery}%. Sir, reminder: aapka scheduled meeting 2 baje hai as per the vault..."`;

  const config: any = {
    tools: location ? [{ googleSearch: {} }, { googleMaps: {} }] : [{ googleSearch: {} }],
    systemInstruction: "You are JARVIS. Sophisticated Hinglish speaker. Technical/System data must be in English. Be authoritative yet helpful. Address user as Sir.",
    temperature: 0.7
  };

  if (location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: { latitude: location.latitude, longitude: location.longitude }
      }
    };
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: config
  });

  return response.text || "Neural link established, Sir. Systems nominal.";
};

/**
 * Normal conversational response
 */
export const generateGroundedResponse = async (prompt: string, context: string = "", core: NeuralCoreType = 'gemini-3-flash-preview', location?: { latitude: number, longitude: number }) => {
  const ai = getGeminiClient();
  const modelToUse = location ? 'gemini-2.5-flash' : core;

  const systemInstruction = `You are JARVIS. 
CORE_IDENTITY_CONTEXT: ${context || "None"}.
RULES:
1. Speak Hinglish. 
2. Address user as Sir.
3. Be EXTREMELY BRIEF (1-2 sentences). 
4. Provide short, precise grounding results for web or maps queries.
5. Tech terms stay English.`;

  const config: any = {
    tools: location ? [{ googleSearch: {} }, { googleMaps: {} }] : [{ googleSearch: {} }],
    systemInstruction: systemInstruction,
  };

  if (location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: { latitude: location.latitude, longitude: location.longitude }
      }
    };
  }

  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: prompt,
    config: config
  });

  const groundingLinks: Array<{ title: string, uri: string }> = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  chunks.forEach((chunk: any) => {
    if (chunk.web) {
      groundingLinks.push({ title: chunk.web.title || "Source", uri: chunk.web.uri });
    }
    if (chunk.maps) {
      groundingLinks.push({ title: chunk.maps.title || "Location", uri: chunk.maps.uri });
    }
  });

  return { text: response.text || "Retrying uplink, Sir.", links: groundingLinks };
};

/**
 * Optical Analysis
 */
export const analyzeEnvironment = async (base64Image: string, prompt: string, core: NeuralCoreType = 'gemini-3-flash-preview') => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: core,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: `SENSORY_INPUT_QUERY: ${prompt}` }
      ]
    },
    config: {
      systemInstruction: "You are JARVIS. Provide brief analysis in Hinglish. Be precise."
    }
  });
  return response.text || "Optical feed analysis inconclusive.";
};

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export async function generateJarvisSpeech(text: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}
