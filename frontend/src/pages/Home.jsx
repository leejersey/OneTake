import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [modelSize, setModelSize] = useState('medium'); // 新增：模型选择
  const navigate = useNavigate();

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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
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

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎬 One Take</h1>
          <p style={styles.subtitle}>AI 视频自动剪辑编辑器</p>
          <p style={styles.description}>
            上传视频 → 自动转写 → 编辑逐字稿 → 导出剪辑视频
          </p>
        </div>

        <div
          style={{
            ...styles.dropZone,
            borderColor: file ? '#10b981' : '#d1d5db',
            background: file ? '#f0fdf4' : '#f9fafb',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div style={styles.uploadIcon}>📁</div>
          <p style={styles.dropText}>
            {file ? '✅ 文件已选择' : '拖拽文件到此处'}
          </p>
          <p style={styles.dropHint}>或</p>
          <label style={styles.fileLabel}>
            <input
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileChange}
              disabled={uploading}
              style={styles.fileInput}
            />
            <span style={styles.fileLabelText}>选择文件</span>
          </label>
          
          {file && (
            <div style={styles.fileInfo}>
              <p style={styles.fileName}>📄 {file.name}</p>
              <p style={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* 模型选择器 */}
        <div style={styles.modelSelector}>
          <label style={styles.modelLabel}>
            <span style={styles.modelLabelText}>🎯 识别模型:</span>
            <select 
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value)}
              disabled={uploading}
              style={styles.modelSelect}
            >
              <option value="tiny">Tiny (最快 · 准确率 ~80%)</option>
              <option value="base">Base (快速 · 准确率 ~85%)</option>
              <option value="medium">Medium (推荐 · 准确率 ~95%)</option>
              <option value="large">Large (最准 · 准确率 ~97%)</option>
            </select>
          </label>
          <p style={styles.modelHint}>
            💡 提示：Medium 模型适合大多数场景，准确率高且速度适中
          </p>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            ...styles.uploadButton,
            opacity: !file || uploading ? 0.5 : 1,
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? '🔄 处理中...' : '🚀 开始处理'}
        </button>

        {uploading && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <p style={styles.progressText}>{progress}</p>
          </div>
        )}

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>⚡</span>
            <span style={styles.featureText}>快速转写</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✂️</span>
            <span style={styles.featureText}>智能剪辑</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🎯</span>
            <span style={styles.featureText}>精确编辑</span>
          </div>
        </div>

        {/* 历史任务列表 */}
        {historyTasks.length > 0 && (
          <div style={styles.historySection}>
            <h3 style={styles.historyTitle}>📚 历史任务</h3>
            <div style={styles.historyList}>
              {historyTasks.slice(0, 5).map((task) => (
                <div
                  key={task.task_id}
                  style={styles.historyItem}
                  onClick={() => task.status === 'completed' && navigate(`/editor/${task.task_id}`)}
                >
                  <span style={styles.historyStatus}>
                    {task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏳'}
                  </span>
                  <span style={styles.historyName}>
                    {task.file_path?.split('/').pop() || '未命名'}
                  </span>
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '20px',
    padding: 'clamp(20px, 5vw, 40px)',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: 'clamp(20px, 5vw, 40px)',
  },
  title: {
    fontSize: 'clamp(32px, 8vw, 48px)',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: 'clamp(16px, 4vw, 20px)',
    color: '#6b7280',
    margin: '0 0 10px 0',
    fontWeight: '500',
  },
  description: {
    fontSize: 'clamp(12px, 3vw, 14px)',
    color: '#9ca3af',
    margin: 0,
  },
  dropZone: {
    border: '3px dashed',
    borderRadius: '16px',
    padding: 'clamp(20px, 5vw, 40px) 20px',
    textAlign: 'center',
    marginBottom: '20px',
    transition: 'all 0.3s',
  },
  uploadIcon: {
    fontSize: 'clamp(48px, 10vw, 64px)',
    marginBottom: '20px',
  },
  dropText: {
    fontSize: 'clamp(14px, 4vw, 18px)',
    color: '#374151',
    margin: '0 0 10px 0',
    fontWeight: '500',
  },
  dropHint: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: '10px 0',
  },
  fileLabel: {
    display: 'inline-block',
    padding: '12px 24px',
    background: '#6366f1',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(14px, 3vw, 16px)',
  },
  fileLabelText: {
    pointerEvents: 'none',
  },
  fileInput: {
    display: 'none',
  },
  fileInfo: {
    marginTop: '20px',
    padding: '15px',
    background: '#f3f4f6',
    borderRadius: '8px',
    wordBreak: 'break-all',
  },
  fileName: {
    margin: '0 0 5px 0',
    fontSize: 'clamp(14px, 3vw, 16px)',
    color: '#1f2937',
    fontWeight: '500',
  },
  fileSize: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  },
  uploadButton: {
    width: '100%',
    padding: '16px',
    fontSize: 'clamp(16px, 4vw, 18px)',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.3s',
  },
  progressContainer: {
    marginTop: '20px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
    transition: 'width 0.3s',
  },
  progressText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  features: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: '30px',
    paddingTop: '30px',
    borderTop: '1px solid #e5e7eb',
    flexWrap: 'wrap',
    gap: '15px',
  },
  feature: {
    textAlign: 'center',
    minWidth: '80px',
  },
  featureIcon: {
    fontSize: 'clamp(24px, 6vw, 32px)',
    display: 'block',
    marginBottom: '8px',
  },
  featureText: {
    fontSize: 'clamp(12px, 3vw, 14px)',
    color: '#6b7280',
  },
  historySection: {
    marginTop: '30px',
    paddingTop: '30px',
    borderTop: '1px solid #e5e7eb',
  },
  historyTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    color: '#374151',
    fontWeight: 'bold',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 15px',
    background: '#f9fafb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  historyStatus: {
    fontSize: '16px',
  },
  historyName: {
    flex: 1,
    fontSize: '14px',
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  historyDate: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  modelSelector: {
    marginBottom: '20px',
    padding: '15px',
    background: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  modelLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  modelLabelText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  modelSelect: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  modelHint: {
    margin: '8px 0 0 0',
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
};

export default Home;
