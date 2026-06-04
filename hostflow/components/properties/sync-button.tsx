"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { syncPropertyAction } from "@/lib/properties/sync-action";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

function InnerButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {pending ? "Synchronisiere …" : "Jetzt synchronisieren"}
    </Button>
  );
}

export function SyncButton({ propertyId }: { propertyId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    syncPropertyAction,
    null,
  );

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <InnerButton />
    </form>
  );
}
