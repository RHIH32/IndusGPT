const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Parser = require('rss-parser'); // RSS News ke liye
require('dotenv').config();

// --- Firebase Admin Setup ---
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

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

// === MAIN API (OpenRouter Version) ===
app.post('/api/generate', async (req, res) => {
    try {
        const { contents, systemInstruction } = req.body;
        if (!contents) return res.status(400).json({ error: 'No contents' });

        if (!OPENROUTER_API_KEY) {
            throw new Error("🚨 Render par OPENROUTER_API_KEY nahi mili!");
        }

        const lastMessage = contents[contents.length - 1]?.parts[0]?.text?.toLowerCase() || "";
        let finalSystemInstruction = systemInstruction?.parts[0]?.text || "";
        let extraContext = "";

        // --- 1. 🕒 TIME & DATE ---
        if (lastMessage.includes("time") || lastMessage.includes("samay") || lastMessage.includes("date") || lastMessage.includes("tarikh")) {
            console.log("🕒 Time Injection");
            extraContext += `\n[SYSTEM UPDATE]: Current Date/Time in India is: ${getSystemTime()}. User ko ye time batao.`;
        }

        // --- 2. 📰 NEWS ---
        else if (lastMessage.includes("news") || lastMessage.includes("khabar") || lastMessage.includes("samachar")) {
            console.log("📰 RSS News Injection");
            const newsData = await getGoogleNews();
            if (newsData) {
                extraContext += `\n[LATEST NEWS SUMMARY]:\n${newsData}\n(In khabron ko padhkar user ko Hinglish mein sunao. Koi link mat dena).`;
            }
        }

        // --- 3. 🖼️ IMAGE GENERATION (Fake Response) ---
        if (lastMessage.includes("draw") || lastMessage.includes("create") || lastMessage.includes("banao")) {
             const fakeResponse = JSON.stringify({
                action: "generate_image",
                prompt: lastMessage,
                response: "Bilkul! Tasveer bana raha hoon... 🎨"
            });
            return res.json({ text: fakeResponse });
        }

        if (extraContext) {
            finalSystemInstruction += extraContext;
        }

        // --- 4. 🧠 TRANSLATOR: Gemini Format ko OpenRouter Format mein badalna ---
        let openRouterMessages = [];

        // System Prompt add kiya
        if (finalSystemInstruction) {
            openRouterMessages.push({ role: "system", content: finalSystemInstruction });
        }

        // Chat History add ki
        contents.forEach(msg => {
            const role = msg.role === 'model' ? 'assistant' : 'user';
            const content = msg.parts && msg.parts[0] ? msg.parts[0].text : '';
            if (content) {
                openRouterMessages.push({ role, content });
            }
        });

       // --- 5. 🚀 CALL OPENROUTER FREE API (WITH SECURITY HEADERS) ---
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/free", 
            messages: openRouterMessages
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://raviai-1h96.onrender.com", // 🚨 FREE TIER KE LIYE ZAROORI HAI
                "X-Title": "IndusGPT" // 🚨 APP KA NAAM ZAROORI HAI
            }
        });

        const textResponse = response.data.choices[0].message.content;
        res.json({ text: textResponse });

    } catch (error) {
        console.error('🔥 AI Error:', error.response ? error.response.data : error.message);
        // Ab asli error frontend par jayega taaki pata chale kya galat hua
        res.status(500).json({ error: error.response ? JSON.stringify(error.response.data) : error.message });
    }
});

// Image API (100% Sahi hai, No changes needed)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const seed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`; 
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');
        res.json({ base64Image, imageUrl });
    } catch (error) {
        res.status(500).json({ error: "Image Failed" });
    }
});

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
