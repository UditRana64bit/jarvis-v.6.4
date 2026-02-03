
# Jarvis AI Terminal Deployment

This project is optimized for hosting on [Vercel](https://vercel.com).

## Deployment Steps

1. **Environment Variable**: Ensure you add your Google Gemini API Key in the Vercel dashboard.
   - Go to **Project Settings** > **Environment Variables**.
   - Add a new variable:
     - **Key**: `API_KEY`
     - **Value**: `your_gemini_api_key_here`

2. **Framework Preset**: If prompted, you can use "Other" or "Vite" if you have added a build script. For the current raw ESM setup, "Other" works best.

3. **Grounding & Search**: If you enable "Search Grounding" in the UI, ensure your API key has access to the Google Search tool in the Google AI Studio console.

## Features
- **Jarvis Core**: Animated central AI visualization.
- **Real-time Streaming**: Chat responses stream in real-time.
- **Image Synthesis**: Type "generate an image of..." to trigger the generation engine.
- **Search Grounding**: Real-time web access for up-to-date information.
