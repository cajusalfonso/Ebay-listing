export type TaskType =
  | "cleaning"
  | "maintenance"
  | "checkin_prep"
  | "laundry"
  | "restock"
  | "other";

export type TaskStatus = "todo" | "in_progress" | "done";

export const TASK_TYPES: TaskType[] = [
  "cleaning",
  "maintenance",
  "checkin_prep",
  "laundry",
  "restock",
  "other",
];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  cleaning: "Reinigung",
  maintenance: "Wartung",
  checkin_prep: "Check-in-Vorbereitung",
  laundry: "Wäsche",
  restock: "Auffüllen",
  other: "Sonstiges",
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

export const TASK_STATUS_BADGE: Record<
  TaskStatus,
  "default" | "secondary" | "outline"
> = {
  todo: "outline",
  in_progress: "secondary",
  done: "default",
};
