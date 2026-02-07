
# Jarvis AI Terminal Deployment

This project is optimized for hosting on [Vercel](https://vercel.com) or local development.

## Local Development (Option 1)

1. Create a `.env.local` file in the project root.
2. Add your Google Gemini API Key:
   ```env
   API_KEY=your_gemini_api_key_here
   ```
3. Your local build tool (Vite/Next.js) will automatically inject this into the application.

## Vercel Deployment (Option 2)

1. **Environment Variable**: Ensure you add your Google Gemini API Key in the Vercel dashboard.
   - Go to **Project Settings** > **Environment Variables**.
   - Add a new variable:
     - **Key**: `API_KEY`
     - **Value**: `your_gemini_api_key_here`

2. **Framework Preset**: If prompted, use "Vite" or "Other".

## Features
- **Jarvis Core**: Animated central AI visualization.
- **Voice Link**: Hands-free conversation using Gemini Live API.
- **Diagnostics**: Real-time system monitoring and environment detection.
- **Security**: Stark Industries grade biometric login (simulated).
