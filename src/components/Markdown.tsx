import { Fragment, type ReactNode } from "react";

/** แปลง **ตัวหนา** และ *ตัวเอียง* ภายในบรรทัด (ไม่ใช้ HTML ดิบ ปลอดภัยจากสคริปต์แทรก) */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={k++} className="font-semibold text-fg">{m[1]}</strong>);
    else if (m[2] != null) out.push(<code key={k++} className="num rounded bg-panel-2 px-1 py-0.5 text-[12.5px] text-fg">{m[2]}</code>);
    else out.push(<em key={k++}>{m[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Markdown แบบย่อสำหรับคำตอบของ AI: หัวข้อ, รายการ, เส้นคั่น, ย่อหน้า */
export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: { indent: number; text: string }[] } | null = null;

  const flush = () => {
    if (!list) return;
    const L = list;
    const Tag = L.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`my-2 space-y-1 ${L.ordered ? "list-decimal" : "list-none"} pl-5`}>
        {L.items.map((it, i) => (
          <li key={i} className="relative leading-relaxed" style={{ marginLeft: it.indent * 14 }}>
            {!L.ordered && <span className="absolute -left-3.5 top-[0.65em] size-1 rounded-full bg-accent" />}
            {inline(it.text)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const num = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const m = (bullet ?? num)!;
      const ordered = !!num && !bullet;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push({ indent: Math.min(3, Math.floor(m[1].length / 2)), text: m[2] });
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (/^VERDICT:/.test(line)) continue; // บรรทัดสำหรับระบบ แสดงเป็นป้ายแยกแทน
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <h3 key={blocks.length} className={level <= 2 ? "mb-1.5 mt-5 text-[15px] font-semibold text-fg first:mt-0" : "mb-1 mt-3 text-sm font-semibold text-fg"}>
          {inline(h[2])}
        </h3>,
      );
    } else if (/^-{3,}$/.test(line.trim())) {
      blocks.push(<hr key={blocks.length} className="my-4 border-line" />);
    } else {
      blocks.push(
        <p key={blocks.length} className="my-2 leading-relaxed">
          {inline(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="text-[14px] text-[#d3d7f5]">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
