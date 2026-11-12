/**
 * Demo data for SEED_DEMO=true, built on the real works in content/works:
 *
 * - Class DEMO12: 20 sample students with different reading habits, three
 *   assignments (two open, one past its deadline), graded answers, reading
 *   time, highlights, a class discussion and one AI report for the admin.
 * - The demo student (hocsinh@readly.local): one finished work, two in
 *   progress, highlights with notes, a prediction with AI feedback, a short
 *   streak and an avatar, so the home page and the reading profile are full.
 *
 * Runs once: skipped when the first sample student already exists.
 * Everything is deterministic (seeded random) and relative to `now`.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import type { AnswerLevel, HighlightColor } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/server/auth/password";
import { effectiveLevel, isPassing } from "../src/lib/questions/rules";
import { htmlToText } from "../src/lib/reading/html-text";
import { vnDay } from "../src/lib/reading/active-time";
import { anchorFor, sentenceAt } from "../src/lib/reading/text";
import { dueAtFromDate, vnDateString } from "../src/lib/teacher";
import { db as appDb } from "../src/server/db";
import { setJobSender } from "../src/server/queue";
import { evaluateBadges, recalculateUser, recordActivity } from "../src/server/services/gamification";

type Profile = "ace" | "good" | "late" | "behind" | "flagged" | "idle";

const STUDENTS: { name: string; profile: Profile }[] = [
  { name: "Nguyễn Hoàng Anh", profile: "ace" },
  { name: "Lê Thị Bích Ngọc", profile: "good" },
  { name: "Phạm Quốc Bảo", profile: "behind" },
  { name: "Đỗ Thu Hà", profile: "ace" },
  { name: "Vũ Minh Đức", profile: "late" },
  { name: "Bùi Khánh Linh", profile: "good" },
  { name: "Hoàng Gia Huy", profile: "idle" },
  { name: "Ngô Phương Thảo", profile: "good" },
  { name: "Đặng Tuấn Kiệt", profile: "flagged" },
  { name: "Trịnh Mai Chi", profile: "ace" },
  { name: "Lý Nhật Nam", profile: "late" },
  { name: "Phan Thanh Tâm", profile: "behind" },
  { name: "Mai Anh Thư", profile: "good" },
  { name: "Cao Đức Long", profile: "idle" },
  { name: "Trương Hải Yến", profile: "good" },
  { name: "Đinh Quang Minh", profile: "ace" },
  { name: "Võ Ngọc Trâm", profile: "late" },
  { name: "Hồ Thanh Sơn", profile: "behind" },
  { name: "Lâm Bảo Ngân", profile: "good" },
  { name: "Tạ Minh Khôi", profile: "idle" },
];

export const DEMO_STUDENT_PASSWORD = "readly-hs-123";
export const DEMO_STUDENT_COUNT = STUDENTS.length;
const emailFor = (i: number) => `hs${String(i + 1).padStart(2, "0")}@demo.readly.local`;
const MAIN_STUDENT_EMAIL = "hocsinh@readly.local";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Texts = { short: Record<AnswerLevel, string>; essay: string };

/** Sample answers written for each assigned work (graded as if by the AI). */
const ANSWERS: Record<string, Texts> = {
  "cau-ca-mua-thu": {
    short: {
      SAU_SAC:
        "Cảnh thu được tả bằng những chi tiết rất nhỏ, rất khẽ: nước “trong veo”, thuyền “bé tẻo teo”, lá vàng “khẽ đưa vèo”. Cái động nhẹ làm nổi bật sự tĩnh lặng, và đằng sau cảnh vắng là tâm trạng trầm ngâm, cô đơn của nhà thơ khi đã lui về ở ẩn.",
      DAT: "Cảnh thu yên tĩnh, trong trẻo với ao nước trong veo, chiếc thuyền câu nhỏ, còn người câu cá ngồi lặng lẽ rất lâu.",
      CHUA_DAT: "Cảnh mùa thu rất đẹp.",
    },
    essay:
      "Đọc “Câu cá mùa thu”, em như được ngồi bên một ao làng giữa mùa thu Bắc Bộ. Bức tranh được vẽ bằng những nét rất nhỏ: nước “trong veo”, chiếc thuyền “bé tẻo teo”, sóng biếc chỉ “hơi gợn tí”, lá vàng “khẽ đưa vèo”. Mọi chuyển động đều nhẹ đến mức gần như không có, vì thế cái tĩnh của ao thu càng sâu. Không gian được mở lên trời cao với “tầng mây lơ lửng”, “trời xanh ngắt” rồi lại thu về “ngõ trúc quanh co” vắng khách, khiến cảnh vừa thoáng đãng vừa quạnh quẽ. Giữa khung cảnh ấy là người câu cá “tựa gối, ôm cần”, ngồi lâu mà chẳng được gì, và chỉ một tiếng cá đớp dưới chân bèo cũng đủ làm giật mình. Em hiểu rằng nhà thơ không thật sự chú tâm vào việc câu cá; ông đang lặng lẽ với nỗi niềm riêng của một nhà nho đã rời chốn quan trường. Bài thơ giúp em yêu hơn vẻ đẹp bình dị của làng quê và thấm thía tâm hồn tinh tế, kín đáo của Nguyễn Khuyến.",
  },
  "hai-dua-tre": {
    short: {
      SAU_SAC:
        "Chi tiết cho thấy cuộc sống tù đọng, nghèo khó nơi phố huyện: mọi thứ đều nhỏ bé, leo lét như ngọn đèn con của chị Tí. Nhưng Liên vẫn giữ được tâm hồn nhạy cảm, biết thương người và khao khát một thế giới sáng hơn, như Hà Nội mà chuyến tàu đêm mang qua.",
      DAT: "Chi tiết cho thấy cuộc sống nghèo và buồn ở phố huyện, nhưng hai chị em Liên vẫn mong chờ một điều gì đó tươi sáng hơn.",
      CHUA_DAT: "Em thấy chi tiết này buồn.",
    },
    essay:
      "Đọc “Hai đứa trẻ”, em nhớ mãi hình ảnh Liên trong những giây phút chờ chuyến tàu đêm. Liên là một cô bé biết lo toan: trông cửa hàng thay mẹ, đếm từng đồng tiền lẻ, nhẹ nhàng đánh thức em khi tàu đến. Chị thương em, thương cả những đứa trẻ nhặt nhạnh ở chợ, thương mẹ con chị Tí, bà cụ Thi điên dù chính mình cũng chẳng có gì. Nhưng điều làm em xúc động nhất là tâm hồn giàu mơ ước của Liên. Khi đoàn tàu sáng rực đi qua, chị “lặng theo mơ tưởng” về Hà Nội xa xăm, sáng rực và huyên náo, như thấy một thế giới khác hẳn ngọn đèn con của chị Tí. Chuyến tàu chỉ đi qua trong chốc lát, rồi đêm tối lại bao trùm phố huyện, nhưng chính khát khao ấy giữ cho Liên không chìm hẳn vào cuộc sống mòn mỏi. Qua nhân vật, Thạch Lam cho em thấy lòng thương cảm với những kiếp người nhỏ bé và trân trọng ước mơ, dù mong manh, của họ.",
  },
  "thuong-vo": {
    short: {
      SAU_SAC:
        "Bà Tú hiện lên tảo tần, “lặn lội thân cò” nuôi cả “năm con với một chồng” mà vẫn “dám quản công”. Tú Xương vừa thương, vừa biết ơn, vừa tự trách mình là người chồng “hờ hững”, nên lời thơ hóm hỉnh mà thấm thía.",
      DAT: "Bà Tú rất vất vả buôn bán nuôi chồng con, còn nhà thơ thương vợ và tự trách mình.",
      CHUA_DAT: "Bà Tú đi buôn bán.",
    },
    essay:
      "Bài thơ “Thương vợ” cho em thấy chân dung bà Tú, một người phụ nữ tảo tần và giàu đức hi sinh. Quanh năm bà buôn bán ở “mom sông”, nơi đất nhô ra chênh vênh, để “nuôi đủ năm con với một chồng”. Hình ảnh “thân cò” lặn lội lúc vắng vẻ, chen chúc lúc “đò đông” làm em nhớ đến những câu ca dao về người mẹ, người vợ vất vả. Dù “năm nắng mười mưa”, bà vẫn “âu đành phận”, không một lời kể công. Điều đặc biệt là người viết bài thơ chính là ông chồng. Tú Xương nhìn vợ bằng ánh mắt thương yêu, biết ơn, rồi quay lại tự trách mình bằng lời “chửi” rất thật: “Có chồng hờ hững cũng như không!”. Em quý tấm lòng ấy vì không phải người chồng nào thời xưa cũng dám nhận lỗi trước vợ. Bài thơ khiến em thêm thương mẹ, thương những người phụ nữ lặng lẽ gánh vác gia đình.",
  },
};

/** Answers on the placeholder works (their text is placeholder too). */
const GENERIC: Texts = {
  short: {
    SAU_SAC:
      "Chi tiết gió qua hàng tre và nắng vàng trên đê gợi một làng quê yên bình. Em thấy tác giả dùng hình ảnh gần gũi để nói nỗi nhớ quê, nhịp thơ chậm như bước chân người đi xa.",
    DAT: "Chi tiết gió qua hàng tre làm em nhớ quê, khung cảnh rất yên bình và gần gũi với mọi người.",
    CHUA_DAT: "Em thấy đoạn này hay vì tả cảnh đẹp.",
  },
  essay:
    "Đọc tác phẩm, em ấn tượng nhất với cách tác giả dựng lại khung cảnh làng quê bằng những hình ảnh rất quen: gió qua hàng tre, nắng vàng trên đê, con đường nhỏ dẫn về nhà. Những chi tiết ấy không mới, nhưng được đặt cạnh nhau theo một nhịp chậm rãi, khiến người đọc như đang đi lại con đường tuổi thơ. Em nghĩ điều tác giả muốn gửi gắm là tình yêu với những gì bình dị nhất, thứ mà khi lớn lên và đi xa ta mới thấy quý. Đọc xong, em muốn gọi điện cho ông bà ở quê nhiều hơn.",
};

const FEEDBACK: Record<AnswerLevel, { strengths: string; improvements: string }> = {
  SAU_SAC: {
    strengths: "Câu trả lời bám sát văn bản, dẫn được chi tiết cụ thể và có cảm nhận riêng.",
    improvements: "Bạn có thể nói thêm về nghệ thuật (từ ngữ, nhịp điệu) làm nên vẻ đẹp của chi tiết.",
  },
  DAT: {
    strengths: "Bạn đã nêu được ý chính của câu hỏi.",
    improvements: "Thử trích dẫn từ ngữ cụ thể trong văn bản và giải thích vì sao nó quan trọng.",
  },
  CHUA_DAT: {
    strengths: "Bạn đã bắt đầu trả lời câu hỏi.",
    improvements: "Hãy chỉ ra chi tiết cụ thể trong văn bản rồi nói rõ chi tiết ấy gợi cho em điều gì.",
  },
};

const NOTES = [
  "Câu này làm em nhớ quê ngoại.",
  "Vì sao tác giả lại chọn hình ảnh này?",
  "Đọc to lên nghe rất hay.",
  "Từ ngữ ở đây rất đắt.",
  "Đoạn này buồn quá.",
];
const COLORS: HighlightColor[] = ["YELLOW", "BLUE", "PINK", "PURPLE"];

type WorkData = Awaited<ReturnType<typeof loadWork>>;

async function loadWork(db: PrismaClient, slug: string) {
  return db.work.findUniqueOrThrow({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      segments: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, content: true } },
      questions: {
        orderBy: [{ stage: "asc" }, { order: "asc" }],
        select: { id: true, type: true, segmentId: true, correctOptionId: true, options: true, stage: true, required: true },
      },
    },
  });
}

/** Sentence spans of a segment, for highlights and quotes. */
function sentences(html: string) {
  const text = htmlToText(html);
  const spans: { start: number; end: number }[] = [];
  let at = 0;
  while (at < text.length) {
    const span = sentenceAt(text, at);
    if (span && span.end > span.start && text.slice(span.start, span.end).trim().length > 12) spans.push(span);
    at = span ? Math.max(span.end + 1, at + 1) : at + 1;
  }
  return { text, spans };
}

type ReadOptions = {
  level: AnswerLevel;
  complete: boolean;
  dueAt: Date;
  createdAt: Date;
  flagShort?: boolean;
  /** Fixed highlights instead of random ones (the demo student). */
  highlights?: { segment: number; sentence: number; color: HighlightColor; note?: string }[];
};

export async function seedDemoClass(db: PrismaClient, classId: string, now = new Date()) {
  if (await db.user.findUnique({ where: { email: emailFor(0) }, select: { id: true } })) return null;

  const random = mulberry32(20261112);
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const between = (min: number, max: number) => min + random() * (max - min);
  const ago = (minH: number, maxH: number) => new Date(now.getTime() - between(minH, maxH) * HOUR);

  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, select: { teacherId: true } });
  const poem = await loadWork(db, "cau-ca-mua-thu");
  const story = await loadWork(db, "hai-dua-tre");
  const wife = await loadWork(db, "thuong-vo");
  const viDa = await loadWork(db, "day-thon-vi-da");

  // Two open assignments and one whose deadline passed 2 days ago.
  const due = (days: number) => dueAtFromDate(vnDateString(new Date(now.getTime() + days * DAY)))!;
  const assignments = [
    { work: poem, dueAt: due(4), createdAt: new Date(now.getTime() - 10 * DAY) },
    { work: story, dueAt: due(-2), createdAt: new Date(now.getTime() - 14 * DAY) },
    { work: wife, dueAt: due(9), createdAt: new Date(now.getTime() - 2 * DAY) },
  ];
  for (const a of assignments) {
    await db.assignment.upsert({
      where: { classId_workId: { classId, workId: a.work.id } },
      update: {},
      create: { classId, workId: a.work.id, dueAt: a.dueAt, createdAt: a.createdAt },
    });
  }
  const [poemA, storyA, wifeA] = assignments;

  /** Reads the first `count` segments, answers their required questions, and maybe completes. */
  const read = async (userId: string, work: WorkData, count: number, end: Date, opts: ReadOptions) => {
    const texts = ANSWERS[work.slug] ?? GENERIC;
    const segments = work.segments.slice(0, count);
    const start = end.getTime() - segments.length * between(0.6, 1.6) * HOUR;
    for (const [k, seg] of segments.entries()) {
      const readAt = new Date(start + (k + 1) * ((end.getTime() - start) / Math.max(1, segments.length)));
      await db.segmentRead.create({ data: { userId, segmentId: seg.id, readAt } });
      await db.readingTime.create({
        data: { userId, segmentId: seg.id, day: vnDay(readAt), seconds: Math.round(between(90, 420)) },
      });
    }
    const readIds = new Set(segments.map((seg) => seg.id));
    const owed = work.questions.filter(
      (q) => q.required && (q.stage === "DURING" ? q.segmentId !== null && readIds.has(q.segmentId) : opts.complete),
    );
    let flagged = Boolean(opts.flagShort);
    for (const q of owed) {
      const at = new Date(end.getTime() - between(0.1, 0.9) * HOUR);
      if (q.type === "MCQ") {
        const wrongFirst = random() < (opts.level === "SAU_SAC" ? 0.1 : 0.35);
        const wrong = (q.options as { id: string }[]).find((o) => o.id !== q.correctOptionId)!.id;
        const tries = wrongFirst ? [wrong, q.correctOptionId!] : [q.correctOptionId!];
        for (const [n, content] of tries.entries()) {
          const isCorrect = content === q.correctOptionId;
          await db.answer.create({
            data: {
              questionId: q.id,
              userId,
              attempt: n + 1,
              content,
              status: "GRADED",
              isCorrect,
              level: isCorrect ? "DAT" : "CHUA_DAT",
              submittedAt: at,
              gradedAt: at,
            },
          });
        }
        continue;
      }
      const levels: AnswerLevel[] =
        flagged && q.type === "SHORT"
          ? ["CHUA_DAT", "CHUA_DAT", "CHUA_DAT"]
          : opts.level === "DAT" && random() < 0.3
            ? ["CHUA_DAT", "DAT"]
            : [opts.level === "SAU_SAC" && random() < 0.25 ? "DAT" : opts.level];
      if (flagged && q.type === "SHORT") flagged = false;
      for (const [n, level] of levels.entries()) {
        const submittedAt = new Date(at.getTime() + n * 20 * 60_000);
        await db.answer.create({
          data: {
            questionId: q.id,
            userId,
            attempt: n + 1,
            content: q.type === "ESSAY" ? texts.essay : texts.short[level],
            status: "GRADED",
            level,
            ...FEEDBACK[level],
            submittedAt,
            gradedAt: new Date(submittedAt.getTime() + 40_000),
          },
        });
      }
    }

    // Highlights: most students mark the same few sentences, so the heatmap has hot spots.
    const marks =
      opts.highlights?.filter((h) => h.segment <= segments.length) ??
      segments.flatMap((_, k) => {
        if (random() < 0.45) return [];
        const sentence = random() < 0.7 ? Math.floor(random() * 2) : Math.floor(random() * 6);
        return [{ segment: k + 1, sentence, color: pick(COLORS), note: random() < 0.35 ? pick(NOTES) : undefined }];
      });
    for (const [k, mark] of marks.entries()) {
      const seg = segments[mark.segment - 1];
      const { text, spans } = sentences(seg.content);
      const span = spans[Math.min(mark.sentence, spans.length - 1)];
      if (!span) continue;
      await db.highlight.create({
        data: {
          userId,
          workId: work.id,
          segmentId: seg.id,
          ...span,
          ...anchorFor(text, span),
          color: mark.color,
          note: mark.note ?? null,
          isPrivate: !opts.highlights && random() < 0.12,
          createdAt: new Date(end.getTime() - (marks.length - k) * 4 * 60_000),
        },
      });
    }

    const last = segments.at(-1);
    if (last) {
      await db.readingProgress.create({
        data: { userId, workId: work.id, segmentId: last.id, segmentFraction: 0.9, startedAt: new Date(start), updatedAt: end },
      });
    }
    if (opts.complete && count >= work.segments.length) {
      await db.workCompletion.create({
        data: {
          userId,
          workId: work.id,
          completedAt: end,
          onTime: end.getTime() <= opts.dueAt.getTime() && end.getTime() >= opts.createdAt.getTime(),
        },
      });
    }
  };

  const passwordHash = await hashPassword(DEMO_STUDENT_PASSWORD);
  const ids: string[] = [];
  const all = (w: WorkData) => w.segments.length;

  for (const [i, s] of STUDENTS.entries()) {
    const user = await db.user.create({
      data: {
        email: emailFor(i),
        name: s.name,
        role: "STUDENT",
        passwordHash,
        settings: { create: {} },
        memberships: { create: { classId, joinedAt: new Date(now.getTime() - 20 * DAY) } },
      },
    });
    ids.push(user.id);

    switch (s.profile) {
      case "ace":
        await read(user.id, story, all(story), new Date(storyA.dueAt.getTime() - between(30, 90) * HOUR), { ...storyA, level: "SAU_SAC", complete: true });
        await read(user.id, poem, all(poem), ago(6, 40), { ...poemA, level: "SAU_SAC", complete: true });
        if (random() < 0.6) await read(user.id, wife, all(wife), ago(1, 20), { ...wifeA, level: "SAU_SAC", complete: true });
        break;
      case "good":
        await read(user.id, story, all(story), new Date(storyA.dueAt.getTime() - between(4, 40) * HOUR), { ...storyA, level: "DAT", complete: true });
        await read(user.id, poem, random() < 0.5 ? all(poem) : 1, ago(2, 30), { ...poemA, level: "DAT", complete: random() < 0.5 });
        break;
      case "late":
        await read(user.id, story, all(story), new Date(storyA.dueAt.getTime() + between(10, 30) * HOUR), { ...storyA, level: "DAT", complete: true });
        await read(user.id, poem, 1, ago(20, 60), { ...poemA, level: "DAT", complete: false });
        break;
      case "behind":
        await read(user.id, story, Math.ceil(all(story) * 0.5), ago(70, 120), { ...storyA, level: "DAT", complete: false });
        break;
      case "flagged":
        await read(user.id, story, all(story), new Date(storyA.dueAt.getTime() - 20 * HOUR), { ...storyA, level: "DAT", complete: true, flagShort: true });
        await read(user.id, poem, 1, ago(3, 10), { ...poemA, level: "CHUA_DAT", complete: false });
        break;
      case "idle":
        break;
    }
  }

  // ── The demo student everyone logs in with ──
  const main = await db.user.findUnique({ where: { email: MAIN_STUDENT_EMAIL }, select: { id: true } });
  if (main) {
    ids.push(main.id);
    await db.playerState.upsert({ where: { userId: main.id }, create: { userId: main.id, avatar: "muop" }, update: { avatar: "muop" } });
    await read(main.id, poem, all(poem), ago(26, 30), {
      ...poemA,
      level: "SAU_SAC",
      complete: true,
      highlights: [
        { segment: 1, sentence: 0, color: "YELLOW", note: "Chữ “trong veo” làm cả câu thơ trong theo." },
        { segment: 1, sentence: 3, color: "PURPLE", note: "Lấy động tả tĩnh: lá rơi rất khẽ." },
        { segment: 2, sentence: 2, color: "PINK" },
        { segment: 2, sentence: 3, color: "BLUE", note: "Vì sao tác giả không quan tâm đến việc câu được cá?" },
      ],
    });
    const prediction = poem.questions.find((q) => q.type === "PREDICTION");
    if (prediction) {
      await db.answer.create({
        data: {
          questionId: prediction.id,
          userId: main.id,
          attempt: 1,
          content: "Em đoán bài thơ tả một buổi đi câu vui vẻ ở làng quê, người câu được nhiều cá và cảnh thu rực rỡ.",
          status: "GRADED",
          submittedAt: ago(32, 34),
          gradedAt: ago(32, 34),
          feedback:
            "Em đoán đúng khung cảnh làng quê mùa thu và hình ảnh người đi câu. Nhưng bài thơ không vui nhộn: cảnh ao thu tĩnh lặng, “khách vắng teo”, người câu ngồi lâu “chẳng được” cá. Hãy nghĩ xem vì sao nhà thơ chọn một buổi câu lặng lẽ như thế để nói tâm trạng của mình?",
        },
      });
    }
    await read(main.id, story, 4, ago(3, 5), {
      ...storyA,
      level: "DAT",
      complete: false,
      highlights: [
        { segment: 1, sentence: 1, color: "PURPLE", note: "So sánh mây với hòn than sắp tàn, rất đẹp." },
        { segment: 1, sentence: 5, color: "PINK", note: "Liên buồn mà không hiểu vì sao." },
        { segment: 2, sentence: 9, color: "BLUE" },
        { segment: 4, sentence: 4, color: "YELLOW", note: "Ngọn đèn con của chị Tí xuất hiện lần nữa." },
      ],
    });
    await read(main.id, viDa, 1, ago(0.5, 1.5), {
      dueAt: now,
      createdAt: now,
      level: "DAT",
      complete: false,
      highlights: [{ segment: 1, sentence: 2, color: "YELLOW", note: "Vườn ai mướt quá xanh như ngọc." }],
    });
  }

  // ── Class discussion on "Hai đứa trẻ" ──
  const storyText = sentences(story.segments[5].content);
  const quoteSpan = storyText.spans[Math.min(8, storyText.spans.length - 1)];
  const posts = [
    {
      author: ids[0],
      type: "QUESTION" as const,
      body: "Vì sao Liên và An đêm nào cũng cố thức để chờ chuyến tàu, dù biết chẳng ai mua hàng nữa?",
      hoursAgo: 50,
      pinned: true,
      resolved: true,
      replies: [
        { author: ids[3], body: "Mình nghĩ chuyến tàu là thứ duy nhất mang ánh sáng của Hà Nội về phố huyện, hai chị em chờ nó như chờ một chút hi vọng." },
        { author: cls.teacherId, body: "Ý của Hà rất hay. Các em để ý thêm câu văn “Con tàu như đã đem một chút thế giới khác đi qua” nhé." },
      ],
      likes: [1, 3, 5, 7, 9],
    },
    {
      author: ids[1],
      type: "REFLECTION" as const,
      body: "Đoạn cuối làm mình rất xúc động. Hình ảnh ngọn đèn con của chị Tí chỉ chiếu sáng một vùng đất nhỏ giống như cuộc sống của những người ở phố huyện vậy.",
      hoursAgo: 30,
      quote: quoteSpan ? { segmentId: story.segments[5].id, ...quoteSpan, quote: storyText.text.slice(quoteSpan.start, quoteSpan.end) } : null,
      replies: [{ author: ids[9], body: "Đồng ý! Thạch Lam tả bóng tối rất nhiều để làm nổi bật mấy đốm sáng nhỏ." }],
      likes: [0, 2, 4, 9],
    },
    {
      author: ids[5],
      type: "QUESTION" as const,
      body: "Cụ Thi điên xuất hiện có một đoạn ngắn, theo các bạn nhân vật này có ý nghĩa gì?",
      hoursAgo: 12,
      replies: [],
      likes: [8],
    },
  ];
  for (const p of posts) {
    const createdAt = new Date(now.getTime() - p.hoursAgo * HOUR);
    const post = await db.post.create({
      data: {
        workId: story.id,
        classId,
        authorId: p.author,
        type: p.type,
        body: p.body,
        pinned: p.pinned ?? false,
        resolved: p.resolved ?? false,
        createdAt,
        ...(p.quote ? { segmentId: p.quote.segmentId, quoteStart: p.quote.start, quoteEnd: p.quote.end, quote: p.quote.quote } : {}),
      },
    });
    for (const [k, r] of p.replies.entries()) {
      await db.reply.create({ data: { postId: post.id, authorId: r.author, body: r.body, createdAt: new Date(createdAt.getTime() + (k + 1) * 2 * HOUR) } });
    }
    await db.postLike.createMany({ data: p.likes.map((k) => ({ postId: post.id, userId: ids[k] })) });
  }

  // ── The teacher flagged one AI grading for the admin (spec §6.5) ──
  const flaggedId = ids[STUDENTS.findIndex((s) => s.profile === "flagged")];
  const flaggedAnswer = await db.answer.findFirst({
    where: { userId: flaggedId, question: { type: "SHORT", workId: story.id }, level: "CHUA_DAT" },
    orderBy: { attempt: "desc" },
    select: { id: true },
  });
  if (flaggedAnswer) {
    await db.aiReport.create({
      data: {
        answerId: flaggedAnswer.id,
        reporterId: cls.teacherId,
        reason: "Học sinh đã nêu đúng ý cuộc sống nghèo khó ở phố huyện nhưng AI chấm Chưa đạt cả ba lần; rubric câu này cần nêu rõ thế nào là “Đạt”.",
        createdAt: new Date(now.getTime() - 20 * HOUR),
      },
    });
  }

  // Assignment notices for everyone in the class, as if sent when assigned.
  const members = await db.classMembership.findMany({ where: { classId, leftAt: null }, select: { studentId: true } });
  for (const a of assignments) {
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.studentId,
        kind: "ASSIGNMENT" as const,
        title: `Bài mới: ${a.work.title}`,
        href: `/student/works/${a.work.slug}`,
        workId: a.work.id,
        createdAt: a.createdAt,
      })),
    });
  }

  // Points, streaks and badges from the history above (same as the backfill script).
  // Historical data: store badge notices, but don't queue web pushes for them.
  setJobSender(async () => {});
  for (const userId of ids) {
    await recalculateUser(userId);
    const [reads, answers] = await Promise.all([
      appDb.segmentRead.findMany({ where: { userId }, select: { readAt: true } }),
      appDb.answer.findMany({ where: { userId, status: "GRADED" }, select: { submittedAt: true, isCorrect: true, level: true, teacherLevel: true } }),
    ]);
    for (const r of reads) await recordActivity(userId, r.readAt);
    for (const a of answers) if (a.isCorrect || isPassing(effectiveLevel(a))) await recordActivity(userId, a.submittedAt);
    await evaluateBadges(userId);
  }
  // The demo student keeps a 4-day streak up to today.
  if (main) for (let d = 3; d >= 0; d--) await recordActivity(main.id, new Date(now.getTime() - d * DAY));
  await appDb.$disconnect();
  return { students: STUDENTS.length, assignments: assignments.length, posts: posts.length };
}
