"""
One Take API - WebSocket 实时进度推送
"""

import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger("websocket")


class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        # task_id -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, task_id: str):
        """添加连接"""
        await websocket.accept()
        async with self._lock:
            if task_id not in self._connections:
                self._connections[task_id] = set()
            self._connections[task_id].add(websocket)
        logger.info(f"WebSocket 连接: task={task_id}")
    
    async def disconnect(self, websocket: WebSocket, task_id: str):
        """移除连接"""
        async with self._lock:
            if task_id in self._connections:
                self._connections[task_id].discard(websocket)
                if not self._connections[task_id]:
                    del self._connections[task_id]
        logger.info(f"WebSocket 断开: task={task_id}")
    
    async def broadcast(self, task_id: str, message: dict):
        """向任务的所有连接广播消息"""
        async with self._lock:
            connections = self._connections.get(task_id, set()).copy()
        
        if not connections:
            return
        
        dead_connections = []
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                dead_connections.append(websocket)
        
        # 清理死连接
        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self._connections.get(task_id, set()).discard(ws)


# 全局连接管理器
ws_manager = ConnectionManager()


@router.websocket("/ws/tasks/{task_id}")
async def websocket_task_progress(websocket: WebSocket, task_id: str):
    """
    WebSocket 端点，实时接收任务进度更新
    
    消息格式:
    - {"type": "progress", "progress": 50, "status": "processing"}
    - {"type": "completed", "progress": 100, "status": "completed"}
    - {"type": "error", "error": "错误信息"}
    """
    await ws_manager.connect(websocket, task_id)
    
    try:
        # 立即发送当前状态
        from app.utils.task_manager import task_manager
        try:
            task = await task_manager.get_task(task_id)
            await websocket.send_json({
                "type": "progress",
                "progress": task.progress,
                "status": task.status.value
            })
        except ValueError:
            await websocket.send_json({
                "type": "error",
                "error": f"任务 {task_id} 不存在"
            })
            return
        
        # 保持连接，等待客户端关闭
        while True:
            try:
                # 等待客户端消息（心跳或关闭）
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
            except asyncio.TimeoutError:
                # 发送 ping 保持连接
                await websocket.send_json({"type": "ping"})
    
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(websocket, task_id)
