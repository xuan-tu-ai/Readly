import { describe, expect, it } from "vitest";
import { buildSegments, htmlToBlocks, suggestSegments } from "@/lib/content/segmenter";
import { docxToHtml, draftFromDocx } from "@/server/content/docx";
import { makeDocx } from "../helpers/docx";

const titlesOf = (draft: ReturnType<typeof suggestSegments>, genre: Parameters<typeof buildSegments>[1]) =>
  buildSegments(draft, genre).map((s) => s.title);

describe("htmlToBlocks", () => {
  it("splits top-level blocks and classifies them", () => {
    const blocks = htmlToBlocks("<h3>Khổ 1</h3><p>Dòng một<br />Dòng hai</p><p></p><p>* * *</p><p><em>Nghiêng</em> thường</p>");
    expect(blocks.map((b) => [b.kind, b.text])).toEqual([
      ["heading", "Khổ 1"],
      ["para", "Dòng một\nDòng hai"],
      ["empty", ""],
      ["separator", "* * *"],
      ["para", "Nghiêng thường"],
    ]);
    expect(blocks[4].html).toBe("<p><em>Nghiêng</em> thường</p>");
  });
});

describe("suggestSegments", () => {
  it("poem: one blank line separates stanzas; lines of a stanza join with <br>", () => {
    const html = "<p>Dòng 1</p><p>Dòng 2</p><p></p><p>Dòng 3</p><p>Dòng 4</p><p></p><p></p><p>Dòng 5</p>";
    const draft = suggestSegments(htmlToBlocks(html), "THO");
    expect(draft.starts).toEqual([true, false, true, false, true]);
    expect(buildSegments(draft, "THO")).toEqual([
      { title: "Khổ 1", html: "<p>Dòng 1<br />Dòng 2</p>" },
      { title: "Khổ 2", html: "<p>Dòng 3<br />Dòng 4</p>" },
      { title: "Khổ 3", html: "<p>Dòng 5</p>" },
    ]);
  });

  it("story: headings start parts, a single blank line does not break, long parts are cut", () => {
    const para = (n: number) => `<p>${`Câu văn số ${n} khá dài để kiểm tra độ dài phân đoạn. `.repeat(10)}</p>`;
    const html = `<h3>Phần mở đầu</h3>${para(1)}<p></p>${para(2)}<h3>Phần hai</h3>${Array.from({ length: 12 }, (_, i) => para(i + 3)).join("")}`;
    const draft = suggestSegments(htmlToBlocks(html), "TRUYEN_NGAN");
    const segments = buildSegments(draft, "TRUYEN_NGAN");
    expect(segments[0].title).toBe("Phần mở đầu");
    expect(segments[0].html).toContain("số 2"); // the single blank line did not split part one
    expect(segments[1].title).toBe("Phần hai");
    expect(segments.length).toBeGreaterThan(2); // 12 long paragraphs exceed the size limit
    for (const s of segments) expect(s.html.replace(/<[^>]+>/g, "").length).toBeLessThan(3000);
  });

  it("play: scene marker lines start scenes and become titles; '* * *' always breaks", () => {
    const html = [
      "<p>CẢNH 1</p>",
      "<p><strong>NHÂN VẬT A:</strong> Lời thoại.</p>",
      "<p><strong>NHÂN VẬT B:</strong> Lời đáp.</p>",
      "<p>Cảnh 2 – Trong nhà</p>",
      "<p><em>(Ánh đèn dịu xuống.)</em></p>",
      "<p>* * *</p>",
      "<p><strong>NHÂN VẬT A:</strong> Kết.</p>",
    ].join("");
    const draft = suggestSegments(htmlToBlocks(html), "KICH");
    expect(titlesOf(draft, "KICH")).toEqual(["CẢNH 1", "Cảnh 2 – Trong nhà", "Cảnh 3"]);
    expect(buildSegments(draft, "KICH")[0].html).toBe(
      "<p><strong>NHÂN VẬT A:</strong> Lời thoại.</p><p><strong>NHÂN VẬT B:</strong> Lời đáp.</p>",
    );
  });

  it("a scene word inside a sentence is not a marker", () => {
    const draft = suggestSegments(htmlToBlocks("<p>Cảnh 1 mở ra một buổi chiều rất dài, khi mọi người đã về nhà và bếp lửa đỏ.</p>"), "KICH");
    expect(draft.starts).toEqual([true]);
    expect(draft.titles).toEqual([null]);
  });
});

describe("real .docx import (mammoth)", () => {
  it("keeps headings, italics, line breaks and blank lines as boundary hints", async () => {
    const buffer = await makeDocx([
      { heading: "Khổ một" },
      { lines: ["Gió qua hàng tre", "Nắng vàng trên đê"] },
      "",
      { italic: "Lời đề từ nghiêng" },
      { heading: "Khổ hai" },
      "Đêm xuống trên sông",
    ]);
    const { html } = await docxToHtml(buffer);
    expect(html).toContain("<h3>Khổ một</h3>");
    expect(html).toContain("Gió qua hàng tre<br />Nắng vàng trên đê");
    expect(html).toContain("<em>Lời đề từ nghiêng</em>");

    const draft = await draftFromDocx(buffer, "THO");
    expect(buildSegments(draft, "THO")).toEqual([
      { title: "Khổ một", html: "<p>Gió qua hàng tre<br />Nắng vàng trên đê</p>" },
      { title: "Khổ 2", html: "<p><em>Lời đề từ nghiêng</em></p>" },
      { title: "Khổ hai", html: "<p>Đêm xuống trên sông</p>" },
    ]);
  });

  it("rejects files that are not .docx", async () => {
    await expect(docxToHtml(Buffer.from("không phải docx"))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
