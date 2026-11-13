import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanClassCode } from "@/lib/install";
import { CLASS_CODE_LENGTH } from "@/lib/validation";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Card>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold">Đăng ký học sinh</CardTitle>
        <CardDescription>Bạn cần mã lớp do giáo viên cung cấp.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* A class QR code links here with ?code=…; the form is shown at once and refilled when the code arrives. */}
        <Suspense fallback={<RegisterForm />}>
          <RegisterWithCode searchParams={searchParams} />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-bold text-primary underline-offset-4 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

async function RegisterWithCode({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { code } = await searchParams;
  return <RegisterForm classCode={cleanClassCode(code, CLASS_CODE_LENGTH)} />;
}
