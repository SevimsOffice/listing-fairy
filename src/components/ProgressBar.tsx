export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-primary font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-[image:var(--gradient-primary)] rounded-full transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
