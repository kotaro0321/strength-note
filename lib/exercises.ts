/** strength-note 用 種目カタログ + CSVローダ
 *  - まずは最小セット（ベンチ/スクワット/デッド/ショルダープレス/ラットプル など）
 *  - public/date/exercises.csv があればそれを優先して読み込む（なければ最小セットをフォールバック）
 */

export type BodyPart = '胸' | '背中' | '肩' | '腕' | '脚' | '体幹';
export type Tool = 'バーベル' | 'ダンベル' | 'マシン' | 'スミス' | '自重' | 'ケーブル';
export type Movement = 'PUSH' | 'PULL';

export type Exercise = {
  id: string;           // 永続ID（内部用）
  name: string;         // 表示名（ユーザー向け）
  part: BodyPart;       // 鍛える部位（フィルタ用）
  tools: Tool[];        // 使う道具（タグ表示/将来の絞り込み）
  aka?: string[];       // 別名（将来の検索用）
  // CSV由来の補助フィールド（必要に応じてUIで使用可）
  primeMuscle?: string;
  assistMuscle?: string;
  rawGearText?: string;
  movement: Movement;   // 動作タイプ（押す/引く）
};

/** ひとまず最小構成（CSVが無い/読み込めない時のフォールバック） */
export const EXERCISES: Exercise[] = [
  // 胸
  { id: 'bench_barbell', name: 'ベンチプレス', part: '胸', tools: ['バーベル'], aka: ['バーベルベンチ'], movement: 'PUSH' },
  { id: 'incline_db_press', name: 'インクラインダンベルプレス', part: '胸', tools: ['ダンベル'], movement: 'PUSH' },
  { id: 'pec_deck', name: 'ペックデック', part: '胸', tools: ['マシン'], movement: 'PUSH' },

  // 背中
  { id: 'deadlift_barbell', name: 'デッドリフト', part: '背中', tools: ['バーベル'], movement: 'PULL' },
  { id: 'lat_pulldown', name: 'ラットプルダウン', part: '背中', tools: ['マシン', 'ケーブル'], movement: 'PULL' },
  { id: 'seated_row', name: 'シーテッドロー', part: '背中', tools: ['マシン', 'ケーブル'], movement: 'PULL' },

  // 肩
  { id: 'ohp_barbell', name: 'オーバーヘッドプレス', part: '肩', tools: ['バーベル'], aka: ['ショルダープレス'], movement: 'PUSH' },
  { id: 'lateral_raise_db', name: 'サイドレイズ', part: '肩', tools: ['ダンベル'], movement: 'PUSH' },

  // 腕
  { id: 'curl_db', name: 'ダンベルカール', part: '腕', tools: ['ダンベル'], movement: 'PULL' },
  { id: 'pushdown', name: 'ケーブルトライセプスプッシュダウン', part: '腕', tools: ['ケーブル'], movement: 'PUSH' },

  // 脚
  { id: 'squat_barbell', name: 'スクワット', part: '脚', tools: ['バーベル'], movement: 'PUSH' },
  { id: 'leg_press', name: 'レッグプレス', part: '脚', tools: ['マシン'], movement: 'PUSH' },
  { id: 'leg_extension', name: 'レッグエクステンション', part: '脚', tools: ['マシン'], movement: 'PUSH' },

  // 体幹
  { id: 'plank', name: 'プランク', part: '体幹', tools: ['自重'], movement: 'PUSH' },
  { id: 'cable_crunch', name: 'ケーブルクランチ', part: '体幹', tools: ['ケーブル'], movement: 'PUSH' },
];

/** ---- CSV ロード関連 --------------------------------------------------- */

/** 道具のタグ抽出（CSVの「使用器具」自由記述 → 既定タグへ正規化） */
function parseTools(gearText: string | undefined): Tool[] {
  const text = (gearText || '').toLowerCase();
  const tags: Tool[] = [];
  if (/[バ|ﾊﾞ]ｰ?ﾍﾞﾙ|barbell|バーベル/.test(text)) tags.push('バーベル');
  if (/ダンベル|dumbbell/.test(text)) tags.push('ダンベル');
  if (/スミス|smith/.test(text)) tags.push('スミス');
  if (/マシン|machine/.test(text)) tags.push('マシン');
  if (/ケーブル|cable/.test(text)) tags.push('ケーブル');
  if (/自重|bodyweight/.test(text)) tags.push('自重');
  // 重複除去
  return Array.from(new Set(tags));
}

/** ID 生成（日本語名でも安定） */
function makeIdFromName(name: string, index: number): string {
  // encodeURIComponent によりURLセーフなIDに（重複の保険で index を付加）
  return `ex-${encodeURIComponent(name)}-${index}`;
}

/** CSVテキストを Exercise[] に変換
 * CSVヘッダ: 種目名,部位,主動作筋,協働筋,使用器具[,動作]  (動作列は任意: PUSH/PULL)
 */
function parseCsvToExercises(csvText: string): Exercise[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(',');
  // 最低限の列数チェック
  if (header.length < 5) return [];
  // (allow 5 or more columns; extra columns like 動作はオプション)

  const rows = lines.slice(1);
  const list: Exercise[] = rows
    .map((line, i) => {
      const cols = line.split(',');
      if (cols.length < 5) return null;
      const [name, part, prime, assist, gear, movementRaw] = cols
        .slice(0, 6)
        .map((s) => s.trim());
      // 部位は BodyPart に絞る（想定外は除外）
      const validPart = ['胸', '背中', '肩', '腕', '脚', '体幹'] as const;
      if (!validPart.includes(part as BodyPart)) return null;

      const tools = parseTools(gear);
      const upperMove = (movementRaw || '').toUpperCase();
      let movement: Movement;
      if (upperMove === 'PUSH' || upperMove === 'PULL') {
        movement = upperMove;
      } else {
        // fallback: 部位からざっくり推定（CSVに動作列が無い場合の保険）
        if (part === '背中') {
          movement = 'PULL';
        } else {
          movement = 'PUSH';
        }
      }
      return {
        id: makeIdFromName(name, i),
        name,
        part: part as BodyPart,
        tools,
        primeMuscle: prime || undefined,
        assistMuscle: assist || undefined,
        rawGearText: gear || undefined,
        movement,
      } as Exercise;
    })
    .filter((v): v is Exercise => !!v);

  return list;
}

/** CSV を取得して変換。失敗時は最小セットにフォールバック */
export async function loadExercises(): Promise<Exercise[]> {
  try {
    const res = await fetch('/date/exercises.csv', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const parsed = parseCsvToExercises(text);
    if (parsed.length === 0) throw new Error('parsed list is empty');
    return parsed;
  } catch (e) {
    console.warn('[exercises] CSV読み込みに失敗。フォールバックします:', e);
    return EXERCISES;
  }
}

/** ---- 既存ユーティリティ（配列に対するヘルパ） ----------------------- */

/** 部位でフィルタ（同期版：フォールバック配列に対して） */
export function listByPart(part?: BodyPart): Exercise[] {
  if (!part) return EXERCISES;
  return EXERCISES.filter(e => e.part === part);
}

/** IDで検索（同期版：フォールバック配列に対して） */
export function findById(id: string): Exercise | undefined {
  return EXERCISES.find(e => e.id === id);
}

/** 部位でフィルタ（CSVも考慮した非同期版：UIで使いたい場合はこっち） */
export async function listByPartAsync(part?: BodyPart): Promise<Exercise[]> {
  const all = await loadExercises();
  if (!part) return all;
  return all.filter(e => e.part === part);
}

/** 名前で部分一致検索（CSVも考慮した非同期版） */
export async function searchExercises(query: string, part?: BodyPart): Promise<Exercise[]> {
  const q = (query || '').trim().toLowerCase();
  const all = await loadExercises();
  const base = part ? all.filter(e => e.part === part) : all;
  if (!q) return base;
  return base.filter(e =>
    e.name.toLowerCase().includes(q) ||
    (e.primeMuscle || '').toLowerCase().includes(q) ||
    (e.assistMuscle || '').toLowerCase().includes(q) ||
    (e.rawGearText || '').toLowerCase().includes(q)
  );
}

/** 器具と主動作筋でフィルタ（部分一致） */
export async function filterByToolAndPrime(
  toolQuery?: string,
  primeMuscleQuery?: string
): Promise<Exercise[]> {
  const all = await loadExercises();
  const toolQ = (toolQuery || '').trim().toLowerCase();
  const primeQ = (primeMuscleQuery || '').trim().toLowerCase();

  return all.filter(e => {
    const toolsLower = e.tools.map(t => t.toLowerCase());
    const rawGearLower = (e.rawGearText || '').toLowerCase();

    const toolMatch =
      !toolQ ||
      toolsLower.some(t => t.includes(toolQ)) ||
      rawGearLower.includes(toolQ);

    const primeMatch =
      !primeQ ||
      (e.primeMuscle || '').toLowerCase().includes(primeQ);

    // 現状は AND 条件（両方の条件を満たしたものだけ）
    // 「どちらかに合えばOK（OR）」にしたくなったら `&&` を `||` に変更
    return toolMatch && primeMatch;
  });
}