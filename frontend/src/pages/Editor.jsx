import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import WaveformPlayer from '../components/WaveformPlayer';
import VideoPlayer from '../components/VideoPlayer';

function Editor() {
  const { taskId } = useParams();
  const navigate = useNavigate();
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

  const [selectedWordIndex, setSelectedWordIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingText, setEditingText] = useState('');

  // 字幕配置
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitleConfig, setSubtitleConfig] = useState({
    font_name: 'Arial',
    font_size: null, // null 表示自动
    color: '#FFFFFF',
    outline_color: '#000000',
    outline_width: 2,
    position: 'bottom'
  });

  useEffect(() => {
    loadEDL();
  }, [taskId]);

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

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 撤销/重做
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      
      // 空格键播放/暂停
      if (e.key === ' ' && e.target.tagName !== 'INPUT') {
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
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWordIndex >= 0) {
        e.preventDefault();
        toggleWordDelete(selectedWordIndex);
        return;
      }
      
      // 上下方向键选择词
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        const newIndex = Math.max(0, Math.min(modifiedWords.length - 1, selectedWordIndex + delta));
        setSelectedWordIndex(newIndex);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, selectedWordIndex, modifiedWords]);

  const loadEDL = async () => {
    try {
      const response = await api.getEDL(taskId);
      setEdl(response.data);
      const words = response.data.words || [];
      setModifiedWords(words);
      setSavedWords(words);
      setHistory([words]);
      setHistoryIndex(0);
      setLoading(false);
    } catch (error) {
      console.error('加载 EDL 失败:', error);
      alert('加载失败');
    }
  };

  const saveToHistory = (newWords) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newWords);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setModifiedWords(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setModifiedWords(history[historyIndex + 1]);
    }
  };

  const toggleWordDelete = (index) => {
    const newWords = modifiedWords.map((word, i) => 
      i === index 
        ? { ...word, auto_delete: false, user_delete: !(word.auto_delete || word.user_delete) }
        : word
    );
    setModifiedWords(newWords);
    saveToHistory(newWords);
  };

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

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>加载中...</div>
      </div>
    );
  }

  const deletedCount = modifiedWords.filter(w => w.auto_delete || w.user_delete).length;
  const keptCount = modifiedWords.length - deletedCount;
  const fillerCount = modifiedWords.filter(w => w.type === 'filler').length;
  const currentWordIndex = getCurrentWordIndex();
  const audioUrl = api.getAudioUrl(taskId);
  
  // 判断是否是视频文件
  const isVideoFile = edl?.original_audio?.match(/\.(mp4|avi|mov|mkv|webm)$/i);

  return (
    <div style={styles.container}>
      {/* 顶部工具栏 */}
      <div style={styles.header}>
        <button onClick={() => {
          if (!hasUnsavedChanges || window.confirm('有未保存的修改，确定离开？')) navigate('/');
        }} style={styles.backButton}>
          ← 返回首页
        </button>
        <h1 style={styles.title}>One Take 编辑器</h1>
        <div style={styles.headerActions}>
          <span role="status">{hasUnsavedChanges ? '未保存' : '已保存'}</span>
          <button onClick={handleSave} disabled={saving || exporting || !hasUnsavedChanges} style={styles.actionButton}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={handleUndo} disabled={historyIndex <= 0} style={styles.actionButton} title="撤销 (Ctrl+Z)">
            ↩️ 撤销
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} style={styles.actionButton} title="重做 (Ctrl+Shift+Z)">
            ↪️ 重做
          </button>
          <select 
            value={exportQuality}
            onChange={(e) => setExportQuality(e.target.value)}
            style={styles.qualitySelect}
            disabled={exporting}
          >
            <option value="high">高质量</option>
            <option value="medium">中质量</option>
            <option value="low">低质量</option>
          </select>
          <button 
            onClick={handleExport} 
            disabled={exporting || saving}
            style={{...styles.exportButton, opacity: exporting ? 0.6 : 1}}
          >
            {exporting ? '导出中...' : '📤 导出视频'}
          </button>
        </div>
      </div>

      {/* 播放器区域 */}
      {isVideoFile ? (
        <VideoPlayer
          ref={videoRef}
          videoUrl={audioUrl}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : (
        <WaveformPlayer
          ref={waveformRef}
          audioUrl={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          height={80}
        />
      )}

      {/* 统计信息卡片 */}
      <div style={styles.statsCard}>
        <div style={styles.statsHeader}>
          <h3 style={styles.statsTitle}>📊 统计信息</h3>
          <div style={styles.batchActions}>
            <button onClick={() => toggleAllFillers(true)} style={styles.batchButton}>
              🗑️ 删除所有语气词
            </button>
            <button onClick={() => toggleAllFillers(false)} style={styles.batchButtonAlt}>
              ♻️ 恢复所有语气词
            </button>
          </div>
        </div>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{edl?.statistics?.total_words || 0}</div>
            <div style={styles.statLabel}>总词数</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#f59e0b'}}>{fillerCount}</div>
            <div style={styles.statLabel}>语气词</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#ef4444'}}>{deletedCount}</div>
            <div style={styles.statLabel}>已删除</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#10b981'}}>{keptCount}</div>
            <div style={styles.statLabel}>保留</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{edl?.statistics?.original_duration?.toFixed(1) || 0}s</div>
            <div style={styles.statLabel}>原始时长</div>
          </div>
          <div style={styles.statItem}>
            <div style={{...styles.statValue, color: '#3b82f6'}}>{edl?.statistics?.estimated_final_duration?.toFixed(1) || 0}s</div>
            <div style={styles.statLabel}>预估时长</div>
          </div>
        </div>
      </div>

      {/* 字幕配置面板 */}
      <div style={styles.subtitleCard}>
        <div style={styles.subtitleHeader}>
          <h3 style={styles.subtitleTitle}>🎬 字幕设置</h3>
          <label style={styles.enableToggle}>
            <input
              type="checkbox"
              checked={subtitleEnabled}
              onChange={(e) => setSubtitleEnabled(e.target.checked)}
              style={styles.checkbox}
            />
            <span>启用字幕</span>
          </label>
        </div>
        
        {subtitleEnabled && (
          <div style={styles.subtitleOptions}>
            <div style={styles.optionRow}>
              <label style={styles.optionLabel}>
                字体:
                <select
                  value={subtitleConfig.font_name}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, font_name: e.target.value})}
                  style={styles.optionSelect}
                >
                  <option value="Arial">Arial</option>
                  <option value="Microsoft YaHei">微软雅黑</option>
                  <option value="SimHei">黑体</option>
                  <option value="KaiTi">楷体</option>
                </select>
              </label>
              
              <label style={styles.optionLabel}>
                颜色:
                <input
                  type="color"
                  value={subtitleConfig.color}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, color: e.target.value})}
                  style={styles.colorInput}
                />
              </label>
            </div>
            
            <div style={styles.optionRow}>
              <label style={styles.optionLabel}>
                描边颜色:
                <input
                  type="color"
                  value={subtitleConfig.outline_color}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, outline_color: e.target.value})}
                  style={styles.colorInput}
                />
              </label>
              
              <label style={styles.optionLabel}>
                位置:
                <select
                  value={subtitleConfig.position}
                  onChange={(e) => setSubtitleConfig({...subtitleConfig, position: e.target.value})}
                  style={styles.optionSelect}
                >
                  <option value="bottom">底部</option>
                  <option value="center">中间</option>
                  <option value="top">顶部</option>
                </select>
              </label>
            </div>
            
            <p style={styles.subtitleHint}>
              💡 字号会根据视频分辨率自动调整（横屏 16:9 / 竖屏 9:16）
            </p>
          </div>
        )}
      </div>

      {/* 逐字稿编辑区 */}
      <div style={styles.transcriptContainer}>
        <div style={styles.transcriptHeader}>
          <h3 style={styles.transcriptTitle}>📝 逐字稿</h3>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{...styles.legendBox, background: '#dbeafe'}}></span>
              正常词
            </span>
            <span style={styles.legendItem}>
              <span style={{...styles.legendBox, background: '#fee2e2'}}></span>
              语气词
            </span>
            <span style={styles.legendItem}>
              <span style={{...styles.legendBox, background: '#c4b5fd', border: '2px solid #7c3aed'}}></span>
              当前播放
            </span>
            <span style={styles.legendItem}>
              <span style={{...styles.legendBox, textDecoration: 'line-through'}}>删除</span>
            </span>
          </div>
        </div>
        
        <div style={styles.wordsContainer}>
          {modifiedWords.map((word, index) => {
            const isDeleted = word.auto_delete || word.user_delete;
            const isFiller = word.type === 'filler';
            const isCurrent = index === currentWordIndex;
            const isSelected = index === selectedWordIndex;
            const isEditing = index === editingIndex;
            
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
                key={index}
                onClick={() => handleWordClick(index)}
                onDoubleClick={() => handleWordDoubleClick(index)}
                style={{
                  ...styles.wordChip,
                  textDecoration: isDeleted ? 'line-through' : 'none',
                  backgroundColor: isCurrent ? '#c4b5fd' : (isFiller ? '#fee2e2' : '#dbeafe'),
                  border: isSelected ? '3px solid #6366f1' : (isCurrent ? '3px solid #7c3aed' : (isDeleted ? '3px solid #ef4444' : '2px solid transparent')),
                  opacity: isDeleted ? 0.5 : 1,
                  transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                }}
                title={`双击编辑 | 单击选择 | Delete删除\n${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s`}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* 提示信息 */}
      <div style={styles.hint}>
        💡 提示：单击选择词，双击编辑文字，Delete 删除。空格播放/暂停，方向键跳转。
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#1a1a1a',
  },
  loadingText: {
    fontSize: '24px',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '15px 25px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    flexWrap: 'wrap',
    gap: '10px',
  },
  backButton: {
    padding: '10px 20px',
    fontSize: '14px',
    background: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    color: '#1f2937',
    fontWeight: 'bold',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  actionButton: {
    padding: '8px 16px',
    fontSize: '14px',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  exportButton: {
    padding: '12px 24px',
    fontSize: '14px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  statsCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  statsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  statsTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#1f2937',
    fontWeight: 'bold',
  },
  batchActions: {
    display: 'flex',
    gap: '10px',
  },
  batchButton: {
    padding: '8px 16px',
    fontSize: '13px',
    background: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  batchButtonAlt: {
    padding: '8px 16px',
    fontSize: '13px',
    background: '#d1fae5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '15px',
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  transcriptContainer: {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  transcriptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  transcriptTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#1f2937',
    fontWeight: 'bold',
  },
  legend: {
    display: 'flex',
    gap: '15px',
    fontSize: '13px',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
  },
  legendBox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #d1d5db',
  },
  wordsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    lineHeight: '2',
  },
  wordChip: {
    padding: '6px 14px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '8px',
    userSelect: 'none',
    transition: 'all 0.2s',
    fontWeight: '500',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  hint: {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '15px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
  },
  qualitySelect: {
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  subtitleCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  subtitleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  subtitleTitle: {
    margin: 0,
    fontSize: '18px',
    color: '#1f2937',
    fontWeight: 'bold',
  },
  enableToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  subtitleOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  optionRow: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  optionSelect: {
    padding: '6px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  colorInput: {
    width: '50px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  subtitleHint: {
    margin: '10px 0 0 0',
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
};

export default Editor;
