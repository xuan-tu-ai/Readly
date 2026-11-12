import { describe, expect, it } from "vitest";
import { anchorFor } from "@/lib/reading/text";
import { reanchor, similarity, type Anchor } from "@/lib/reading/reanchor";

function anchorIn(segmentId: string, text: string, quote: string, occurrence = 0): Anchor {
  let start = -1;
  for (let i = 0; i <= occurrence; i++) start = text.indexOf(quote, start + 1);
  if (start < 0) throw new Error("quote not in text");
  const span = { start, end: start + quote.length };
  return { segmentId, ...span, ...anchorFor(text, span) };
}

const S1 = "Gió qua hàng tre, nắng vàng trên đê.\nTiếng chim gọi bạn bên kia sông.\nChiều xuống chậm trên mái nhà ai.";
const S2 = "Đêm xuống trên sông. Trăng lên đầu núi.\nThuyền ai đậu bến sông trăng đó.";

describe("reanchor", () => {
  it("keeps highlights whose text did not change", () => {
    const a = anchorIn("s1", S1, "Tiếng chim gọi bạn");
    expect(reanchor(a, [{ id: "s1", text: S1 }])).toMatchObject({ segmentId: "s1", start: a.start, how: "unchanged" });
  });

  it("follows the quote when a paragraph is inserted before it", () => {
    const a = anchorIn("s1", S1, "Tiếng chim gọi bạn");
    const edited = `Một dòng mới chèn vào đầu.\n${S1}`;
    const r = reanchor(a, [{ id: "s1", text: edited }])!;
    expect(r.how).toBe("moved");
    expect(edited.slice(r.start, r.end)).toBe("Tiếng chim gọi bạn");
  });

  it("survives a spelling fix inside the quote (fuzzy, between the old context)", () => {
    const typo = S1.replace("Tiếng chim gọi bạn", "Tiếng chym gọi bạn");
    const a = anchorIn("s1", typo, "Tiếng chym gọi bạn bên kia sông");
    const r = reanchor(a, [{ id: "s1", text: S1 }])!;
    expect(r.how).toBe("fuzzy");
    expect(S1.slice(r.start, r.end)).toBe("Tiếng chim gọi bạn bên kia sông");
  });

  it("finds the quote in another segment when its paragraph moved there", () => {
    const a = anchorIn("s1", S1, "Chiều xuống chậm trên mái nhà ai");
    const shortened = S1.replace("\nChiều xuống chậm trên mái nhà ai.", "");
    const moved = `${S2}\nChiều xuống chậm trên mái nhà ai.`;
    const r = reanchor(a, [
      { id: "s1", text: shortened },
      { id: "s2", text: moved },
    ])!;
    expect(r).toMatchObject({ segmentId: "s2", how: "other-segment" });
    expect(moved.slice(r.start, r.end)).toBe("Chiều xuống chậm trên mái nhà ai");
  });

  it("orphans the highlight when its paragraph was deleted", () => {
    const a = anchorIn("s1", S1, "Tiếng chim gọi bạn bên kia sông");
    const deleted = S1.replace("\nTiếng chim gọi bạn bên kia sông.", "");
    expect(reanchor(a, [{ id: "s1", text: deleted }, { id: "s2", text: S2 }])).toBeNull();
  });

  it("orphans when the segment itself is gone and the quote is nowhere else", () => {
    const a = anchorIn("s1", S1, "nắng vàng trên đê");
    expect(reanchor(a, [{ id: "s2", text: S2 }])).toBeNull();
  });

  it("picks the occurrence whose surroundings match when a phrase repeats", () => {
    const a = anchorIn("s2", S2, "sông", 1); // "bến sông trăng", not "trên sông."
    const edited = `Mở đầu.\n${S2}`;
    const r = reanchor(a, [{ id: "s2", text: edited }])!;
    expect(edited.slice(r.start - 4, r.end + 6)).toBe("bến sông trăng");
  });

  it("measures similarity", () => {
    expect(similarity("Tiếng chim", "Tiếng chym")).toBeCloseTo(0.9);
    expect(similarity("", "")).toBe(1);
  });
});
