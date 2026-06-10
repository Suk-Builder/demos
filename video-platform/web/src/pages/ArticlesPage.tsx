import { useState, useEffect } from 'react';
import { BookOpen, Eye, ThumbsUp, ExternalLink } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  views_count: number;
  likes_count: number;
  created_at: string;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/articles?page=1&limit=20')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setArticles(data.data?.articles || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#CD5700] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-[#e8e6e3] flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-[#CD5700]" />
        专栏文章
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map(article => (
          <a
            key={article.id}
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-4 rounded-xl border border-[#1a1a1e] bg-[#141417] p-4 transition-all hover:border-[#CD5700]/30 hover:bg-[#1a1a1e]"
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-[#e8e6e3] group-hover:text-[#CD5700] transition-colors line-clamp-2">
                {article.title}
              </h3>
              <div className="flex items-center gap-4 mt-3 text-xs text-[#5a5a5e]">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{article.views_count}阅读</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{article.likes_count}赞</span>
                <span>{article.created_at?.slice(0, 10)}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#CD5700] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

