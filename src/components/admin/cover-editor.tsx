"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImageUp, Link2, Trash2 } from "lucide-react";
import { removeCoverAction, setCoverLinkAction, uploadCoverAction } from "@/app/actions/admin-content";
import { WorkCover } from "@/components/works/work-cover";
import { Button } from "@/components/ui/button";
import type { Genre } from "@/generated/prisma/enums";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Cover of a work: upload a picture (previewed in the 2:3 frame it will be
 * cropped to), or link one hosted elsewhere, or remove it.
 */
export function CoverEditor({ work }: { work: { id: string; title: string; genre: Genre; coverUrl: string | null } }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [link, setLink] = useState(work.coverUrl?.startsWith("/api/covers/") ? "" : (work.coverUrl ?? ""));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // Free the preview's blob: URL when it is replaced or the editor goes away.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  };

  const choose = (picked: File | undefined) => {
    setMessage(null);
    if (!picked) return reset();
    if (!ACCEPT.split(",").includes(picked.type)) {
      setMessage({ ok: false, text: "Chỉ nhận ảnh JPG, PNG hoặc WebP." });
      return reset();
    }
    if (picked.size > MAX_BYTES) {
      setMessage({ ok: false, text: "Ảnh bìa tối đa 5 MB." });
      return reset();
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const run = (task: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        reset();
        setMessage({ ok: true, text: done });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });

  const upload = () => {
    if (!file) return;
    const data = new FormData();
    data.set("id", work.id);
    data.set("cover", file);
    run(() => uploadCoverAction(data), "Đã lưu ảnh bìa.");
  };

  return (
    <div className="grid gap-4">
      <div className="mx-auto w-40">
        {preview ? (
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-l-md rounded-r-xl shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL) */}
            <img src={preview} alt="Xem trước ảnh bìa" className="size-full object-cover" />
          </div>
        ) : (
          <WorkCover title={work.title} genre={work.genre} coverUrl={work.coverUrl} />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {preview
          ? "Xem trước: ảnh sẽ được cắt giữa theo khung này."
          : work.coverUrl
            ? "Ảnh bìa hiện tại."
            : "Chưa có ảnh: đang dùng bìa tự tạo theo thể loại."}
      </p>

      <input
        ref={input}
        id="cover-file"
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {file ? (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={reset} disabled={pending}>
            Hủy
          </Button>
          <Button type="button" onClick={upload} disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu bìa"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button type="button" onClick={() => input.current?.click()} disabled={pending}>
            <ImageUp /> {work.coverUrl ? "Đổi ảnh bìa" : "Tải ảnh bìa lên"}
          </Button>
          {work.coverUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => removeCoverAction(work.id), "Đã xóa ảnh bìa.")}
            >
              <Trash2 /> Xóa ảnh bìa
            </Button>
          ) : null}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        JPG, PNG hoặc WebP, tối đa 5 MB. Bìa hiển thị theo tỉ lệ <strong>2:3</strong> (dọc như bìa sách); nên dùng ảnh{" "}
        <strong>600×900</strong> px trở lên. Ảnh lệch tỉ lệ sẽ bị cắt bớt hai bên hoặc trên dưới.
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Hoặc dùng đường dẫn ảnh</summary>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setCoverLinkAction(work.id, link), link.trim() ? "Đã dùng ảnh từ đường dẫn." : "Đã xóa ảnh bìa.");
          }}
        >
          <input
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://… hoặc /covers/…"
            aria-label="Đường dẫn ảnh bìa"
            className="h-9 rounded-lg border-2 bg-background px-3 text-sm"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            <Link2 /> Dùng đường dẫn này
          </Button>
        </form>
      </details>

      {message ? (
        <p role="status" className={message.ok ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-destructive"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
