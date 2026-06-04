"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Check, Play, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { setTaskStatus } from "@/lib/tasks/actions";
import type { ActionState } from "@/lib/auth/actions";
import type { TaskStatus } from "@/lib/tasks/constants";
import { Button } from "@/components/ui/button";

type Transition = {
  status: TaskStatus;
  label: string;
  icon: typeof Check;
  variant: "default" | "outline" | "secondary";
};

const TRANSITIONS: Record<TaskStatus, Transition[]> = {
  todo: [
    { status: "in_progress", label: "Starten", icon: Play, variant: "secondary" },
    { status: "done", label: "Erledigt", icon: Check, variant: "default" },
  ],
  in_progress: [
    { status: "done", label: "Erledigt", icon: Check, variant: "default" },
    { status: "todo", label: "Zurück", icon: Undo2, variant: "outline" },
  ],
  done: [
    { status: "todo", label: "Wieder öffnen", icon: RotateCcw, variant: "outline" },
  ],
};

function TransitionButton({ t }: { t: Transition }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="status"
      value={t.status}
      variant={t.variant}
      size="sm"
      disabled={pending}
    >
      <t.icon className="h-4 w-4" /> {t.label}
    </Button>
  );
}

export function StatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    setTaskStatus,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={taskId} />
      {TRANSITIONS[status].map((t) => (
        <TransitionButton key={t.status} t={t} />
      ))}
    </form>
  );
}
