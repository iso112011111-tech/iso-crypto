import AiChat from "./AiChat";

export const metadata = { title: "ผู้ช่วย AI · iso-crypto" };

export default async function Page({ searchParams }: PageProps<"/ai">) {
  const { q } = await searchParams;
  return <AiChat initialInput={typeof q === "string" ? q : ""} />;
}
