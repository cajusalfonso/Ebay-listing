import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold tracking-tight">404</p>
      <p className="text-muted-foreground">
        Diese Seite gibt es nicht (mehr).
      </p>
      <Button asChild>
        <Link href="/dashboard">Zum Dashboard</Link>
      </Button>
    </main>
  );
}
