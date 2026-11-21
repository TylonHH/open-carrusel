// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
// id: er-00809c4b
import { NextResponse } from "next/server";
import { getBrand, updateBrand } from "@/lib/brand";

// Single-brand compatible endpoint. Pass ?brandId= to target a specific brand;
// without it the first brand is used.
export async function GET(request: Request) {
  const brandId = new URL(request.url).searchParams.get("brandId");
  const brand = await getBrand(brandId);
  return NextResponse.json(brand);
}

export async function PUT(request: Request) {
  try {
    const brandId = new URL(request.url).searchParams.get("brandId");
    const body = await request.json();
    const updated = await updateBrand(brandId, body);
    if (!updated) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
