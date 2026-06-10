import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header />
      <Sidebar />
      <main className="lg:ml-56 pt-14 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
