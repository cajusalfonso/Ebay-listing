"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { removeMember, updateMember } from "@/lib/team/actions";
import type { ActionState } from "@/lib/auth/actions";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/forms/submit-button";

export type Member = {
  id: string;
  full_name: string;
  role: UserRole;
  hourly_rate: number | null;
};

const EDITABLE_ROLES = ["manager", "cleaner", "maintenance"] as const;

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function MemberList({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<Member | null>(null);

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {members.map((m) => {
          const isSelf = m.id === currentUserId;
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.full_name || "Ohne Namen"}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (Du)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.hourly_rate != null
                      ? `${m.hourly_rate.toFixed(2)} €/Std.`
                      : "Kein Stundensatz"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                  {ROLE_LABELS[m.role]}
                </Badge>
                {!isSelf && m.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(m)}
                    aria-label={`${m.full_name} bearbeiten`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <EditMemberDialog
        member={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EditMemberDialog({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  const [updateState, updateAction] = useActionState<ActionState, FormData>(
    updateMember,
    null,
  );
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    removeMember,
    null,
  );

  useEffect(() => {
    if (updateState?.message) {
      toast.success(updateState.message);
      onClose();
    } else if (updateState?.error) {
      toast.error(updateState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState]);

  useEffect(() => {
    if (removeState?.message) {
      toast.success(removeState.message);
      onClose();
    } else if (removeState?.error) {
      toast.error(removeState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeState]);

  return (
    <Dialog open={Boolean(member)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {member && (
          <>
            <DialogHeader>
              <DialogTitle>{member.full_name || "Teammitglied"}</DialogTitle>
              <DialogDescription>
                Rolle und Stundensatz anpassen oder das Mitglied entfernen.
              </DialogDescription>
            </DialogHeader>

            <form action={updateAction} className="space-y-4">
              <input type="hidden" name="profileId" value={member.id} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rolle</Label>
                  <Select name="role" defaultValue={member.role}>
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rate">Stundensatz (€)</Label>
                  <Input
                    id="edit-rate"
                    name="hourlyRate"
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={member.hourly_rate ?? ""}
                    placeholder="optional"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <SubmitButton pendingText="Speichere …">Speichern</SubmitButton>
              </DialogFooter>
            </form>

            <form action={removeAction} className="border-t pt-4">
              <input type="hidden" name="profileId" value={member.id} />
              <SubmitButton
                variant="destructive"
                size="sm"
                className="w-full"
                pendingText="Entferne …"
              >
                Aus dem Team entfernen
              </SubmitButton>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
