import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <Card>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>Tiếp tục hành trình đọc của bạn.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Học sinh mới?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Đăng ký bằng mã lớp
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
