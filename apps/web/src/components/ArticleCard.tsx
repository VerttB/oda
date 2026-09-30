import React from 'react';
import { Quote } from 'lucide-react';
import type { ResearchArticle } from '../core/interfaces';



interface ArticleCardProps {
  article: ResearchArticle;
  onSelectArticle: (article: ResearchArticle) => void;
  onSelectAuthor?: (authorId: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onSelectArticle,
  onSelectAuthor
}) => {
  return (
    <div
      id={`article-card-${article.id}`}
      className="bg-surface border border-border p-6 relative overflow-hidden group shadow-[0_4px_12px_rgba(15,23,42,0.05)] rounded-lg flex flex-col justify-between hover:border-accent hover:shadow-md transition-all duration-200"
    >
      <div>
        {/* Tags */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="bg-surface-alt text-secondary text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border border-border"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3
          onClick={() => onSelectArticle(article)}
          className="text-xl font-semibold text-secondary mb-2 group-hover:text-accent-hover transition-colors cursor-pointer leading-snug"
        >
          {article.title}
        </h3>

        {/* Abstract */}
        <p className="text-sm text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
          {article.abstract}
        </p>
      </div>

      {/* Author & Citations Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-border mt-auto">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectAuthor?.(article.author.id);
          }}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-sm text-foreground font-semibold">
            {article.author.name}
          </span>
        </div>

        <div className="flex items-center gap-1 text-primary font-mono text-sm">
          <Quote className="w-3.5 h-3.5 fill-current opacity-70" />
          <span className="font-semibold">{article.citations}</span>
        </div>
      </div>
    </div>
  );
};
