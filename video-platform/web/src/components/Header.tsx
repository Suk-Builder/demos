import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, Upload, User, BookOpen } from "lucide-react";

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  const handleSearch = () => {
    if (searchText.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchText.trim())}`);
      setIsSearchOpen(false);
      setSearchText("");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-[#1a1a1e]">
      <div className="h-full mx-auto px-4 flex items-center justify-between max-w-[1920px]">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-2 text-[#8a8680] hover:text-[#CD5700]">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#CD5700] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="hidden sm:block text-[#e8e6e3] font-semibold">Suka<span className="text-[#CD5700]">č</span>ev</span>
          </Link>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-xl mx-4">
          {isSearchOpen ? (
            <div className="h-8 bg-[#1a1a1e] border border-[#CD5700]/50 rounded-full flex items-center px-4">
              <Search className="w-4 h-4 text-[#CD5700] mr-2 shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索视频、用户..."
                className="flex-1 bg-transparent text-sm text-[#e8e6e3] placeholder:text-[#5a5a5e] outline-none"
                autoFocus
              />
              <button onClick={() => setIsSearchOpen(false)} className="ml-2 text-[#5a5a5e] hover:text-[#e8e6e3]">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className="h-8 bg-[#1a1a1e] border border-[#2a2a2e] rounded-full flex items-center px-4 cursor-pointer hover:border-[#CD5700]/30 transition-colors"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4 text-[#5a5a5e] mr-2" />
              <span className="text-[#5a5a5e] text-sm">搜索视频、用户...</span>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link to="/articles" className="hidden sm:flex items-center gap-1.5 h-8 px-4 border border-[#2a2a2e] hover:border-[#CD5700]/50 text-[#e8e6e3] text-sm rounded transition-colors">
            <BookOpen className="w-4 h-4" />
            专栏
          </Link>
          <Link to="/upload" className="hidden sm:flex items-center gap-1.5 h-8 px-4 bg-[#CD5700] hover:bg-[#b84d00] text-white text-sm font-medium rounded transition-colors">
            <Upload className="w-4 h-4" />
            投稿
          </Link>
          <Link to="/login" className="w-8 h-8 rounded-full bg-[#1a1a1e] flex items-center justify-center text-[#8a8680] hover:text-[#e8e6e3] transition-colors">
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

