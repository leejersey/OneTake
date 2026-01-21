/**
 * 视频播放器组件
 * 支持视频预览和同步播放
 */
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const VideoPlayer = forwardRef(({ 
  videoUrl, 
  onTimeUpdate, 
  onReady,
}, ref) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seekTo: (time) => {
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

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsReady(true);
      onReady?.(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onReady]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSkip = (delta) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(currentTime + delta, duration));
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * duration;
  };

  return (
    <div style={styles.container}>
      {/* 视频播放器 */}
      <div style={styles.videoWrapper}>
        <video 
          ref={videoRef}
          src={videoUrl}
          style={styles.video}
          playsInline
        />
      </div>
      
      {/* 进度条 */}
      <div style={styles.progressContainer} onClick={handleProgressClick}>
        <div 
          style={{
            ...styles.progressFill,
            width: `${(currentTime / duration) * 100}%`
          }} 
        />
      </div>
      
      {/* 控制栏 */}
      <div style={styles.controls}>
        <div style={styles.leftControls}>
          <button onClick={() => handleSkip(-5)} style={styles.skipButton} title="后退 5 秒">
            ⏪
          </button>
          <button onClick={togglePlay} style={styles.playButton} disabled={!isReady}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button onClick={() => handleSkip(5)} style={styles.skipButton} title="前进 5 秒">
            ⏩
          </button>
        </div>
        
        <div style={styles.timeDisplay}>
          <span style={styles.currentTime}>{formatTime(currentTime)}</span>
          <span style={styles.separator}>/</span>
          <span style={styles.duration}>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

const styles = {
  container: {
    background: 'rgba(0, 0, 0, 0.9)',
    borderRadius: '12px',
    padding: '15px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    maxHeight: '300px',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '10px',
    background: '#000',
  },
  video: {
    width: '100%',
    maxHeight: '300px',
    display: 'block',
  },
  progressContainer: {
    width: '100%',
    height: '6px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
    borderRadius: '3px',
    transition: 'width 0.1s',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  playButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.1)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  timeDisplay: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#fff',
  },
  currentTime: {
    color: '#a78bfa',
    fontWeight: 'bold',
  },
  separator: {
    margin: '0 5px',
    color: '#6b7280',
  },
  duration: {
    color: '#9ca3af',
  },
};

export default VideoPlayer;
