import { NextResponse } from "next/server";
import { deleteBrand, getBrand, listBrands, updateBrand } from "@/lib/brand";
import { countCarouselsForBrand } from "@/lib/carousels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brands = await listBrands();
  if (!brands.some((b) => b.id === id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await getBrand(id));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updated = await updateBrand(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const count = await countCarouselsForBrand(id);
  if (count > 0) {
    return NextResponse.json(
      {
        error: `This brand still has ${count} carousel${count === 1 ? "" : "s"}. Delete or move them first.`,
      },
      { status: 409 }
    );
  }
  const removed = await deleteBrand(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
