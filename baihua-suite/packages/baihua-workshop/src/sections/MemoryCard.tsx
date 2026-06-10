import { useState } from 'react';
import type { Memory, MemoryCategory } from '@/types/memory';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Trash2, Clock, Tag } from 'lucide-react';

interface MemoryCardProps {
  memory: Memory;
  category: MemoryCategory;
  onEdit: (memory: Memory) => void;
  onDelete: (id: string) => void;
}

export function MemoryCard({ memory, category, onEdit, onDelete }: MemoryCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const contentPreview = memory.content.length > 120 && !expanded
    ? memory.content.substring(0, 120) + '...'
    : memory.content;

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-l-4" style={{ borderLeftColor: category.color }}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate pr-2">{memory.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(memory.updatedAt)}
                </span>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(memory)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {contentPreview}
          </p>
          {memory.content.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary mt-1 hover:underline"
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
          {memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              <Tag className="w-3 h-3 text-muted-foreground mt-0.5" />
              {memory.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除记忆</DialogTitle>
            <DialogDescription>
              确定要删除「{memory.title}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => { onDelete(memory.id); setShowDelete(false); }}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
