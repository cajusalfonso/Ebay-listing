"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteMember } from "@/lib/team/actions";
import type { ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/forms/submit-button";
import { ROLE_LABELS } from "@/lib/types";

const INVITE_ROLES = ["manager", "cleaner", "maintenance"] as const;

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    inviteMember,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      formRef.current?.reset();
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> Mitglied einladen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teammitglied einladen</DialogTitle>
          <DialogDescription>
            Lege Rolle und optional einen Stundensatz fest. Den Einladungslink
            teilst du anschließend mit der Person.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-Mail</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="person@beispiel.de"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <Select name="role" defaultValue="cleaner">
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-rate">Stundensatz (€)</Label>
              <Input
                id="invite-rate"
                name="hourlyRate"
                type="number"
                min="0"
                step="0.5"
                placeholder="optional"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton pendingText="Erstelle …">Einladung erstellen</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
