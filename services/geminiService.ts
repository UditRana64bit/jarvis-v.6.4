
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message } from "../types";

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY || '';
  if (!apiKey) {
    throw new Error("AUTH_KEY_NOT_SET");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Extracts long-term facts from a conversation to be stored in JARVIS's memory vault.
 */
export const extractFacts = async (conversation: string) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract any personal facts or preferences mentioned by the user in this text. 
      Text: "${conversation}"
      Return a simple list of facts. If no new facts, return "NONE".`,
      config: {
        maxOutputTokens: 100,
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
 */
export const generateGroundedResponse = async (prompt: string, context: string = "", location?: { latitude: number, longitude: number }) => {
  const ai = getGeminiClient();
  
  const config: any = {
    tools: [{ googleSearch: {} }, { googleMaps: {} }],
    systemInstruction: "You are JARVIS. Address me as Sir. You have access to a neural memory vault of all our previous conversations. If location data is available, prioritize local context for weather, traffic, and places. Maintain a professional, sophisticated, and authoritative tone."
  };

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
    model: "gemini-2.5-flash-latest",
    contents: `Recent Context: ${context}\n\nUser Message: ${prompt}`,
    config: config
  });

  const groundingLinks: Array<{ title: string, uri: string }> = [];

  // Extract URLs from groundingChunks (Search and Maps)
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  chunks.forEach((chunk: any) => {
    if (chunk.web) {
      groundingLinks.push({ title: chunk.web.title || "Source", uri: chunk.web.uri });
    }
    if (chunk.maps) {
      groundingLinks.push({ title: chunk.maps.title || "Location Intel", uri: chunk.maps.uri });
      if (chunk.maps.placeAnswerSources?.reviewSnippets) {
        // Optional: you could extract more from snippets if needed
      }
    }
  });

  return {
    text: response.text,
    links: groundingLinks
  };
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

// Manual base64 decoding
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual base64 encoding
export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function generateJarvisSpeech(text: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say in a professional, authoritative, and calm voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || candidate.finishReason !== 'STOP') {
      throw new Error(`System Protocol Refused. Reason: ${candidate?.finishReason || 'REFUSED'}`);
    }

    const audioPart = candidate.content.parts.find(p => p.inlineData);
    const base64Audio = audioPart?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("Neural link unstable: Audio component missing from response.");
    }
    
    return base64Audio;
  } catch (error) {
    console.error("Jarvis Neural Voice Engine failure:", error);
    throw error;
  }
}
