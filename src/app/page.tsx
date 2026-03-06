"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BrandItem = {
  brandId: string;
  username: string;
  displayName: string;
  category: string | null;
  currentFollowerCount: number | null;
  previousFollowerCount: number | null;
  followerDiff: number | null;
  collectedAt: string | null;
  previousCollectedAt: string | null;
};

type ApiResponse = {
  data: BrandItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  lastUpdatedAt: string | null;
};

const CATEGORY = "american_casual";
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<BrandItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 검색어 debounce: 입력 멈춘 뒤 SEARCH_DEBOUNCE_MS 후에만 API에 반영
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return null;
    const date = new Date(lastUpdatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdatedAt]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("category", CATEGORY);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));
        if (debouncedSearch.trim().length > 0) {
          params.set("search", debouncedSearch.trim());
        }

        const res = await fetch(`/api/brands/ranking?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          console.error("브랜드 랭킹 조회 실패", await res.text());
          return;
        }

        const json = (await res.json()) as ApiResponse;

        setItems((prev) => (page === 0 ? json.data : [...prev, ...json.data]));
        setHasMore(json.pagination.hasMore);
        setLastUpdatedAt(json.lastUpdatedAt);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("브랜드 랭킹 조회 중 오류", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [page, debouncedSearch]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 1.0,
      },
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loading]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-8 font-sans dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-6 rounded-xl bg-white px-4 py-6 shadow-sm dark:bg-zinc-950 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Brands Insta Stat
            </h1>
            {formattedLastUpdated !== null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                데이터 기준 시각: {formattedLastUpdated}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              카테고리
              <span className="ml-2 rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                아메리칸 캐주얼
              </span>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="브랜드 이름 또는 계정(username)으로 검색"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>현재 팔로워 수 기준 내림차순 정렬</span>
            <span>
              총 {items.length}개{hasMore ? " +" : ""}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          {items.length === 0 && !loading && (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              해당 조건에 맞는 브랜드가 없습니다.
            </div>
          )}

          {/* 컬럼 위치 고정용 그리드 헤더 */}
          <div
            className="grid gap-x-4 rounded-t-md border border-zinc-200 border-b-0 bg-zinc-50 px-3 py-2 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 sm:px-4"
            style={{
              gridTemplateColumns: "2.5rem 1fr 6rem 5.5rem",
            }}
          >
            <span className="text-center">순위</span>
            <span>브랜드</span>
            <span className="text-right">현재 팔로워</span>
            <span className="text-right">전일 대비</span>
          </div>

          <ul className="flex flex-col divide-y divide-zinc-100 rounded-b-md border border-zinc-200 border-t-0 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {items.map((item, index) => {
              const rank = index + 1;
              const diff = item.followerDiff ?? 0;
              const diffLabel =
                item.followerDiff === null ? "-" : diff.toLocaleString("ko-KR");
              const diffClass =
                item.followerDiff === null
                  ? "text-zinc-500"
                  : diff > 0
                    ? "text-emerald-500"
                    : diff < 0
                      ? "text-rose-500"
                      : "text-zinc-500";

              const currentFollowers =
                item.currentFollowerCount === null
                  ? "-"
                  : item.currentFollowerCount.toLocaleString("ko-KR");

              const previousFollowers =
                item.previousFollowerCount === null
                  ? "-"
                  : item.previousFollowerCount.toLocaleString("ko-KR");

              return (
                <li
                  key={item.brandId}
                  className="grid items-center gap-x-4 px-3 py-3 sm:px-4 sm:py-3.5"
                  style={{
                    gridTemplateColumns: "2.5rem 1fr 6rem 5.5rem",
                  }}
                >
                  <span className="text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {rank}
                  </span>
                  <div className="min-w-0 flex flex-col">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {item.displayName}
                    </span>
                    <a
                      href={`https://www.instagram.com/${item.username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-zinc-500 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:decoration-zinc-500 dark:hover:text-zinc-300"
                    >
                      @{item.username}
                    </a>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      현재
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {currentFollowers}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      전일 대비
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${diffClass}`}>
                      {diffLabel === "-"
                        ? "-"
                        : diff > 0
                          ? `+${diffLabel}`
                          : diffLabel}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-500">
                      전일 {previousFollowers}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            ref={loadMoreRef}
            className="flex h-10 items-center justify-center text-xs text-zinc-500 dark:text-zinc-400"
          >
            {loading
              ? "불러오는 중..."
              : hasMore
                ? "아래로 스크롤하면 더 불러옵니다"
                : "더 이상 데이터가 없습니다"}
          </div>
        </section>
      </main>
    </div>
  );
}
