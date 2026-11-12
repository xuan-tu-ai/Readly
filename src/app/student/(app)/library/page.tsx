import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Search, Sparkles } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/mascot/mascot";
import { FeaturedCarousel } from "@/components/works/featured-carousel";
import { WorkCard, WorkGrid, WorkShelf } from "@/components/works/work-card";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  GENRES,
  GENRE_LABEL,
  LENGTHS,
  LENGTH_LABEL,
  parseLibraryFilters,
  type LibraryFilters,
} from "@/lib/catalog";
import { requireUser } from "@/server/auth/dal";
import { listFeatured, listLibrary, type WorkCard as WorkCardData } from "@/server/services/works";

export const metadata: Metadata = { title: "Thư viện" };

export default function LibraryPage({ searchParams }: PageProps<"/student/library">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Library searchParams={searchParams} />
    </Suspense>
  );
}

async function Library({ searchParams }: Pick<PageProps<"/student/library">, "searchParams">) {
  await requireUser("STUDENT");
  const filters = parseLibraryFilters(await searchParams);
  const filtered = Object.values(filters).some((v) => v !== undefined);
  const [works, featured] = await Promise.all([listLibrary(filters), filtered ? [] : listFeatured()]);

  return (
    <div className="grid min-w-0 gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Thư viện</h1>
          <p className="text-muted-foreground">45 tác phẩm văn học lớp 12.</p>
        </div>
        <Link href="/student/quiz" className={buttonVariants({ variant: "outline", className: "uppercase" })}>
          <Sparkles aria-hidden className="text-brand-orange" /> Bài test sở thích
        </Link>
      </div>

      <FilterForm filters={filters} />

      {filtered ? (
        <section className="grid gap-4">
          <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
            {works.length} tác phẩm phù hợp
          </p>
          {works.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center">
              <Mascot pose="sad" size={96} label="" />
              <p className="font-bold">Không có tác phẩm nào khớp bộ lọc.</p>
              <Link href="/student/library" className={buttonVariants({ variant: "outline" })}>
                Xóa bộ lọc
              </Link>
            </div>
          ) : (
            <WorkGrid>
              {works.map((work) => (
                <li key={work.id}>
                  <WorkCard work={work} />
                </li>
              ))}
            </WorkGrid>
          )}
        </section>
      ) : (
        <>
          <FeaturedCarousel works={featured} />
          <Shelves works={works} />
        </>
      )}
    </div>
  );
}

/** Unfiltered library: readable works first, then one shelf per genre. */
function Shelves({ works }: { works: WorkCardData[] }) {
  const readable = works.filter((w) => w.status === "PUBLISHED");
  return (
    <div className="grid min-w-0 gap-8">
      {readable.length > 0 ? (
        <Shelf title="Đọc được ngay">
          {readable.map((work) => (
            <li key={work.id}>
              <WorkCard work={work} />
            </li>
          ))}
        </Shelf>
      ) : null}
      {GENRES.map((genre) => {
        const items = works.filter((w) => w.genre === genre);
        if (items.length === 0) return null;
        return (
          <Shelf key={genre} title={GENRE_LABEL[genre]} href={`/student/library?genre=${genre}`}>
            {items.map((work) => (
              <li key={work.id}>
                <WorkCard work={work} />
              </li>
            ))}
          </Shelf>
        );
      })}
    </div>
  );
}

function Shelf({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-bold text-brand-blue uppercase hover:underline">
            Xem tất cả
          </Link>
        ) : null}
      </div>
      <WorkShelf label={title}>{children}</WorkShelf>
    </section>
  );
}

const selectClass =
  "h-11 w-full rounded-xl border-2 border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FilterForm({ filters }: { filters: LibraryFilters }) {
  return (
    <Form
      action="/student/library"
      role="search"
      className="grid gap-3 rounded-2xl border-2 bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="q">Tìm tác phẩm hoặc tác giả</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Ví dụ: thơ, tác giả…" className="pl-10" />
        </div>
      </div>
      <FilterSelect id="genre" label="Thể loại" value={filters.genre} options={GENRES.map((g) => [g, GENRE_LABEL[g]])} />
      <FilterSelect id="length" label="Thời lượng" value={filters.length} options={LENGTHS.map((l) => [l, LENGTH_LABEL[l]])} />
      <FilterSelect
        id="difficulty"
        label="Độ khó"
        value={filters.difficulty?.toString()}
        options={DIFFICULTIES.map((d) => [String(d), DIFFICULTY_LABEL[d]])}
      />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" className="flex-1 lg:flex-none">
          Lọc
        </Button>
        <Link href="/student/library" className={buttonVariants({ variant: "ghost" })}>
          Xóa
        </Link>
      </div>
    </Form>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
}: {
  id: string;
  label: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} defaultValue={value ?? ""} className={selectClass}>
        <option value="">Tất cả</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
