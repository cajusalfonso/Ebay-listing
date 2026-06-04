"use client";

import { useActionState, useEffect } from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTaskPhoto } from "@/lib/tasks/actions";
import type { ActionState } from "@/lib/auth/actions";
import type { TaskPhoto } from "@/lib/data/tasks";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="absolute right-1 top-1 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
      aria-label="Foto löschen"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function PhotoGallery({
  taskId,
  photos,
  canDelete,
}: {
  taskId: string;
  photos: TaskPhoto[];
  canDelete: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteTaskPhoto,
    null,
  );

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Fotos. Lade ein Foto als Nachweis hoch.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
        >
          {photo.url ? (
            <Image
              src={photo.url}
              alt="Aufgaben-Foto"
              fill
              sizes="(max-width: 640px) 50vw, 200px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              nicht verfügbar
            </div>
          )}
          {canDelete && (
            <form action={formAction}>
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="storagePath" value={photo.storage_path} />
              <input type="hidden" name="taskId" value={taskId} />
              <DeleteButton />
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
