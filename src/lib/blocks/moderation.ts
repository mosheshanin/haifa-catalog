import type { ListingBlock, ListingData } from "@/lib/blocks/types";

// Какие правки владельца проверяются до публикации, а какие публикуются сразу (раздел 2 ТЗ, решение 2 ноября 2026).
// Шапка и контакты проверяются всегда. Скрыть/показать блок и поменять порядок — сразу.
export const MODERATED_TYPES: ReadonlySet<ListingBlock["type"]> = new Set([
  "description",
  "address",
  "service_area",
  "gallery",
  "before_after",
  "video",
  "team",
  "portfolio",
  "certificates",
  "google",
]);

export type ChangeKey = "header" | "contacts" | "order" | string; // string — id блока
export type Change = {
  key: ChangeKey;
  type: ListingBlock["type"] | "header" | "contacts" | "order";
  kind: "added" | "removed" | "changed";
  before: unknown;
  after: unknown;
  moderated: boolean;
};

// Сравнение с устойчивым порядком ключей объекта.
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);
const withoutHidden = (b: ListingBlock) => ({ ...b, hidden: undefined });

// Что изменилось между опубликованной версией и черновиком.
export function diffListing(base: ListingData | null, next: ListingData): Change[] {
  if (!base) {
    return [{ key: "header", type: "header", kind: "added", before: null, after: next.header, moderated: true }];
  }
  const changes: Change[] = [];
  if (!same(base.header, next.header)) {
    changes.push({ key: "header", type: "header", kind: "changed", before: base.header, after: next.header, moderated: true });
  }
  if (!same(base.contacts, next.contacts)) {
    changes.push({ key: "contacts", type: "contacts", kind: "changed", before: base.contacts, after: next.contacts, moderated: true });
  }
  const baseById = new Map(base.blocks.map((b) => [b.id, b]));
  const nextById = new Map(next.blocks.map((b) => [b.id, b]));
  for (const b of next.blocks) {
    const old = baseById.get(b.id);
    if (!old) {
      changes.push({ key: b.id, type: b.type, kind: "added", before: null, after: b, moderated: MODERATED_TYPES.has(b.type) });
    } else if (!same(old, b)) {
      // Только «скрыть/показать» — сразу; изменение содержимого — по типу блока.
      const contentChanged = !same(withoutHidden(old), withoutHidden(b));
      changes.push({ key: b.id, type: b.type, kind: "changed", before: old, after: b, moderated: contentChanged && MODERATED_TYPES.has(b.type) });
    }
  }
  for (const b of base.blocks) {
    if (!nextById.has(b.id)) {
      // Удалить блок можно сразу: убрать информацию безопаснее, чем добавить.
      changes.push({ key: b.id, type: b.type, kind: "removed", before: b, after: null, moderated: false });
    }
  }
  const common = (ids: string[], other: Map<string, unknown>) => ids.filter((id) => other.has(id));
  const baseOrder = common(base.blocks.map((b) => b.id), nextById);
  const nextOrder = common(next.blocks.map((b) => b.id), baseById);
  if (!same(baseOrder, nextOrder)) {
    changes.push({ key: "order", type: "order", kind: "changed", before: baseOrder, after: nextOrder, moderated: false });
  }
  return changes;
}

// Порядок: основной список, а блоки только из второго встают после своего ближайшего соседа.
function mergeOrder(primary: string[], secondary: string[]): string[] {
  const out = [...primary];
  secondary.forEach((id, i) => {
    if (out.includes(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(secondary[j]);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, id);
  });
  return out;
}

// Собрать новую версию: из next берутся только изменения с ключами из keys, остальное остаётся как в base.
export function applyChanges(base: ListingData, next: ListingData, keys: ReadonlySet<ChangeKey>): ListingData {
  const baseById = new Map(base.blocks.map((b) => [b.id, b]));
  const nextById = new Map(next.blocks.map((b) => [b.id, b]));
  const pick = new Map<string, ListingBlock>();
  for (const id of new Set([...baseById.keys(), ...nextById.keys()])) {
    const a = baseById.get(id);
    const b = nextById.get(id);
    if (a && b) pick.set(id, keys.has(id) ? b : a);
    else if (b && keys.has(id)) pick.set(id, b);
    else if (a && !keys.has(id)) pick.set(id, a);
  }
  const baseIds = base.blocks.map((b) => b.id);
  const nextIds = next.blocks.map((b) => b.id);
  const order = keys.has("order") ? mergeOrder(nextIds, baseIds) : mergeOrder(baseIds, nextIds);
  return {
    ...base,
    header: keys.has("header") ? next.header : base.header,
    contacts: keys.has("contacts") ? next.contacts : base.contacts,
    blocks: order.filter((id) => pick.has(id)).map((id) => pick.get(id)!),
  };
}

// «Снять» правку из журнала: вернуть блок (или порядок) к состоянию «до».
export function revertChange(current: ListingData, change: { block_key: string; before: unknown; after: unknown }): ListingData {
  if (change.block_key === "order") {
    const ids = (change.before as string[]) ?? [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    const blocks = [...current.blocks].sort((a, b) => (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6));
    return { ...current, blocks };
  }
  const before = change.before as ListingBlock | null;
  const exists = current.blocks.some((b) => b.id === change.block_key);
  if (!before) return { ...current, blocks: current.blocks.filter((b) => b.id !== change.block_key) };
  if (exists) return { ...current, blocks: current.blocks.map((b) => (b.id === change.block_key ? before : b)) };
  return { ...current, blocks: [...current.blocks, before] };
}

export function changeTitle(c: Pick<Change, "type">, titles: Record<string, string>): string {
  if (c.type === "header") return "Шапка";
  if (c.type === "contacts") return "Контакты";
  if (c.type === "order") return "Порядок блоков";
  return titles[c.type] ?? c.type;
}
