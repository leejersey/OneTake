/**
 * 波形图播放器组件
 * 使用 wavesurfer.js 实现音频可视化、播放控制与倍速调节
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
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [loadError, setLoadError] = useState(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => wavesurferRef.current?.play(),
    playRange: (start, end) => wavesurferRef.current?.play(start, end),
    pause: () => wavesurferRef.current?.pause(),
    seekTo: (time) => {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(Math.max(0, Math.min(1, time / duration)));
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
      waveColor: '#818cf8',
      progressColor: '#6366f1',
      cursorColor: '#c084fc',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: height,
      normalize: true,
      backend: 'WebAudio',
    });

    wavesurferRef.current = wavesurfer;

    // 事件监听
    wavesurfer.on('ready', () => {
      const dur = wavesurfer.getDuration();
      setDuration(dur);
      setIsReady(true);
      onReady?.(dur);
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

    let active = true;
    wavesurfer.load(audioUrl).catch(error => {
      if (!active || error.name === 'AbortError') return;
      console.error('音频加载失败:', error);
      setLoadError(error.message || '音频加载失败');
      setIsReady(false);
    });

    return () => {
      active = false;
      wavesurfer.destroy();
      if (wavesurferRef.current === wavesurfer) wavesurferRef.current = null;
    };
  }, [audioUrl, height, onTimeUpdate, onReady]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause().catch(error => {
      if (error.name !== 'AbortError') setLoadError(error.message);
    });
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkip = (delta) => {
    if (wavesurferRef.current && duration > 0) {
      const newTime = Math.max(0, Math.min(currentTime + delta, duration));
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  const handleRateChange = (rate) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
    }
  };

  return (
    <div style={styles.container}>
      {/* 波形图容器 */}
      <div ref={containerRef} style={styles.waveform} />

      {loadError && <div role="alert">音频加载失败：{loadError}</div>}
      {/* 控制栏 */}
      <div style={styles.controls}>
        <div style={styles.leftControls}>
          <button onClick={() => handleSkip(-5)} style={styles.skipButton} title="后退 5 秒">
            ⏪
          </button>
          <button onClick={togglePlay} style={styles.playButton} disabled={!isReady} title={isPlaying ? '暂停 (空格)' : '播放 (空格)'}>
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

        {/* 倍速控制 */}
        <div style={styles.rateGroup}>
          {[1.0, 1.25, 1.5, 2.0].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              style={{
                ...styles.rateButton,
                backgroundColor: playbackRate === rate ? '#6366f1' : 'rgba(0, 0, 0, 0.05)',
                color: playbackRate === rate ? '#ffffff' : '#64748b',
              }}
              title={`${rate}倍速播放`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

WaveformPlayer.displayName = 'WaveformPlayer';

const styles = {
  container: {
    background: '#090d16',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  },
  waveform: {
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: '4px',
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
  skipButton: {
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

export default WaveformPlayer;
