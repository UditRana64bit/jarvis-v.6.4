
import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from "../types";

export const getGeminiClient = () => {
  // Use a fresh instance with the most current API_KEY from the environment
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

// Manual base64 decoding as per SDK rules
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual base64 encoding as per SDK rules
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
      contents: [{ parts: [{ text: `Address me as Sir. In a deep, calm, authoritative male voice with a slight Indian accent, say the following in Hinglish. VERY IMPORTANT: Speak SLOWLY and clearly with distinct pauses. Text: ${text}` }] }],
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
    if (!candidate) {
      throw new Error("No candidates returned from speech engine.");
    }
    
    const parts = candidate.content?.parts;
    if (!parts) {
      throw new Error(`Speech engine candidate has no content.`);
    }
    
    const audioPart = parts.find(p => p.inlineData);
    const base64Audio = audioPart?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error(`Model response did not contain inline audio data.`);
    }
    
    return base64Audio;
  } catch (error) {
    console.error("Critical: Jarvis Speech Engine failure:", error);
    throw error;
  }
}
