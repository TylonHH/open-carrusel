"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { BrandConfig } from "@/types/brand";

interface BrandSwitcherProps {
  brands: BrandConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BrandSwitcher({
  brands,
  activeId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: BrandSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = brands.find((b) => b.id === activeId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg border border-border bg-surface hover:bg-muted text-sm font-medium transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch brand"
      >
        <span
          className="h-4 w-4 rounded-full border border-border shrink-0"
          style={{ background: active?.colors.accent ?? "transparent" }}
        />
        <span className="max-w-[160px] truncate">
          {active?.name || "No brand"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 w-64 rounded-xl border border-border bg-surface shadow-xl p-1">
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {brands.map((brand) => (
              <li key={brand.id}>
                <button
                  role="option"
                  aria-selected={brand.id === activeId}
                  onClick={() => {
                    onSelect(brand.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-muted text-left"
                >
                  <span
                    className="h-4 w-4 rounded-full border border-border shrink-0"
                    style={{ background: brand.colors.accent }}
                  />
                  <span className="flex-1 truncate">{brand.name}</span>
                  {brand.id === activeId && (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> New brand
            </button>
            {active && (
              <>
                <button
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit &quot;{active.name}&quot;
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-destructive hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete brand
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
