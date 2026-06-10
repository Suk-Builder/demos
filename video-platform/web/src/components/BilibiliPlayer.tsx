interface BilibiliPlayerProps {
  videoUrl: string;
  className?: string;
}

export default function BilibiliPlayer({ videoUrl, className }: BilibiliPlayerProps) {
  // 提取BV号
  const bvidMatch = videoUrl?.match(/bvid=([BV][a-zA-Z0-9]+)/);
  const bvid = bvidMatch ? bvidMatch[1] : null;

  if (!bvid) {
    // 普通视频URL，用原生video标签
    return (
      <video
        src={videoUrl}
        controls
        className={className}
        style={{ width: '100%', maxHeight: '500px' }}
      />
    );
  }

  // B站嵌入播放器
  return (
    <div className={className} style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
      <iframe
        src={`https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=1`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        scrolling="no"
        frameBorder="0"
      />
    </div>
  );
}
