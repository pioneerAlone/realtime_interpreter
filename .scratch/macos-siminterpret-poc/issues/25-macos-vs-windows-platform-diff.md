# macOS vs Windows 平台差异深调研（音频路由/虚拟声卡/本地加速）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户要求对「mac/windows 有何差异（虚拟声卡、音频路由、本地模型加速）」做行业级深调研。本票产出**双平台对等矩阵**，决定我们 v0(mac) → v1(+win) 的移植成本与功能对等度。

**背景（已有，不重复）**：T06 macOS 路由（BlackHole/Process Tap/SCC）、T21/T22 金喜 mac 安装链（brew BlackHole 2ch + VB-CABLE）。本票要**Windows 侧补全 + 双平台对比**。

要回答的问题：

1. **虚拟声卡生态对比**：
   - macOS：BlackHole（GPLv3/商业付费）、Loopback（Rogue Amoeba，商业 $109）、Soundflower（废弃）、Audio Hijack
   - Windows：VB-Cable（免费/donationware）、VoiceMeeter（Banana/Potato，免费）、Virtual Audio Cable（商业）、OBS VirtualCam/VAC
   - license / 签名 / 安装 UX / 企业部署友好度对比
2. **系统音频回采（loopback）对比**：
   - Windows：WASAPI loopback（原生、零依赖）
   - macOS：无原生 loopback → BlackHole / Process Tap (macOS 14.2+) / ScreenCaptureKit (macOS 13+)
   - 延迟 / 权限 / 多应用选择性回采 对比
3. **本地模型加速对比**：
   - macOS：CoreML / MPS（Metal Performance Shaders）/ unified memory；whisper.cpp CoreML 实测、CosyVoice MPS 可行性
   - Windows：CUDA / DirectML / ONNX Runtime GPU；同模型 CUDA vs MPS 的 RTF 差距（论文/issue 数据）
   - 这解释金喜「本地版仅 Win+NVIDIA」的根因，量化我们 Mac 本地模式的天花板
4. **音频 API 层对比**：CoreAudio（AudioUnit/HAL）vs WASAPI/WinMM；缓冲模型差异（CoreAudio HAL buffer vs WASAPI event-driven）对首音延迟的影响
5. **分发/签名对比**：macOS notarization + Gatekeeper + 「允许未授权 DMG」痛点 vs Windows SmartScreen + 驱动签名（虚拟声卡是 kernel/driver 级吗？BlackHole 是 CoreAudio plugin 无需 kext；VB-Cable 是 WDM 驱动需签名）
6. **会议软件兼容对比**：Zoom/Teams/腾讯会议/飞书 在 mac 在 win 上选虚拟声卡作麦克风/扬声器的行为差异（已知 issue）
7. **对产品的结论**：
   - v0 mac-only 的功能边界（哪些 win 能力 mac 没有/反之）
   - v1 加 win 的移植清单（音频层抽象 seam 在哪、要写多少平台代码）
   - 是否值得为 mac 本地模式投入（MPS 天花板）vs win 本地模式（CUDA 红利）

用户要求对「mac/windows 有何差异（虚拟声卡、音频路由、本地模型加速）」做行业级深调研。本票产出**双平台对等矩阵**，决定我们 v0(mac) → v1(+win) 的移植成本与功能对等度。

**背景（已有，不重复）**：T06 macOS 路由（BlackHole/Process Tap/SCC）、T21/T22 金喜 mac 安装链（brew BlackHole 2ch + VB-CABLE）。本票要**Windows 侧补全 + 双平台对比**。

要回答的问题：

1. **虚拟声卡生态对比**：
   - macOS：BlackHole（GPLv3/商业付费）、Loopback（Rogue Amoeba，商业 $109）、Soundflower（废弃）、Audio Hijack
   - Windows：VB-Cable（免费/donationware）、VoiceMeeter（Banana/Potato，免费）、Virtual Audio Cable（商业）、OBS VirtualCam/VAC
   - license / 签名 / 安装 UX / 企业部署友好度对比
2. **系统音频回采（loopback）对比**：
   - Windows：WASAPI loopback（原生、零依赖）
   - macOS：无原生 loopback → BlackHole / Process Tap (macOS 14.2+) / ScreenCaptureKit (macOS 13+)
   - 延迟 / 权限 / 多应用选择性回采 对比
3. **本地模型加速对比**：
   - macOS：CoreML / MPS（Metal Performance Shaders）/ unified memory；whisper.cpp CoreML 实测、CosyVoice MPS 可行性
   - Windows：CUDA / DirectML / ONNX Runtime GPU；同模型 CUDA vs MPS 的 RTF 差距（论文/issue 数据）
   - 这解释金喜「本地版仅 Win+NVIDIA」的根因，量化我们 Mac 本地模式的天花板
4. **音频 API 层对比**：CoreAudio（AudioUnit/HAL）vs WASAPI/WinMM；缓冲模型差异（CoreAudio HAL buffer vs WASAPI event-driven）对首音延迟的影响
5. **分发/签名对比**：macOS notarization + Gatekeeper + 「允许未授权 DMG」痛点 vs Windows SmartScreen + 驱动签名（虚拟声卡是 kernel/driver 级吗？BlackHole 是 CoreAudio plugin 无需 kext；VB-Cable 是 WDM 驱动需签名）
6. **会议软件兼容对比**：Zoom/Teams/腾讯会议/飞书 在 mac/win 上选虚拟声卡作麦克风/扬声器的行为差异（已知 issue）
7. **对产品的结论**：
   - v0 mac-only 的功能边界（哪些 win 能力 mac 没有/反之）
   - v1 加 win 的移植清单（音频层抽象 seam 在哪、要写多少平台代码）
   - 是否值得为 mac 本地模式投入（MPS 天花板）vs win 本地模式（CUDA 红利）

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->