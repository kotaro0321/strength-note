'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BodyPart, Movement } from '@/lib/exercises';

const PARTS: BodyPart[] = ['胸', '背中', '肩', '腕', '脚', '体幹'];

type MovementFilter = 'ALL' | Movement;

export default function SelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLの ?date=YYYY-MM-DD を取得（なければ今日）
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-white/40">
              Strength Note
            </span>
            <h1 className="text-lg font-semibold tracking-wide">
              部位を選択
            </h1>
            <span className="mt-0.5 text-[11px] text-white/40">
              日付: {date}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/today?date=${date}`)}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-emerald-400/70 hover:bg-emerald-400/15"
          >
            <span className="text-sm">←</span>
            <span>Todayに戻る</span>
          </button>
        </div>
      </header>

      {/* 動作フィルター（Push / Pull） */}
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>動作フィルター</span>
          <div className="inline-flex rounded-full bg-white/5 p-0.5">
            {(['ALL', 'PUSH', 'PULL'] as MovementFilter[]).map((mv) => {
              const isActive = movementFilter === mv;
              const label =
                mv === 'ALL' ? 'All' : mv === 'PUSH' ? 'Push' : 'Pull';
              return (
                <button
                  key={mv}
                  type="button"
                  onClick={() => setMovementFilter(mv)}
                  className={`px-3 py-1 rounded-full border text-[11px] transition-colors duration-150 ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-500/80 text-black shadow-sm'
                      : 'border-white/10 text-white/60 hover:border-white/30 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 部位カード（フィルタは次の画面で適用） */}
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {PARTS.map((p) => (
            <button
              key={p}
              onClick={() => {
                const params = new URLSearchParams();
                params.set('date', date);
                if (movementFilter !== 'ALL') {
                  params.set('movement', movementFilter);
                }
                router.push(
                  `/select/${encodeURIComponent(p)}?${params.toString()}`,
                );
              }}
              className="group flex h-24 flex-col items-center justify-center rounded-2xl border border-white/12 bg-[#111111] p-6 text-center text-lg font-semibold tracking-wide transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-emerald-400/80 hover:bg-[#141414] hover:shadow-[0_14px_30px_rgba(0,0,0,0.6)]"
              aria-label={`${p}の種目一覧へ`}
            >
              <span className="text-base sm:text-lg">{p}</span>
              <span className="mt-1 text-[11px] text-white/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                タップして{p}の種目を見る
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}