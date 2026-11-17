import {
  MIN_LOOP,
  SPEED_CAP,
  SPEED_GROWTH,
  TIMER_MIN,
  TIMER_START,
  TURTLE_SUBMERGED,
  TURTLE_VISIBLE,
} from "./constants";

// Lane data. Speeds are in cells per second at level 1; `spacing` is the
// start-to-start distance between entities, in cells.

export type EntityKind = "car" | "truck" | "log" | "turtle";
export type Zone = "road" | "river";

type LaneDef = {
  row: number;
  zone: Zone;
  dir: 1 | -1; // 1 = moves right
  speed: number;
  kind: EntityKind;
  width: number;
  spacing: number;
};

export const LANE_DEFS: readonly LaneDef[] = [
  // River (rows 1-6). Gap between entities is at least 1 cell.
  {
    row: 1,
    zone: "river",
    dir: 1,
    speed: 2.0,
    kind: "log",
    width: 4,
    spacing: 8,
  },
  {
    row: 2,
    zone: "river",
    dir: -1,
    speed: 1.6,
    kind: "turtle",
    width: 2,
    spacing: 5,
  },
  {
    row: 3,
    zone: "river",
    dir: 1,
    speed: 1.0,
    kind: "log",
    width: 2,
    spacing: 5,
  },
  {
    row: 4,
    zone: "river",
    dir: 1,
    speed: 1.8,
    kind: "log",
    width: 3,
    spacing: 7,
  },
  {
    row: 5,
    zone: "river",
    dir: -1,
    speed: 1.4,
    kind: "turtle",
    width: 3,
    spacing: 6,
  },
  {
    row: 6,
    zone: "river",
    dir: 1,
    speed: 1.2,
    kind: "log",
    width: 3,
    spacing: 6,
  },
  // Road (rows 8-12). Gap between entities is at least 2 cells.
  {
    row: 8,
    zone: "road",
    dir: -1,
    speed: 1.4,
    kind: "truck",
    width: 3,
    spacing: 8,
  },
  {
    row: 9,
    zone: "road",
    dir: 1,
    speed: 2.4,
    kind: "car",
    width: 1,
    spacing: 5,
  },
  {
    row: 10,
    zone: "road",
    dir: -1,
    speed: 1.8,
    kind: "truck",
    width: 2,
    spacing: 6,
  },
  {
    row: 11,
    zone: "road",
    dir: 1,
    speed: 3.2,
    kind: "car",
    width: 1,
    spacing: 6,
  },
  {
    row: 12,
    zone: "road",
    dir: -1,
    speed: 2.4,
    kind: "car",
    width: 1,
    spacing: 4,
  },
];

export type LaneItem = {
  col: number; // left edge, in cells (float)
  variant: number; // car color index
  phase: number; // turtle cycle offset, in seconds
};

export type Lane = {
  row: number;
  zone: Zone;
  dir: 1 | -1;
  speed: number; // cells per second, already scaled by level
  kind: EntityKind;
  width: number;
  spacing: number;
  loop: number; // cells; entities wrap around this length
  items: LaneItem[];
};

export const TURTLE_CYCLE = TURTLE_VISIBLE + TURTLE_SUBMERGED;

// Speed multiplier for a level: x1.15 per level above 1, capped.
export function speedFactor(level: number): number {
  return Math.min(SPEED_CAP, Math.pow(SPEED_GROWTH, level - 1));
}

// Round timer in seconds: 15 at level 1, minus 1 per level, never below the minimum.
export function roundTime(level: number): number {
  return Math.max(TIMER_MIN, TIMER_START - (level - 1));
}

export function buildLanes(level: number): Lane[] {
  const factor = speedFactor(level);
  return LANE_DEFS.map((def) => {
    const count = Math.ceil(MIN_LOOP / def.spacing);
    const loop = count * def.spacing;
    const items: LaneItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push({
        col: i * def.spacing,
        variant: (i + def.row) % 3,
        // Spread turtle groups across the cycle so they do not sink together.
        phase: (i * 1.7 + def.row * 0.9) % TURTLE_CYCLE,
      });
    }
    return {
      row: def.row,
      zone: def.zone,
      dir: def.dir,
      speed: def.speed * factor,
      kind: def.kind,
      width: def.width,
      spacing: def.spacing,
      loop,
      items,
    };
  });
}
