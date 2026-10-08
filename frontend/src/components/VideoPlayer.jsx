/**
 * 视频播放器组件
 * 支持视频预览、同步播放、倍速控制与实时字幕预览 (WYSIWYG)
 */
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const VideoPlayer = forwardRef(({
  videoUrl,
  onTimeUpdate,
  onReady,
  subtitleEnabled = false,
  subtitleConfig = {},
  currentSubtitle = '',
}, ref) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const rangeEndRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [captionBounds, setCaptionBounds] = useState({ width: 384, height: 216 });
  const captionScale = captionBounds.height / 216;

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => { rangeEndRef.current = null; return videoRef.current?.play(); },
    playRange: (start, end) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = start;
      rangeEndRef.current = end;
      return video.play();
    },
    pause: () => videoRef.current?.pause(),
    seekTo: (time) => {
      rangeEndRef.current = null;
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    isPlaying: () => isPlaying,
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateCaptionBounds = () => {
      const ratio = video.videoWidth / video.videoHeight || 16 / 9;
      const height = Math.min(video.clientHeight, video.clientWidth / ratio) || 216;
      setCaptionBounds({ width: height * ratio, height });
    };
    const observer = new ResizeObserver(updateCaptionBounds);
    observer.observe(video);
    const handleLoadedMetadata = () => {
      updateCaptionBounds();
      setDuration(video.duration);
      setIsReady(true);
      onReady?.(video.duration);
    };

    const finishRange = () => {
      const end = rangeEndRef.current;
      if (end === null || video.currentTime < end) return false;
      rangeEndRef.current = null;
      video.pause();
      video.currentTime = end;
      setCurrentTime(end);
      onTimeUpdate?.(end);
      return true;
    };
    const handleTimeUpdate = () => {
      if (finishRange()) return;
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    let frame;
    const checkRangeEnd = () => {
      // timeupdate also checks the bound when background tabs throttle animation frames.
      if (video.paused || finishRange()) return;
      frame = requestAnimationFrame(checkRangeEnd);
    };
    const handlePlay = () => {
      setIsPlaying(true);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(checkRangeEnd);
    };
    const handlePause = () => {
      rangeEndRef.current = null;
      cancelAnimationFrame(frame);
      setIsPlaying(false);
    };
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    if (!video.paused) frame = requestAnimationFrame(checkRangeEnd);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onReady]);

  const togglePlay = () => {
    rangeEndRef.current = null;
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSkip = (delta) => {
    rangeEndRef.current = null;
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(currentTime + delta, duration));
    }
  };

  const handleRateChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (!videoRef.current || duration <= 0) return;
    rangeEndRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = percent * duration;
  };

  // 计算字幕覆盖层样式
  const getSubtitlePositionStyle = () => {
    const pos = subtitleConfig?.position || 'bottom';
    if (pos === 'top') {
      return { top: `${16 * captionScale}px`, bottom: 'auto' };
    }
    if (pos === 'center') {
      return { top: '50%', bottom: 'auto', transform: 'translateY(-50%)' };
    }
    return { bottom: `${20 * captionScale}px`, top: 'auto' };
  };

  const outlineColor = subtitleConfig?.outline_color || '#000000';
  const outlineWidth = (subtitleConfig?.outline_width ?? 2) * captionScale;

  return (
    <div ref={containerRef} style={styles.container}>
      {/* 视频包装器与实时字幕层 */}
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          src={videoUrl}
          style={styles.video}
          playsInline
          onClick={togglePlay}
        />

        {/* 实时字幕覆盖预览 */}
        {subtitleEnabled && currentSubtitle && (
          <div
            style={{
              ...styles.subtitleOverlay,
              left: '50%', right: 'auto', top: '50%',
              width: captionBounds.width, height: captionBounds.height,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              style={{
                ...getSubtitlePositionStyle(),
                position: 'absolute', left: 12 * captionScale, right: 12 * captionScale,
                fontFamily: subtitleConfig?.font_name || 'Arial, sans-serif',
                color: subtitleConfig?.color || '#FFFFFF',
                WebkitTextStroke: `${2 * outlineWidth}px ${outlineColor}`,
                paintOrder: 'stroke fill',
                fontSize: `${(subtitleConfig?.font_size || 20) * captionScale}px`,
                fontWeight: '700',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                lineHeight: 1.2,
              }}
            >
              {currentSubtitle}
            </span>
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div style={styles.progressContainer} onClick={handleProgressClick} title="点击跳转进度">
        <div
          style={{
            ...styles.progressFill,
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
          }}
        />
      </div>

      {/* 控制栏 */}
      <div style={styles.controls}>
        <div style={styles.leftControls}>
          <button onClick={() => handleSkip(-5)} style={styles.iconButton} title="后退 5 秒">
            ⏪
          </button>
          <button onClick={togglePlay} style={styles.playButton} disabled={!isReady} title={isPlaying ? '暂停 (空格)' : '播放 (空格)'}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button onClick={() => handleSkip(5)} style={styles.iconButton} title="前进 5 秒">
            ⏩
          </button>
          <button onClick={toggleMute} style={styles.iconButton} title={isMuted ? '取消静音' : '静音'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* 中间时间显示 */}
        <div style={styles.timeDisplay}>
          <span style={styles.currentTime}>{formatTime(currentTime)}</span>
          <span style={styles.separator}>/</span>
          <span style={styles.duration}>{formatTime(duration)}</span>
        </div>

        {/* 右侧控制：倍速与全屏 */}
        <div style={styles.rightControls}>
          <div style={styles.rateGroup}>
            {[1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                style={{
                  ...styles.rateButton,
                  backgroundColor: playbackRate === rate ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                  color: playbackRate === rate ? '#ffffff' : '#94a3b8',
                }}
                title={`${rate}倍速播放`}
              >
                {rate}x
              </button>
            ))}
          </div>
          <button onClick={toggleFullscreen} style={styles.iconButton} title="全屏切换">
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

const styles = {
  container: {
    background: '#090d16',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    maxHeight: '320px',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '10px',
    background: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    maxHeight: '320px',
    display: 'block',
    objectFit: 'contain',
    cursor: 'pointer',
  },
  subtitleOverlay: {
    position: 'absolute',
    left: '0',
    right: '0',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 10,
    transition: 'all 0.2s ease',
  },
  progressContainer: {
    width: '100%',
    height: '6px',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '3px',
    cursor: 'pointer',
    marginBottom: '12px',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  playButton: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
  },
  iconButton: {
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e2e8f0',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: {
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
    color: '#e2e8f0',
  },
  currentTime: {
    color: '#c084fc',
    fontWeight: 'bold',
  },
  separator: {
    margin: '0 4px',
    color: '#64748b',
  },
  duration: {
    color: '#94a3b8',
  },
  rightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rateGroup: {
    display: 'flex',
    gap: '3px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '2px',
    borderRadius: '6px',
  },
  rateButton: {
    padding: '3px 7px',
    fontSize: '11px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

export default VideoPlayer;
