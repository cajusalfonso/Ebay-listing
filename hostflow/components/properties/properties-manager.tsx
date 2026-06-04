"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteProperty } from "@/lib/properties/actions";
import type { ActionState } from "@/lib/auth/actions";
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
import {
  PropertyFormDialog,
  type PropertyFormValues,
} from "@/components/properties/property-form-dialog";

export function PropertiesManager({
  properties,
}: {
  properties: PropertyFormValues[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PropertyFormValues | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PropertyFormValues | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Objekt anlegen
        </Button>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">
              Noch keine Objekte. Lege deine erste Ferienwohnung an.
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Erstes Objekt anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="h-1.5 w-full" style={{ backgroundColor: p.color }} />
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditTarget(p)}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(p)}
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {p.address && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{p.address}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {p.default_cleaning_fee != null && (
                    <span>Reinigung: {p.default_cleaning_fee.toFixed(2)} €</span>
                  )}
                  {p.ical_url && (
                    <span className="inline-flex items-center gap-1 text-status-free">
                      <CalendarCheck2 className="h-4 w-4" /> iCal verbunden
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Anlegen */}
      <PropertyFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Bearbeiten */}
      <PropertyFormDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        property={editTarget ?? undefined}
      />

      {/* Löschen */}
      <DeletePropertyDialog
        property={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DeletePropertyDialog({
  property,
  onClose,
}: {
  property: PropertyFormValues | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteProperty,
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
    <Dialog open={Boolean(property)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Objekt löschen?</DialogTitle>
          <DialogDescription>
            „{property?.name}&ldquo; wird mit allen zugehörigen Buchungen und
            Aufgaben entfernt. Das kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={property?.id ?? ""} />
            <SubmitButton variant="destructive" pendingText="Lösche …">
              Endgültig löschen
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
