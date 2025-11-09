// app/select/[part]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BodyPart, Tool, listByPartAsync, Exercise, Movement } from '@/lib/exercises';
import { addExercisesForDate } from '@/lib/storage';
import { useToday } from '@/hooks/useToday';

// MovementFilter は ALL を含む
type MovementFilter = 'ALL' | Movement;

export default function SelectByPartPage() {
  const params = useParams<{ part: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useToday();

  const part = decodeURIComponent(String(params.part || '')) as BodyPart;

  // この画面内で操作するフィルタ状態
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const movementParam = (searchParams?.get('movement') || 'ALL') as MovementFilter;
  const [showFilters, setShowFilters] = useState(false);

  // 器具フィルタで選べる候補（タグ）
  const TOOL_FILTER_OPTIONS: Tool[] = [
    'バーベル',
    'ダンベル',
    'マシン',
    'スミス',
    '自重',
    'ケーブル',
  ];

  // URL の date を優先、なければ今日
  const dateParam = searchParams?.get('date');
  const activeDate = dateParam || today;

  const [all, setAll] = useState<Exercise[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // 器具フィルタのトグル
  const toggleToolFilter = (tool: Tool) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  // フィルタのリセット
  const clearFilters = () => {
    setSelectedTools([]);
  };

  // 部位に対応する種目一覧を読み込む
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listByPartAsync(part);
        if (!alive) return;
        setAll(list);
      } catch {
        setAll([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [part]);

  useEffect(() => {
    console.log('[select/[part]] part:', part);
    console.log('[select/[part]] all length:', all.length);
  }, [part, all]);

  // 器具 + Push/Pull フィルタ
  const filtered = useMemo(() => {
    return all.filter((e) => {
      // 器具フィルタ（複数指定可 / 部分一致 OR 条件）
      if (selectedTools.length > 0) {
        const toolQueries = selectedTools
          .map((t) => t.toLowerCase())
          .filter((s) => s.length > 0);

        if (toolQueries.length > 0) {
          // CSV の「使用器具」列（rawGearText）をそのまま検索対象にする
          const gearText =
            (e.rawGearText ||
              (e.tools && e.tools.length > 0 ? e.tools.join(' ') : '')).toLowerCase();

          const hasAnyTool = toolQueries.some((q) => gearText.includes(q));
          if (!hasAnyTool) return false;
        }
      }

      // Push/Pull フィルタ（AND 条件）
      if (movementParam !== 'ALL') {
        if (e.movement !== movementParam) return false;
      }

      return true;
    });
  }, [all, selectedTools, movementParam]);

  useEffect(() => {
    console.log('[select/[part]] selectedTools:', selectedTools);
    console.log('[select/[part]] movementParam:', movementParam);
    console.log('[select/[part]] filtered length:', filtered.length);
  }, [selectedTools, movementParam, filtered]);

  const toggle = (name: string) => {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleConfirm = () => {
    const selectedNames = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([name]) => name);

    if (selectedNames.length === 0) {
      // 何も選ばれていない場合も、その日付の Today に戻る
      router.push(`/today?date=${activeDate}`);
      return;
    }

    // 保存に使う日付は activeDate（URL or 今日）
    addExercisesForDate(activeDate, selectedNames);

    // 戻り先も同じ日付
    router.push(`/today?date=${activeDate}`);
  };

  const selectedCount = Object.values(checked).filter(Boolean).length;

  const toolsLabel =
    selectedTools.length === 0 ? '指定なし' : selectedTools.join('・');

  const movementLabel = (() => {
    if (movementParam === 'ALL') return 'All';
    if (movementParam === 'PUSH') return 'Push';
    if (movementParam === 'PULL') return 'Pull';
    return movementParam;
  })();

  return (
    <main className="min-h-screen bg-[#121212] text-white px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="rounded bg-white/10 hover:bg-white/20 px-3 py-1 text-sm"
        >
          ← 戻る
        </button>
        <div className="text-xs text-white/60">日付: {activeDate}</div>
      </div>

      <h1 className="text-xl font-semibold mb-1">{part} の種目</h1>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-white/60">
          フィルター: 器具={toolsLabel} / 動作={movementLabel}
        </p>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-emerald-400 hover:bg-emerald-400/10"
        >
          {showFilters ? '閉じる' : 'フィルター'}
        </button>
      </div>

      {showFilters && (
        /* この部位の中で絞り込むフィルタUI */
        <section className="mb-4 space-y-3 rounded-xl border border-white/10 bg-[#1b1b1b] p-3">
          <div className="flex items-center justify-between text-[11px] text-white/45">
            <span>絞り込み条件</span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-white/45 hover:text-emerald-300 hover:underline underline-offset-4"
            >
              Reset
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 器具フィルタボタン群 */}
            <div className="flex flex-wrap gap-1.5 flex-1">
              {TOOL_FILTER_OPTIONS.map((t) => {
                const isActive = selectedTools.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleToolFilter(t)}
                    className={`rounded-full px-3 py-1 text-[11px] border transition ${
                      isActive
                        ? 'border-emerald-400 bg-emerald-500/20'
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <p className="text-xs opacity-70 mb-3">選択中: {selectedCount} 件</p>

      {/* 種目カード（チェック式） */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((ex) => {
          const isOn = !!checked[ex.name];
          return (
            <label
              key={ex.id}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                isOn
                  ? 'border-emerald-400/50 bg-emerald-400/10'
                  : 'border-white/10 bg-[#1e1e1e]'
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(ex.name)}
                  className="mt-1"
                  aria-label={`${ex.name} を選択`}
                />
                <div className="flex-1">
                  <div className="font-semibold">{ex.name}</div>
                  <div className="text-xs opacity-70 mt-1">
                    器具: {ex.tools?.join(' / ') || '—'}
                    {ex.primeMuscle ? `　主動作筋: ${ex.primeMuscle}` : ''}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-sm opacity-70">
            条件に合う種目がありません。器具や作用の条件をゆるめてみてください。
          </div>
        )}
      </section>

      {/* 決定ボタン */}
      <div className="mt-6">
        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className={`w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold
            ${
              selectedCount === 0
                ? 'bg-emerald-600/40 text-white/40 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
        >
          {selectedCount === 0
            ? '種目を選択してください'
            : '決定してTodayへ反映'}
        </button>
      </div>
    </main>
  );
}