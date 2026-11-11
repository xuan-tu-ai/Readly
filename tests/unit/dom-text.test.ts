// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { buildDomTextModel } from "@/lib/reading/dom-text";
import { htmlToText } from "@/lib/reading/html-text";
import { placeholderSegments } from "../../prisma/seed-content";

function mount(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

const samples = [
  "<p>Dòng 1<br />Dòng 2</p><p>A &amp; <em>B</em> C</p>",
  "<p><strong>NHÂN VẬT A:</strong> Lời thoại.</p><p><em>(Chỉ dẫn.)</em></p>",
  "<blockquote><p>Trích dẫn</p></blockquote><ul><li>một</li><li>hai</li></ul>",
  ...placeholderSegments({ title: "Bài thơ mẫu", genre: "THO" }, 1).map((s) => s.content),
  ...placeholderSegments({ title: "Vở kịch mẫu", genre: "KICH" }, 1).map((s) => s.content),
];

describe("DOM text model", () => {
  it.each(samples)("matches the server text model for %#", (html) => {
    expect(buildDomTextModel(mount(html)).text).toBe(htmlToText(html));
  });

  it("maps offsets to ranges and back across inline elements", () => {
    const root = mount("<p>A &amp; <em>Bê</em> C</p>");
    const model = buildDomTextModel(root);
    const start = model.text.indexOf("Bê");
    const range = model.toRange(start, start + 2)!;
    expect(range.toString()).toBe("Bê");
    expect(model.offsetOf(range.startContainer, range.startOffset)).toBe(start);
    expect(model.offsetOf(range.endContainer, range.endOffset)).toBe(start + 2);
  });

  it("spans line breaks", () => {
    const root = mount("<p>Dòng 1<br />Dòng 2</p>");
    const model = buildDomTextModel(root);
    expect(model.text.slice(5, 9)).toBe("1\nDò");
    expect(model.toRange(5, 9)!.toString()).toBe("1Dò"); // the virtual \n has no DOM text
  });

  it("returns null for nodes outside the root", () => {
    const model = buildDomTextModel(mount("<p>x</p>"));
    expect(model.offsetOf(document.body, 0)).toBeNull();
  });
});
