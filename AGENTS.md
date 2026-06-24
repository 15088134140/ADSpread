# AGENTS.md - AI Agent 协作规范

> 📌 **技术栈说明**:
> - **Hermes Agent**: Nous Research 开源的自我进化 AI 智能体框架（14万+ Stars）
> - **Claude Code**: Anthropic 官方 AI 编码工具（IDE/CLI 深度集成）
> - **Superpowers**: 14+ 可组合的质量保障技能集（Code Review、验证等）

---

## Agent 角色定义

### 1. Hermes Agent - 中枢大脑 + 自我进化智能体

**技术来源**: Nous Research 开源项目（GitHub: 14万+ Stars, MIT 协议）
**核心口号**: "The agent that grows with you"（与你共同成长的 Agent）

**角色定位**: 项目经理 + 技术架构师 + 持续学习者

**原生能力（内置功能）**:
- 🧠 **四层记忆系统**: 工作记忆 + 情景记忆 + 语义记忆 + 用户建模
- ✨ **自我进化技能系统**: 任务完成后自动沉淀为 Markdown 格式 Skill，越用越强
- 🔧 **47+ 内置工具**: 网络搜索、终端执行、文件操作、浏览器自动化、Cron 调度等
- 🤖 **子 Agent 并行**: 生成隔离的子智能体并行处理多任务
- 🌐 **15+ 平台网关**: Telegram、Discord、QQ、飞书、CLI 等
- 🖥️ **6 种终端后端**: Local、Docker、SSH、Daytona、Singularity、Modal
- 🔗 **MCP 协议支持**: 无限扩展任意工具能力

**在本项目中的职责**:
1. **需求理解与任务编排**
   - 自主阅读 PRD 和设计文档，拆解为可执行的开发任务
   - 使用持久化记忆关联历史项目经验和踩过的坑
   - 调用 web_search 检索行业最佳实践和技术选型

2. **调度与协调**
   - 根据任务复杂度决定：直接做 / 派给 Claude Code / 生成子 Agent
   - 自动决定何时调用 Superpowers 做质量审查
   - 管理多任务依赖和执行顺序

3. **自我进化闭环**
   - 每次开发后自动沉淀"ADSpread ××模块开发规范"技能
   - 记录并复用代码审查意见和修复模式
   - 持续优化发布流程和测试策略

4. **执行与集成**
   - 直接调用 terminal 工具执行构建、测试、部署
   - 通过 SSH/Docker 远程操作服务器
   - 内置 Cron 定时执行自动化任务

**决策权限**:
- 技术选型建议和风险评估
- 任务优先级排序和依赖管理
- 代码合并前的最终质量把关
- 发布流程的自动化执行

---

### 2. Claude Code - 编码主力

**技术来源**: Anthropic 官方 AI 编码工具

**角色定位**: 高级开发工程师 + IDE 深度集成

**核心能力**:
- 高质量代码实现（TypeScript/NestJS/Vue3）
- 单元测试和集成测试编写
- 代码调试和 Bug 精准定位修复
- 代码重构和性能优化
- 文档编写和注释完善

**与 Hermes 的协作关系**:
- Hermes 负责任务拆解和验收标准定义
- Claude Code 负责具体的代码实现和 IDE 内操作
- Hermes 负责最终质量把关和技能沉淀

**工作规范**:
1. 接收 Hermes 分配的任务和验收标准
2. 遵循 CLAUDE.md 编码规范和项目已有模式
3. 实现功能并编写对应测试
4. 利用 IDE 集成做自我 Code Review
5. 完成后通知 Hermes 做最终验收

**输出标准**:
- 代码通过 ESLint 和 TypeScript 类型检查
- 相关单元测试通过，核心逻辑覆盖率 > 80%
- 代码有必要的注释和文档
- 变更说明清晰，便于 Code Review

---

### 3. Superpowers - 质量保障技能集

**技术来源**: 14+ 可组合的 AI 开发最佳实践技能集

**角色定位**: 独立审查者 + 技术专家（Hermes 的质量增强插件）

**核心价值**:
- **视角独立**: 子 Agent 不继承 Hermes 的上下文，避免单一 AI 的思维定势和盲区
- **多维度审查**: 正确性、安全性、性能、可维护性全覆盖
- **复杂问题拆解**: 子 Agent 并行协作处理复杂任务

**Hermes 内置调用规则**（自动触发）:

| 技能 | 触发时机 | 输入 | 输出 |
|------|---------|------|------|
| **`brainstorming`** | 技术选型前、架构设计后 | 需求文档 + 约束条件 | 多方案对比 + 风险清单 |
| **`code-review`** | 核心模块开发完成后 | PR/变更文件集 | 分级问题列表 + 修复建议 |
| **`verify`** | 发布前、Bug 修复后 | 测试用例 + 验证场景 | 测试报告 + 回归验证结果 |

**code-review 审查维度**:
1. **正确性审查**: 边界条件、异常处理、逻辑漏洞
2. **安全性审查**: SQL 注入、XSS、认证授权、数据脱敏
3. **性能审查**: N+1 查询、算法复杂度、内存泄漏风险
4. **可维护性审查**: 命名规范、注释质量、代码重复度、复杂度
5. **一致性审查**: 是否符合项目架构和编码规范

3. **`subagent-driven-development` - 多 Agent 协作**
   - 复杂任务拆解为子任务
   - 三角色隔离: Implementer → Reviewer → QA
   - 避免单一 AI 的错误传播

4. **`verify` - 功能验证**
   - 端到端测试场景设计
   - 回归验证
   - 发布前质量把关

**触发时机**（Hermes 决策调用）:
- ⭐ 核心业务模块开发完成
- ⭐ 涉及安全性、认证授权的代码
- ⭐ 算法复杂度高的逻辑
- ⭐ 架构设计方案定稿前
- ⭐ 生产环境发布前

**工作输出**:
- Code Review 报告（含问题分级和建议）
- 架构评审意见和风险清单
- 测试场景和验证报告
- 多方案对比分析文档

---

## Agent 协作流程

> 📌 **核心原则**: Hermes 始终是主控者，决定何时调用 Superpowers 的哪个技能。
> Superpowers 是**工具集而非替代者**。

---

### 场景 1: 新功能开发

```
产品需求
    │
    ▼
Hermes: 需求分析
├─ [可选] 调用 Superpowers brainstorming 进行方案评估
└─ 输出: 任务分解清单 + 验收标准
    │
    ├─→ Claude Code: 模块 A 开发 ──┐
    ├─→ Claude Code: 模块 B 开发 ──┤
    └─→ Claude Code: 模块 C 开发 ──┤
                                    │
                                    ▼
                           Claude Code 自验通过?
                                    │
                                    ▼
        ┌───────────────────────────┴──────────────────────┐
        │ 是核心模块/复杂逻辑?                               │
        ├─ 是 → Hermes 调用 Superpowers code-review         │
        └─ 否 → 跳过审查                                    │
                                    │
                                    ▼
                          Hermes: 集成和最终验收
                                    │
                                    ▼
                                  合并
```

**触发 Superpowers 的判断标准**:
- 代码涉及认证、权限、支付等安全敏感逻辑
- 算法复杂度 O(n²) 以上
- 跨 3 个以上模块的改动
- 首次使用新技术/新框架

---

### 场景 2: Bug 修复

```
Bug 报告
    │
    ▼
Hermes: 影响范围分析
└─ 判断: 是否生产环境 P0 级 Bug?
    │
    ├─ 是 → [可选] 调用 Superpowers brainstorming 分析根因
    └─ 否 → Claude Code 直接修复
    │
    ▼
Claude Code: 定位和修复 + 单元测试
    │
    ▼
    ┌─────────────────────────────┐
    │ Bug 影响核心功能?            │
    ├─ 是 → Superpowers verify    │
    └─ 否 → 跳过                   │
    │
    ▼
  Hermes 验收 → 发布修复
```

---

### 场景 3: 架构重构

```
重构需求
    │
    ▼
Hermes: 重构范围和风险评估
    │
    ▼
调用 Superpowers brainstorming: 多方案对比
    │
    ▼
Hermes: 确定重构方案 → 拆解为子任务
    │
    ▼
Claude Code: 分阶段实施重构
    │
    ▼
每个阶段完成 → 调用 Superpowers code-review
    │
    ▼
Hermes: 整体验收
    │
    ▼
  完成重构
```

> ⚠️ **重要修正**: Superpowers **不做** "重构方案设计" — 它提供评审意见，方案设计和最终决策始终是 Hermes 的职责。

---

## 通信协议

### 任务分配格式

Hermes → Claude Code / Superpower:

```typescript
interface TaskAssignment {
  taskId: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  acceptanceCriteria: string[];
  technicalConstraints: string[];
  dependencies: string[];
  estimatedEffort: string;
  relatedFiles: string[];
}
```

### 任务完成报告

Claude Code / Superpower → Hermes:

```typescript
interface TaskCompletion {
  taskId: string;
  status: 'completed' | 'blocked' | 'partial';
  summary: string;
  changedFiles: string[];
  testResults: {
    unit: boolean;
    integration: boolean;
    coverage: number;
  };
  risks: string[];
  nextSteps: string[];
}
```

### Code Review 格式

Superpower → Claude Code:

```typescript
interface CodeReview {
  file: string;
  findings: Array<{
    line: number;
    severity: 'critical' | 'major' | 'minor' | 'nit';
    type: 'bug' | 'security' | 'performance' | 'style' | 'architecture';
    description: string;
    suggestion?: string;
  }>;
  approved: boolean;
  summary: string;
}
```

---

## 冲突解决机制

### 技术意见分歧

当 Agent 之间出现技术分歧时:

1. **优先参考**：CLAUDE.md 中的既定规范
2. **其次参考**：项目已有代码的风格和模式
3. **再次参考**：业界最佳实践和技术文档
4. **最终决策**：由 Hermes 裁定，必要时引入人类决策者

### 任务阻塞

当任务被阻塞时，Claude Code 必须:

1. 立即向 Hermes 报告阻塞状态
2. 说明阻塞原因和影响
3. 提出可能的解决方案
4. 等待 Hermes 调度或调整

---

## 质量保证层级

### Level 1 - Claude Code 自验（强制执行）

每段代码提交前必须:
- ✅ TypeScript 类型检查通过
- ✅ ESLint 无错误
- ✅ Prettier 格式化
- ✅ 单元测试通过
- ✅ 本地手动验证功能

### Level 2 - Superpowers 审查（按需触发）

触发条件满足时，Hermes 调用 Superpowers code-review:
- ✅ 代码逻辑正确性审查
- ✅ 安全性检查（SQL 注入、XSS、认证授权等）
- ✅ 性能评估（N+1 查询、算法复杂度）
- ✅ 架构一致性检查
- ✅ 可维护性评估

### Level 3 - Hermes 验收（发布前必须）

发布前必须:
- ✅ 所有测试通过
- ✅ 功能符合需求文档
- ✅ 文档完整且与代码一致
- ✅ Code Review 意见已处理
- ✅ 没有已知的 Critical Bug

---

## 学习和进化机制

### 规范更新

当发现现有规范不足时:

1. 遇到问题的 Agent 提交规范改进建议
2. Hermes 评估建议的合理性
3. 更新 CLAUDE.md 或 AGENTS.md
4. 所有 Agent 遵循新规范

### 最佳实践沉淀

每个迭代结束后:
- 记录遇到的问题和解决方案
- 总结可复用的模式和模板
- 更新到知识库供后续参考

---

## 人类介入触发点

以下情况必须引入人类决策者:

1. **需求不明确**：无法从现有文档推断需求意图
2. **技术选型**：涉及重大架构变更或新技术引入
3. **时间估算**：需要评估项目排期和交付时间
4. **优先级冲突**：多个高优先级任务资源竞争
5. **生产问题**：生产环境严重故障需要人工确认
6. **伦理边界**：涉及数据隐私、合规性等敏感问题

---

---

## 基于深度研究的关键发现

> 📊 **数据来源**: 105 Agent、2489957 Tokens、历时 16 分钟的 Adversarial Verification
> 📅 **补充搜索（2026-06-24）**: 确认 Hermes Agent 真实存在且已大规模应用

### 已被验证的结论 ✅

| 结论 | 置信度 | 说明 |
|------|--------|------|
| Claude Code 是本地运行的编码平台 | 高 | 直接与模型 API 通信，无后端服务器 |
| Superpowers 是技能集合 | 高 | 14+ 可组合技能，非统一引擎 |
| 子 Agent 架构有效 | 高 | 上下文隔离减少错误传播，Hermes 原生支持 |
| 多视角审查提升质量 | 高 | 独立视角能发现单一 AI 的盲区 |
| **Hermes Agent 是成熟开源产品** | 高 | Nous Research 开发，14万+ GitHub Stars，MIT 协议 |

### 已被反驳的误解 ❌

| 误区 | 事实 |
|------|------|
| "Superpowers 能自动化发布" | 发布需要工程化工具链，AI 是执行者 |
| "TDD 是铁律" | 测试重要，但不做教条化强制 |
| "多 Agent 一定更快" | 提升质量，但不必然提升速度 |
| ~~"Hermes 是成熟产品"~~ | **修正**: Hermes Agent 确实是成熟产品（14万+ Stars），之前检索范围有限 |

### 本项目的技术栈差异化 💡

1. **全栈 AI 原生**: Hermes Agent（中枢）+ Claude Code（编码）+ Superpowers（质量），三者深度集成
2. **自我进化优势**: 利用 Hermes 的技能沉淀系统，项目开发效率随时间指数提升
3. **质量保障体系**: Superpowers 独立审查机制，弥补单一 LLM 的注意力稀释问题
4. **灵活而非教条**: 流程是指导原则，根据任务复杂度按需调用，不做过度工程化

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.0 | 2026-06-24 | 确认项目基于真实 Hermes Agent 框架，更新完整能力描述 |
| v1.1 | 2026-06-24 | 基于 105 Agent 深度研究结果修正 Superpowers 定位 |
| v1.0 | 2026-06-24 | 初始化 Agent 协作规范 |
