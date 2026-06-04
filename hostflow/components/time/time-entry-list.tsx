"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTimeEntry } from "@/lib/time/actions";
import type { ActionState } from "@/lib/auth/actions";
import { entryCost, type TimeEntryRow } from "@/lib/time/cost";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Eintrag löschen"
      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function TimeEntryList({ entries }: { entries: TimeEntryRow[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteTimeEntry,
    null,
  );

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Noch keine Zeiteinträge.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li key={e.id}>
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {e.property?.name ?? "—"}
                  {e.task?.title && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {e.task.title}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(e.entry_date).toLocaleDateString("de-DE")} ·{" "}
                  {e.fixed_amount != null
                    ? "Pauschale"
                    : `${e.hours} Std. × ${euro.format(e.hourly_rate_snapshot ?? 0)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{euro.format(entryCost(e))}</Badge>
                <form action={formAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <DeleteButton />
                </form>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
