import { useMemo, useRef } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { getChartDataPointCount, getChartRenderer } from "../../charts/ChartRenderer";
import { elementStartTime, elementDuration } from "../../animation/AnimationEngine";

/** Timeline — 播放头 / 每元素动画起止，支持拖动调整开始时间与时长（§30） */
export default function Timeline() {
  const { project, currentTime, seek, updateProject, selectedElementId, setSelectedElementId } = useProjectStore();
  const pointCount = useMemo(() => getChartDataPointCount(project), [project]);
  const renderer = useMemo(() => getChartRenderer(project), [project]);
  const animTargetIds = useMemo(() => renderer.getAnimationTargets(project), [renderer, project]);
  const dur = project.document.duration;
  const trackRef = useRef<HTMLDivElement>(null);

  const chartType = project.chart.type;
  const itemLabel = chartType === "line" ? "Point" : chartType === "pie" ? "Slice" : "Bar";

  const pct = (t: number) => `${(t / dur) * 100}%`;
  const timeFromX = (rect: DOMRect, clientX: number) => {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * dur;
  };

  /** 标尺点击/拖动：移动播放头 */
  const onRulerMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek(timeFromX(rect, e.clientX));
    const move = (ev: MouseEvent) => {
      seek(timeFromX(rect, ev.clientX));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    const step = dur > 8 ? 2 : dur > 4 ? 1 : 0.5;
    for (let t = 0; t <= dur + 1e-6; t += step) marks.push(Number(t.toFixed(2)));
    return marks;
  }, [dur]);

  const indices = useMemo(() => Array.from({ length: pointCount }, (_, i) => i), [pointCount]);

  const handleBlockMouseDown = (e: React.MouseEvent, id: string, index: number) => {
    e.stopPropagation();
    setSelectedElementId(id);

    const lane = e.currentTarget.parentElement as HTMLElement;
    const rect = lane.getBoundingClientRect();
    const blockEl = e.currentTarget as HTMLElement;
    const blockRect = blockEl.getBoundingClientRect();
    const startX = e.clientX;
    const startTime = elementStartTime(project.animation, index, project.elementOverrides, id);
    const duration = elementDuration(project.animation, project.elementOverrides, id);
    const offsetInBlock = startX - blockRect.left;
    const edgeSize = 8;
    const mode =
      offsetInBlock < edgeSize ? "resize-left" :
      offsetInBlock > blockRect.width - edgeSize ? "resize-right" : "move";

    const update = (clientX: number) => {
      const t = timeFromX(rect, clientX);
      if (mode === "move") {
        const newStart = Math.max(0, t - (offsetInBlock / rect.width) * dur);
        updateProject((p) => {
          p.elementOverrides[id] = { ...p.elementOverrides[id], startTime: Number(newStart.toFixed(3)) };
        });
      } else if (mode === "resize-right") {
        const newDuration = Math.max(0.05, t - startTime);
        updateProject((p) => {
          p.elementOverrides[id] = { ...p.elementOverrides[id], duration: Number(newDuration.toFixed(3)) };
        });
      } else if (mode === "resize-left") {
        const newStart = Math.max(0, Math.min(startTime + duration - 0.05, t));
        const newDuration = Math.max(0.05, startTime + duration - newStart);
        updateProject((p) => {
          p.elementOverrides[id] = {
            ...p.elementOverrides[id],
            startTime: Number(newStart.toFixed(3)),
            duration: Number(newDuration.toFixed(3))
          };
        });
      }
    };

    update(startX);
    const move = (ev: MouseEvent) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="timeline">
      <div className="timeline-ruler" ref={trackRef} onMouseDown={onRulerMouseDown}>
        {rulerMarks.map((t) => (
          <span key={t} className="ruler-mark" style={{ left: pct(t) }}>
            {t}s
          </span>
        ))}
        <div className="playhead" style={{ left: pct(currentTime) }} />
      </div>
      <div className="timeline-tracks">
        {indices.map((i) => {
          const id = animTargetIds[i] ?? `target-${i}`;
          const start = elementStartTime(project.animation, i, project.elementOverrides, id);
          const duration = elementDuration(project.animation, project.elementOverrides, id);
          const end = start + duration;
          const selected = selectedElementId === id;
          return (
            <div key={i} className="track-row">
              <span className="track-name">{itemLabel} {String(i + 1).padStart(2, "0")}</span>
              <div className="track-lane" onMouseDown={onRulerMouseDown}>
                <div
                  className={`track-block${selected ? " selected" : ""}`}
                  style={{ left: pct(start), width: `calc(${pct(end - start)} - 1px)` }}
                  title={`${start.toFixed(2)}s → ${end.toFixed(2)}s`}
                  onMouseDown={(e) => handleBlockMouseDown(e, id, i)}
                />
                <div className="playhead playhead-thin" style={{ left: pct(currentTime) }} />
              </div>
            </div>
          );
        })}
        {pointCount === 0 && <div className="track-empty">当前没有可用于生成图表的数据。</div>}
      </div>
    </div>
  );
}
