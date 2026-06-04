import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, User } from "lucide-react";

import { getCurrentUser } from "@/lib/data/profile";
import { getTask } from "@/lib/data/tasks";
import { isStaffRole } from "@/lib/types";
import {
  TASK_STATUS_BADGE,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/tasks/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusControl } from "@/components/tasks/status-control";
import { PhotoUpload } from "@/components/tasks/photo-upload";
import { PhotoGallery } from "@/components/tasks/photo-gallery";

export const metadata = { title: "Aufgabe" };

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentUser();
  if (!current) return null;

  const task = await getTask(id);
  if (!task) notFound();

  const isStaff = isStaffRole(current.profile.role);
  const isAssigned = task.assigned_to === current.userId;
  const canUpload = isStaff || isAssigned;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/aufgaben">
          <ArrowLeft className="h-4 w-4" /> Alle Aufgaben
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
        <Badge variant={TASK_STATUS_BADGE[task.status]}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: task.property?.color ?? "#94a3b8" }}
            />
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{task.property?.name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{TASK_TYPE_LABELS[task.type]}</Badge>
          </div>
          {task.due_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4" /> Fällig am{" "}
              {new Date(task.due_date).toLocaleDateString("de-DE")}
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            {task.assignee?.full_name
              ? `Zuständig: ${task.assignee.full_name}`
              : "Nicht zugewiesen"}
          </div>
          {task.status === "done" && task.completed_at && (
            <p className="text-status-free">
              Erledigt
              {task.completer?.full_name ? ` von ${task.completer.full_name}` : ""}{" "}
              am {new Date(task.completed_at).toLocaleString("de-DE")}
            </p>
          )}

          {task.description && (
            <>
              <Separator />
              <p className="whitespace-pre-wrap text-foreground">
                {task.description}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusControl taskId={task.id} status={task.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Foto-Nachweis</CardTitle>
          {canUpload && (
            <PhotoUpload
              taskId={task.id}
              organizationId={current.organization.id}
            />
          )}
        </CardHeader>
        <CardContent>
          <PhotoGallery
            taskId={task.id}
            photos={task.photos}
            canDelete={isStaff}
          />
        </CardContent>
      </Card>
    </div>
  );
}
