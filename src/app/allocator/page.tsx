import Allocator from "./Allocator";

export const metadata = { title: "แบ่งไม้ · iso-crypto" };

export default async function Page({ searchParams }: PageProps<"/allocator">) {
  const sp = await searchParams;
  const raw = sp.id ?? sp.symbol;
  const id = typeof raw === "string" && raw ? (raw.startsWith("dex:") ? raw : raw.toUpperCase()) : "BTC";
  return <Allocator initialId={id} />;
}
