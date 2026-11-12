import type { Prisma } from "@/generated/prisma/client";
import {
  LENGTH_RANGE,
  VISIBLE_STATUSES,
  normalizeSearch,
  type LibraryFilters,
} from "@/lib/catalog";
import { db } from "@/server/db";

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  author: true,
  genre: true,
  difficulty: true,
  estMinutes: true,
  status: true,
  coverUrl: true,
  tags: { select: { tag: { select: { slug: true, label: true, kind: true } } } },
} satisfies Prisma.WorkSelect;

type CardRow = Prisma.WorkGetPayload<{ select: typeof cardSelect }>;

function toCard({ tags, ...work }: CardRow) {
  return { ...work, tags: tags.map((t) => t.tag) };
}

export type WorkCard = ReturnType<typeof toCard>;

function filterWhere(filters: LibraryFilters): Prisma.WorkWhereInput {
  const where: Prisma.WorkWhereInput = { status: { in: [...VISIBLE_STATUSES] } };
  if (filters.genre) where.genre = filters.genre;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.length) {
    const { min, max } = LENGTH_RANGE[filters.length];
    where.estMinutes = max === null ? { gte: min } : { gte: min, lte: max };
  }
  if (filters.q) {
    const terms = normalizeSearch(filters.q).split(" ").filter(Boolean);
    where.AND = terms.map((term) => ({ searchText: { contains: term } }));
  }
  return where;
}

/** Library listing: readable works first, then "coming soon", each by title. */
export async function listLibrary(filters: LibraryFilters = {}): Promise<WorkCard[]> {
  const rows = await db.work.findMany({
    where: filterWhere(filters),
    select: cardSelect,
    // Postgres sorts enums in declaration order: PUBLISHED before COMING_SOON.
    orderBy: [{ status: "asc" }, { genre: "asc" }, { title: "asc" }],
  });
  return rows.map(toCard);
}

/** Every work a student can see – the candidate set for quiz recommendations. */
export async function listVisibleWorks(): Promise<WorkCard[]> {
  return listLibrary();
}

export async function getVisibleWorkBySlug(slug: string) {
  const work = await db.work.findFirst({
    where: { slug, status: { in: [...VISIBLE_STATUSES] } },
    select: {
      ...cardSelect,
      summary: true,
      authorBio: true,
      _count: { select: { segments: { where: { archivedAt: null } } } },
    },
  });
  if (!work) return null;
  const { _count, ...rest } = work;
  return { ...toCard(rest), summary: rest.summary, authorBio: rest.authorBio, segmentCount: _count.segments };
}

/** Readable works for the library hero carousel, with their summaries. */
export async function listFeatured(limit = 4) {
  const rows = await db.work.findMany({
    where: { status: "PUBLISHED" },
    select: { ...cardSelect, summary: true },
    orderBy: { title: "asc" },
    take: limit,
  });
  return rows.map(({ summary, ...row }) => ({ ...toCard(row), summary }));
}

export type FeaturedWork = Awaited<ReturnType<typeof listFeatured>>[number];
