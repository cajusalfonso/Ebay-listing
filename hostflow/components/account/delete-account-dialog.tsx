"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/lib/account/actions";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/submit-button";

export function DeleteAccountDialog({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteAccount,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const matches = confirm.trim() === organizationName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Konto & alle Daten löschen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Konto unwiderruflich löschen?</DialogTitle>
          <DialogDescription>
            Alle Objekte, Buchungen, Aufgaben, Fotos, Zeiteinträge und Konten
            deiner Organisation werden dauerhaft gelöscht. Ein laufendes Abo wird
            gekündigt. Dies kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Tippe zur Bestätigung „{organizationName}&ldquo;
            </Label>
            <Input
              id="confirm"
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <SubmitButton
              variant="destructive"
              disabled={!matches}
              pendingText="Lösche …"
            >
              Endgültig löschen
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
