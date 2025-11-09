'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToday } from '@/hooks/useToday';
import { getRecordsByDate, type RecordItem, deleteRecordById } from '@/lib/storage';

export default function TodayPage() {
  const today = useToday();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL ?date=YYYY-MM-DD があれば優先、なければ今日
  const activeDate = useMemo(() => {
    const param = searchParams.get('date');
    return param || today;
  }, [searchParams, today]);

  const [records, setRecords] = useState<RecordItem[]>([]);

  // localStorage から「その日の記録」を読み込む
  useEffect(() => {
    try {
      const list = getRecordsByDate(activeDate);
      setRecords(list);
    } catch {
      setRecords([]);
    }
  }, [activeDate]);

  const handleDelete = (id: string) => {
    deleteRecordById(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const totalStats = records.reduce(
    (acc, r) => {
      acc.loadKg += r.totals.loadKg;
      acc.reps += r.totals.reps;
      acc.sets += r.totals.sets;
      return acc;
    },
    { loadKg: 0, reps: 0, sets: 0 }
  );

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Today</h1>
            <p className="mt-0.5 text-xs text-white/60">日付：{activeDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition-colors duration-150 hover:border-white/40 hover:bg-white/15"
            >
              Home
            </Link>
            <Link
              href={`/select?date=${activeDate}`}
              className="inline-flex h-8 items-center rounded-full border border-emerald-500/70 bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors duration-150 hover:border-emerald-300 hover:bg-emerald-500"
            >
              ＋ 今日のトレーニングを追加
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-sm px-4 py-6 space-y-6">
        {/* 今日のトレーニング一覧 */}
        <section className="rounded-xl border border-white/12 bg-[#181818] p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm opacity-80">今日のトレーニング</h2>
            {records.length > 0 && (
              <div className="text-[11px] text-white/60">
                種目 {records.length} 件 · 合計 {totalStats.loadKg.toFixed(1)} kg · {totalStats.sets} set
              </div>
            )}
          </div>

          {records.length === 0 ? (
            <div className="text-xs opacity-70">
              まだ記録がありません。上の「＋ 今日のトレーニングを追加」から入力してください。
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-white/12 bg-black/30 p-3 cursor-pointer transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:bg-black/60 hover:shadow-[0_14px_30px_rgba(0,0,0,0.7)]"
                  onClick={() =>
                    router.push(
                      `/log?date=${r.dateStr}&exercise=${encodeURIComponent(
                        r.exerciseName,
                      )}&fresh=1`,
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.exerciseName}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // カードクリックをキャンセル
                        handleDelete(r.id);
                      }}
                      className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-red-500/70 hover:text-white transition"
                    >
                      削除
                    </button>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="tabular-nums">
                      {r.totals.loadKg.toFixed(1)} kg
                    </span>{' '}
                    · {r.totals.reps} rep · {r.totals.sets} set（{r.unit} 入力）
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}