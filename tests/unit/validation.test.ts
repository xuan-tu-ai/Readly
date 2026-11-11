import { describe, expect, it } from "vitest";
import { joinClassSchema, registerStudentSchema } from "@/lib/validation";
import { CLASS_CODE_ALPHABET, generateClassCode } from "@/server/services/classes";

describe("class code", () => {
  it("normalises spaces and case", () => {
    expect(joinClassSchema.parse({ classCode: " ab c 2d3 " }).classCode).toBe("ABC2D3");
  });

  it("rejects codes of the wrong length with a Vietnamese message", () => {
    const result = joinClassSchema.safeParse({ classCode: "ABC" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Mã lớp gồm 6 ký tự.");
  });

  it("generates 6 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateClassCode();
      expect(code).toHaveLength(6);
      for (const ch of code) expect(CLASS_CODE_ALPHABET).toContain(ch);
    }
  });

  it("never uses look-alike characters", () => {
    for (const ch of "0O1IL") expect(CLASS_CODE_ALPHABET).not.toContain(ch);
  });

  it("is driven by the injected random source", () => {
    expect(generateClassCode(() => 0)).toBe("AAAAAA");
  });
});

describe("student registration input", () => {
  const valid = { name: "Trần Văn A", email: " An@Example.COM ", password: "12345678", classCode: "demo12" };

  it("trims and lower-cases email, upper-cases class code", () => {
    const data = registerStudentSchema.parse(valid);
    expect(data.email).toBe("an@example.com");
    expect(data.classCode).toBe("DEMO12");
  });

  it("requires a password of at least 8 characters", () => {
    const result = registerStudentSchema.safeParse({ ...valid, password: "1234567" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["password"]);
  });

  it("requires a class code", () => {
    const result = registerStudentSchema.safeParse({ ...valid, classCode: "" });
    expect(result.success).toBe(false);
  });
});
