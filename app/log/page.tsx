'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { upsertRecord } from '@/lib/storage';
import ExerciseHistory from '@/components/ExerciseHistory';

/** lb → kg 換算係数 */
const KG_PER_LB = 0.45359237;
const DRAFT_KEY = 'strength-note:log-draft:v1';
const RECENT_PREFIX = 'strength-note:recent:v1';

/** 1セット分の入力 */
type SetRow = { weight: string; reps: string; rpe: string };

// 入力欄の統一スタイル
const INPUT_CLASS =
  'w-full h-10 rounded bg-black/40 px-3 outline-none transition focus:ring-2 focus:ring-white/20 focus:bg-black/50';

// 1 行が有効かどうか
const isValidRow = (row: SetRow) => {
  const weight = parseFloat(row.weight);
  const reps = parseInt(row.reps, 10);
  return Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0;
};

export default function LogPage() {
  // 単一種目の入力状態
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [rows, setRows] = useState<SetRow[]>(
    Array.from({ length: 3 }, () => ({ weight: '', reps: '', rpe: '' })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string>('保存しました');
  const [hasRecent, setHasRecent] = useState<boolean>(false);
  const [historyRev, setHistoryRev] = useState(0); // 履歴更新用トリガー

  // 種目名と日付
  const [exerciseName, setExerciseName] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const isFresh = searchParams?.get('fresh') === '1';

  const defaultZeroRows: SetRow[] = Array.from({ length: 3 }, () => ({
    weight: '0',
    reps: '0',
    rpe: '',
  }));

  // 各行の入力ボックス参照
  const weightRefs = useRef<HTMLInputElement[]>([]);
  const repsRefs = useRef<HTMLInputElement[]>([]);
  const rpeRefs = useRef<HTMLInputElement[]>([]);

  const recentKey = () => {
    if (!exerciseName) return '';
    return `${RECENT_PREFIX}:${exerciseName}:${unit}`;
  };

  const loadRecentIfExists = () => {
    const key = recentKey();
    if (!key) return null;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const handleCopyLast = () => {
    const data = loadRecentIfExists();
    if (!data || !Array.isArray(data.rows)) return;
    setRows(data.rows);
    setSavedMsg('前回の記録をコピーしました');
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  };

  /** kg 換算 */
  const toKg = (wStr: string) => {
    const w = parseFloat(wStr);
    if (!Number.isFinite(w)) return 0;
    return unit === 'kg' ? w : w * KG_PER_LB;
  };

  /** 合計 rep */
  const totalReps = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (!isValidRow(r)) return sum;
      const n = parseInt(r.reps, 10);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [rows]);

  /** 合計ボリューム (kg × rep) */
  const exerciseLoad = useMemo(() => {
    const load = rows.reduce((sum, r) => {
      if (!isValidRow(r)) return sum;
      const kg = toKg(r.weight);
      const reps = parseInt(r.reps, 10);
      const vol = kg * (Number.isFinite(reps) ? reps : 0);
      return sum + vol;
    }, 0);
    return Math.round(load * 10) / 10;
  }, [rows, unit]);

  const validSetCount = useMemo(() => rows.filter(isValidRow).length, [rows]);

  const liveTotals = useMemo(() => {
    // 種目未入力 or 日付なしのときは何も渡さない
    if (!exerciseName || !dateStr) return undefined;

    // 有効なセットがない場合も無視
    if (validSetCount === 0 || totalReps === 0 || exerciseLoad <= 0) {
      return undefined;
    }

    return {
      dateStr,
      loadKg: exerciseLoad,
      reps: totalReps,
      sets: validSetCount,
    };
  }, [exerciseName, dateStr, validSetCount, totalReps, exerciseLoad]);

  // 前回値（種目 × 単位ごと）
  function getPrevTotals() {
    const data = loadRecentIfExists();
    if (!data || !Array.isArray(data.rows)) {
      return { prevLoadKg: 0, prevReps: 0, prevSets: 0 };
    }
    const validRows = data.rows.filter((r: SetRow) => isValidRow(r));
    const prevReps = validRows.reduce(
      (s, r) => s + (parseInt(r.reps, 10) || 0),
      0,
    );
    const prevLoadKg =
      Math.round(
        validRows.reduce(
          (s, r) => s + toKg(r.weight) * (parseInt(r.reps, 10) || 0),
          0,
        ) * 10,
      ) / 10;
    const prevSets = validRows.length;
    return { prevLoadKg, prevReps, prevSets };
  }

  const { prevLoadKg, prevReps, prevSets } = useMemo(
    () => getPrevTotals(),
    [exerciseName, unit],
  );

  // 行の部分更新
  const setRow = (idx: number, patch: Partial<SetRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addSet = () => {
    setRows((prev) =>
      prev.length >= 10 ? prev : [...prev, { weight: '', reps: '', rpe: '' }],
    );
  };

  const removeSet = (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      weightRefs.current.splice(idx, 1);
      repsRefs.current.splice(idx, 1);
      rpeRefs.current.splice(idx, 1);
      return next;
    });
  };

  const focusWeight = (i: number) => {
    const el = weightRefs.current[i];
    el?.focus();
    el?.select?.();
  };

  // 1〜20 → ①〜⑳
  const toCircleNumber = (n: number) => {
    if (n >= 1 && n <= 20) return String.fromCharCode(9311 + n);
    return `${n}.`;
  };

  const handleSave = () => {
    try {
      setIsSaving(true);
      const cleanRows = rows.filter(isValidRow);

      // 1セットも入力が無ければ、そのまま Today に戻る
      if (cleanRows.length === 0) {
        router.push(`/today?date=${dateStr}`);
        return;
      }

      // 下書き保存
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ unit, rows: cleanRows, exerciseName, dateStr }),
      );

      if (exerciseName) {
        // 直近データ（前回コピー & 比較用）
        const key = recentKey();
        if (key) {
          localStorage.setItem(
            key,
            JSON.stringify({ unit, rows: cleanRows, exerciseName, dateStr }),
          );
        }

        // 本番の履歴（Today / History / グラフ用）
        upsertRecord({
          dateStr,
          exerciseName,
          unit,
          rows: cleanRows,
        });

        setHistoryRev((prev) => prev + 1);
      }

      setSavedMsg('保存しました');
      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        router.push(`/today?date=${dateStr}`);
      }, 1200);
    } catch (e) {
      console.warn('manual save failed', e);
    } finally {
      setIsSaving(false);
    }
  };

  const isValidDateStr = (s: string) => /^(\d{4})-(\d{2})-(\d{2})$/.test(s);

  // 初回マウント時：fresh でなければドラフトを読み込み
  useEffect(() => {
    if (isFresh) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && (data.unit === 'kg' || data.unit === 'lb') && Array.isArray(data.rows)) {
        setUnit(data.unit);
        const safeRows = data.rows.map((r: any) => ({
          weight: typeof r?.weight === 'string' ? r.weight : '',
          reps: typeof r?.reps === 'string' ? r.reps : '',
          rpe: typeof r?.rpe === 'string' ? r.rpe : '',
        }));
        setRows(safeRows.length ? safeRows : [{ weight: '', reps: '', rpe: '' }]);
        if (typeof data.exerciseName === 'string') {
          setExerciseName(data.exerciseName);
        }
        if (typeof data.dateStr === 'string') {
          setDateStr(data.dateStr);
        }
      }
    } catch (e) {
      console.warn('draft load failed', e);
    }
  }, [isFresh]);

  // fresh=1 で来たとき：ゼロ初期化 & クエリで上書き
  useEffect(() => {
    if (!isFresh) return;

    setRows(defaultZeroRows);

    const qDate = searchParams?.get('date');
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      setDateStr(qDate);
    }
    const qEx = searchParams?.get('exercise');
    if (qEx) {
      setExerciseName(qEx);
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [isFresh, searchParams]);

  // クエリからの上書き（date / exercise）
  useEffect(() => {
    const qDate = searchParams?.get('date');
    if (qDate && isValidDateStr(qDate)) {
      setDateStr(qDate);
    }
    const qEx = searchParams?.get('exercise');
    if (qEx) {
      setExerciseName(qEx);
    }
  }, [searchParams]);

  // オートセーブ（ドラフト）
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ unit, rows, exerciseName, dateStr }),
        );
      } catch (e) {
        console.warn('draft save failed', e);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [unit, rows, exerciseName, dateStr]);

  // 前回データの有無
  useEffect(() => {
    const exists = !!loadRecentIfExists();
    setHasRecent(exists);
  }, [exerciseName, unit]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#050816] via-[#020617] to-black text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-black/80 via-[#020617]/95 to-transparent backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="mx-auto max-w-screen-sm flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-teal-300/70">
              Strength Log
            </div>
            <h1 className="text-lg font-semibold tabular-nums">
              {exerciseName || '種目未入力'}
            </h1>
            <div className="text-[11px] text-white/60 mt-0.5">
              {dateStr}
            </div>
          </div>
          <button
            className="h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-medium hover:bg-white/10 transition"
            onClick={() => router.push(`/today?date=${dateStr}`)}
          >
            Todayへ戻る
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-sm px-4 py-6 space-y-6">
        {/* PREVIOUS / CURRENT 比較 */}
        <section className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-3 shadow-sm">
          {hasRecent ? (
            <div>
              <div className="text-[11px] tracking-[0.22em] uppercase text-white/50 mb-2 text-center">
                Comparison
              </div>
              <div className="flex justify-center gap-10 text-sm">
                {/* PREVIOUS */}
                <div className="text-center min-w-[120px]">
                  <div className="text-[11px] tracking-wide uppercase text-white/45">
                    Previous
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white tabular-nums">
                    {prevLoadKg.toFixed(1)}
                    <span className="text-sm opacity-70"> kg</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/65">
                    {prevReps} reps ・ {prevSets} sets
                  </div>
                </div>

                {/* CURRENT */}
                <div className="text-center min-w-[120px]">
                  <div className="text-[11px] tracking-wide uppercase text-teal-300">
                    Current
                  </div>
                  <div className="mt-1 text-xl font-semibold text-teal-100 tabular-nums">
                    {exerciseLoad.toFixed(1)}
                    <span className="text-sm opacity-70"> kg</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/70">
                    {totalReps} reps ・ {validSetCount} sets
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-white/60 text-center">
              No previous record yet. Start logging your first sets below.
            </div>
          )}
        </section>

        {/* 各セットの入力 */}
        <section className="rounded-2xl border border-white/10 bg-[#020617] p-4 space-y-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-white/90">Set Log</div>
            <button
              type="button"
              onClick={handleCopyLast}
              disabled={!hasRecent || !exerciseName}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium hover:bg-white/10 disabled:opacity-40"
              aria-label="前回の記録をコピー"
            >
              前回コピー
            </button>
          </div>

          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-2 items-center py-2 border-b border-white/5 last:border-none"
            >
              {/* ラベル */}
              <div
                className="col-span-1 text-center text-sm opacity-70"
                aria-label={`セット${idx + 1}`}
              >
                {toCircleNumber(idx + 1)}
              </div>
              {/* 重さ */}
              <div className="col-span-3">
                <input
                  className={INPUT_CLASS}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={`重さ（${unit})`}
                  value={row.weight}
                  onChange={(e) => setRow(idx, { weight: e.target.value })}
                  ref={(el) => {
                    if (el) weightRefs.current[idx] = el;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const next = repsRefs.current[idx];
                      next?.focus();
                      next?.select?.();
                    }
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              {/* 回数 */}
              <div className="col-span-3">
                <input
                  className={INPUT_CLASS}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="回数"
                  value={row.reps}
                  onChange={(e) => setRow(idx, { reps: e.target.value })}
                  ref={(el) => {
                    if (el) repsRefs.current[idx] = el;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const next = rpeRefs.current[idx];
                      next?.focus();
                      next?.select?.();
                    }
                  }}
                />
              </div>
              {/* RPE */}
              <div className="col-span-3">
                <input
                  className={INPUT_CLASS}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  placeholder="RPE（6〜10）"
                  value={row.rpe}
                  onChange={(e) => setRow(idx, { rpe: e.target.value })}
                  ref={(el) => {
                    if (el) rpeRefs.current[idx] = el;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const isLast = idx === rows.length - 1;
                      if (isLast) {
                        if (isValidRow(row)) {
                          addSet();
                          setTimeout(() => {
                            focusWeight(rows.length);
                          }, 0);
                        }
                      } else {
                        focusWeight(idx + 1);
                      }
                    }
                  }}
                />
              </div>
              {/* 削除 */}
              <div className="col-span-2 flex justify-end">
                <button
                  className="rounded bg-black/40 px-2 py-1 text-xs hover:bg-black/60"
                  onClick={() => removeSet(idx)}
                  type="button"
                  aria-label={`セット${idx + 1}を削除`}
                >
                  削除
                </button>
              </div>
            </div>
          ))}

          {/* ＋ セットを追加 */}
          <div className="pt-3">
            <button
              className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm hover:bg-black/60 disabled:opacity-40"
              onClick={addSet}
              type="button"
              disabled={rows.length >= 10}
              aria-label="セットを追加"
            >
              ＋ セットを追加（現在：{rows.length}）
            </button>
          </div>
        </section>

        {/* 過去の記録（この種目の履歴） */}
        {exerciseName && (
          <ExerciseHistory
            key={`${exerciseName}-${unit}-${historyRev}`}
            exerciseName={exerciseName}
            unit={unit}
            liveTotals={liveTotals}
          />
        )}
      </div>

      {/* 下部固定バー：保存ボタン */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/70 backdrop-blur supports-[backdrop-filter]:bg-black/60">
        <div className="mx-auto max-w-screen-sm px-4 py-3 flex items-center justify-end">
          <button
            className="min-w-[120px] h-10 rounded-lg bg-teal-500 px-4 text-sm font-medium text-black hover:bg-teal-400 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-teal-400/60 transition"
            onClick={handleSave}
            type="button"
            disabled={isSaving}
            aria-label="記録を保存"
          >
            {isSaving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      {/* 保存トースト */}
      {showSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 w-[min(90vw,360px)] rounded-xl border border-white/10 bg-[#1e1e1e] p-5 text-center shadow-xl">
            <div className="text-base font-semibold mb-1">{savedMsg}</div>
            <div className="text-xs opacity-70">記録はこの端末のブラウザに保存されています。</div>
          </div>
        </div>
      )}
    </main>
  );
}