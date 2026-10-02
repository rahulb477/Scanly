import Link from "next/link";
export default function BusinessNotFound() {
  return <main className="grid min-h-screen place-items-center p-6 text-center"><section><h1 className="text-3xl font-bold">Business not found</h1><p className="mt-3 text-slate-600">This business page is unavailable. Please ask the business owner to verify the QR.</p><Link href="/" className="mt-6 block underline">Back home</Link></section></main>;
}
