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

// API Key nikalne ka simple tarika
function getApiKey() {
    const keys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
    if (keys.length === 0) throw new Error("No Gemini API keys found in .env");
    return keys[0].trim(); // Hum sirf pehli key use karenge simplicity ke liye
}

// ============================================================
// === 4. SMART GENERATE API (100% OFFICIAL V1 ENDPOINT) ===
// ============================================================
app.post('/api/generate', async (req, res) => {
    try {
        const { contents, systemInstruction } = req.body;
        if (!contents) return res.status(400).json({ error: 'No contents found' });

        const apiKey = getApiKey();
        
        // 🚀 OFFICIAL STABLE ENDPOINT (v1) AUR LATEST MODEL (gemini-1.5-flash) 🚀
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = { contents };
        if (systemInstruction) {
            payload.systemInstruction = systemInstruction;
        }

        console.log(`🔄 Sending request to Gemini 1.5 Flash...`);

        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        const textResponse = response.data.candidates[0].content.parts[0].text;
        console.log(`✅ Success!`);
        
        res.json({ text: textResponse });

    } catch (error) {
        // Agar ab galti aayi toh EXACT Google ka error aapki phone screen par aayega
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error(`❌ Gemini API Error:`, errorMsg);
        res.status(500).json({ error: `Gemini API Error: ${errorMsg}` });
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
