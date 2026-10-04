import CoinView from "./CoinView";

export default async function Page({ params }: PageProps<"/coin/[id]">) {
  const { id } = await params;
  return <CoinView id={decodeURIComponent(id)} />;
}
