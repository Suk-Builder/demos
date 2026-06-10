import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import type { ReactNode, MouseEvent, ChangeEvent } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  Settings,
} from 'lucide-react';

export interface VideoPlayerHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getContainer: () => HTMLDivElement | null;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  children?: ReactNode;
}

const formatTime = (t: number): string => {
  if (!isFinite(t) || isNaN(t)) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, poster, onTimeUpdate, onPlay, onPause, children }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [buffered, setBuffered] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
      play: () => { videoRef.current?.play(); },
      pause: () => { videoRef.current?.pause(); },
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getContainer: () => containerRef.current,
    }));

    const togglePlay = useCallback(() => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }, []);

    const toggleMute = useCallback(() => {
      if (!videoRef.current) return;
      const next = !videoRef.current.muted;
      videoRef.current.muted = next;
      setIsMuted(next);
    }, []);

    const toggleFullscreen = useCallback(async () => {
      if (!containerRef.current) return;
      try {
        if (!document.fullscreenElement) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } else {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      } catch {
        // ignore
      }
    }, []);

    const handleVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = v === 0;
      }
      setIsMuted(v === 0);
    }, []);

    const handleProgressClick = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || !videoRef.current || duration === 0) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        videoRef.current.currentTime = ratio * duration;
      },
      [duration]
    );

    const handleProgressDrag = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        const handleMove = (moveEvent: globalThis.MouseEvent) => {
          if (!progressBarRef.current || !videoRef.current || duration === 0) return;
          const rect = progressBarRef.current.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
          videoRef.current.currentTime = ratio * duration;
        };
        const handleUp = () => {
          document.removeEventListener('mousemove', handleMove);
          document.removeEventListener('mouseup', handleUp);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        handleProgressClick(e);
      },
      [duration, handleProgressClick]
    );

    const skip = useCallback((seconds: number) => {
      if (videoRef.current) videoRef.current.currentTime += seconds;
    }, []);

    const changePlaybackRate = useCallback((rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
    }, []);

    const handleMouseMove = useCallback(() => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    }, [isPlaying]);

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!videoRef.current) return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        switch (e.key) {
          case ' ':
            e.preventDefault();
            togglePlay();
            break;
          case 'ArrowRight':
            e.preventDefault();
            skip(5);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            skip(-5);
            break;
          case 'ArrowUp': {
            e.preventDefault();
            const nvUp = Math.min(1, volume + 0.1);
            setVolume(nvUp);
            videoRef.current.volume = nvUp;
            if (nvUp > 0) {
              videoRef.current.muted = false;
              setIsMuted(false);
            }
            break;
          }
          case 'ArrowDown': {
            e.preventDefault();
            const nvDown = Math.max(0, volume - 0.1);
            setVolume(nvDown);
            videoRef.current.volume = nvDown;
            if (nvDown === 0) {
              videoRef.current.muted = true;
              setIsMuted(true);
            }
            break;
          }
          case 'f':
          case 'F':
            toggleFullscreen();
            break;
          case 'm':
          case 'M':
            toggleMute();
            break;
          default:
            break;
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [togglePlay, toggleFullscreen, toggleMute, volume, skip]);

    useEffect(() => {
      const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', onFsChange);
      return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const handleTimeUpdate = useCallback(() => {
      if (!videoRef.current) return;
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }, [onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) setDuration(videoRef.current.duration);
    }, []);

    const handleProgress = useCallback(() => {
      if (!videoRef.current || !videoRef.current.buffered.length) return;
      try {
        setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      } catch {
        // ignore
      }
    }, []);

    const handlePlay = useCallback(() => {
      setIsPlaying(true);
      onPlay?.();
    }, [onPlay]);

    const handlePause = useCallback(() => {
      setIsPlaying(false);
      setShowControls(true);
      onPause?.();
    }, [onPause]);

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-lg overflow-hidden select-none group"
        style={{ aspectRatio: '16/9' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onPlay={handlePlay}
          onPause={handlePause}
          playsInline
          preload="metadata"
        />

        <div className="absolute inset-0 pointer-events-none z-10">{children}</div>

        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 cursor-pointer"
          >
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </button>
        )}

        <div
          className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            ref={progressBarRef}
            className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
            onClick={handleProgressClick}
            onMouseDown={handleProgressDrag}
          >
            <div
              className="absolute top-0 left-0 h-full bg-white/40 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute top-0 left-0 h-full bg-[#CD5700] rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-[#CD5700] transition-colors">
                {isPlaying ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
              </button>
              <button onClick={() => skip(-5)} className="text-white hover:text-[#CD5700] transition-colors">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={() => skip(5)} className="text-white hover:text-[#CD5700] transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
              <span className="text-white text-xs font-mono select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 group/volume relative">
                <button onClick={toggleMute} className="text-white hover:text-[#CD5700] transition-colors">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-[#CD5700] h-1"
                  />
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="text-white hover:text-[#CD5700] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-8 right-0 bg-black/90 rounded-lg p-2 min-w-[100px] z-50">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`block w-full text-left px-3 py-1 text-xs rounded ${
                          playbackRate === rate
                            ? 'text-[#CD5700] bg-[#CD5700]/20'
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {rate === 1 ? '正常' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={toggleFullscreen} className="text-white hover:text-[#CD5700] transition-colors">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
