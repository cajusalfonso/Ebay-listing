"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createProperty, updateProperty } from "@/lib/properties/actions";
import type { ActionState } from "@/lib/auth/actions";
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
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";

export interface PropertyFormValues {
  id: string;
  name: string;
  address: string | null;
  ical_url: string | null;
  default_cleaning_fee: number | null;
  notes: string | null;
  color: string;
}

const PRESET_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: PropertyFormValues;
}) {
  const isEdit = Boolean(property);
  const action = isEdit ? updateProperty : createProperty;
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    null,
  );
  const [color, setColor] = useState(property?.color ?? PRESET_COLORS[0]);

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Bei jedem Öffnen die Farbe synchronisieren.
  useEffect(() => {
    if (open) setColor(property?.color ?? PRESET_COLORS[0]);
  }, [open, property?.color]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Objekt bearbeiten" : "Neues Objekt"}</DialogTitle>
          <DialogDescription>
            Stammdaten der Ferienwohnung. Den iCal-Link kannst du später für den
            Kalender-Sync nutzen.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {property && <input type="hidden" name="id" value={property.id} />}
          <input type="hidden" name="color" value={color} />

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={property?.name}
              placeholder="z. B. Strandhaus Nordsee"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              name="address"
              defaultValue={property?.address ?? ""}
              placeholder="Straße, PLZ Ort"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ical_url">iCal-Link (Airbnb/Booking)</Label>
            <Input
              id="ical_url"
              name="ical_url"
              type="url"
              defaultValue={property?.ical_url ?? ""}
              placeholder="https://…/calendar.ics"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_cleaning_fee">
              Standard-Reinigungspauschale (€)
            </Label>
            <Input
              id="default_cleaning_fee"
              name="default_cleaning_fee"
              type="number"
              min="0"
              step="0.5"
              defaultValue={property?.default_cleaning_fee ?? ""}
              placeholder="optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={property?.notes ?? ""}
              placeholder="z. B. Schlüsselübergabe, WLAN, Besonderheiten"
            />
          </div>

          <div className="space-y-2">
            <Label>Farbe</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 transition-all",
                    color === c && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Farbe ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <SubmitButton pendingText="Speichere …">
              {isEdit ? "Speichern" : "Objekt anlegen"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
