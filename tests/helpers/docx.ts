import JSZip from "jszip";

/**
 * Builds a real (minimal) .docx in memory for import tests. Each entry is a
 * paragraph: plain text, "" for an empty line, { heading } for a Heading 1,
 * { lines } for one paragraph with line breaks, or { italic } for an
 * italic paragraph.
 */
export type DocxParagraph = string | { heading: string } | { lines: string[] } | { italic: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (text: string, italic = false) =>
  `<w:r>${italic ? "<w:rPr><w:i/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

function paragraph(p: DocxParagraph): string {
  if (typeof p === "string") return p ? `<w:p>${run(p)}</w:p>` : "<w:p/>";
  if ("heading" in p) return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run(p.heading)}</w:p>`;
  if ("italic" in p) return `<w:p>${run(p.italic, true)}</w:p>`;
  return `<w:p>${p.lines.map((line, i) => (i ? "<w:r><w:br/></w:r>" : "") + run(line)).join("")}</w:p>`;
}

export async function makeDocx(paragraphs: DocxParagraph[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map(paragraph)
      .join("")}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
