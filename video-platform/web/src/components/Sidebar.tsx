import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Flame, Tv, Music, Gamepad2, BookOpen, Coffee, Cpu, Smile, Utensils, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  film: Tv,
  music: Music,
  game: Gamepad2,
  book: BookOpen,
  coffee: Coffee,
  cpu: Cpu,
  smile: Smile,
  utensils: Utensils,
  running: Shirt,
  tshirt: Shirt,
  home: Home,
  flame: Flame,
}

export function Sidebar() {
  const location = useLocation();
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.categories) {
          setCategories(data.data.categories);
        }
      })
  }, []);

  const navItems = [
    { to: "/", icon: Home, label: "首页" },
    { to: "/hot", icon: Flame, label: "热门" },
    ...categories.map(c => ({
      to: `/category/${c.slug}`,
      icon: iconMap[c.icon] || Tv,
      label: c.name,
    })),
  ];

  return (
    <aside className="hidden lg:block fixed left-0 top-14 bottom-0 w-56 bg-[#0a0a0f] border-r border-[#1a1a1e] overflow-y-auto z-40">
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-[#CD5700]/10 text-[#CD5700] font-medium"
                  : "text-[#8a8680] hover:text-[#e8e6e3] hover:bg-[#121214]"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "text-[#CD5700]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-4 my-2 h-px bg-[#1a1a1e]" />
      <div className="px-4 py-3 text-xs text-[#5a5a5e]">
        <p>裂缝·递砖·建造者</p>
        <p className="mt-1">BDI 150+ | Sukačev</p>
      </div>
    </aside>
  );
}

