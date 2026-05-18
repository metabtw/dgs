import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "dgs_data.db");

app.use(express.json());

// Initialize GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Database Setup
let db: any;
async function initDb() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      name TEXT,
      watched BOOLEAN,
      solved BOOLEAN,
      reviewed BOOLEAN
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      date TEXT,
      math_correct INTEGER,
      math_wrong INTEGER,
      math_net REAL,
      turk_correct INTEGER,
      turk_wrong INTEGER,
      turk_net REAL,
      total_net REAL
    );
  `);

  // Insert default subjects if none exist
  const subjectCount = await db.get("SELECT COUNT(*) as count FROM subjects");
  if (subjectCount.count === 0) {
    const mathSubjects = [
      "Temel Kavramlar", "Sayı Basamakları", "Bölme ve Bölünebilme", "OBEB - OKEK",
      "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar",
      "Köklü Sayılar", "Çarpanlara Ayırma", "Oran Orantı", "Denklem Çözme",
      "Sayı Problemleri", "Kesir Problemleri", "Yaş Problemleri", "Yüzde Problemleri",
      "Kâr Zarar Problemleri", "Faiz Problemleri", "Karışım Problemleri",
      "İşçi Havuz Problemleri", "Hareket Problemleri", "Kümeler", "Fonksiyonlar",
      "İşlem", "Modüler Aritmetik", "Permütasyon, Kombinasyon, Olasılık",
      "Tablo ve Grafikler", "Sayısal Mantık", "Geometri Temel Kavramlar"
    ];
    
    const turkSubjects = [
      "Sözcükte Anlam", "Cümlenin Anlamı ve Yorumu", "Paragrafta Anlatım Biçimleri",
      "Paragrafta Yapı", "Paragrafta Ana Düşünce", "Paragrafta Yardımcı Düşünceler",
      "Sözel Mantık"
    ];

    for (const name of mathSubjects) {
      await db.run("INSERT INTO subjects (category, name, watched, solved, reviewed) VALUES (?, ?, ?, ?, ?)", ["Matematik", name, false, false, false]);
    }
    for (const name of turkSubjects) {
      await db.run("INSERT INTO subjects (category, name, watched, solved, reviewed) VALUES (?, ?, ?, ?, ?)", ["Türkçe", name, false, false, false]);
    }
  }
}

// API Routes
app.get("/api/subjects", async (req, res) => {
  try {
    const subjects = await db.all("SELECT * FROM subjects");
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

app.put("/api/subjects/:id", async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body; // field should be 'watched', 'solved', or 'reviewed'
  try {
    if (!["watched", "solved", "reviewed"].includes(field)) {
       return res.status(400).json({ error: "Invalid field" });
    }
    await db.run(`UPDATE subjects SET ${field} = ? WHERE id = ?`, [value ? 1 : 0, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update subject" });
  }
});

app.get("/api/exams", async (req, res) => {
  try {
    const exams = await db.all("SELECT * FROM exams ORDER BY id DESC");
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch exams" });
  }
});

app.post("/api/exams", async (req, res) => {
  const { name, math_correct, math_wrong, turk_correct, turk_wrong } = req.body;
  try {
    const math_net = math_correct - (math_wrong / 4);
    const turk_net = turk_correct - (turk_wrong / 4);
    const total_net = math_net + turk_net;
    const date = new Date().toISOString();

    const result = await db.run(
      "INSERT INTO exams (name, date, math_correct, math_wrong, math_net, turk_correct, turk_wrong, turk_net, total_net) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name, date, math_correct, math_wrong, math_net, turk_correct, turk_wrong, turk_net, total_net]
    );
    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: "Failed to add exam" });
  }
});

app.delete("/api/exams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.run("DELETE FROM exams WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

app.post("/api/coach", async (req, res) => {
  try {
    const { apiKey } = req.body; // Explicitly received from user input as per request!
    
    const subjects = await db.all("SELECT * FROM subjects");
    const exams = await db.all("SELECT * FROM exams ORDER BY id DESC LIMIT 3");
    
    const finishedSubjects = subjects.filter((s: any) => s.watched && s.solved).map((s: any) => s.name).join(", ");
    const missingSubjects = subjects.filter((s: any) => !s.watched || !s.solved).map((s: any) => s.name).join(", ");
    const examSummary = exams.map((e: any) => `${e.name} (${e.date}): Mat Net: ${e.math_net}, Türkçe Net: ${e.turk_net}, Toplam: ${e.total_net}`).join("\n");
    
    const prompt = `
      Öğrencinin bitirdiği konular: ${finishedSubjects || 'Henüz biten konu yok.'}
      Öğrencinin eksik listesi (hiç çalışılmayan veya sorusu çözülmeyen): ${missingSubjects || 'Tüm konular bitti!'}
      
      Son 3 Deneme Sonuçları:
      ${examSummary || 'Henüz girilen deneme yok.'}
      
      Yukarıdaki verileri dikkate alarak öğrenciye somut bir haftalık çalışma stratejisi üret.
    `;

    const systemInstruction = "Sen DGS konusunda uzman, disiplinli ve motive edici bir AI Sınav Koçusun. Öğrencinin getirdiği güncel konu ilerlemesini ve deneme netlerini incele. Ona eksik olduğu konulardan, deneme netlerindeki dalgalanmalardan yola çıkarak nokta atışı, somut bir haftalık çalışma stratejisi yaz. Samimi ve mentorvari bir ton kullan.";

    // If the user provided an API key in the UI, use it. Otherwise fallback to the server configured one.
    let currentAi = ai;
    if (apiKey) {
      currentAi = new GoogleGenAI({ apiKey });
    } else if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: "Gemini API Key is missing. Lütfen kenar çubuğundan API anahtarınızı girin." });
    }

    const response = await currentAi.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    res.status(500).json({ error: "AI Coach ile iletişimde sorun oluştu: " + error.message });
  }
});

// Vite middleware & start
async function startServer() {
  await initDb();
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
