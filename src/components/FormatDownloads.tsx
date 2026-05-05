export function FormatDownloads({
  onDownload,
}: {
  onDownload: (f: "png" | "jpg" | "pdf") => void;
}) {
  const formats = [
    { key: "png" as const, icon: "🖼️", label: "PNG", desc: "Transparent, lossless" },
    { key: "jpg" as const, icon: "📷", label: "JPG", desc: "Compressed, universal" },
    { key: "pdf" as const, icon: "📄", label: "PDF", desc: "Print-ready, A4" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {formats.map(({ key, icon, label, desc }) => (
        <button
          key={key}
          onClick={() => onDownload(key)}
          className="flex flex-col items-center p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <span className="text-2xl mb-1">{icon}</span>
          <span className="font-bold text-foreground text-sm group-hover:text-primary">
            {label}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5 text-center">{desc}</span>
        </button>
      ))}
    </div>
  );
}
