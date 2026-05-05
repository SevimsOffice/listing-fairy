export function MockupGrid({
  mockups,
  onDownload,
}: {
  mockups: { templateId: string; templateName: string; url: string }[];
  onDownload: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {mockups.map((m, i) => (
        <div
          key={m.templateId}
          className="group relative rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
        >
          {i === 0 && (
            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              Hero Image #1
            </div>
          )}
          <img
            src={m.url}
            alt={m.templateName}
            className="w-full aspect-square object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={() => onDownload(m.templateId)}
              className="bg-background text-foreground font-semibold text-sm px-4 py-2 rounded-lg shadow hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              ⬇ Download
            </button>
          </div>
          <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border-t border-border">
            {m.templateName}
          </div>
        </div>
      ))}
    </div>
  );
}
