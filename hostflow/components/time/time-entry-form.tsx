"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createTimeEntry } from "@/lib/time/actions";
import type { ActionState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/forms/submit-button";

interface Props {
  properties: { id: string; name: string }[];
  tasks: { id: string; title: string; property_id: string }[];
  defaultRate: number | null;
  today: string;
}

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function TimeEntryForm({ properties, tasks, defaultRate, today }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTimeEntry,
    null,
  );
  const [mode, setMode] = useState<"hours" | "fixed">("hours");
  const [propertyId, setPropertyId] = useState<string>(
    properties[0]?.id ?? "",
  );
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      setHours("");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const tasksForProperty = useMemo(
    () => tasks.filter((t) => t.property_id === propertyId),
    [tasks, propertyId],
  );

  const preview =
    mode === "hours" && defaultRate != null && Number(hours) > 0
      ? euro.format(Number(hours) * defaultRate)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zeit erfassen</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mode" value={mode} />

          <div className="space-y-2">
            <Label htmlFor="property_id">Objekt *</Label>
            <Select
              value={propertyId}
              onValueChange={setPropertyId}
              name="property_id"
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
            <Label htmlFor="task_id">Aufgabe (optional)</Label>
            <Select name="task_id" defaultValue="none">
              <SelectTrigger id="task_id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Aufgabe</SelectItem>
                {tasksForProperty.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry_date">Datum</Label>
            <Input
              id="entry_date"
              name="entry_date"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          {/* Umschalter Stunden / Pauschale */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("hours")}
              className={cn(
                "rounded-md border p-2 text-sm font-medium transition-colors",
                mode === "hours"
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Stunden
            </button>
            <button
              type="button"
              onClick={() => setMode("fixed")}
              className={cn(
                "rounded-md border p-2 text-sm font-medium transition-colors",
                mode === "fixed"
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Pauschale
            </button>
          </div>

          {mode === "hours" ? (
            <div className="space-y-2">
              <Label htmlFor="hours">Stunden</Label>
              <Input
                id="hours"
                name="hours"
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="z. B. 2.5"
              />
              <p className="text-xs text-muted-foreground">
                {defaultRate != null
                  ? `Dein Satz: ${euro.format(defaultRate)} / Std.`
                  : "Kein Stundensatz hinterlegt – bitte Pauschale nutzen."}
                {preview && ` · Kosten: ${preview}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="fixed_amount">Pauschale (€)</Label>
              <Input
                id="fixed_amount"
                name="fixed_amount"
                type="number"
                min="0"
                step="0.5"
                placeholder="z. B. 60"
              />
            </div>
          )}

          <SubmitButton className="w-full" pendingText="Speichere …">
            Erfassen
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
