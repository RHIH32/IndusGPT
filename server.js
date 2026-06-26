const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Key nikalne ka original simple tarika
function getApiKey() {
    const keys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
    if (keys.length === 0) throw new Error("No API keys found in .env");
    return keys[0].trim();
}

// ============================================================
// === SMART GENERATE API (ORIGINAL WEB WALA V1BETA) ===
// ============================================================
app.post('/api/generate', async (req, res) => {
    try {
        const { contents, systemInstruction } = req.body;
        if (!contents) return res.status(400).json({ error: 'No contents found' });

        const apiKey = getApiKey();
        
        // 🚀 ORIGINAL V1BETA URL (Jo System Instruction ko 100% support karta hai) 🚀
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = { contents };
        if (systemInstruction) {
            payload.systemInstruction = systemInstruction;
        }

        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        res.json({ text: response.data.candidates[0].content.parts[0].text });

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error(`❌ Gemini API Error:`, errorMsg);
        res.status(500).json({ error: errorMsg }); // Android ko exact error batayega
    }
});

// ============================================================
// === IMAGE GENERATION API (ORIGINAL) ===
// ============================================================
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const HF_API_KEY = process.env.HF_API_KEY; 
        
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
        res.status(500).json({ error: "Image error" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
