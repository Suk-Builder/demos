import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import VideoPage from "@/pages/VideoPage";
import CategoryPage from "@/pages/CategoryPage";
import ArticlesPage from "@/pages/ArticlesPage";
import LoginPage from "@/pages/LoginPage";
import ProfilePage from "@/pages/ProfilePage";
import SearchPage from "@/pages/SearchPage";
import SpacePage from "@/pages/SpacePage";
import UploadPage from "@/pages/UploadPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/hot" element={<HomePage sort="hot" subtitle="热门视频" />} />
        <Route path="/video/:id" element={<VideoPage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/space/:id" element={<SpacePage />} />
        <Route path="/upload" element={<UploadPage />} />
      </Route>
    </Routes>
  );
}

