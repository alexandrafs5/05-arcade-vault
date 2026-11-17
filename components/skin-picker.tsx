"use client";

import { useId } from "react";
import { SKIN_LABELS, type SkinId } from "@/lib/games/skins";

type SkinPickerProps = {
  skins: readonly SkinId[];
  value: SkinId;
  onPick: (id: SkinId) => void;
  className?: string;
};

export function SkinPicker({
  skins,
  value,
  onPick,
  className,
}: SkinPickerProps) {
  const labelId = useId();
  return (
    <div className={className}>
      <div className="l" id={labelId}>
        Aspecto
      </div>
      <div className="skin-picker" role="radiogroup" aria-labelledby={labelId}>
        {skins.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={`skin-opt skin-${id}`}
            onClick={(e) => {
              onPick(id);
              // Keep Space/Enter free for the game after a click.
              e.currentTarget.blur();
            }}
          >
            <span className="skin-dot" aria-hidden="true" />
            {SKIN_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
