"""
WebSocket 端点测试
"""

import pytest
class TestWebSocketEndpoint:
    """WebSocket 端点测试"""
    
    def test_websocket_connection(self, client):
        """测试 WebSocket 连接建立"""
        # 注意：由于任务不存在，连接会收到错误消息
        with client.websocket_connect("/ws/tasks/test-task-id") as websocket:
            data = websocket.receive_json()
            # 应该收到错误消息
            assert data["type"] == "error"
            assert "不存在" in data["error"]
    
    def test_websocket_invalid_path(self, client):
        """测试无效的 WebSocket 路径"""
        with pytest.raises(Exception):
            # 尝试连接到不存在的 WebSocket 端点
            with client.websocket_connect("/ws/invalid"):
                pass
