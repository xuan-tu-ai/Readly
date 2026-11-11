import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Search, Sparkles } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkCard, WorkGrid } from "@/components/works/work-card";
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
import { listLibrary } from "@/server/services/works";

export const metadata: Metadata = { title: "Thư viện" };

export default function LibraryPage({ searchParams }: PageProps<"/student/library">) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Thư viện</h1>
          <p className="text-muted-foreground">45 tác phẩm văn học lớp 12.</p>
        </div>
        <Link href="/student/quiz" className={buttonVariants({ variant: "outline" })}>
          <Sparkles aria-hidden /> Làm bài test sở thích
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Library({ searchParams }: Pick<PageProps<"/student/library">, "searchParams">) {
  await requireUser("STUDENT");
  const filters = parseLibraryFilters(await searchParams);
  const works = await listLibrary(filters);
  const filtered = Object.values(filters).some((v) => v !== undefined);

  return (
    <>
      <FilterForm filters={filters} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {works.length} tác phẩm{filtered ? " phù hợp" : ""}
      </p>
      {works.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Không có tác phẩm nào khớp bộ lọc.{" "}
          <Link href="/student/library" className="font-medium text-primary underline-offset-4 hover:underline">
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
    </>
  );
}

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FilterForm({ filters }: { filters: LibraryFilters }) {
  return (
    <Form
      action="/student/library"
      role="search"
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="q">Tìm tác phẩm hoặc tác giả</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Ví dụ: thơ, tác giả…" className="pl-8" />
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
