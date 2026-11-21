import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";

// 该接口会被 Credamo 问卷页面（不同源）用 fetch 轮询调用，
// 用于判断某个 uid 是否已经在 LabWeb 走完完整实验流程（即 experiments 表已有对应记录）。
// 因此必须允许跨域读取响应。
const CORS_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");

  if (!uid || uid.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing uid" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    // experiments 表只有在 /api/submit 完整成功写入后才会出现该 uid 的一行，
    // 半途关闭、只点击外链但未完成实验的情况下不会有记录，
    // 所以"记录是否存在"天然等价于"是否真正完成实验"。
    const { data, error } = await supabase
      .from("experiments")
      .select("uid")
      .eq("uid", uid)
      .maybeSingle();

    if (error) {
      console.error("status check failed:", error);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json({ completed: !!data }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error("status check unexpected error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
