import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import WaveformPlayer from '../components/WaveformPlayer';
import VideoPlayer from '../components/VideoPlayer';
import { useTheme } from '../contexts/theme';
import { groupSentences, captionTextAt, isEditingTarget } from '../utils/editor';
import ThemeToggle from '../components/ThemeToggle';

function Editor() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [edl, setEdl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modifiedWords, setModifiedWords] = useState([]);
  const [savedWords, setSavedWords] = useState(null);
  const [saving, setSaving] = useState(false);
  const hasUnsavedChanges = savedWords !== null && modifiedWords !== savedWords;
  const [exporting, setExporting] = useState(false);
  const [exportQuality, setExportQuality] = useState('high');
  const [currentTime, setCurrentTime] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const waveformRef = useRef(null);
  const videoRef = useRef(null);
  const transcriptScrollRef = useRef(null);

  const [selectedWordIndex, setSelectedWordIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingText, setEditingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isSubtitlePanelOpen, setIsSubtitlePanelOpen] = useState(true);

  // 字幕配置
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitleConfig, setSubtitleConfig] = useState({
    font_name: 'Arial',
    font_size: 20,
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 2,
    position: 'bottom'
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    // ponytail: SPA back navigation needs a data-router blocker if every route change must be guarded.
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const loadEDL = useCallback(async () => {
    try {
      const response = await api.getEDL(taskId);
      setEdl(response.data);
      const words = response.data.words || [];
      setModifiedWords(words);
      setSavedWords(words);
      setHistory([words]);
      setHistoryIndex(0);
    } catch (error) {
      console.error('加载 EDL 失败:', error);
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { loadEDL(); }, [loadEDL]);

  const saveToHistory = useCallback((newWords) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newWords);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setModifiedWords(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setModifiedWords(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const toggleWordDelete = useCallback((index) => {
    const newWords = modifiedWords.map((word, i) =>
      i === index
        ? { ...word, auto_delete: false, user_delete: !(word.auto_delete || word.user_delete) }
        : word
    );
    setModifiedWords(newWords);
    saveToHistory(newWords);
  }, [modifiedWords, saveToHistory]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditingTarget(e.target)) return;
      if (e.key === ' ' && e.target.closest?.('button, a[href]')) return;
      // 撤销/重做
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // 空格键播放/暂停
      if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const player = videoRef.current || waveformRef.current;
        if (player) {
          if (player.isPlaying?.()) {
            player.pause();
          } else {
            player.play();
          }
        }
        return;
      }

      // 左右方向键跳转
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const player = videoRef.current || waveformRef.current;
        if (player) {
          const current = player.getCurrentTime?.() || 0;
          const delta = e.key === 'ArrowLeft' ? -2 : 2;
          player.seekTo?.(Math.max(0, current + delta));
        }
        return;
      }

      // Delete/Backspace 删除选中词
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWordIndex >= 0 && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleWordDelete(selectedWordIndex);
        return;
      }

      // 上下方向键选择词
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        const newIndex = Math.max(0, Math.min(modifiedWords.length - 1, selectedWordIndex + delta));
        setSelectedWordIndex(newIndex);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, toggleWordDelete, selectedWordIndex, modifiedWords]);

  // 批量操作：删除/恢复所有语气词
  const toggleAllFillers = (shouldDelete) => {
    const newWords = modifiedWords.map(word =>
      word.type === 'filler'
        ? { ...word, auto_delete: false, user_delete: shouldDelete }
        : word
    );
    setModifiedWords(newWords);
    saveToHistory(newWords);
  };

  // 点击词跳转到对应时间
  const handleWordClick = (index) => {
    const word = modifiedWords[index];
    const player = videoRef.current || waveformRef.current;
    if (player) {
      player.seekTo(word.start);
    }
    setSelectedWordIndex(index);
  };

  const handleSentencePlay = async (block) => {
    const player = videoRef.current || waveformRef.current;
    const start = block[0].word.start;
    const end = block.at(-1).word.end;
    if (!player || end <= start) return;
    setSelectedWordIndex(block[0].index);
    try {
      await player.playRange(start, end);
    } catch (error) {
      if (error.name !== 'AbortError') alert(`播放失败: ${error.message}`);
    }
  };

  // 双击编辑文字
  const handleWordDoubleClick = (index) => {
    setEditingIndex(index);
    setEditingText(modifiedWords[index].word);
  };

  // 完成编辑
  const handleEditComplete = () => {
    if (editingIndex >= 0 && editingText.trim()) {
      const newWords = modifiedWords.map((word, i) =>
        i === editingIndex
          ? { ...word, word: editingText.trim() }
          : word
      );
      setModifiedWords(newWords);
      saveToHistory(newWords);
    }
    setEditingIndex(-1);
    setEditingText('');
  };

  // 获取当前播放位置对应的词索引
  const getCurrentWordIndex = useCallback(() => {
    for (let i = 0; i < modifiedWords.length; i++) {
      const word = modifiedWords[i];
      if (currentTime >= word.start && currentTime <= word.end) {
        return i;
      }
    }
    return -1;
  }, [currentTime, modifiedWords]);

  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const handleSave = async () => {
    const words = modifiedWords;
    setSaving(true);
    try {
      const response = await api.saveEDL(taskId, { words });
      setEdl(response.data);
      setSavedWords(words);
      return response.data;
    } catch (error) {
      console.error('保存失败:', error);
      alert(`保存失败: ${error.response?.data?.detail || error.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!isVideoFile) return;
    try {
      setExporting(true);
      const customEDL = await handleSave();
      if (!customEDL) {
        setExporting(false);
        return;
      }

      // 准备字幕配置
      const subtitleParam = subtitleEnabled ? {
        enabled: true,
        ...subtitleConfig
      } : { enabled: false };

      const response = await api.exportVideo(taskId, {
        edl: customEDL,
        format: 'mp4',
        quality: exportQuality,
        subtitle: subtitleParam
      });

      const exportId = response.data.export_id;

      // 轮询导出状态
      const pollExport = async () => {
        try {
          const statusResponse = await api.getExportStatus(exportId);
          const status = statusResponse.data;
          if (status.status === 'completed') {
            const downloadUrl = api.getDownloadUrl(exportId);
            window.open(downloadUrl, '_blank');
            setExporting(false);
            alert('视频导出成功！下载已开始');
          } else if (status.status === 'failed') {
            alert(`导出失败: ${status.error}`);
            setExporting(false);
          } else {
            setTimeout(pollExport, 3000);
          }
        } catch (error) {
          alert(`查询导出状态失败: ${error.message}`);
          setExporting(false);
        }
      };

      await pollExport();
    } catch (error) {
      console.error('导出失败:', error);
      alert(`导出失败: ${error.message}`);
      setExporting(false);
    }
  };

  const currentWordIndex = getCurrentWordIndex();

  // 播放跟随自动平滑滚动 (Auto-scroll)
  useEffect(() => {
    if (currentWordIndex >= 0) {
      const element = document.getElementById(`word-chip-${currentWordIndex}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [currentWordIndex]);

  // 前端动态实时计算统计指标
  const statistics = useMemo(() => {
    const totalWords = modifiedWords.length;
    let deletedCount = 0;
    let fillerCount = 0;
    let deletedDuration = 0;

    modifiedWords.forEach(w => {
      const isDel = w.auto_delete || w.user_delete;
      if (isDel) {
        deletedCount++;
        deletedDuration += Math.max(0, (w.end || 0) - (w.start || 0));
      }
      if (w.type === 'filler') {
        fillerCount++;
      }
    });

    const keptCount = totalWords - deletedCount;
    const originalDuration = edl?.statistics?.original_duration
      || (modifiedWords.length > 0 ? modifiedWords[modifiedWords.length - 1].end : 0);
    const estimatedDuration = Math.max(0, originalDuration - deletedDuration);

    return {
      totalWords,
      deletedCount,
      keptCount,
      fillerCount,
      originalDuration,
      deletedDuration,
      estimatedDuration,
    };
  }, [modifiedWords, edl]);

  // 将词列表结构化为“句子/段落”分块
  const sentenceBlocks = useMemo(() => groupSentences(modifiedWords), [modifiedWords]);

  const currentSubtitleText = captionTextAt(sentenceBlocks, currentTime);

  const formatSecs = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinnerIcon}>⏳</div>
        <div style={styles.loadingText}>正在加载剪辑工程...</div>
      </div>
    );
  }

  const audioUrl = api.getAudioUrl(taskId);
  const isVideoFile = edl?.original_audio?.match(/\.(mp4|avi|mov|mkv|webm)$/i);

  return (
    <div className="editor-shell" style={{
      ...styles.container,
      backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
      color: isDark ? '#f8fafc' : '#0f172a',
    }}>
      {/* 顶部工具导航栏 */}
      <header className="editor-header" style={{
        ...styles.header,
        backgroundColor: isDark ? '#111827' : '#ffffff',
        borderColor: isDark ? '#1f2937' : '#e2e8f0',
      }}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => {
              if (!hasUnsavedChanges || window.confirm('有未保存的修改，确定离开？')) navigate('/');
            }}
            style={{
              ...styles.backButton,
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: isDark ? '#f8fafc' : '#334155',
            }}
          >
            ← 首页
          </button>
          <div style={styles.headerTitleWrap}>
            <h1 style={{
              ...styles.title,
              color: isDark ? '#f8fafc' : '#0f172a',
            }}>One Take 工作台</h1>
          </div>
        </div>

        <div className="editor-actions" style={styles.headerActions}>
          {/* 保存状态指示 Badge (保留 role="status" 满足无障碍与契约) */}
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: hasUnsavedChanges
                ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7')
                : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'),
              color: hasUnsavedChanges ? '#d97706' : '#059669',
              border: `1px solid ${hasUnsavedChanges ? '#fde68a' : '#a7f3d0'}`,
            }}
          >
            <span style={{
              ...styles.statusDot,
              backgroundColor: hasUnsavedChanges ? '#f59e0b' : '#10b981',
            }} />
            <span role="status" style={{ fontSize: '12px', fontWeight: '600' }}>
              {saving ? '保存中...' : hasUnsavedChanges ? '未保存' : '已保存'}
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || exporting || !hasUnsavedChanges}
            style={{
              ...styles.actionButton,
              backgroundColor: hasUnsavedChanges ? '#6366f1' : (isDark ? '#1f2937' : '#f1f5f9'),
              color: hasUnsavedChanges ? '#ffffff' : (isDark ? '#64748b' : '#94a3b8'),
              cursor: hasUnsavedChanges && !saving ? 'pointer' : 'default',
            }}
          >
            {saving ? '保存中...' : '💾 保存'}
          </button>

          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{
              ...styles.actionButton,
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: isDark ? '#e2e8f0' : '#334155',
              opacity: historyIndex <= 0 ? 0.4 : 1,
            }}
            title="撤销 (Ctrl+Z)"
          >
            ↩️ 撤销
          </button>

          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              ...styles.actionButton,
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: isDark ? '#e2e8f0' : '#334155',
              opacity: historyIndex >= history.length - 1 ? 0.4 : 1,
            }}
            title="重做 (Ctrl+Shift+Z)"
          >
            ↪️ 重做
          </button>

          <button
            onClick={() => setShowShortcutsModal(true)}
            style={{
              ...styles.actionButton,
              backgroundColor: isDark ? '#1f2937' : '#f1f5f9',
              color: isDark ? '#e2e8f0' : '#334155',
            }}
            title="查看键盘快捷键"
          >
            ⌨️ 快捷键
          </button>

          <ThemeToggle />

          <select
            value={exportQuality}
            onChange={(e) => setExportQuality(e.target.value)}
            style={{
              ...styles.qualitySelect,
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              borderColor: isDark ? '#374151' : '#cbd5e1',
            }}
            disabled={exporting}
          >
            <option value="high">高质量</option>
            <option value="medium">标准质量</option>
            <option value="low">低质量 (快速)</option>
          </select>

          <button
            onClick={handleExport}
            disabled={exporting || saving || !isVideoFile}
            style={{
              ...styles.exportButton,
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? '⏳ 导出中...' : '📤 导出视频'}
          </button>
        </div>
      </header>

      {/* 专业双栏工作台布局 */}
      <main className="editor-workspace" style={styles.workspace}>
        {/* 左侧控制栏：播放器 + 剪辑统计 + 字幕设置 */}
        <section className="editor-sidebar" style={{
          ...styles.leftPanel,
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderColor: isDark ? '#1f2937' : '#e2e8f0',
        }}>
          {/* 播放器区域 (内置实时字幕预览) */}
          <div style={styles.playerContainer}>
            {isVideoFile ? (
              <VideoPlayer
                key={audioUrl}
                ref={videoRef}
                videoUrl={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                subtitleEnabled={subtitleEnabled}
                subtitleConfig={subtitleConfig}
                currentSubtitle={currentSubtitleText}
              />
            ) : (
              <WaveformPlayer
                key={audioUrl}
                ref={waveformRef}
                audioUrl={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                height={75}
              />
            )}
          </div>

          {/* 剪辑指标看板 (前端实时联动) */}
          <div style={{
            ...styles.statsCard,
            backgroundColor: isDark ? '#1a2234' : '#f8fafc',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
          }}>
            <div style={styles.statsRowHeader}>
              <span style={styles.panelSectionTitle}>📊 剪辑成片预估</span>
              {statistics.deletedDuration > 0 && (
                <span style={styles.savedTimeBadge}>
                  已精简 -{statistics.deletedDuration.toFixed(1)}s
                </span>
              )}
            </div>
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <div style={{ ...styles.statValue, color: '#6366f1' }}>{statistics.totalWords}</div>
                <div style={styles.statLabel}>总词数</div>
              </div>
              <div style={styles.statItem}>
                <div style={{ ...styles.statValue, color: '#ef4444' }}>{statistics.deletedCount}</div>
                <div style={styles.statLabel}>已删除</div>
              </div>
              <div style={styles.statItem}>
                <div style={{ ...styles.statValue, color: '#10b981' }}>{statistics.keptCount}</div>
                <div style={styles.statLabel}>保留词</div>
              </div>
              <div style={styles.statItem}>
                <div style={{ ...styles.statValue, color: '#f59e0b' }}>{statistics.fillerCount}</div>
                <div style={styles.statLabel}>语气词</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statValue}>{formatSecs(statistics.originalDuration)}</div>
                <div style={styles.statLabel}>原时长</div>
              </div>
              <div style={styles.statItem}>
                <div style={{ ...styles.statValue, color: '#3b82f6' }}>{formatSecs(statistics.estimatedDuration)}</div>
                <div style={styles.statLabel}>剪辑后预估</div>
              </div>
            </div>
          </div>

          {/* 字幕设置面板 */}
          <div style={{
            ...styles.subtitleCard,
            backgroundColor: isDark ? '#1a2234' : '#f8fafc',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
          }}>
            <div
              style={styles.subtitleHeader}
              onClick={() => setIsSubtitlePanelOpen(!isSubtitlePanelOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={styles.panelSectionTitle}>🎬 字幕样式 (所见即所得)</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {isSubtitlePanelOpen ? '▼' : '▶'}
                </span>
              </div>
              <label
                style={styles.enableToggle}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={subtitleEnabled}
                  onChange={(e) => setSubtitleEnabled(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{ fontSize: '13px', fontWeight: '500' }}>启用字幕</span>
              </label>
            </div>

            {isSubtitlePanelOpen && subtitleEnabled && (
              <div style={styles.subtitleOptions}>
                <div style={styles.optionRow}>
                  <label style={styles.optionLabel}>
                    <span>字体</span>
                    <select
                      value={subtitleConfig.font_name}
                      onChange={(e) => setSubtitleConfig({...subtitleConfig, font_name: e.target.value})}
                      style={{
                        ...styles.optionSelect,
                        backgroundColor: isDark ? '#111827' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        borderColor: isDark ? '#374151' : '#cbd5e1',
                      }}
                    >
                      <option value="Arial">Arial (通用)</option>
                      <option value="Microsoft YaHei">微软雅黑</option>
                      <option value="SimHei">黑体</option>
                      <option value="KaiTi">楷体</option>
                    </select>
                  </label>

                  <label style={styles.optionLabel}>
                    <span>字号</span>
                    <select
                      value={subtitleConfig.font_size || 20}
                      onChange={(e) => setSubtitleConfig({...subtitleConfig, font_size: parseInt(e.target.value)})}
                      style={{
                        ...styles.optionSelect,
                        backgroundColor: isDark ? '#111827' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        borderColor: isDark ? '#374151' : '#cbd5e1',
                      }}
                    >
                      <option value="16">小 (16px)</option>
                      <option value="20">标准 (20px)</option>
                      <option value="24">大 (24px)</option>
                      <option value="28">超大 (28px)</option>
                    </select>
                  </label>
                </div>

                <div style={styles.optionRow}>
                  <label style={styles.optionLabel}>
                    <span>文字色</span>
                    <input
                      type="color"
                      value={subtitleConfig.color}
                      onChange={(e) => setSubtitleConfig({...subtitleConfig, color: e.target.value})}
                      style={styles.colorInput}
                    />
                  </label>

                  <label style={styles.optionLabel}>
                    <span>描边色</span>
                    <input
                      type="color"
                      value={subtitleConfig.outline_color}
                      onChange={(e) => setSubtitleConfig({...subtitleConfig, outline_color: e.target.value})}
                      style={styles.colorInput}
                    />
                  </label>

                  <label style={styles.optionLabel}>
                    <span>位置</span>
                    <select
                      value={subtitleConfig.position}
                      onChange={(e) => setSubtitleConfig({...subtitleConfig, position: e.target.value})}
                      style={{
                        ...styles.optionSelect,
                        backgroundColor: isDark ? '#111827' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        borderColor: isDark ? '#374151' : '#cbd5e1',
                      }}
                    >
                      <option value="bottom">底部</option>
                      <option value="center">居中</option>
                      <option value="top">顶部</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 右侧独立滚动区：逐字稿编辑工作台 */}
        <section
          className="editor-transcript"
          ref={transcriptScrollRef}
          style={{
            ...styles.rightPanel,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? '#1f2937' : '#e2e8f0',
          }}
        >
          {/* 逐字稿顶部操作与过滤条 */}
          <div className="editor-transcript-toolbar" style={{
            ...styles.transcriptToolbar,
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          }}>
            <div style={styles.batchActions}>
              <button
                onClick={() => toggleAllFillers(true)}
                style={styles.batchButtonDelete}
                title="自动将所有 '嗯、啊、这' 等无意义语气词划线标记删除"
              >
                🗑️ 一键消除语气词
              </button>
              <button
                onClick={() => toggleAllFillers(false)}
                style={styles.batchButtonRestore}
                title="恢复所有被识别出的语气词"
              >
                ♻️ 恢复所有语气词
              </button>
            </div>

            {/* 搜索框 */}
            <div style={styles.searchBox}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="搜索字词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  ...styles.searchInput,
                  color: isDark ? '#f8fafc' : '#0f172a',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                >✕</button>
              )}
            </div>

            {/* 状态图例 */}
            <div style={styles.legend}>
              <span style={styles.legendItem}>
                <span style={{...styles.legendBox, background: isDark ? '#334155' : '#e2e8f0'}}></span>
                正常词
              </span>
              <span style={styles.legendItem}>
                <span style={{...styles.legendBox, background: '#fee2e2'}}></span>
                语气词
              </span>
              <span style={styles.legendItem}>
                <span style={{...styles.legendBox, background: '#c084fc'}}></span>
                当前播放
              </span>
              <span style={styles.legendItem}>
                <span style={{...styles.legendBox, textDecoration: 'line-through'}}>删除</span>
              </span>
            </div>
          </div>

          {/* 结构化逐字稿：按句子/段落分块展示 */}
          <div style={styles.sentencesContainer}>
            {sentenceBlocks.map((block, bIndex) => {
              const startSec = block[0].word.start || 0;
              const endSec = block[block.length - 1].word.end || 0;
              const isBlockActive = block.some(item => item.index === currentWordIndex);

              return (
                <div
                  key={bIndex}
                  style={{
                    ...styles.sentenceRow,
                    backgroundColor: isBlockActive
                      ? (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(238, 242, 255, 0.8)')
                      : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'transparent'),
                    borderColor: isBlockActive
                      ? '#6366f1'
                      : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'),
                  }}
                >
                  {/* 左侧句间时间戳与试听按钮 */}
                  <div style={styles.sentenceMeta}>
                    <button
                      onClick={() => handleSentencePlay(block)}
                      disabled={endSec <= startSec}
                      style={styles.sentencePlayBtn}
                      title="从本句开始播放"
                    >
                      ▶️
                    </button>
                    <span style={styles.sentenceTime}>
                      {formatSecs(startSec)} - {formatSecs(endSec)}
                    </span>
                  </div>

                  {/* 右侧词块流 */}
                  <div style={styles.sentenceWords}>
                    {block.map(({ word, index }) => {
                      const isDeleted = word.auto_delete || word.user_delete;
                      const isFiller = word.type === 'filler';
                      const isCurrent = index === currentWordIndex;
                      const isSelected = index === selectedWordIndex;
                      const isEditing = index === editingIndex;
                      const isMatch = searchQuery && word.word.toLowerCase().includes(searchQuery.toLowerCase());

                      if (isEditing) {
                        return (
                          <input
                            key={index}
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={handleEditComplete}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditComplete();
                              if (e.key === 'Escape') {
                                setEditingIndex(-1);
                                setEditingText('');
                              }
                            }}
                            autoFocus
                            style={styles.editInput}
                          />
                        );
                      }

                      return (
                        <span
                          id={`word-chip-${index}`}
                          key={index}
                          onClick={() => handleWordClick(index)}
                          onDoubleClick={() => handleWordDoubleClick(index)}
                          style={{
                            ...styles.wordChip,
                            textDecoration: isDeleted ? 'line-through' : 'none',
                            backgroundColor: isCurrent
                              ? '#c084fc'
                              : isFiller
                                ? '#fee2e2'
                                : isMatch
                                  ? '#fef08a'
                                  : isDark
                                    ? '#1e293b'
                                    : '#f1f5f9',
                            color: isCurrent
                              ? '#ffffff'
                              : isFiller
                                ? '#991b1b'
                                : isMatch
                                  ? '#854d0e'
                                  : isDeleted
                                    ? '#94a3b8'
                                    : isDark
                                      ? '#f1f5f9'
                                      : '#1e293b',
                            border: isSelected
                              ? '2px solid #6366f1'
                              : isCurrent
                                ? '2px solid #9333ea'
                                : isDeleted
                                  ? '1px dashed #ef4444'
                                  : '1px solid transparent',
                            opacity: isDeleted ? 0.45 : 1,
                            transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                            fontWeight: isCurrent || isMatch ? '700' : '500',
                          }}
                          title={`单击跳转 (${word.start.toFixed(2)}s) | 双击修改 | Delete键删除/恢复`}
                        >
                          {word.word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 快捷键提示模态框 */}
      {showShortcutsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowShortcutsModal(false)}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>⌨️ 快捷键速查表</h3>
              <button onClick={() => setShowShortcutsModal(false)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <div style={styles.shortcutsList}>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>Space (空格)</kbd>
                <span>播放 / 暂停音视频</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>Delete / Backspace</kbd>
                <span>删除 / 恢复选中的词</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>← / → 方向键</kbd>
                <span>快退 2 秒 / 快进 2 秒</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>↑ / ↓ 方向键</kbd>
                <span>选择上一个词 / 下一个词</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>Ctrl + Z / ⌘ + Z</kbd>
                <span>撤销上一步操作</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>Ctrl + Shift + Z / ⌘ + ⇧ + Z</kbd>
                <span>重做上一步操作</span>
              </div>
              <div style={styles.shortcutRow}>
                <kbd style={styles.kbd}>双击词块</kbd>
                <span>直接修改文本内容</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    gap: '12px',
    background: '#090d16',
  },
  spinnerIcon: {
    fontSize: '32px',
  },
  loadingText: {
    fontSize: '16px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  header: {
    height: '56px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    borderBottom: '1px solid',
    zIndex: 100,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  backButton: {
    padding: '6px 14px',
    fontSize: '13px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '17px',
    fontWeight: '700',
    letterSpacing: '-0.3px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  actionButton: {
    padding: '6px 12px',
    fontSize: '13px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.15s ease',
  },
  qualitySelect: {
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    outline: 'none',
  },
  exportButton: {
    padding: '7px 16px',
    fontSize: '13px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '440px',
    minWidth: '380px',
    maxWidth: '480px',
    height: '100%',
    overflowY: 'auto',
    padding: '16px',
    borderRight: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flexShrink: 0,
  },
  playerContainer: {
    width: '100%',
  },
  panelSectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '-0.2px',
  },
  statsCard: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid',
  },
  statsRowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  savedTimeBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.1)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  statItem: {
    textAlign: 'center',
    padding: '4px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: '800',
    marginBottom: '2px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  subtitleCard: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid',
  },
  subtitleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  enableToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  subtitleOptions: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(148, 163, 184, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  optionLabel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  optionSelect: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer',
    outline: 'none',
  },
  colorInput: {
    width: '36px',
    height: '26px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'none',
  },
  rightPanel: {
    flex: 1,
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  transcriptToolbar: {
    padding: '10px 18px',
    borderBottom: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  batchActions: {
    display: 'flex',
    gap: '8px',
  },
  batchButtonDelete: {
    padding: '5px 12px',
    fontSize: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  batchButtonRestore: {
    padding: '5px 12px',
    fontSize: '12px',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(148, 163, 184, 0.1)',
    padding: '3px 10px',
    borderRadius: '6px',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: '12px',
    width: '100px',
  },
  searchClearBtn: {
    border: 'none',
    background: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '11px',
  },
  legend: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: '#94a3b8',
  },
  legendBox: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    border: '1px solid #94a3b8',
  },
  sentencesContainer: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sentenceRow: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid',
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
  },
  sentenceMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
    paddingTop: '3px',
  },
  sentencePlayBtn: {
    border: 'none',
    background: 'none',
    padding: '0',
    cursor: 'pointer',
    fontSize: '13px',
  },
  sentenceTime: {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  sentenceWords: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    lineHeight: '1.8',
  },
  wordChip: {
    padding: '3px 9px',
    fontSize: '15px',
    cursor: 'pointer',
    borderRadius: '6px',
    userSelect: 'none',
    transition: 'transform 0.15s ease, background-color 0.15s ease',
  },
  editInput: {
    fontSize: '14px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '2px solid #6366f1',
    outline: 'none',
    width: '80px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '90%',
    maxWidth: '460px',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  modalCloseBtn: {
    border: 'none',
    background: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  shortcutsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  shortcutRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  kbd: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
};

export default Editor;
