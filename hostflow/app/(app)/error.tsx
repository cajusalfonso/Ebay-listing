"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Bitte versuche es erneut. Falls das Problem bestehen bleibt, lade die
        Seite neu.
      </p>
      <Button onClick={reset}>Erneut versuchen</Button>
    </div>
  );
}
