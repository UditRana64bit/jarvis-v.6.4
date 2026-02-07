
import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from "../types";

export const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY || '';
  if (!apiKey) {
    throw new Error("AUTH_KEY_NOT_SET");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Performs a lightweight handshake to verify the current API key is valid.
 */
export const verifyProtocols = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return { success: false, error: "ENVIRONMENT_KEY_MISSING" };

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });
    
    if (response.text) {
      return { success: true };
    }
    return { success: false, error: "EMPTY_RESPONSE" };
  } catch (error: any) {
    console.error("Protocol verification failed:", error);
    return { 
      success: false, 
      error: error?.message || "CONNECTION_FAILED" 
    };
  }
};

/**
 * Generates grounded content using Google Search.
 */
export const generateGroundedResponse = async (prompt: string) => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are JARVIS. Address me as Sir. Use a natural, fluid conversational speed. Maintain a professional, sophisticated, and authoritative tone."
    }
  });

  const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    web: chunk.web || { title: "Source", uri: "#" }
  })).map(c => ({ title: c.web.title, uri: c.web.uri })) || [];

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
    // Simplified prompt to avoid "OTHER" safety refusals while maintaining Fenrir's deep voice
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
