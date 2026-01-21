#!/usr/bin/env python3
"""
One Take API - 端到端测试脚本

测试完整的 API 工作流：
1. 上传音频文件
2. 轮询任务状态
3. 获取 EDL 结果
"""

import requests
import time
import sys
from pathlib import Path

API_BASE = "http://localhost:8000"


def test_health():
    """测试健康检查"""
    print("1️⃣  测试健康检查...")
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code == 200:
            print(f"   ✅ 健康检查通过: {response.json()}")
            return True
        else:
            print(f"   ❌ 健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ 无法连接到 API 服务: {e}")
        print(f"   💡 请先启动服务: python run.py")
        return False


def test_upload(audio_file):
    """测试文件上传"""
    print(f"\n2️⃣  测试文件上传: {audio_file}")
    
    if not Path(audio_file).exists():
        print(f"   ❌ 文件不存在: {audio_file}")
        return None
    
    try:
        with open(audio_file, 'rb') as f:
            files = {'file': f}
            data = {'language': 'zh'}
            response = requests.post(f"{API_BASE}/api/v1/upload", files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            task_id = result['task_id']
            print(f"   ✅ 上传成功")
            print(f"   📝 任务 ID: {task_id}")
            print(f"   📊 状态: {result['status']}")
            return task_id
        else:
            print(f"   ❌ 上传失败: {response.status_code}")
            print(f"   {response.text}")
            return None
    except Exception as e:
        print(f"   ❌ 上传出错: {e}")
        return None


def test_task_status(task_id):
    """测试任务状态查询"""
    print(f"\n3️⃣  查询任务状态...")
    
    max_attempts = 60  # 最多等待 60 秒
    attempt = 0
    
    while attempt < max_attempts:
        try:
            response = requests.get(f"{API_BASE}/api/v1/tasks/{task_id}")
            if response.status_code == 200:
                result = response.json()
                status = result['status']
                progress = result['progress']
                
                print(f"   📊 状态: {status}, 进度: {progress}%", end='\r')
                
                if status == 'completed':
                    print()  # 换行
                    print(f"   ✅ 处理完成！")
                    if 'statistics' in result and result['statistics']:
                        stats = result['statistics']
                        print(f"   📈 统计信息:")
                        print(f"      - 总词数: {stats.get('total_words', 0)}")
                        print(f"      - 语气词: {stats.get('filler_count', 0)}")
                        print(f"      - 静音段: {stats.get('silence_count', 0)}")
                       print(f"      - 原始时长: {stats.get('original_duration', 0):.2f}s")
                        print(f"      - 预估时长: {stats.get('estimated_final_duration', 0):.2f}s")
                    return True
                elif status == 'failed':
                    print()  # 换行
                    print(f"   ❌ 处理失败: {result.get('error', 'Unknown error')}")
                    return False
                
                time.sleep(1)
                attempt += 1
            else:
                print(f"\n   ❌ 查询失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"\n   ❌ 查询出错: {e}")
            return False
    
    print("\n   ⏱️ 超时：处理时间过长")
    return False


def test_edl(task_id):
    """测试 EDL 获取"""
    print(f"\n4️⃣  获取 EDL 数据...")
    
    try:
        response = requests.get(f"{API_BASE}/api/v1/tasks/{task_id}/edl")
        if response.status_code == 200:
            edl = response.json()
            print(f"   ✅ EDL 获取成功")
            print(f"   📋 包含 {len(edl.get('words', []))} 个词")
            print(f"   🔇 包含 {len(edl.get('silence_segments', []))} 个静音段")
            
            # 显示前 5 个词的示例
            words = edl.get('words', [])[:5]
            if words:
                print(f"\n   📝 前 5 个词示例:")
                for w in words:
                    print(f"      {w['word']} ({w['start']:.2f}s - {w['end']:.2f}s)")
            
            return True
        else:
            print(f"   ❌ 获取失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ 获取出错: {e}")
        return False


def main():
    """主测试流程"""
    print("=" * 60)
    print("One Take API - 端到端测试")
    print("=" * 60)
    
    # 1. 健康检查
    if not test_health():
        sys.exit(1)
    
    # 2. 确定测试文件
    test_file = "test_audio.mp3"
    if len(sys.argv) > 1:
        test_file = sys.argv[1]
    
    # 3. 上传文件
    task_id = test_upload(test_file)
    if not task_id:
        sys.exit(1)
    
    # 4. 查询状态
    if not test_task_status(task_id):
        sys.exit(1)
    
    # 5. 获取 EDL
    if not test_edl(task_id):
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ 所有测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    main()
