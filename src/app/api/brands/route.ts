import { NextResponse } from "next/server";
import { createBrand, listBrands } from "@/lib/brand";

export async function GET() {
  const brands = await listBrands();
  return NextResponse.json({ brands });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.name !== "string" ||
      !body.name.trim()
    ) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const brand = await createBrand({ ...body, name: body.name.trim() });
    return NextResponse.json(brand, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
