import type { ManualBlock } from "../manual-content";

const NOTE_STYLE: Record<"tip" | "info" | "warning", { cls: string; icon: string; label: string }> = {
  tip: { cls: "alert-success", icon: "bi-lightbulb", label: "Tip" },
  info: { cls: "alert-info", icon: "bi-info-circle", label: "Note" },
  warning: { cls: "alert-warning", icon: "bi-exclamation-triangle", label: "Important" },
};

function Block({ block }: { block: ManualBlock }) {
  switch (block.type) {
    case "p":
      return <p className="mb-3">{block.text}</p>;

    case "steps":
      return (
        <ol className="mb-3 ps-3">
          {block.items.map((item, i) => (
            <li key={i} className="mb-1">
              {item}
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="mb-3 ps-3">
          {block.items.map((item, i) => (
            <li key={i} className="mb-1">
              {item}
            </li>
          ))}
        </ul>
      );

    case "note": {
      const s = NOTE_STYLE[block.variant];
      return (
        <div className={`alert ${s.cls} d-flex gap-2`} role="note">
          <i className={`bi ${s.icon} flex-shrink-0 mt-1`} aria-hidden="true" />
          <div>
            <span className="fw-semibold me-1">{s.label}:</span>
            {block.text}
          </div>
        </div>
      );
    }

    case "shot":
      return (
        <figure className="figure d-block my-4">
          {/* Plain <img>: these are variable-height full-page PNGs generated
              into public/manual/screens/ by scripts/capture-manual-screens.mjs
              — next/image's fixed width/height would fight the real ratios. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.caption}
            loading="lazy"
            className="figure-img img-fluid rounded border shadow-sm d-block"
          />
          <figcaption className="figure-caption mt-1">{block.caption}</figcaption>
        </figure>
      );

    default:
      return null;
  }
}

export function ManualBlocks({ blocks }: { blocks: ManualBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}
