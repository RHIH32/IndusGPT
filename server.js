const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// --- 1. Firebase Setup ---
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin initialized.");
    }
} catch (error) {
    console.warn("⚠️ Firebase Init Warning: .env check karein.");
}
const db = admin.apps.length ? admin.firestore() : null;

// --- 2. Server Config ---
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// --- 3. API Key Logic ---
const GEMINI_API_KEYS = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
let currentKeyIndex = 0;

function getNextApiKey() {
    if (GEMINI_API_KEYS.length === 0) throw new Error("No Gemini API keys found in .env");
    const key = GEMINI_API_KEYS[currentKeyIndex].trim();
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    return key;
}

// ============================================================
// === 4. SMART GENERATE API (100% FIXED & BULLETPROOF) ===
// ============================================================
app.post('/api/generate', async (req, res) => {
    try {
        const { contents, systemInstruction } = req.body;
        if (!contents) return res.status(400).json({ error: 'No contents found' });

        const currentApiKey = getNextApiKey();
        
        // 🚀 YAHAN CHANGE KIYA HAI: '-latest' laga diya aur sirf naye models rakhe hain
        const modelsToTry = [
            'gemini-1.5-flash-latest', 
            'gemini-1.5-pro-latest'
        ]; 
        
        let lastErrorMsg = null;
        let textResponse = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🔄 Trying model: ${modelName}...`);
                
                // 🚀 YAHAN BHI CHANGE KIYA HAI: Sab kuch hamesha v1beta par chalega
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentApiKey}`;
                
                const payload = { contents };
                // System Instruction direct bhej rahe hain
                if (systemInstruction) {
                    payload.systemInstruction = systemInstruction;
                }

                const response = await axios.post(apiUrl, payload);
                
                textResponse = response.data.candidates[0].content.parts[0].text;
                console.log(`✅ Success with ${modelName}!`);
                break; // Ek model chal gaya toh aage mat jao

            } catch (error) {
                // Asli Error nikal kar console me dikhao
                lastErrorMsg = error.response?.data?.error?.message || error.message;
                console.error(`❌ Failed with ${modelName}:`, lastErrorMsg);
            }
        }

        if (textResponse) {
            res.json({ text: textResponse });
        } else {
            res.status(500).json({ error: lastErrorMsg || 'All AI models failed' });
        }

    } catch (error) {
        console.error('FATAL ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// === 5. IMAGE GENERATION API ===
// ============================================================
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt missing" });

        const HF_API_KEY = process.env.HF_API_KEY; 
        if (!HF_API_KEY) return res.status(500).json({ error: "Server par Image API Key set nahi hai." });

        console.log("🎨 Generating image for:", prompt);

        const response = await axios.post(
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
            { inputs: prompt },
            {
                headers: { 
                    Authorization: `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                responseType: "arraybuffer"
            }
        );

        const base64Image = Buffer.from(response.data, "binary").toString("base64");
        res.json({ base64Image: base64Image });

    } catch (error) {
        const errorMsg = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
        console.error("Image Gen Error:", errorMsg);
        res.status(500).json({ error: "Image error: " + errorMsg });
    }
});

// --- 6. Start Server ---
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
