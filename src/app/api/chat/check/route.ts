// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
// id: er-00809c4b
import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai-provider";
import { isClaudeAvailable } from "@/lib/claude-path";
import { isOpenCodeAvailable } from "@/lib/opencode-path";

export async function GET() {
  const provider = getAiProvider();
  const available =
    provider === "opencode" ? isOpenCodeAvailable() : isClaudeAvailable();
  return NextResponse.json({ available, provider });
}
