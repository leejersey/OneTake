"""
异常处理单元测试
"""

import pytest
from app.exceptions import (
    OneTakeException,
    TaskNotFoundError,
    InvalidFileTypeError,
    FileTooLargeError,
    ASRProcessingError,
    ExportError,
)


class TestOneTakeException:
    """测试基础异常类"""
    
    def test_basic_exception(self):
        """基础异常创建"""
        exc = OneTakeException("测试消息", "TEST_CODE")
        assert exc.message == "测试消息"
        assert exc.code == "TEST_CODE"
        assert str(exc) == "测试消息"


class TestTaskNotFoundError:
    """测试任务不存在异常"""
    
    def test_task_not_found(self):
        """任务不存在"""
        exc = TaskNotFoundError("abc123")
        assert "abc123" in exc.message
        assert exc.code == "TASK_NOT_FOUND"
        assert exc.task_id == "abc123"


class TestInvalidFileTypeError:
    """测试文件类型异常"""
    
    def test_invalid_file_type(self):
        """不支持的文件类型"""
        exc = InvalidFileTypeError(".exe", [".mp3", ".wav"])
        assert ".exe" in exc.message
        assert exc.code == "INVALID_FILE_TYPE"
        assert exc.file_ext == ".exe"
        assert ".mp3" in exc.allowed


class TestFileTooLargeError:
    """测试文件过大异常"""
    
    def test_file_too_large(self):
        """文件过大"""
        exc = FileTooLargeError(600 * 1024 * 1024, 500 * 1024 * 1024)
        assert "600" in exc.message
        assert exc.code == "FILE_TOO_LARGE"


class TestASRProcessingError:
    """测试 ASR 处理异常"""
    
    def test_asr_error_with_task_id(self):
        """ASR 错误带任务 ID"""
        exc = ASRProcessingError("模型加载失败", task_id="task123")
        assert exc.code == "ASR_PROCESSING_ERROR"
        assert exc.task_id == "task123"


class TestExportError:
    """测试导出异常"""
    
    def test_export_error(self):
        """导出错误"""
        exc = ExportError("FFmpeg 执行失败", export_id="export123")
        assert exc.code == "EXPORT_ERROR"
        assert exc.export_id == "export123"
