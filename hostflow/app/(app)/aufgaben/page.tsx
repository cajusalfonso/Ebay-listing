import { Suspense } from "react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/data/profile";
import {
  getAssignableMembers,
  getPropertiesLite,
  getTasks,
  type TaskFilters,
} from "@/lib/data/tasks";
import { isStaffRole } from "@/lib/types";
import { todayInTimeZone } from "@/lib/properties/status";
import type { TaskStatus } from "@/lib/tasks/constants";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { NewTaskButton } from "@/components/tasks/new-task-button";

export const metadata = { title: "Aufgaben" };

export default async function AufgabenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await getCurrentUser();
  if (!current) return null;

  const sp = await searchParams;
  const isStaff = isStaffRole(current.profile.role);

  const filters: TaskFilters = {
    propertyId: sp.property,
    status: sp.status as TaskStatus | undefined,
    assignee: sp.assignee,
    due: sp.due as TaskFilters["due"],
  };

  const [tasks, properties, members] = await Promise.all([
    getTasks(filters),
    isStaff ? getPropertiesLite(current.organization.id) : Promise.resolve([]),
    isStaff
      ? getAssignableMembers(current.organization.id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aufgaben</h1>
          <p className="text-muted-foreground">
            {isStaff
              ? "Reinigung, Wartung und mehr – zuweisen und verfolgen."
              : "Deine zugewiesenen Aufgaben."}
          </p>
        </div>
        {isStaff &&
          (properties.length > 0 ? (
            <NewTaskButton properties={properties} members={members} />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/objekte">Zuerst ein Objekt anlegen</Link>
            </Button>
          ))}
      </div>

      <Suspense>
        <TaskFilterBar
          properties={properties}
          members={members}
          showProperty={isStaff}
          showAssignee={isStaff}
        />
      </Suspense>

      <TaskList
        tasks={tasks}
        today={todayInTimeZone()}
        isStaff={isStaff}
        properties={properties}
        members={members}
      />
    </div>
  );
}
