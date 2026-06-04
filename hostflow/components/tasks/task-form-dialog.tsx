"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { createTask, updateTask } from "@/lib/tasks/actions";
import type { ActionState } from "@/lib/auth/actions";
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
} from "@/lib/tasks/constants";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export interface TaskFormValues {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  property_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
}

interface OptionProperty {
  id: string;
  name: string;
}
interface OptionMember {
  id: string;
  full_name: string;
  role: string;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  properties,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskFormValues;
  properties: OptionProperty[];
  members: OptionMember[];
}) {
  const isEdit = Boolean(task);
  const action = isEdit ? updateTask : createTask;
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
          <DialogDescription>
            Aufgabe einem Objekt zuordnen, zuweisen und terminieren.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {task && <input type="hidden" name="id" value={task.id} />}

          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              name="title"
              defaultValue={task?.title}
              placeholder="z. B. Reinigung nach Check-out"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="type">Art</Label>
              <Select name="type" defaultValue={task?.type ?? "cleaning"}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Fällig am</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={task?.due_date ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_id">Objekt *</Label>
            <Select
              name="property_id"
              defaultValue={task?.property_id ?? undefined}
              required
            >
              <SelectTrigger id="property_id">
                <SelectValue placeholder="Objekt wählen" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Zuständig</Label>
            <Select
              name="assigned_to"
              defaultValue={task?.assigned_to ?? "unassigned"}
            >
              <SelectTrigger id="assigned_to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Niemand</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || "Ohne Namen"} ·{" "}
                    {ROLE_LABELS[m.role as UserRole]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={task?.description ?? ""}
              placeholder="Details, Checkliste, Hinweise …"
            />
          </div>

          <DialogFooter>
            <SubmitButton pendingText="Speichere …">
              {isEdit ? "Speichern" : "Aufgabe anlegen"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
