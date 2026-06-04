"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  properties: { id: string; name: string }[];
  members: { id: string; full_name: string }[];
  showAssignee: boolean;
  showProperty: boolean;
}

const ALL = "all";

export function TaskFilterBar({
  properties,
  members,
  showAssignee,
  showProperty,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function current(key: string) {
    return searchParams.get(key) ?? ALL;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <FilterSelect
        value={current("due")}
        onChange={(v) => setParam("due", v)}
        ariaLabel="Fälligkeit"
        options={[
          { value: ALL, label: "Alle Termine" },
          { value: "today", label: "Heute" },
          { value: "overdue", label: "Überfällig" },
          { value: "upcoming", label: "Anstehend" },
        ]}
      />

      <FilterSelect
        value={current("status")}
        onChange={(v) => setParam("status", v)}
        ariaLabel="Status"
        options={[
          { value: ALL, label: "Alle Status" },
          ...TASK_STATUSES.map((s) => ({
            value: s,
            label: TASK_STATUS_LABELS[s],
          })),
        ]}
      />

      {showProperty && (
        <FilterSelect
          value={current("property")}
          onChange={(v) => setParam("property", v)}
          ariaLabel="Objekt"
          options={[
            { value: ALL, label: "Alle Objekte" },
            ...properties.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      )}

      {showAssignee && (
        <FilterSelect
          value={current("assignee")}
          onChange={(v) => setParam("assignee", v)}
          ariaLabel="Zuständig"
          options={[
            { value: ALL, label: "Alle Zuständigen" },
            { value: "unassigned", label: "Nicht zugewiesen" },
            ...members.map((m) => ({
              value: m.id,
              label: m.full_name || "Ohne Namen",
            })),
          ]}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  ariaLabel,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[8rem]" aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
