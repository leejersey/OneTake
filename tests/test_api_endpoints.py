"""
API 端点集成测试
"""

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
        # Invalid extensions exercise the limit without loading ASR models.
        statuses = [
            client.post(
                "/api/v1/upload",
                files={"file": ("test.txt", b"test content", "text/plain")}
            ).status_code
            for _ in range(11)
        ]
        assert statuses == [400] * 10 + [429]


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
        assert response.status_code == 400
        assert "为空" in response.json()["detail"]
        assert client.get("/api/v1/tasks").json() == []
        from app.config import settings
        assert not list((settings.storage_path / "uploads").iterdir())
