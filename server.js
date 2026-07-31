const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Parser = require('rss-parser'); // RSS News ke liye
require('dotenv').config();
const ytSearch = require('yt-search');
const play = require('play-dl'); // 👉 Naya aur sabse powerful package
// --- Firebase Admin Setup ---
//const admin = require('firebase-admin');
//const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

//admin.initializeApp({
  //credential: admin.credential.cert(serviceAccount)
//});
//const db = admin.firestore(); 

const app = express();
const parser = new Parser(); 
const port = process.env.PORT || 10000;

// Har port (jaise 5500) se request allow karne ke liye CORS fix
app.use(cors({
    origin: '*', // Allow all origins (development ke liye best hai)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// --- 🔑 NAYI API KEY YAHAN AAYEGI ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🛠️ HELPER: System Time
function getSystemTime() {
    const now = new Date();
    return now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
}

// 🛠️ HELPER: Google News RSS (Text Only - No Links)
async function getGoogleNews() {
    try {
        const feed = await parser.parseURL("https://news.google.com/rss?ceid=IN:en&hl=en-IN&gl=IN");
        return feed.items.slice(0, 5).map(item => `- ${item.title}`).join("\n");
    } catch (e) { return null; }
}

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const seed = Math.floor(Math.random() * 100000);
        
        // 🪄 MAGICAL FIX: Yahan humne "perfect anatomy" aur deformed cheezon ko rokne ke liye strict words add kiye hain
        const superPrompt = `A real life National Geographic style photograph of ${prompt}. 
        ultra-realistic, 8k resolution, shot on DSLR, hyper-detailed, perfect anatomy, flawless proportions, symmetrical eyes. 
        STRICTLY AVOID AND NO: deformed, mutated, extra limbs, missing legs, bad eyes, poorly drawn, cartoon, 3d render.`;

        // URL encode the prompt
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(superPrompt)}?seed=${seed}&width=1024&height=1024&nologo=true&enhance=true&model=flux-realism`; 
        
        console.log(`🖼️ Generating Perfect Image for: ${prompt}`);

        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 25000 });
        
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        res.json({ base64Image, imageUrl });
    } catch (error) {
        console.error("🖼️ Image Error:", error.message);
        res.status(500).json({ error: "Image Failed" });
    }
});
// ====================================================
// ==========================================
// 🎵 INDUS MUSIC API (APPLE MUSIC 30-SEC PREVIEW)
// ==========================================
app.get('/api/play-music', async (req, res) => {
    try {
        const songName = req.query.song;
        if (!songName) return res.status(400).send("Gaane ka naam bhej bhai!");

        console.log(`🔍 Searching Apple Music for: ${songName}`);

        // 1. Apple Music (iTunes) API se direct search (100% Stable & Free)
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(songName)}&limit=1&entity=song`;
        const response = await axios.get(itunesUrl);
        
        const results = response.data.results;

        // Agar gaana na mile
        if (!results || results.length === 0) {
            console.log("❌ Gaana nahi mila");
            return res.status(404).send("Gaana nahi mila!");
        }

        const track = results[0];
        const previewUrl = track.previewUrl; // Apple ka direct 30-sec audio link

        console.log(`▶️ Found: ${track.trackName} by ${track.artistName}`);
        console.log(`🎵 Playing 30-sec Preview...`);

        // 2. Direct Apple ke CDN par redirect kar do (Lightning Fast & No Server Load)
        res.redirect(previewUrl);

    } catch (error) {
        console.error("❌ Music API Error:", error.message);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// 🤖 AI CHAT API (CLEANED & FIXED)
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        // 👇 Purana hardcoded /api/play-music hata diya. Ab ye Frontend ki baat manega!
        const systemInstruction = `You are IndusGPT, an advanced AI. Answer the user properly.
        CRITICAL RULE: If the user provides a [STRICT RULE] or [CRITICAL OVERRIDE] with a JSON format at the end of their prompt, you MUST output ONLY that exact JSON without any extra conversational text, markdown blocks, or \`\`\`json.`;

        // API ko bhejne wala message
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        const reply = response.data.choices[0].message.content;
        res.json({ reply: reply });

    } catch (error) {
        console.error("❌ AI Error:", error.message);
        res.status(500).json({ error: "AI Failed" });
    }
});
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
