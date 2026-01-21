// API 客户端
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 300000, // 5 分钟超时（用于视频处理）
});

export const api = {
  // 健康检查
  health: () => apiClient.get('/health'),
  
  // 上传文件
  upload: (file, language = null, modelSize = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language);
    }
    if (modelSize) {
      formData.append('model_size', modelSize);
    }
    return apiClient.post('/api/v1/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // 获取任务状态
  getTask: (taskId) => apiClient.get(`/api/v1/tasks/${taskId}`),
  
  // 获取 EDL
  getEDL: (taskId) => apiClient.get(`/api/v1/tasks/${taskId}/edl`),
  
  // 导出视频
  exportVideo: (taskId, params) => 
    apiClient.post(`/api/v1/tasks/${taskId}/export`, params),
  
  // 获取导出状态
  getExportStatus: (exportId) => apiClient.get(`/api/v1/exports/${exportId}`),
  
  // 下载导出视频
  getDownloadUrl: (exportId) => `${API_BASE}/api/v1/exports/${exportId}/download`,
  
  // 获取任务音频 URL（用于波形图）
  getAudioUrl: (taskId) => `${API_BASE}/api/v1/tasks/${taskId}/audio`,
  
  // 获取任务列表
  getTasks: (limit = 50, offset = 0) => 
    apiClient.get(`/api/v1/tasks?limit=${limit}&offset=${offset}`),
};

export default api;
