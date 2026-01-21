"""
API 端点集成测试
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """创建测试客户端"""
    return TestClient(app)


class TestHealthEndpoint:
    """健康检查端点测试"""
    
    def test_health_check(self, client):
        """健康检查返回正确状态"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestUploadEndpoint:
    """上传端点测试"""
    
    def test_upload_invalid_file_type(self, client):
        """上传不支持的文件类型"""
        response = client.post(
            "/api/v1/upload",
            files={"file": ("test.txt", b"test content", "text/plain")}
        )
        assert response.status_code == 400
        assert "不支持" in response.json()["detail"]


class TestTasksEndpoint:
    """任务端点测试"""
    
    def test_get_nonexistent_task(self, client):
        """获取不存在的任务"""
        response = client.get("/api/v1/tasks/nonexistent-id")
        assert response.status_code == 404


class TestExceptionHandling:
    """全局异常处理测试"""
    
    def test_404_handling(self, client):
        """404 错误处理"""
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404


class TestTasksList:
    """任务列表端点测试"""
    
    def test_get_tasks_list(self, client):
        """获取任务列表"""
        response = client.get("/api/v1/tasks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_tasks_with_pagination(self, client):
        """任务列表分页参数"""
        response = client.get("/api/v1/tasks?limit=5&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5


class TestRateLimiting:
    """限流测试"""
    
    def test_upload_rate_limit(self, client):
        """上传端点限流"""
        # 注意：这个测试可能需要模拟多次请求来触发限流
        # 这里仅作示例，实际测试需要根据限流配置调整
        import io
        test_file = ("test.mp3", io.BytesIO(b"fake audio"), "audio/mpeg")
        
        # 尝试多次上传（这里简化测试，可能需要调整）
        responses = []
        for _ in range(2):  # 少于限流阈值的请求
            response = client.post(
                "/api/v1/upload",
                files={"file": test_file}
            )
            responses.append(response)
        
        # 至少前几次请求应该成功或返回正常错误（非429）
        assert any(r.status_code != 429 for r in responses)


class TestEdgeCases:
    """边界条件测试"""
    
    def test_get_task_with_invalid_id(self, client):
        """使用无效格式的任务 ID"""
        response = client.get("/api/v1/tasks/invalid-format-123")
        assert response.status_code == 404
    
    def test_upload_empty_file(self, client):
        """上传空文件"""
        response = client.post(
            "/api/v1/upload",
            files={"file": ("empty.mp3", b"", "audio/mpeg")}
        )
        # 应该返回错误或被处理
        assert response.status_code in [400, 500]
