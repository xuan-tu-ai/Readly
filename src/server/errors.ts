/** Expected business-rule failure. `message` is Vietnamese and safe to show to users. */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type DomainErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "CLASS_CODE_INVALID"
  | "ALREADY_IN_CLASS"
  | "NOT_IN_CLASS"
  | "CODE_GENERATION_FAILED";

export function forbidden(message = "Bạn không có quyền thực hiện thao tác này."): never {
  throw new DomainError("FORBIDDEN", message);
}

export function notFound(message = "Không tìm thấy dữ liệu."): never {
  throw new DomainError("NOT_FOUND", message);
}
