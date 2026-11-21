// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
// id: er-00809c4b
import { Mutex } from "async-mutex";
import { readData, readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import type { BrandConfig, BrandRule, BrandsData } from "@/types/brand";
import { DEFAULT_BRAND } from "@/types/brand";

const FILE = "brands.json";
const LEGACY_FILE = "brand.json";
const brandMutex = new Mutex();

function normalizeBrand(raw: Partial<BrandConfig> | null): BrandConfig {
  return {
    ...DEFAULT_BRAND,
    ...raw,
    colors: { ...DEFAULT_BRAND.colors, ...raw?.colors },
    fonts: { ...DEFAULT_BRAND.fonts, ...raw?.fonts },
    customFonts: raw?.customFonts ?? [],
    styleKeywords: raw?.styleKeywords ?? [],
    rules: raw?.rules ?? [],
  };
}

// Reads brands.json. On first run, migrates the single-brand brand.json
// (kept on disk untouched as a backup) into the first entry.
async function loadAll(): Promise<BrandConfig[]> {
  try {
    const data = await readData<BrandsData>(FILE);
    return (data.brands ?? []).map(normalizeBrand);
  } catch {
    // brands.json missing or unreadable: try the legacy file
  }

  const legacy = await readDataSafe<Partial<BrandConfig> | null>(
    LEGACY_FILE,
    null
  );
  if (legacy && typeof legacy.name === "string" && legacy.name.trim()) {
    const migrated = normalizeBrand({
      ...legacy,
      id: "default",
      createdAt: legacy.createdAt || now(),
    });
    await writeData<BrandsData>(FILE, { brands: [migrated] });
    return [migrated];
  }
  return [];
}

async function saveAll(brands: BrandConfig[]): Promise<void> {
  await writeData<BrandsData>(FILE, { brands });
}

export async function listBrands(): Promise<BrandConfig[]> {
  return loadAll();
}

/** Returns the requested brand, or the first brand when no id is given. */
export async function getBrand(brandId?: string | null): Promise<BrandConfig> {
  const brands = await loadAll();
  const found = brandId
    ? brands.find((b) => b.id === brandId)
    : brands[0];
  return found ?? normalizeBrand(null);
}

export async function getDefaultBrandId(): Promise<string | null> {
  const brands = await loadAll();
  return brands[0]?.id ?? null;
}

export async function createBrand(
  input: Partial<Omit<BrandConfig, "id" | "createdAt" | "updatedAt">>
): Promise<BrandConfig> {
  return brandMutex.runExclusive(async () => {
    const brands = await loadAll();
    const brand = normalizeBrand({
      ...input,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    });
    await saveAll([...brands, brand]);
    return brand;
  });
}

export async function deleteBrand(brandId: string): Promise<boolean> {
  return brandMutex.runExclusive(async () => {
    const brands = await loadAll();
    const remaining = brands.filter((b) => b.id !== brandId);
    if (remaining.length === brands.length) return false;
    await saveAll(remaining);
    return true;
  });
}

async function mutateBrand<T>(
  brandId: string | null | undefined,
  mutator: (current: BrandConfig) => { brand: BrandConfig; result: T },
  notFound: T
): Promise<T> {
  return brandMutex.runExclusive(async () => {
    const brands = await loadAll();
    const idx = brandId ? brands.findIndex((b) => b.id === brandId) : 0;
    if (idx === -1 || !brands[idx]) return notFound;
    const current = brands[idx];
    const outcome = mutator(current);
    if (outcome.brand !== current) {
      const next = [...brands];
      next[idx] = outcome.brand;
      await saveAll(next);
    }
    return outcome.result;
  });
}

/**
 * Updates a brand. Without a brandId the first brand is updated; if no brand
 * exists yet, one is created (keeps the original single-brand setup flow working).
 */
export async function updateBrand(
  brandId: string | null | undefined,
  updates: Partial<Omit<BrandConfig, "id" | "createdAt" | "updatedAt">>
): Promise<BrandConfig | null> {
  if (!brandId && (await listBrands()).length === 0) {
    return createBrand(updates);
  }
  return mutateBrand(
    brandId,
    (current) => {
      const updated: BrandConfig = {
        ...current,
        ...updates,
        id: current.id,
        colors: { ...current.colors, ...updates.colors },
        fonts: { ...current.fonts, ...updates.fonts },
        rules: updates.rules ?? current.rules,
        updatedAt: now(),
        createdAt: current.createdAt || now(),
      };
      return { brand: updated, result: updated as BrandConfig | null };
    },
    null
  );
}

export async function addBrandRule(
  brandId: string | null | undefined,
  text: string
): Promise<BrandRule | null> {
  const normalized = text.trim();
  return mutateBrand<BrandRule | null>(
    brandId,
    (current) => {
      const existing = current.rules.find(
        (rule) => rule.text.toLowerCase() === normalized.toLowerCase()
      );
      if (existing) {
        return { brand: current, result: existing };
      }

      const rule: BrandRule = {
        id: generateId(),
        text: normalized,
        createdAt: now(),
      };
      const brand: BrandConfig = {
        ...current,
        rules: [...current.rules, rule],
        updatedAt: now(),
        createdAt: current.createdAt || now(),
      };
      return { brand, result: rule };
    },
    null
  );
}

export async function updateBrandRule(
  brandId: string | null | undefined,
  id: string,
  text: string
): Promise<BrandRule | null> {
  return mutateBrand<BrandRule | null>(
    brandId,
    (current) => {
      const existing = current.rules.find((rule) => rule.id === id);
      if (!existing) {
        return { brand: current, result: null };
      }
      const rule: BrandRule = { ...existing, text: text.trim() };
      const brand: BrandConfig = {
        ...current,
        rules: current.rules.map((item) => (item.id === id ? rule : item)),
        updatedAt: now(),
      };
      return { brand, result: rule };
    },
    null
  );
}

export async function removeBrandRule(
  brandId: string | null | undefined,
  id: string
): Promise<boolean> {
  return mutateBrand<boolean>(
    brandId,
    (current) => {
      const rules = current.rules.filter((rule) => rule.id !== id);
      if (rules.length === current.rules.length) {
        return { brand: current, result: false };
      }
      const brand: BrandConfig = {
        ...current,
        rules,
        updatedAt: now(),
      };
      return { brand, result: true };
    },
    false
  );
}

export function isBrandConfigured(brand: BrandConfig): boolean {
  return brand.name.trim().length > 0;
}
