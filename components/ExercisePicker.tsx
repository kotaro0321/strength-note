'use client';
import { useState } from 'react';
import { BodyPart, Tool } from '@/lib/exercises';

const PARTS: BodyPart[] = ['胸', '背中', '肩', '腕', '脚', '体幹'];
const TOOLS: (Tool | 'ALL')[] = ['ALL', 'バーベル', 'ダンベル', 'マシン', 'スミス', '自重', 'ケーブル'];

type Props = {
  onSelect: (name: string) => void;
};

export default function ExercisePicker({ onSelect }: Props) {
  const [tool, setTool] = useState<Tool | 'ALL'>('ALL');
  const [q, setQ] = useState('');

  return (
    <main className="min-h-screen bg-[#121212] text-white px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">トレーニング種目を選択</h1>

      {/* フィルタUI */}
      <section className="rounded-xl border border-white/10 bg-[#1e1e1e] p-4 space-y-3 mb-6">
        <div>
          <label className="block text-sm opacity-80 mb-1">器具</label>
          <select
            className="w-full rounded bg-black/40 px-2 py-2"
            value={tool}
            onChange={(e) => setTool(e.target.value as Tool | 'ALL')}
          >
            {TOOLS.map(t => <option key={t} value={t}>{t === 'ALL' ? '指定なし' : t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm opacity-80 mb-1">検索</label>
          <input
            type="text"
            placeholder="キーワードを入力"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
      </section>

      {/* 部位カード */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {PARTS.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="rounded-xl border border-white/10 bg-[#1e1e1e] hover:bg-white/10 transition p-6 text-center font-semibold text-lg"
          >
            {p}
          </button>
        ))}
      </section>
    </main>
  );
}