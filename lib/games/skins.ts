// Visual skins shared by every game. `classic` is the default and keeps the
// look a game shipped with; `neon` and `retro` are alternative palettes/styles.

export type SkinId = "classic" | "neon" | "retro";

export const SKIN_IDS: SkinId[] = ["classic", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "classic";

// Spanish UI labels.
export const SKIN_LABELS: Record<SkinId, string> = {
  classic: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && (SKIN_IDS as string[]).includes(value);
}

export const skinStorageKey = (gameId: string) => `av_skin_${gameId}`;
