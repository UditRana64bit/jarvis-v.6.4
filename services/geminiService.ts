
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message, NeuralCoreType } from "../types";

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY || process.env.VITE_API_KEY ;
  if (!apiKey) {
    throw new Error("AUTH_KEY_NOT_SET");
  }
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
      contents: `Extract any personal facts or preferences mentioned by the user in this text. 
      Text: "${conversation}"
      Return a simple list of facts. If no new facts, return "NONE".`,
      config: {
        maxOutputTokens: 150,
        systemInstruction: "You are the JARVIS neural processing unit. Your job is to extract user preferences and facts for long-term storage."
      }
    });
    
    const text = response.text || "";
    if (text.includes("NONE")) return [];
    return text.split('\n').filter(f => f.trim().length > 3).map(f => f.replace(/^- /, '').trim());
  } catch (err) {
    console.warn("Fact extraction failed:", err);
    return [];
  }
};

/**
 * Generates grounded content using Google Maps and Google Search.
 * Includes Thinking Config for Pro models.
 */
export const generateGroundedResponse = async (prompt: string, context: string = "", core: NeuralCoreType = 'gemini-3-flash-preview', location?: { latitude: number, longitude: number }) => {
  const ai = getGeminiClient();
  
  const config: any = {
    tools: [{ googleSearch: {} }, { googleMaps: {} }],
    systemInstruction: "You are JARVIS. Address me as Sir. You have access to a neural memory vault of all our previous conversations. If location data is available, prioritize local context for weather, traffic, and places. Maintain a professional, sophisticated, and authoritative tone."
  };

  // Enable Thinking for Pro Core
  if (core === 'gemini-3-pro-preview') {
    config.thinkingConfig = { thinkingBudget: 4000 };
  }

  if (location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: location.latitude,
          longitude: location.longitude
        }
      }
    };
  }

  const response = await ai.models.generateContent({
    model: core,
    contents: `Recent Context: ${context}\n\nUser Message: ${prompt}`,
    config: config
  });

  const groundingLinks: Array<{ title: string, uri: string }> = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  chunks.forEach((chunk: any) => {
    if (chunk.web) groundingLinks.push({ title: chunk.web.title || "Source", uri: chunk.web.uri });
    if (chunk.maps) groundingLinks.push({ title: chunk.maps.title || "Location Intel", uri: chunk.maps.uri });
  });

  return {
    text: response.text,
    links: groundingLinks
  };
};

/**
 * Visual Analysis Protocol
 */
export const analyzeEnvironment = async (base64Image: string, prompt: string, core: NeuralCoreType = 'gemini-3-flash-preview') => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: core,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: `Tactical Analysis requested: ${prompt}. Analyze the visual feed and provide strategic intelligence.` }
      ]
    },
    config: {
      systemInstruction: "You are JARVIS. Analyze optical data from the suit's external cameras. Be concise and professional."
    }
  });
  return response.text;
};

/**
 * Generates visualizations (images) using the Flash Image model.
 */
export const generateVisualization = async (prompt: string): Promise<string | null> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [{ text: `High-tech HUD blueprint schematic of: ${prompt}. Cinematic lighting, orange and amber color palette, futuristic design.` }]
    },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
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
    contents: [{ parts: [{ text: `Say in a professional, authoritative, and calm voice: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
      },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio synthesis failed");
  return base64Audio;
}
