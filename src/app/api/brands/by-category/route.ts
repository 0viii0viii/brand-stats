import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase.client";

type BrandStatsRow = {
  follower_count: number | null;
  collected_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (!category) {
    return NextResponse.json(
      { error: "category 쿼리 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  const { data: brands, error: brandsError } = await supabaseClient
    .from("brands")
    .select("id, username, display_name, category")
    .eq("category", category);

  if (brandsError) {
    return NextResponse.json(
      { error: "브랜드 조회 중 오류가 발생했습니다.", details: brandsError.message },
      { status: 500 },
    );
  }

  if (!brands || brands.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const results = await Promise.all(
    brands.map(async (brand) => {
      const { data: stats, error: statsError } = await supabaseClient
        .from("brand_stats")
        .select("follower_count, collected_at")
        .eq("brand_id", brand.id)
        .order("collected_at", { ascending: false })
        .limit(2);

      if (statsError) {
        return {
          brandId: brand.id,
          username: brand.username,
          displayName: brand.display_name ?? brand.username,
          category: brand.category,
          currentFollowerCount: null,
          previousFollowerCount: null,
          collectedAt: null,
          previousCollectedAt: null,
          error: statsError.message,
        };
      }

      const [current, previous] = (stats ?? []) as BrandStatsRow[];

      return {
        brandId: brand.id,
        username: brand.username,
        displayName: brand.display_name ?? brand.username,
        category: brand.category,
        currentFollowerCount: current?.follower_count ?? null,
        previousFollowerCount: previous?.follower_count ?? null,
        collectedAt: current?.collected_at ?? null,
        previousCollectedAt: previous?.collected_at ?? null,
      };
    }),
  );

  return NextResponse.json({ data: results });
}

