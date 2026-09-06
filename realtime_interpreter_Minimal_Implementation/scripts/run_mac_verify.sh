#!/bin/bash
# ============================================================
#  实时同传阶段1验证 v2 - 一键启动脚本 (macOS)
#  自动选择Python3.9-3.12、创建venv、装依赖、运行
#  用法: bash scripts/run_mac_verify.sh [--run]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
VENV_DIR="$PROJECT_ROOT/.venv"
PYTHON_SCRIPT="$SRC_DIR/mac_ast2_s2s_v2.py"

echo "=========================================="
echo "  实时同传阶段1验证 v2 - 环境搭建"
echo "  (protobuf协议 + ogg_opus解码)"
echo "=========================================="
echo "  项目根目录: $PROJECT_ROOT"
echo ""

# 1. 查找合适的 Python (3.9 ~ 3.12)
find_python() {
    for py in python3.12 python3.11 python3.10 python3.9 python3; do
        if command -v "$py" &> /dev/null; then
            version=$("$py" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
            major=$(echo "$version" | cut -d. -f1)
            minor=$(echo "$version" | cut -d. -f2)
            if [ "$major" = "3" ] && [ "$minor" -ge 9 ] && [ "$minor" -le 12 ]; then
                echo "$py"
                return 0
            fi
        fi
    done
    return 1
}

PYTHON_BIN=$(find_python)

if [ -z "$PYTHON_BIN" ]; then
    echo ""
    echo "[错误] 未找到兼容的 Python 版本 (需要 3.9 ~ 3.12)"
    echo "  请执行: brew install python@3.11"
    exit 1
fi

PYTHON_VERSION=$("$PYTHON_BIN" --version)
echo "[1/6] 使用 Python: $PYTHON_VERSION ($PYTHON_BIN)"

# 2. 创建 venv
if [ ! -d "$VENV_DIR" ]; then
    echo "[2/6] 创建虚拟环境 .venv ..."
    "$PYTHON_BIN" -m venv "$VENV_DIR"
else
    VENV_PY_VERSION=$("$VENV_DIR/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "unknown")
    TARGET_VERSION=$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [ "$VENV_PY_VERSION" != "$TARGET_VERSION" ]; then
        echo "[2/6] 现有 venv 版本($VENV_PY_VERSION)不匹配($TARGET_VERSION)，重建..."
        rm -rf "$VENV_DIR"
        "$PYTHON_BIN" -m venv "$VENV_DIR"
    else
        echo "[2/6] 虚拟环境已存在且版本匹配"
    fi
fi

# 3. 激活并安装依赖
echo "[3/6] 安装依赖 (sounddevice numpy websockets protobuf soundfile)..."
source "$VENV_DIR/bin/activate"
pip install --quiet --upgrade pip 2>/dev/null || pip install --upgrade pip
pip install --quiet sounddevice numpy websockets protobuf soundfile

echo "      已安装:"
pip list 2>/dev/null | grep -iE "sounddevice|numpy|websockets|protobuf|soundfile" | while read line; do
    echo "        - $line"
done

# 4. 检查 libsndfile (soundfile 依赖)
echo ""
echo "[4/6] 检查音频解码环境..."
python3 -c "import soundfile; print('      soundfile OK')" 2>/dev/null || {
    echo ""
    echo "[警告] soundfile 加载失败，可能缺少 libsndfile"
    echo "       执行: brew install libsndfile"
    echo "       然后重新运行本脚本"
    exit 1
}

# 5. 检查 sounddevice
echo "[5/6] 检查音频采集环境..."
python3 -c "import sounddevice; print('      sounddevice OK, 设备数:', len(sounddevice.query_devices()))" 2>/dev/null || {
    echo "[警告] sounddevice 加载失败，可能缺少 PortAudio"
    echo "       执行: brew install portaudio"
    exit 1
}

# 6. 验证 protobuf (从 src/ 目录导入)
echo "[6/6] 验证 protobuf 绑定..."
cd "$SRC_DIR"
python3 -c "
from ast_proto.products.understanding.ast import ast_service_pb2
from ast_proto.common import events_pb2
print('      protobuf OK, StartSession=', events_pb2.Type.StartSession, 'SessionStarted=', events_pb2.Type.SessionStarted)
" 2>/dev/null || {
    echo "[错误] protobuf 绑定加载失败"
    echo "       确认 src/ast_proto/ 目录存在"
    echo "       当前目录: $(pwd)"
    ls -la ast_proto/ 2>/dev/null || echo "       ast_proto/ 目录不存在!"
    exit 1
}

echo ""
echo "=========================================="
echo "  环境就绪！"
echo "=========================================="
echo ""
echo "  ① 枚举设备:"
echo "     cd $SRC_DIR"
echo "     source $VENV_DIR/bin/activate"
echo "     python3 mac_ast2_s2s_v2.py --list-devices"
echo ""
echo "  ② 编辑 src/mac_ast2_s2s_v2.py 填写:"
echo "     API_KEY (新版语音控制台)"
echo "     MIC_DEVICE_ID / OUTPUT_DEVICE_ID"
echo ""
echo "  ③ 运行:"
echo "     bash scripts/run_mac_verify.sh --run"
echo "=========================================="

if [ "$1" = "--run" ]; then
    echo ""
    echo "启动验证脚本 v2... (Ctrl+C 退出)"
    echo ""
    cd "$SRC_DIR"
    python3 "$PYTHON_SCRIPT"
fi
