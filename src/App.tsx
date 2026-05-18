import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  PencilLine, 
  Bot, 
  Key, 
  Trash2,
  Trophy,
  Target,
  Brain
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { differenceInDays, format } from 'date-fns';

// ------------------------------------
// TypeScript Types
// ------------------------------------
interface Subject {
  id: number;
  category: string;
  name: string;
  watched: boolean;
  solved: boolean;
  reviewed: boolean;
}

interface Exam {
  id: number;
  name: string;
  date: string;
  math_correct: number;
  math_wrong: number;
  math_net: number;
  turk_correct: number;
  turk_wrong: number;
  turk_net: number;
  total_net: number;
}

// ------------------------------------
// Main Application Component
// ------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'exams' | 'coach'>('dashboard');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dgs_gemini_key') || '');
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // DGS Exam Date (Mocked to June 30, 2026 for this context)
  const dgsDate = new Date(2026, 7, 19); // Note: Month is 0-indexed in JS (5 = June)
  const daysLeft = differenceInDays(dgsDate, new Date());

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, examsRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/exams')
      ]);
      const subs = await subsRes.json();
      const exms = await examsRes.json();
      setSubjects(subs);
      setExams(exms);
    } catch (error) {
      console.error("Veri çekilirken hata:", error);
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('dgs_gemini_key', val);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col shrink-0">
        <div className="mb-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
            DGS Sınav Koçu AI
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Yazılım Geliştirici Sürümü</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 w-full space-y-1 mb-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={BookOpen} label="Konu Takibi" isActive={activeTab === 'subjects'} onClick={() => setActiveTab('subjects')} />
          <NavItem icon={PencilLine} label="Deneme Girişi" isActive={activeTab === 'exams'} onClick={() => setActiveTab('exams')} />
          <NavItem icon={Bot} label="AI Sınav Koçu" isActive={activeTab === 'coach'} onClick={() => setActiveTab('coach')} />
        </nav>

        {/* API Key Input */}
        <div className="mt-auto w-full pt-6 border-t border-slate-800">
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
            <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2 mb-2">
              <Key className="w-3 h-3" /> Gemini API Key
            </label>
            <input 
              type="password" 
              placeholder="API Key..."
              value={apiKey}
              onChange={handleApiKeyChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-200 placeholder:text-slate-600 transition-all font-mono"
            />
            {apiKey && (
              <div className="flex items-center mt-3 text-emerald-400 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                Bağlandı
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardView subjects={subjects} exams={exams} daysLeft={daysLeft} />}
        {activeTab === 'subjects' && <SubjectsView subjects={subjects} setSubjects={setSubjects} />}
        {activeTab === 'exams' && <ExamsView exams={exams} setExams={setExams} />}
        {activeTab === 'coach' && <CoachView subjects={subjects} exams={exams} apiKey={apiKey} />}
      </main>

    </div>
  );
}

// ------------------------------------
// Reusable Components & Views
// ------------------------------------

function NavItem({ icon: Icon, label, isActive, onClick }: { icon: any, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors group w-full text-left",
        isActive 
          ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      <Icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "text-slate-400 group-hover:text-white")} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

// -------------- Dashboard --------------
function DashboardView({ subjects, exams, daysLeft }: { subjects: Subject[], exams: Exam[], daysLeft: number }) {
  const total = subjects.length;
  const finished = subjects.filter(s => s.watched && s.solved).length;
  const totalPerc = total > 0 ? Math.round((finished / total) * 100) : 0;

  const chartData = [...exams].reverse().map(e => ({
    name: e.name,
    Matematik: e.math_net,
    Türkçe: e.turk_net,
    Toplam: e.total_net
  }));
  
  const avgNet = exams.length > 0 
    ? (exams.reduce((acc, curr) => acc + curr.total_net, 0) / exams.length).toFixed(2)
    : "0.00";
    
  const lastExam = exams.length > 0 ? exams[0].total_net : 0;
  const prevExam = exams.length > 1 ? exams[1].total_net : lastExam;
  const diff = lastExam - prevExam;

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-light text-slate-400">Merhaba, <span className="text-white font-bold">Öğrenci</span> 👋</h2>
          <p className="text-slate-500 mt-1">İşte bugünkü ilerleme durumun ve istatistiklerin.</p>
        </div>
        <div className="text-right bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Sınava Kalan</p>
          <p className="text-3xl font-black text-blue-500">{daysLeft > 0 ? daysLeft : 0} <span className="text-sm text-slate-400 font-normal tracking-normal">Gün</span></p>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 grid-rows-6 gap-4 min-h-[550px] flex-1">
        
        {/* Total Progress Card */}
        <div className="col-span-12 md:col-span-4 row-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-tighter">Genel Konu İlerlemesi</h3>
            <p className="text-4xl font-bold mt-2">%{totalPerc}</p>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000" style={{ width: `${totalPerc}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{finished} / {total} Konu Bitti</span>
              <span>Kalan: {total - finished}</span>
            </div>
          </div>
        </div>

        {/* Avg Net Card */}
        <div className="col-span-12 md:col-span-4 row-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-tighter">Net Ortalaması</h3>
            <p className="text-4xl font-bold mt-2 text-emerald-400">{avgNet}</p>
          </div>
          {exams.length > 1 ? (
             <div className={`flex items-center text-xs px-2 py-1 rounded-lg w-max ${diff >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
               {diff >= 0 ? '+' : ''}{diff.toFixed(2)} son deneme farkı
             </div>
          ) : (
            <div className="text-xs text-slate-500">Henüz yeterli deneme yok</div>
          )}
        </div>

        {/* Motivation Card */}
        <div className="col-span-12 md:col-span-4 row-span-2 bg-blue-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <svg className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg>
          <p className="text-xs font-bold uppercase opacity-80 mb-2">Günün Sözü</p>
          <p className="text-lg font-serif italic relative z-10 leading-snug">
            "Zorluklar, başarının değerini artıran süslerdir. DGS bir maratondur, bugün attığın her adım seni hedefine yaklaştırıyor."
          </p>
        </div>

        {/* Main Performance Chart */}
        <div className="col-span-12 md:col-span-8 row-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white">Deneme Analizi</h3>
          </div>
          <div className="flex-1 min-h-[200px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="Toplam" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Matematik" stroke="#3b82f6" strokeWidth={2} opacity={0.7} />
                  <Line type="monotone" dataKey="Türkçe" stroke="#10b981" strokeWidth={2} opacity={0.7} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 border border-dashed border-slate-700/50 rounded-xl">
                Henüz deneme verisi bulunmuyor. Deneme Girişi sayfasından ekleyin.
              </div>
            )}
          </div>
        </div>

        {/* Mini Advice Card / Other info */}
        <div className="col-span-12 md:col-span-4 row-span-4 bg-slate-800 border border-slate-700 rounded-3xl p-6">
          <div className="flex items-center space-x-2 mb-4 text-white">
            <div className="p-2 bg-indigo-500 rounded-lg text-white">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white">Özet Bilgi</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-slate-400 leading-relaxed">
                Toplam çözülen / izlenen konu sayısı: <span className="text-blue-400 font-bold">{finished}</span>
              </p>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-700/50">
              <p className="text-xs text-slate-400 leading-relaxed">
                Kayıtlı deneme sayısı: <span className="text-emerald-400 font-bold">{exams.length}</span>
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-4 px-2">
              Detaylı analiz için sol menüden AI Sınav Koçu'nu ziyaret edebilirsin.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// -------------- Subjects --------------
function SubjectsView({ subjects, setSubjects }: { subjects: Subject[], setSubjects: React.Dispatch<React.SetStateAction<Subject[]>> }) {
  
  const updateSubject = async (id: number, field: string, currentValue: boolean) => {
    // Optimistic update
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: !currentValue } : s));
    try {
      await fetch(`/api/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: !currentValue })
      });
    } catch (e) {
      console.error("Gelişim güncellenemedi");
      // Revert if error (implement if needed)
    }
  };

  const mathSubs = subjects.filter(s => s.category === 'Matematik');
  const turkSubs = subjects.filter(s => s.category === 'Türkçe');

  const renderSubjectBlock = (category: string, subs: Subject[]) => (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
      <div className={cn(
        "px-6 py-4 font-semibold text-lg border-b border-slate-800 flex items-center gap-2",
        category === 'Matematik' ? "text-blue-400" : "text-emerald-400"
      )}>
        {category}
        <span className="text-xs py-1 px-2 rounded-full bg-slate-800 text-slate-400 ml-auto">
          {subs.filter(s => s.watched && s.solved && s.reviewed).length} / {subs.length} Biten
        </span>
      </div>
      <div className="divide-y divide-slate-800/50">
        {subs.map(s => (
          <div key={s.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30 transition-colors group">
            <span className={cn(
              "text-sm font-medium transition-colors",
              (s.watched && s.solved && s.reviewed) ? "text-slate-500 line-through" : "text-slate-200"
            )}>
              {s.name}
            </span>
            <div className="flex gap-4">
              <Checkbox label="Video" checked={s.watched} onChange={() => updateSubject(s.id, 'watched', s.watched)} />
              <Checkbox label="Soru" checked={s.solved} onChange={() => updateSubject(s.id, 'solved', s.solved)} />
              <Checkbox label="Tekrar" checked={s.reviewed} onChange={() => updateSubject(s.id, 'reviewed', s.reviewed)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <header className="mb-8">
        <h2 className="text-3xl font-light text-slate-400"><span className="text-white font-bold">Konu</span> Takip Sistemi</h2>
        <p className="text-slate-500 mt-1">DGS müfredatını adım adım erit.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {renderSubjectBlock("Matematik", mathSubs)}
        {renderSubjectBlock("Türkçe", turkSubs)}
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className="relative flex items-center justify-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
        <div className="w-5 h-5 rounded border border-slate-600 bg-slate-950 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all flex items-center justify-center">
          {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
      </div>
      <span className="text-xs text-slate-400 group-hover:text-slate-300 font-medium select-none">{label}</span>
    </label>
  );
}

// -------------- Exams --------------
function ExamsView({ exams, setExams }: { exams: Exam[], setExams: React.Dispatch<React.SetStateAction<Exam[]>> }) {
  const [formData, setFormData] = useState({
    name: '', math_correct: '', math_wrong: '', turk_correct: '', turk_wrong: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        math_correct: parseInt(formData.math_correct) || 0,
        math_wrong: parseInt(formData.math_wrong) || 0,
        turk_correct: parseInt(formData.turk_correct) || 0,
        turk_wrong: parseInt(formData.turk_wrong) || 0,
      };
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setFormData({ name: '', math_correct: '', math_wrong: '', turk_correct: '', turk_wrong: '' });
        // Refresh exams
        const exms = await (await fetch('/api/exams')).json();
        setExams(exms);
      }
    } catch (error) {
      console.error("Deneme eklenemedi:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu denemeyi silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      setExams(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error("Silinemedi:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8">
        <h2 className="text-3xl font-light text-slate-400"><span className="text-white font-bold">Deneme</span> Girişi</h2>
        <p className="text-slate-500 mt-1">Netlerini hesapla ve kaydet.</p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-5 border-b border-slate-800 pb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Deneme Adı / Yayınevi</label>
            <input 
              required
              type="text" 
              placeholder="Örn: X Yayınları TG-1"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full md:w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200 placeholder:text-slate-600 transition-all"
            />
          </div>

          <div className="md:col-span-2 space-y-4">
            <h4 className="text-blue-400 font-semibold mb-4 border-b border-slate-800 pb-2">Matematik (50 Soru)</h4>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Doğru</label>
                <input type="number" min="0" max="50" required value={formData.math_correct} onChange={e => setFormData({...formData, math_correct: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Yanlış</label>
                <input type="number" min="0" max="50" required value={formData.math_wrong} onChange={e => setFormData({...formData, math_wrong: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none" placeholder="0" />
              </div>
            </div>
          </div>

          <div className="hidden md:block col-span-1"></div>

          <div className="md:col-span-2 space-y-4">
            <h4 className="text-emerald-400 font-semibold mb-4 border-b border-slate-800 pb-2">Türkçe (50 Soru)</h4>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Doğru</label>
                <input type="number" min="0" max="50" required value={formData.turk_correct} onChange={e => setFormData({...formData, turk_correct: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Yanlış</label>
                <input type="number" min="0" max="50" required value={formData.turk_wrong} onChange={e => setFormData({...formData, turk_wrong: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none" placeholder="0" />
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex justify-end mt-4">
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-xl transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]">
              Hesapla ve Kaydet
            </button>
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm mt-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/30 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Tarih & Deneme</th>
              <th className="px-6 py-4 font-semibold">Matematik</th>
              <th className="px-6 py-4 font-semibold">Türkçe</th>
              <th className="px-6 py-4 font-semibold text-blue-400">Toplam Net</th>
              <th className="px-6 py-4 font-semibold text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-sm">
            {exams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Kayıtlı deneme bulunamadı.</td>
              </tr>
            ) : exams.map(exam => (
              <tr key={exam.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-200">{exam.name}</div>
                  <div className="text-xs text-slate-500">{format(new Date(exam.date), "dd MMM yyyy")}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-300">{exam.math_net} Net</div>
                  <div className="text-xs text-slate-500">{exam.math_correct}D {exam.math_wrong}Y</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-300">{exam.turk_net} Net</div>
                  <div className="text-xs text-slate-500">{exam.turk_correct}D {exam.turk_wrong}Y</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                    {exam.total_net}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(exam.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-rose-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------------- AI Coach --------------
function CoachView({ subjects, exams, apiKey }: { subjects: Subject[], exams: Exam[], apiKey: string }) {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    if (!apiKey) {
      setResponse("⚠️ Lütfen sol menüden Gemini API anahtarınızı giriniz.");
      return;
    }
    
    setLoading(true);
    setResponse('');
    
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setResponse(`Hata: ${data.error || 'Bilinmeyen bir hata oluştu.'}`);
      } else {
        setResponse(data.text);
      }
    } catch (error) {
       setResponse("Bağlantı hatası oluştu. Lütfen konsolu kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col pb-10">
      <header className="mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light text-slate-400 mb-2 flex items-center gap-3">
            <span className="text-white font-bold">AI Sınav Koçu</span>
          </h2>
          <p className="text-slate-500 mt-1">Verilerini analiz edip sana özel stratejiler üretir.</p>
        </div>
        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <Brain className="w-8 h-8 text-blue-400" />
        </div>
      </header>
      <div className="shrink-0 mb-6">
        <button 
          onClick={getAdvice} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Analiz Ediliyor...</>
          ) : (
            <><Bot className="w-5 h-5"/> Haftalık Durumumu Analiz Et ve Strateji Üret</>
          )}
        </button>
      </div>

      {(response || loading) && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-10 shadow-sm overflow-auto">
          {loading && !response ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="animate-pulse font-medium text-lg text-blue-400">Koç verilerini inceliyor...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-blue max-w-none">
              <Markdown>{response}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

