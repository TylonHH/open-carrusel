// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
// id: er-00809c4b
import { NextResponse } from "next/server";
import { listCarousels, createCarousel } from "@/lib/carousels";
import type { AspectRatio } from "@/types/carousel";

export async function GET(request: Request) {
  const brandId = new URL(request.url).searchParams.get("brandId");
  const carousels = await listCarousels(brandId);
  return NextResponse.json({ carousels });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, aspectRatio, brandId } = body as {
      name?: string;
      aspectRatio?: AspectRatio;
      brandId?: string;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const validRatios: AspectRatio[] = ["1:1", "4:5", "9:16"];
    const ratio = validRatios.includes(aspectRatio as AspectRatio)
      ? (aspectRatio as AspectRatio)
      : "4:5";

    const carousel = await createCarousel(
      name.trim(),
      ratio,
      typeof brandId === "string" ? brandId : null
    );
    return NextResponse.json(carousel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
