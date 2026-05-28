/**
 * @module server/splitter
 *
 * Markdown 内容分段器，将原始 Markdown 按标题层级切分为 SearchSection 数组。
 * 边界：仅负责内容分段与分词，不涉及路由映射或索引构建。
 *
 * 分段规则：
 * - 遇到 # ~ ###### 标题行时，结束当前段落并开始新段落
 * - 每个段落继承其最近上级标题的 hash 和文本（来自 tocList）
 * - 标题前的无标题内容归入第一个段落（hash 为空字符串）
 */

import type { TocTree } from 'vita-site/server'
import { tokenize } from '../common/tokenizer.js'
import type { SearchSectionBuild } from '../types.js'

/**
 * 按标题将 Markdown 内容分段
 *
 * 每个段落继承其最近上级标题的 hash 和文本。
 * 无标题的内容归入第一个段落（hash 为空字符串）。
 *
 * @param content - 去除 frontmatter 后的原始 Markdown 内容
 * @param tocList - 页面目录树（来自 meta.tocList），用于将标题文本映射为 hash
 * @returns 分段结果数组
 */
export function splitByHeadings(content: string, tocList: TocTree[]): SearchSectionBuild[] {
  const lines = content.split('\n')
  /** 匹配 Markdown 标题行：# ~ ###### */
  const headingRegex = /^(#{1,6})\s+(.+)$/

  const sections: SearchSectionBuild[] = []
  let currentHeading = ''
  let currentHash = ''
  let currentLines: string[] = []

  /** 从 tocList 构建标题文本 → hash 的映射，用于将标题文本转换为锚点 */
  const hashMap = buildHashMap(tocList)

  for (const line of lines) {
    const match = headingRegex.exec(line)
    if (match) {
      // 遇到标题行：先保存当前段落，再开始新段落
      if (currentLines.length > 0 || currentHeading) {
        sections.push(buildSection(currentHash, currentHeading, currentLines))
      }
      const headingText = match[2]!.trim()
      currentHeading = headingText
      // 从 tocList 的 hash 映射中查找对应锚点，找不到则回退为空
      currentHash = hashMap.get(headingText) || ''
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // 处理最后一个段落
  if (currentLines.length > 0 || currentHeading) {
    sections.push(buildSection(currentHash, currentHeading, currentLines))
  }

  return sections
}

/**
 * 从 tocList 递归构建标题文本 → hash 的映射表
 *
 * tocList 由 Markdown 解析器生成，包含标题文本与对应锚点 hash 的对应关系。
 * 此函数将其展平为 Map 以便 O(1) 查询。
 *
 * @param tocList - 页面目录树
 * @returns 标题文本 → hash 的映射
 */
function buildHashMap(tocList: TocTree[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(items: TocTree[]): void {
    for (const item of items) {
      map.set(item.name, item.hash)
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }
  walk(tocList)
  return map
}

/**
 * 移除 HTML 标签
 *
 * 用于在构建索引前清理内容中的 HTML 标签，避免标签污染分词和搜索结果。
 *
 * @param html - 可能包含 HTML 标签的文本
 * @returns 纯文本
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * 构建单个搜索段落
 *
 * @param hash - 段落对应标题的锚点 hash
 * @param heading - 段落对应标题的文本
 * @param lines - 段落内的 Markdown 行
 * @returns 包含分词结果的搜索段落
 */
function buildSection(hash: string, heading: string, lines: string[]): SearchSectionBuild {
  const text = stripHtml(lines.join('\n').trim())
  return {
    hash,
    heading: stripHtml(heading),
    content: text,
    contentTokens: tokenize(text)
  }
}
