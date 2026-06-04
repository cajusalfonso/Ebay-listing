"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CostFilter({
  month,
  propertyId,
  properties,
}: {
  month: string;
  propertyId?: string;
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="month" className="text-xs text-muted-foreground">
          Monat
        </Label>
        <Input
          id="month"
          type="month"
          value={month}
          onChange={(e) => setParam("month", e.target.value)}
          className="h-9 w-auto"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Objekt</Label>
        <Select
          value={propertyId ?? "all"}
          onValueChange={(v) => setParam("property", v)}
        >
          <SelectTrigger className="h-9 w-auto min-w-[10rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekte</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
