import { useState } from "react";

/** 可复用的问号提示图标，悬停或点击显示 tooltip */
export default function HelpIcon({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="help-icon-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      <span className="help-icon">?</span>
      {open && <span className="help-tooltip">{tip}</span>}
    </span>
  );
}
