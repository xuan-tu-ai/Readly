import { AppShell } from "@/components/app-shell";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <AppShell role="STUDENT">{children}</AppShell>;
}
