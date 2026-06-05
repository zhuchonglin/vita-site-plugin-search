/**
 * @module server/builder
 *
 * 搜索索引构建器，将分段后的文档数据与路由信息合并，
 * 生成用于客户端搜索的倒排索引（SearchIndex）。
 * 边界：仅负责索引构建，不涉及文件 I/O 或插件钩子逻辑。
 *
 * 倒排索引结构：
 * - key: 分词 token
 * - value: [docIndex, sectionIndex][] — sectionIndex 为 -1 表示标题匹配
 * - 标题匹配在搜索时享有更高权重（由 client/search.ts 处理）
 *
 * 体积优化：
 * - 构建时使用 SearchDocBuild（含 titleTokens/contentTokens）生成倒排索引
 * - 输出时剥离 token 数据转为 SearchDoc，减少约 50% 索引体积
 * - 客户端搜索仅需倒排索引 + 文档元信息，无需预分词结果
 */

import type { RouteNode } from 'vitarx-router/file-router'
import { tokenize } from '../common/tokenizer.js'
import type { SearchDocBuild, SearchIndex, SearchSection, SearchSectionBuild } from '../types.js'
import type { SearchPluginOptions } from './index.js'

/** 路由映射条目，包含 fullPath 和路由级别的 lang */
interface RouteMapping {
  fullPath: string
  lang?: string | undefined
}

/**
 * 从路由树递归构建 relativePath → RouteMapping 的映射
 *
 * Markdown 文件的 meta.relativePath 格式为 "guide/getting-started.md"，
 * 而路由 fullPath 为 "/guide/getting-started"，此映射用于将两者关联。
 * 同时注册去掉 .md 后缀的路径作为备选 key，提高匹配成功率。
 *
 * lang 来源：路由 pageParser 根据文件名后缀（如 intro.en.md）解析得到，
 * 优先级高于文档 frontmatter 中的 lang，因为文件名约定是 VitaSite 多语言的核心机制。
 *
 * @param routes - 路由节点数组（来自 FileRouter.generate().routes）
 * @returns relativePath → RouteMapping 的映射
 */
function buildPathMap(routes: RouteNode[]): Map<string, RouteMapping> {
  const map = new Map<string, RouteMapping>()

  function walk(nodes: RouteNode[]): void {
    for (const node of nodes) {
      const relativePath = node.meta?.['relativePath'] as string | undefined
      if (relativePath && node.fullPath) {
        const lang = node.meta?.['lang'] as string | undefined
        const mapping: RouteMapping = { fullPath: node.fullPath, lang }
        // 同时注册带 .md 和不带 .md 的路径，以兼容不同来源的 key
        const mdPath = relativePath.replace(/\.md$/, '')
        map.set(relativePath, mapping)
        map.set(mdPath, mapping)
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(routes)
  return map
}

/**
 * 构建搜索索引
 *
 * 将分段后的文档数据与路由信息合并，生成倒排索引。
 * 流程：
 * 1. 通过路由树建立 relativePath -> fullPath 映射
 * 2. 遍历文档数据，匹配 fullPath 并构建 SearchDocBuild 列表（含 token）
 * 3. 遍历所有 token，构建 token -> [docIndex, sectionIndex][] 倒排索引
 * 4. 剥离 token 数据，输出精简的 SearchIndex
 *
 * @param docs - 文档数据 Map（relativePath -> { title, sections }）
 * @param routes - RouteNode 数组（来自 generate().routes）
 * @param fallbackLang - 回退语言，路由无 lang 时使用
 * @param options - 搜索插件配置选项
 * @returns 搜索索引（docs 不含 token 数据 + 倒排 index）
 */
export function buildSearchIndex(
  docs: Map<string, { title: string; sections: SearchSectionBuild[] }>,
  routes: RouteNode[],
  fallbackLang: string,
  options: SearchPluginOptions = {}
): SearchIndex {
  const pathMap = buildPathMap(routes)
  const buildDocs: SearchDocBuild[] = []

  for (const [relPath, doc] of docs) {
    const mapping = pathMap.get(relPath)
    // 跳过无法匹配路由的文档（可能是被排除或未注册的页面）
    if (!mapping) continue

    buildDocs.push({
      path: mapping.fullPath,
      title: doc.title,
      titleTokens: tokenize(doc.title),
      sections: doc.sections.map(s => ({
        ...s,
        contentTokens: tokenize(s.content)
      })),
      lang: mapping.lang ?? fallbackLang
    })
  }

  // 构建倒排索引：token → 出现位置列表
  const index: Record<string, [number, number][]> = Object.create(null)
  buildDocs.forEach((doc, di) => {
    // 标题 token 的 sectionIndex 记为 -1，搜索时可据此加权
    for (const token of doc.titleTokens) {
      ;(index[token] ??= []).push([di, -1])
    }
    doc.sections.forEach((section, si) => {
      for (const token of section.contentTokens) {
        ;(index[token] ??= []).push([di, si])
      }
    })
  })

  // 优化索引体积：
  // 1. 提前截断 content 到搜索结果展示所需长度（搜索面板仅展示约 50 中文字符）
  // 2. 文档 sections 使用紧凑数组格式 [hash, heading, content] 而非对象
  const { contentLength = 100 } = options
  const runtimeDocs = buildDocs.map(doc => ({
    path: doc.path,
    title: doc.title,
    sections: doc.sections.map(
      s => [s.hash, s.heading, s.content.slice(0, contentLength)] as SearchSection
    ),
    lang: doc.lang
  }))

  return { docs: runtimeDocs, index }
}
