import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase.client";

type BrandRow = {
  id: string;
  username: string;
  display_name: string | null;
  category: string | null;
};

type BrandStatsRow = {
  brand_id: string;
  follower_count: number | null;
  collected_at: string;
};

const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const category =
    searchParams.get("category") !== null
      ? searchParams.get("category")!
      : "american_casual";
  const search = searchParams.get("search");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  const limit = Math.min(
    Number.isNaN(Number(limitParam)) || limitParam === null
      ? DEFAULT_LIMIT
      : Number(limitParam),
    50,
  );
  const offset =
    Number.isNaN(Number(offsetParam)) || offsetParam === null
      ? 0
      : Number(offsetParam);

  let brandQuery = supabaseClient
    .from("brands")
    .select("id, username, display_name, category")
    .eq("category", category);

  if (search && search.trim().length > 0) {
    const keyword = `%${search.trim()}%`;
    brandQuery = brandQuery.or(
      `display_name.ilike.${keyword},username.ilike.${keyword}`,
    );
  }

  const { data: brands, error: brandsError } = await brandQuery;

  if (brandsError) {
    return NextResponse.json(
      {
        error: "브랜드 조회 중 오류가 발생했습니다.",
        details: brandsError.message,
      },
      { status: 500 },
    );
  }

  if (!brands || brands.length === 0) {
    return NextResponse.json({
      data: [],
      pagination: {
        total: 0,
        limit,
        offset,
        hasMore: false,
      },
      lastUpdatedAt: null,
    });
  }

  const brandIds = (brands as BrandRow[]).map((b) => b.id);

  const { data: stats, error: statsError } = await supabaseClient
    .from("brand_stats")
    .select("brand_id, follower_count, collected_at")
    .in("brand_id", brandIds);

  if (statsError) {
    return NextResponse.json(
      {
        error: "브랜드 통계 조회 중 오류가 발생했습니다.",
        details: statsError.message,
      },
      { status: 500 },
    );
  }

  const statsByBrand = new Map<string, BrandStatsRow[]>();
  let lastUpdatedAt: string | null = null;

  (stats as BrandStatsRow[]).forEach((row) => {
    const existing = statsByBrand.get(row.brand_id) ?? [];
    existing.push(row);
    statsByBrand.set(row.brand_id, existing);

    if (!lastUpdatedAt || row.collected_at > lastUpdatedAt) {
      lastUpdatedAt = row.collected_at;
    }
  });

  const enriched = (brands as BrandRow[]).map((brand) => {
    const brandStats = statsByBrand.get(brand.id) ?? [];
    brandStats.sort((a, b) => (a.collected_at < b.collected_at ? 1 : -1));

    const current = brandStats[0];
    const previous = brandStats[1];

    const currentFollowerCount = current?.follower_count ?? null;
    const previousFollowerCount = previous?.follower_count ?? null;

    const followerDiff =
      currentFollowerCount !== null && previousFollowerCount !== null
        ? currentFollowerCount - previousFollowerCount
        : null;

    return {
      brandId: brand.id,
      username: brand.username,
      displayName: brand.display_name ?? brand.username,
      category: brand.category,
      currentFollowerCount,
      previousFollowerCount,
      followerDiff,
      collectedAt: current?.collected_at ?? null,
      previousCollectedAt: previous?.collected_at ?? null,
    };
  });

  enriched.sort((a, b) => {
    const aFollowers = a.currentFollowerCount ?? 0;
    const bFollowers = b.currentFollowerCount ?? 0;
    return bFollowers - aFollowers;
  });

  const total = enriched.length;
  const paged = enriched.slice(offset, offset + limit);

  return NextResponse.json({
    data: paged,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    lastUpdatedAt,
  });
}

