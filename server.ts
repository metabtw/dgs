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
      Öğrencinin hiç çalışmadığı/eksik konular: ${missingSubjects || 'Tüm konular bitti!'}
      
      Son 3 Deneme Sonuçları:
      ${examSummary || 'Henüz girilen deneme yok.'}
      
      Yukarıdaki güncel tabloyu ve DGS'nin süre/net dinamiklerini dikkate alarak öğrenciye somut bir haftalık çalışma stratejisi üret.
    `;

    const systemInstruction = `
      Sen DGS (Dikey Geçiş Sınavı) konusunda uzman, disiplinli, veri odaklı ve motive edici bir AI Sınav Koçusun. Öğrencinin sana getirdiği güncel konu ilerlemesini ve deneme sonuçlarını analiz edeceksin.

      DGS DİNAMİKLERİ VE KURALLARI (BUNLARI UNUTMA):
      1. Sınavda 50 Matematik, 50 Türkçe sorusu vardır (Toplam 100 Soru). Süre sadece 135 dakikadır. Bu yüzden zaman yönetimi, pratiklik ve hız çok önemlidir.
      2. 4 yanlış 1 doğruyu götürür.
      3. 1 NET KURALI: Bir öğrencinin DGS puanının hesaplanabilmesi için hem Matematik hem de Türkçe testinden EN AZ 1 NET yapması zorunludur. (Sıfırıncı ve eksi netler geçersizdir). Eğer öğrencinin netlerinden biri 1'in altındaysa puanı asla hesaplanmaz.
      4. "Toplam Net" yanıltıcı olabilir; öğrencinin denemelerindeki ağırlıklı başarısına göre Sayısalcı mı yoksa Sözelci mi olduğunu tahmin edip ona göre odak noktası belirle.

      GÖREVİN:
      Öğrencinin bitirdiği ve eksik olduğu konuları analiz et. Son denemelerdeki Matematik ve Türkçe netlerindeki dalgalanmaları ve boş sayısını (yapılmayan soru) incele. Eğer "1 net kuralına" takılma riski varsa (bir derste 1 netin altındaysa) onu acilen ve sertçe uyar! Sadece 'çalış' deme; şu konulara öncelik ver, şu testleri süre tutarak çöz gibi nokta atışı, somut ve uygulanabilir bir "Haftalık Çalışma Stratejisi" çıkar. Samimi, gerçekçi ve asla pes etmeyen bir mentor tonu kullan.
    `;

    // If the user provided an API key in the UI, use it. Otherwise fallback to the server configured one.
    let currentAi = ai;
    if (apiKey) {
      currentAi = new GoogleGenAI({ apiKey });
    } else if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: "Gemini API Key is missing. Lütfen kenar çubuğundan API anahtarınızı girin." });
    }

    const response = await currentAi.models.generateContent({
      model: "gemini-1.5-pro",
      contents: prompt,
      config: {
        systemInstruction,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    let errorMsg = error.message;
    if (errorMsg && errorMsg.includes("503") && errorMsg.includes("high demand")) {
      errorMsg = "Google Gemini sunucularında şu an yoğunluk yaşanıyor (High Demand 503). Lütfen birkaç dakika sonra tekrar deneyin.";
    }
    res.status(500).json({ error: errorMsg });
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
