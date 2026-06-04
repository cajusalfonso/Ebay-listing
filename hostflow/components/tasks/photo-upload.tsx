"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { recordTaskPhoto } from "@/lib/tasks/actions";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function PhotoUpload({
  taskId,
  organizationId,
}: {
  taskId: string;
  organizationId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("Datei zu groß (max. 10 MB).");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/${taskId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("task-photos")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        toast.error("Upload fehlgeschlagen.");
        return;
      }

      const { error } = await recordTaskPhoto(taskId, path);
      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Foto hochgeladen.");
      router.refresh();
    } catch {
      toast.error("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {uploading ? "Lädt hoch …" : "Foto hinzufügen"}
      </Button>
    </>
  );
}
