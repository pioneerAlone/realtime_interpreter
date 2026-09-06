#!/usr/bin/env python3
"""
鉴权自动测试脚本 - 尝试所有可能的鉴权组合，找到能通过的方式

用法:
  1. 填写下方所有你有的凭据
  2. python3 auth_test.py
  3. 看哪个组合返回 101 Switching Protocols (成功)
"""
import asyncio
import uuid
import websockets

# ============================================================
#  填写你所有的凭据 (有哪个填哪个, 没有的留空)
# ============================================================

# 【新版】方舟控制台 API Key (console.volcengine.com/ark → API Key 管理)
NEW_API_KEY = ""

# 【旧版】语音控制台 App ID + Access Token (console.volcengine.com/speech/app)
OLD_APP_ID = ""          # App ID (数字, 如 12345678)
OLD_ACCESS_TOKEN = ""    # Access Token (长字符串)

# 【Doppelvoice风格】App Key + Access Key (如果你是从某些教程里看到的)
DOPPEL_APP_KEY = ""
DOPPEL_ACCESS_KEY = ""

# 资源 ID (固定值, 不用改)
RESOURCE_ID = "volc.service_type.10053"
WS_URL = "wss://openspeech.bytedance.com/api/v4/ast/v2/translate"

# ============================================================


async def test_auth(name: str, headers: list):
    """测试一种鉴权组合, 返回 (成功?, 状态码/错误)"""
    print(f"\n  测试 [{name}]...", end=" ", flush=True)
    try:
        async with websockets.connect(
            WS_URL,
            additional_headers=headers,
            max_size=4 * 1024 * 1024,
            close_timeout=3,
            open_timeout=10,
        ) as ws:
            # 连接成功, 立即关闭
            await ws.close()
            print("✅ 成功! (HTTP 101 Switching Protocols)")
            return True
    except websockets.InvalidStatus as e:
        code = getattr(e.response, 'status_code', getattr(e.response, 'status', '?'))
        print(f"❌ 失败: HTTP {code}")
        return False
    except Exception as e:
        print(f"❌ 失败: {type(e).__name__}: {e}")
        return False


async def main():
    print("=" * 60)
    print("  鉴权组合自动测试")
    print("=" * 60)
    print(f"  目标: {WS_URL}")
    print(f"  Resource ID: {RESOURCE_ID}")
    print()

    results = []
    connect_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    full_headers = [
        ("X-Api-Connect-Id", connect_id),
        ("X-Api-Request-Id", request_id),
        ("X-Api-Sequence", "-1"),
    ]

    # 组合1: 新版 X-Api-Key (官方文档最简2头)
    if NEW_API_KEY:
        ok = await test_auth("新版 X-Api-Key (最简2头)", [
            ("X-Api-Key", NEW_API_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
        ])
        results.append(("新版最简2头", ok))

    # 组合1b: 新版 X-Api-Key + openless完整header
    if NEW_API_KEY:
        ok = await test_auth("新版 X-Api-Key + 完整header", [
            ("X-Api-Key", NEW_API_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
        ] + full_headers)
        results.append(("新版+完整header", ok))

    # 组合2: 旧版官方文档 X-Api-App-Id
    if OLD_APP_ID and OLD_ACCESS_TOKEN:
        ok = await test_auth("旧版 X-Api-App-Id (官方文档)", [
            ("X-Api-App-Id", OLD_APP_ID),
            ("X-Api-Access-Key", OLD_ACCESS_TOKEN),
            ("X-Api-Resource-Id", RESOURCE_ID),
        ])
        results.append(("旧版 X-Api-App-Id", ok))

    # 组合3: Doppelvoice风格 X-Api-App-Key
    if DOPPEL_APP_KEY and DOPPEL_ACCESS_KEY:
        ok = await test_auth("Doppelvoice风格 X-Api-App-Key", [
            ("X-Api-App-Key", DOPPEL_APP_KEY),
            ("X-Api-Access-Key", DOPPEL_ACCESS_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
            ("X-Api-Connect-Id", connect_id),
        ])
        results.append(("Doppelvoice风格", ok))

    # 组合4: 旧版 App ID 当 App Key 用 (交叉测试)
    if OLD_APP_ID and OLD_ACCESS_TOKEN:
        ok = await test_auth("旧版AppId当AppKey用", [
            ("X-Api-App-Key", OLD_APP_ID),
            ("X-Api-Access-Key", OLD_ACCESS_TOKEN),
            ("X-Api-Resource-Id", RESOURCE_ID),
            ("X-Api-Connect-Id", connect_id),
        ])
        results.append(("AppId当AppKey用", ok))

    # 组合5: 新版 API Key 当旧版双 Key 用 (交叉测试)
    if NEW_API_KEY:
        ok = await test_auth("新版Key当双Key(AppKey+AccessKey)", [
            ("X-Api-App-Key", NEW_API_KEY),
            ("X-Api-Access-Key", NEW_API_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
            ("X-Api-Connect-Id", connect_id),
        ])
        results.append(("新版Key当双Key", ok))

    # 组合6: 新版Key + ASR资源ID (测试Key是否能调用其他语音服务)
    if NEW_API_KEY:
        ok = await test_auth("新版Key + ASR资源ID(测Key通用性)", [
            ("X-Api-Key", NEW_API_KEY),
            ("X-Api-Resource-Id", "volc.seedasr.sauc.duration"),
        ])
        results.append(("新版Key+ASR资源", ok))

    # 总结
    print("\n" + "=" * 60)
    print("  测试结果总结")
    print("=" * 60)
    success_count = 0
    for name, ok in results:
        status = "✅ 成功" if ok else "❌ 失败"
        print(f"  {status}  {name}")
        if ok:
            success_count += 1

    print()
    if success_count == 0:
        print("  ⚠️  所有组合都失败了!")
        print()
        print("  可能原因:")
        print("  1. 凭据填错了 (复制时多了空格/换行)")
        print("  2. 服务未开通: 去 console.volcengine.com/ark 开通 'Doubao 同声传译大模型'")
        print("  3. API Key 没有关联同声传译服务 (方舟控制台 → API Key 管理 → 编辑 → 勾选同传)")
        print("  4. 你用的是声音复刻的 Key, 不是同传的 Key (两个服务不同!)")
        print()
        print("  请确认: 你的 Key 是从哪个页面获取的?")
        print("    - 方舟控制台 console.volcengine.com/ark → API Key 管理 → 新版")
        print("    - 语音控制台 console.volcengine.com/speech/app → 旧版 App ID+Token")
    else:
        print(f"  🎉 找到 {success_count} 个可用的鉴权组合!")
        print("  请把成功的组合名称告诉我, 我来更新主脚本的配置。")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
