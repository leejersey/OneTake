import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useTheme } from '../contexts/theme';
import ThemeToggle from '../components/ThemeToggle';

function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [retryingTask, setRetryingTask] = useState(null);
  const [modelSize, setModelSize] = useState('medium'); // 模型选择
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    loadHistoryTasks();
  }, []);

  const loadHistoryTasks = async () => {
    try {
      const response = await api.getTasks(10, 0);
      setHistoryTasks(response.data || []);
    } catch (error) {
      console.error('加载历史任务失败:', error);
    }
  };

  const handleRetry = async (taskId) => {
    setRetryingTask(taskId);
    try {
      await api.retryTask(taskId);
      await loadHistoryTasks();
      setUploading(true);
      setProgressPercent(0);
      setProgress('重新处理中...');
      pollTaskFallback(taskId);
    } catch (error) {
      alert(`重试失败: ${error.response?.data?.detail || error.message}`);
    } finally {
      setRetryingTask(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (selectedFile.size > maxSize) {
        alert('文件过大，最大支持 500MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }

    try {
      setUploading(true);
      setProgress('正在上传...');
      setProgressPercent(10);

      const uploadResponse = await api.upload(file, 'zh', modelSize);
      const taskId = uploadResponse.data.task_id;
      setProgress('上传成功，正在处理...');
      setProgressPercent(30);

      // 使用 WebSocket 监听进度
      const ws = new WebSocket(api.getTaskWebSocketUrl(taskId));

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'ping') {
          // 心跳响应
          ws.send('pong');
          return;
        }

        if (data.type === 'error') {
          alert(`处理失败: ${data.error}`);
          setUploading(false);
          setProgressPercent(0);
          ws.close();
          return;
        }

        if (data.type === 'completed') {
          setProgress('处理完成！正在跳转...');
          setProgressPercent(100);
          ws.close();
          setTimeout(() => navigate(`/editor/${taskId}`), 500);
          return;
        }

        if (data.type === 'progress') {
          const currentProgress = data.progress || 0;
          setProgress(`ASR 转写中... ${currentProgress}%`);
          setProgressPercent(currentProgress);

          if (data.status === 'failed') {
            alert(`处理失败`);
            setUploading(false);
            setProgressPercent(0);
            ws.close();
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        // 降级到轮询
        console.log('降级到轮询模式');
        ws.close();
        pollTaskFallback(taskId);
      };

      ws.onclose = () => {
        console.log('WebSocket 连接关闭');
      };

    } catch (error) {
      console.error('上传失败:', error);
      alert(`上传失败: ${error.message}`);
      setUploading(false);
      setProgressPercent(0);
    }
  };

  // 轮询备用方案
  const pollTaskFallback = async (taskId) => {
    const pollTask = async () => {
      try {
        const taskResponse = await api.getTask(taskId);
        const task = taskResponse.data;

        if (task.status === 'completed') {
          setProgress('处理完成！正在跳转...');
          setProgressPercent(100);
          setTimeout(() => navigate(`/editor/${taskId}`), 500);
        } else if (task.status === 'failed') {
          alert(`处理失败: ${task.error}`);
          setUploading(false);
          setProgressPercent(0);
        } else {
          const currentProgress = task.progress || 0;
          setProgress(`ASR 转写中... ${currentProgress}%`);
          setProgressPercent(currentProgress);
          setTimeout(pollTask, 2000);
        }
      } catch (error) {
        console.error('轮询失败:', error);
        setTimeout(pollTask, 2000);
      }
    };
    pollTask();
  };

  // 阶段判断
  const currentStep = progressPercent >= 100 ? 4 : progressPercent >= 60 ? 3 : progressPercent >= 30 ? 2 : progressPercent > 0 ? 1 : 0;

  return (
    <div style={{
      ...styles.container,
      background: isDark
        ? 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 60%, #030712 100%)'
        : 'radial-gradient(ellipse at top, #e0e7ff 0%, #f8fafc 60%, #f1f5f9 100%)',
    }}>
      {/* 顶部简易栏 */}
      <div style={styles.topBar}>
        <div style={styles.brandTitle}>
          <span style={{ fontSize: '24px' }}>🎬</span>
          <span style={{ fontWeight: '700', fontSize: '18px', color: isDark ? '#f8fafc' : '#0f172a' }}>One Take AI</span>
        </div>
        <ThemeToggle />
      </div>

      <div style={{
        ...styles.card,
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        boxShadow: isDark ? '0 20px 60px rgba(0, 0, 0, 0.6)' : '0 20px 60px rgba(99, 102, 241, 0.12)',
      }}>
        <div style={styles.header}>
          <h1 style={styles.title}>AI 视频智能粗剪</h1>
          <p style={{
            ...styles.subtitle,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>一键上传视频，自动转写逐字稿，像编辑文档一样轻松剪辑音视频</p>
        </div>

        {/* 拖拽上传区 */}
        <div
          style={{
            ...styles.dropZone,
            borderColor: file ? '#10b981' : isDragging ? '#6366f1' : isDark ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
            background: isDragging
              ? (isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(224, 231, 255, 0.5)')
              : file
                ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4')
                : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
            transform: isDragging ? 'scale(1.01)' : 'scale(1)',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <div style={styles.uploadIcon}>{file ? '✅' : '📥'}</div>
          <p style={{
            ...styles.dropText,
            color: isDark ? '#f1f5f9' : '#1e293b',
          }}>
            {file ? '文件就绪' : isDragging ? '松开鼠标即可添加' : '拖拽音视频文件至此处'}
          </p>
          <p style={styles.dropHint}>支持 MP4, MOV, AVI, MP3, WAV 等格式 · 单文件最大 500MB</p>

          <label style={styles.fileLabel}>
            <input
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileChange}
              disabled={uploading}
              style={styles.fileInput}
            />
            <span style={styles.fileLabelText}>{file ? '重新选择' : '浏览本地文件'}</span>
          </label>

          {file && (
            <div style={{
              ...styles.fileInfo,
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
            }}>
              <p style={{
                ...styles.fileName,
                color: isDark ? '#f8fafc' : '#0f172a',
              }}>📄 {file.name}</p>
              <p style={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* 模型选择器 */}
        <div style={{
          ...styles.modelSelector,
          background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
        }}>
          <div style={styles.modelLabel}>
            <span style={{
              ...styles.modelLabelText,
              color: isDark ? '#e2e8f0' : '#334155',
            }}>🎯 Whisper 识别模型:</span>
            <select
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value)}
              disabled={uploading}
              style={{
                ...styles.modelSelect,
                background: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
              }}
            >
              <option value="tiny">Tiny (超快 · 适合测试)</option>
              <option value="base">Base (快速 · 准确率良好)</option>
              <option value="medium">Medium (推荐 · 平衡精度与速度)</option>
              <option value="large">Large (最准 · 适合嘈杂或专业音频)</option>
            </select>
          </div>
          <p style={styles.modelHint}>
            💡 提示：推荐使用 Medium 模型，支持中英文混杂转写与标点切分
          </p>
        </div>

        {/* 开始处理按钮 */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            ...styles.uploadButton,
            opacity: !file || uploading ? 0.6 : 1,
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? '⏳ 正在处理中...' : '🚀 开始智能识别与剪辑'}
        </button>

        {/* 处理中步骤条与进度条 */}
        {uploading && (
          <div style={styles.progressContainer}>
            <div style={styles.stepperContainer}>
              {[
                { title: '上传文件', step: 1 },
                { title: '音频分离', step: 2 },
                { title: '语音识别', step: 3 },
                { title: '生成逐字稿', step: 4 },
              ].map((s) => (
                <div key={s.step} style={styles.stepItem}>
                  <div style={{
                    ...styles.stepCircle,
                    backgroundColor: currentStep >= s.step ? '#6366f1' : isDark ? '#334155' : '#cbd5e1',
                    color: '#ffffff',
                  }}>
                    {currentStep > s.step ? '✓' : s.step}
                  </div>
                  <span style={{
                    ...styles.stepLabel,
                    color: currentStep >= s.step ? (isDark ? '#f8fafc' : '#0f172a') : '#94a3b8',
                    fontWeight: currentStep === s.step ? '600' : '400',
                  }}>{s.title}</span>
                </div>
              ))}
            </div>

            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <p style={{
              ...styles.progressText,
              color: isDark ? '#94a3b8' : '#64748b',
            }}>{progress}</p>
          </div>
        )}

        {/* 亮点特性 */}
        <div style={{
          ...styles.features,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
        }}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>⚡</span>
            <span style={styles.featureText}>字级时间对齐</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🗑️</span>
            <span style={styles.featureText}>一键消除语气词</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🎬</span>
            <span style={styles.featureText}>精确剪辑导出</span>
          </div>
        </div>

        {/* 历史任务列表 */}
        {historyTasks.length > 0 && (
          <div style={{
            ...styles.historySection,
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
          }}>
            <h3 style={{
              ...styles.historyTitle,
              color: isDark ? '#f8fafc' : '#0f172a',
            }}>📚 最近剪辑历史</h3>
            <div style={styles.historyList}>
              {historyTasks.slice(0, 5).map((task) => (
                <div
                  key={task.task_id}
                  style={{
                    ...styles.historyItem,
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0',
                  }}
                  onClick={() => task.status === 'completed' && navigate(`/editor/${task.task_id}`)}
                >
                  <span style={{
                    ...styles.historyBadge,
                    backgroundColor: task.status === 'completed'
                      ? '#d1fae5'
                      : task.status === 'failed'
                        ? '#fee2e2'
                        : '#fef3c7',
                    color: task.status === 'completed'
                      ? '#065f46'
                      : task.status === 'failed'
                        ? '#991b1b'
                        : '#92400e',
                  }}>
                    {task.status === 'completed' ? '✓ 完成' : task.status === 'failed' ? '✕ 失败' : '⏳ 处理中'}
                  </span>

                  <span style={{
                    ...styles.historyName,
                    color: isDark ? '#f1f5f9' : '#1e293b',
                  }}>
                    {task.file_path?.split('/').pop() || '未命名文件'}
                  </span>

                  {task.status === 'failed' && (
                    <button
                      disabled={uploading || retryingTask !== null}
                      title="使用当前后端模型配置重新转写"
                      onClick={(event) => { event.stopPropagation(); handleRetry(task.task_id); }}
                      style={styles.retryButton}
                    >
                      {retryingTask === task.task_id ? '⏳ 提交中...' : '🔄 重试'}
                    </button>
                  )}

                  <span style={styles.historyDate}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
    boxSizing: 'border-box',
    transition: 'background 0.3s ease',
  },
  topBar: {
    maxWidth: '680px',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  brandTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  card: {
    borderRadius: '24px',
    padding: 'clamp(24px, 5vw, 44px)',
    maxWidth: '680px',
    width: '100%',
    border: '1px solid',
    backdropFilter: 'blur(16px)',
    boxSizing: 'border-box',
    transition: 'all 0.3s ease',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  title: {
    fontSize: 'clamp(28px, 6vw, 38px)',
    fontWeight: '800',
    margin: '0 0 10px 0',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '15px',
    margin: '0',
    lineHeight: '1.6',
  },
  dropZone: {
    border: '2px dashed',
    borderRadius: '16px',
    padding: '36px 20px',
    textAlign: 'center',
    marginBottom: '20px',
    transition: 'all 0.25s ease',
  },
  uploadIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  dropText: {
    fontSize: '17px',
    margin: '0 0 6px 0',
    fontWeight: '600',
  },
  dropHint: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '0 0 18px 0',
  },
  fileLabel: {
    display: 'inline-block',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#fff',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    transition: 'transform 0.15s ease',
  },
  fileLabelText: {
    pointerEvents: 'none',
  },
  fileInput: {
    display: 'none',
  },
  fileInfo: {
    marginTop: '18px',
    padding: '12px 16px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  fileName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  },
  fileSize: {
    margin: 0,
    fontSize: '13px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  modelSelector: {
    marginBottom: '20px',
    padding: '14px 18px',
    borderRadius: '14px',
    border: '1px solid',
  },
  modelLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modelLabelText: {
    fontSize: '14px',
    fontWeight: '600',
  },
  modelSelect: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    outline: 'none',
  },
  modelHint: {
    margin: '8px 0 0 0',
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.4',
  },
  uploadButton: {
    width: '100%',
    padding: '15px',
    fontSize: '16px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.2s ease',
  },
  progressContainer: {
    marginTop: '22px',
  },
  stepperContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  stepCircle: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
  },
  stepLabel: {
    fontSize: '11px',
    transition: 'color 0.3s ease',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    background: 'rgba(148, 163, 184, 0.2)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
    transition: 'width 0.3s ease',
  },
  progressText: {
    textAlign: 'center',
    fontSize: '13px',
    margin: 0,
  },
  features: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid',
    gap: '12px',
  },
  feature: {
    textAlign: 'center',
  },
  featureIcon: {
    fontSize: '22px',
    display: 'block',
    marginBottom: '4px',
  },
  featureText: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  historySection: {
    marginTop: '26px',
    paddingTop: '22px',
    borderTop: '1px solid',
  },
  historyTitle: {
    margin: '0 0 14px 0',
    fontSize: '16px',
    fontWeight: '700',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  historyBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  historyName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  retryButton: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  historyDate: {
    fontSize: '12px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
};

export default Home;
