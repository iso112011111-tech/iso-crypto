import Journal from "./Journal";

export const metadata = { title: "สมุดเทรด · iso-crypto" };

export default async function Page({ searchParams }: PageProps<"/journal">) {
  const { add } = await searchParams;
  return <Journal addId={typeof add === "string" ? add : null} />;
}
