import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload,
  Video,
  X,
  ImageIcon,
  Plus,
  Tag,
  Send,
  FileVideo,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

const categories = ['动画', '音乐', '科技', '知识', '生活', '游戏'];

interface FormErrors {
  title?: string;
  category?: string;
  file?: string;
}

/* ================================================================== */
export default function UploadPage() {
  const navigate = useNavigate();

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* ---- drag & drop ---- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('请选择视频文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast.error('视频文件不能超过2GB');
      return;
    }
    setSelectedFile(file);
    setErrors((prev) => ({ ...prev, file: undefined }));
    toast.success(`已选择: ${file.name}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  /* ---- tags ---- */
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast.info('标签已存在');
      return;
    }
    if (tags.length >= 8) {
      toast.info('最多添加8个标签');
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  /* ---- thumbnail ---- */
  const handleThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      const url = URL.createObjectURL(file);
      setThumbnailUrl(url);
    }
  };

  /* ---- validation ---- */
  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!selectedFile) errs.file = '请选择要上传的视频';
    if (!title.trim()) errs.title = '请输入视频标题';
    else if (title.trim().length < 2) errs.title = '标题至少2个字符';
    else if (title.trim().length > 80) errs.title = '标题最多80个字符';
    if (!category) errs.category = '请选择分区';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ---- submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    // Simulate upload delay
    await new Promise((r) => setTimeout(r, 2500));
    clearInterval(interval);
    setUploadProgress(100);

    setTimeout(() => {
      setIsSubmitting(false);
      toast.success('视频发布成功！');
      navigate('/profile');
    }, 500);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-50 py-4 md:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-6 h-6 text-[#CD5700]" />
            投稿视频
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            分享你的创作，与世界连接
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ===== Upload Area ===== */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-[#CD5700]" />
              选择视频
              <span className="text-red-500">*</span>
            </h2>

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-[#CD5700] bg-pink-50'
                    : errors.file
                    ? 'border-red-300 bg-red-50/50'
                    : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50/30'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    isDragOver ? 'bg-pink-100 text-[#CD5700]' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Video className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  点击选择文件 或 拖拽视频到此处
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  支持 MP4, MOV, AVI, MKV 等格式，单个文件不超过2GB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="border rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pink-100 text-[#CD5700] flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(selectedFile.size)} · {selectedFile.type}
                    </p>
                    {isSubmitting && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#CD5700] rounded-full transition-all duration-200"
                            style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          上传中... {Math.min(Math.round(uploadProgress), 100)}%
                        </p>
                      </div>
                    )}
                    {!isSubmitting && (
                      <div className="flex items-center gap-1 mt-1.5 text-green-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        文件已就绪
                      </div>
                    )}
                  </div>
                  {!isSubmitting && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadProgress(0);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {errors.file && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.file}
              </p>
            )}
          </div>

          {/* ===== Video Info ===== */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#CD5700]" />
              视频信息
            </h2>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="video-title">
                标题 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="video-title"
                placeholder="给你的视频起个吸引人的标题吧"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((p) => ({ ...p, title: undefined }));
                }}
                aria-invalid={!!errors.title}
                className="h-11"
                maxLength={80}
              />
              <div className="flex items-center justify-between">
                {errors.title ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.title}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {title.length}/80
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="video-desc">简介</Label>
              <Textarea
                id="video-desc"
                placeholder="介绍一下你的视频内容..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>
                分区 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  if (errors.category) setErrors((p) => ({ ...p, category: undefined }));
                }}
              >
                <SelectTrigger className="h-11 w-full" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="选择一个分区" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.category}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="video-tags">标签</Label>
              <div className="flex gap-2">
                <Input
                  id="video-tags"
                  placeholder="添加标签，按回车确认"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="h-11 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3 shrink-0"
                  onClick={handleAddTag}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="pl-2.5 pr-1 py-1 h-7 text-sm gap-1 bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 cursor-default"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-pink-200 p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">最多添加8个标签</p>
            </div>
          </div>

          {/* ===== Thumbnail ===== */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#CD5700]" />
              缩略图
            </h2>

            {!thumbnailUrl ? (
              <div
                onClick={() => thumbInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 md:p-8 text-center cursor-pointer hover:border-pink-300 hover:bg-pink-50/30 transition-all w-fit"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-xs text-muted-foreground">点击上传封面图</p>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbChange}
                />
              </div>
            ) : (
              <div className="relative w-fit group">
                <img
                  src={thumbnailUrl}
                  alt="缩略图"
                  className="w-48 h-27 object-cover rounded-xl border"
                  style={{ height: 108 }}
                />
                <button
                  type="button"
                  onClick={() => setThumbnailUrl(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div
                  className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={() => thumbInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbChange}
                />
              </div>
            )}
          </div>

          {/* ===== Actions ===== */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6 flex flex-col sm:flex-row items-center gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-[#CD5700] hover:bg-[#b84d00] text-white font-medium rounded-xl px-8 h-11 shadow-md shadow-pink-200 transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? '发布中...' : '发布视频'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto h-11 rounded-xl px-6"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
