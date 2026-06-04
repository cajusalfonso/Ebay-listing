"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export function NewTaskButton({
  properties,
  members,
}: {
  properties: { id: string; name: string }[];
  members: { id: string; full_name: string; role: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Neue Aufgabe
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        properties={properties}
        members={members}
      />
    </>
  );
}
