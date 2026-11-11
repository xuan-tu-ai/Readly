import type { Role } from "@/generated/prisma/enums";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
};

export function homePathFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
  }
}

/** Minimal user shape passed around the app (never includes the password hash). */
export type Actor = {
  id: string;
  role: Role;
};

export type CurrentUser = Actor & {
  name: string;
  email: string;
};
