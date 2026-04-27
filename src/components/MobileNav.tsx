import { Link, useLocation } from "@tanstack/react-router";
import { Settings, Upload, Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/setup", label: "Setup", icon: Settings },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/generate", label: "Generate", icon: Sparkles },
  { to: "/publish", label: "Publish", icon: Send },
] as const;

export function MobileNav() {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
