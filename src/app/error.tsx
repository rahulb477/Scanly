"use client";
import { Button } from "@/components/ui/Button";
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center p-6 text-center"><section className="max-w-md"><h1 className="text-2xl font-bold">Unable to load this page</h1><p className="mt-3 text-slate-600">Please try again. If this continues, ask the administrator to check Firebase server configuration, permissions and service availability.</p><Button onClick={reset} className="mt-6">Try again</Button><a href="/login" className="mt-4 block underline">Go to sign in</a></section></main>;
}
