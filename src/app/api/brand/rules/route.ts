// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
import { NextResponse } from "next/server";
import { addBrandRule, getBrand } from "@/lib/brand";

const MAX_RULE_LENGTH = 1000;

function brandIdOf(request: Request) {
  return new URL(request.url).searchParams.get("brandId");
}

export async function GET(request: Request) {
  const brand = await getBrand(brandIdOf(request));
  return NextResponse.json({ rules: brand.rules });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body as { text?: string };

    if (
      !text ||
      typeof text !== "string" ||
      !text.trim() ||
      text.trim().length > MAX_RULE_LENGTH
    ) {
      return NextResponse.json(
        { error: `Rule text is required (max ${MAX_RULE_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const rule = await addBrandRule(brandIdOf(request), text);
    if (!rule) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
