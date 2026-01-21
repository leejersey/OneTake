/**
 * 波形图播放器组件
 * 使用 wavesurfer.js 实现音频可视化和播放控制
 */
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';

const WaveformPlayer = forwardRef(({ 
  audioUrl, 
  onTimeUpdate, 
  onReady,
  height = 80 
}, ref) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => wavesurferRef.current?.play(),
    pause: () => wavesurferRef.current?.pause(),
    seekTo: (time) => {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(time / duration);
      }
    },
    getCurrentTime: () => wavesurferRef.current?.getCurrentTime() || 0,
    isPlaying: () => isPlaying,
  }));

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    // 创建 WaveSurfer 实例
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a78bfa',
      progressColor: '#7c3aed',
      cursorColor: '#4f46e5',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: height,
      normalize: true,
      backend: 'WebAudio',
    });

    wavesurferRef.current = wavesurfer;

    // 加载音频
    wavesurfer.load(audioUrl);

    // 事件监听
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
      setIsReady(true);
      onReady?.(wavesurfer.getDuration());
    });

    wavesurfer.on('audioprocess', (time) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    wavesurfer.on('seeking', (time) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, height, onTimeUpdate, onReady]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkip = (delta) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, Math.min(currentTime + delta, duration));
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  return (
    <div style={styles.container}>
      {/* 波形图容器 */}
      <div ref={containerRef} style={styles.waveform} />
      
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

WaveformPlayer.displayName = 'WaveformPlayer';

const styles = {
  container: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  waveform: {
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '15px',
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
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
    transition: 'transform 0.2s',
  },
  skipButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#f3f4f6',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  timeDisplay: {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#374151',
  },
  currentTime: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  separator: {
    margin: '0 5px',
    color: '#9ca3af',
  },
  duration: {
    color: '#6b7280',
  },
};

export default WaveformPlayer;
