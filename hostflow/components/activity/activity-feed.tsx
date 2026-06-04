import {
  describeActivity,
  type ActivityEntry,
} from "@/lib/data/activity";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `heute ${time}`;
  return `${date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  })} ${time}`;
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Noch keine Aktivitäten.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline justify-between gap-3 rounded-lg border p-3 text-sm"
        >
          <span>
            <span className="font-medium">
              {entry.actor?.full_name || "Jemand"}
            </span>{" "}
            <span className="text-muted-foreground">
              {describeActivity(entry)}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatWhen(entry.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
