import Alerts from "./Alerts";

export const metadata = { title: "แจ้งเตือน · iso-crypto" };

export default async function Page({ searchParams }: PageProps<"/alerts">) {
  const { add } = await searchParams;
  return <Alerts addId={typeof add === "string" ? add : null} />;
}
