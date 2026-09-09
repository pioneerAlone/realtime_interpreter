import React, { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  /** 右侧状态指示灯文本（如「● 已保存 2 分钟前」或「6 项能力」） */
  status?: React.ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 实装 vs stub：stub 时整体半透明 + 不可展开（v1 实装） */
  isStub?: boolean;
  /** stub 时显示在标题旁的 badge（如「即将推出」） */
  stubBadge?: string;
  children: React.ReactNode;
}

/**
 * CollapsibleSection — 设置 tab 通用折叠 section（T-G-03）
 *
 * 视觉：
 *   - 标题 row：▸ 展开状态 + title + status 右侧 · 整 row 可点击展开
 *   - 展开后下方 padding inset + children
 *
 * 行为：
 *   - 默认折叠（除非 defaultExpanded）
 *   - stub 时不响应点击 + 整体 0.55 opacity
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.6 (sections 重组) + §10.1 T-G-03
 * Ticket:    #28 (T-G-03)
 */
export default function CollapsibleSection({
  title,
  status,
  defaultExpanded = false,
  isStub = false,
  stubBadge,
  children,
}: CollapsibleSectionProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = (): void => {
    if (isStub) return;
    setExpanded((prev) => !prev);
  };

  return (
    <section
      className="rt-collapsible"
      data-component="collapsible-section"
      data-expanded={expanded}
      data-stub={isStub}
    >
      <button
        type="button"
        className="rt-collapsible-head"
        onClick={handleToggle}
        disabled={isStub}
        aria-expanded={expanded}
      >
        <span className="rt-collapsible-caret" aria-hidden="true">
          ▸
        </span>
        <span className="rt-collapsible-title">{title}</span>
        {stubBadge && (
          <span className="rt-collapsible-badge">{stubBadge}</span>
        )}
        <span className="rt-collapsible-spacer" />
        {status && <span className="rt-collapsible-status">{status}</span>}
      </button>
      {expanded && !isStub && (
        <div className="rt-collapsible-body">{children}</div>
      )}
    </section>
  );
}
