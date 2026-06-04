"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, Pencil, Trash2 } from "lucide-react";

import { deleteTask } from "@/lib/tasks/actions";
import type { ActionState } from "@/lib/auth/actions";
import type { TaskRow } from "@/lib/data/tasks";
import {
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/tasks/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusControl } from "@/components/tasks/status-control";
import {
  TaskFormDialog,
  type TaskFormValues,
} from "@/components/tasks/task-form-dialog";

interface Props {
  tasks: TaskRow[];
  today: string;
  isStaff: boolean;
  properties: { id: string; name: string }[];
  members: { id: string; full_name: string; role: string }[];
}

export function TaskList({ tasks, today, isStaff, properties, members }: Props) {
  const [editTarget, setEditTarget] = useState<TaskFormValues | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Keine Aufgaben gefunden.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {tasks.map((task) => {
          const overdue =
            task.due_date != null &&
            task.due_date < today &&
            task.status !== "done";
          const photoCount = task.photo_count?.[0]?.count ?? 0;
          return (
            <li key={task.id}>
              <Card className="overflow-hidden">
                <div className="flex">
                  <div
                    className="w-1.5 shrink-0"
                    style={{ backgroundColor: task.property?.color ?? "#94a3b8" }}
                  />
                  <CardContent className="flex-1 space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/aufgaben/${task.id}`}
                        className="font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                      <Badge variant={TASK_STATUS_BADGE[task.status]}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{task.property?.name ?? "—"}</span>
                      <span>· {TASK_TYPE_LABELS[task.type]}</span>
                      {task.assignee?.full_name && (
                        <span>· {task.assignee.full_name}</span>
                      )}
                      {photoCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          · <Camera className="h-3.5 w-3.5" /> {photoCount}
                        </span>
                      )}
                      {task.due_date && (
                        <Badge
                          variant="outline"
                          className={overdue ? "border-destructive text-destructive" : ""}
                        >
                          {new Date(task.due_date).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                          {overdue && " · überfällig"}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusControl taskId={task.id} status={task.status} />
                      {isStaff && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Bearbeiten"
                            onClick={() =>
                              setEditTarget({
                                id: task.id,
                                title: task.title,
                                description: task.description,
                                type: task.type,
                                property_id: task.property?.id ?? null,
                                assigned_to: task.assigned_to,
                                due_date: task.due_date,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Löschen"
                            onClick={() => setDeleteTarget(task)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {isStaff && (
        <>
          <TaskFormDialog
            open={Boolean(editTarget)}
            onOpenChange={(o) => !o && setEditTarget(null)}
            task={editTarget ?? undefined}
            properties={properties}
            members={members}
          />
          <DeleteTaskDialog
            task={deleteTarget}
            onClose={() => setDeleteTarget(null)}
          />
        </>
      )}
    </>
  );
}

function DeleteTaskDialog({
  task,
  onClose,
}: {
  task: TaskRow | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteTask,
    null,
  );

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      onClose();
    } else if (state?.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aufgabe löschen?</DialogTitle>
          <DialogDescription>
            „{task?.title}&ldquo; wird endgültig entfernt.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={task?.id ?? ""} />
            <SubmitButton variant="destructive" pendingText="Lösche …">
              Löschen
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
