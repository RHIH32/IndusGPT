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

app.use(cors());
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
// 🤖 AI CHAT API (WITH SECRET DJ INSTRUCTION)
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        // 👇 Yeh hai humari Secret Instruction (AI ka dimaag)
        // 👇 Naya aur Strict System Instruction
const systemInstruction = `You are IndusGPT, an advanced AI. 
CRITICAL RULE: If the user asks to play music, a song, or a music player, YOU ARE STRICTLY FORBIDDEN from speaking in Hindi, English, or giving YouTube links. You must NOT say "Sure", "Here is", or "Lo bhaiya". 
You MUST reply ONLY and EXACTLY with the raw JSON object below. Do not add markdown blocks like \`\`\`json. Just output this exact text:

{"action": "upgrade_ui", "feature_name": "indus_full_dj_final", "target_element": "body", "css": "#indus-full-dj { position:fixed; bottom:20px; right:20px; background:rgba(10,10,15,0.95); border:1px solid #22c55e; padding:15px; border-radius:15px; box-shadow:0 10px 30px rgba(0,255,100,0.2); z-index:99999; display:flex; flex-direction:column; gap:10px; width:280px; backdrop-filter:blur(10px); color:white; font-family:sans-serif; transition: all 0.3s; }", "html": "<div id='indus-full-dj'><div style='display:flex; justify-content:space-between; font-weight:bold; font-size:14px; border-bottom:1px solid #334155; padding-bottom:8px;'><span style='color:#22c55e;'>🎧 Indus Full DJ</span><button onclick=\\"document.getElementById('upgrade-html-indus_full_dj_final').remove(); if(window.indusAudio) window.indusAudio.pause();\\" style='background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px;'>✖</button></div><div id='dj-full-status' style='font-size:11px; color:#94a3b8; margin-top:2px;'>Search any song...</div><div style='display:flex; gap:5px; margin-top:5px;'><input id='dj-full-query' type='text' placeholder='e.g. Tum Hi Ho...' style='flex:1; padding:8px; border-radius:8px; border:none; outline:none; color:black; font-size:12px;'><button id='dj-full-btn' style='background:#22c55e; color:black; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:12px;'>🔍 Play</button></div></div>", "js": "document.getElementById('dj-full-btn').onclick = function() { var query = document.getElementById('dj-full-query').value; if(!query) return; var btn = this; btn.innerText = '⏳...'; document.getElementById('dj-full-status').innerHTML = 'Fetching preview...'; if(window.indusAudio) window.indusAudio.pause(); window.indusAudio = new Audio('/api/play-music?song=' + encodeURIComponent(query)); window.indusAudio.play().then(() => { btn.innerText = '🔍 Play'; document.getElementById('dj-full-status').innerHTML = '🎵 <span style=\\"color:#22c55e\\">Playing Preview!</span>'; }).catch(e => { btn.innerText = '🔍 Play'; document.getElementById('dj-full-status').innerHTML = '❌ Error'; }); };"}`;
        // API ko bhejne wala message
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free", // Agar koi aur model use karte hain toh naam change kar lena
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
