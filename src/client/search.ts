/**
 * @module client/search
 *
 * 客户端搜索逻辑，基于倒排索引执行查询并返回排序后的搜索结果。
 * 边界：仅负责搜索算法，不涉及 UI 渲染。
 *
 * 索引加载：
 * 通过动态 import() 从虚拟模块 `virtual:vita-site-search/index` 按需加载，
 * Vite 自动处理路径和 base 配置，天然支持子目录部署。
 * 首次搜索时加载索引并缓存，后续搜索直接使用缓存。
 *
 * 取消机制：
 * 使用代数计数器实现搜索取消。每次调用 search() 递增代数，
 * 异步索引加载完成后检查代数是否仍为当前值，若已被新搜索取代则返回 canceled。
 * cancelSearch() 也可主动递增代数使正在进行的搜索失效。
 * 搜索遍历过程中每个 token 循环也会检查代数，实现提早中断。
 *
 * 评分策略：
 * - 标题匹配加权 5 倍（sectionIndex === -1 的条目）
 * - 内容匹配权重 1 倍
 * - 多个查询 token 命中同一文档/段落时得分累加
 * - 最终按得分降序排列，截取 maxResults 条
 */

import { tokenize } from '../common/tokenizer.js'
import type { SearchIndex, SearchResponse, SearchResult } from '../types.js'

export interface SearchOptions {
  /**
   * 指定要搜索的语言
   */
  lang?: string
  /**
   * 最大搜索结果数量
   *
   * @default 10
   */
  maxResults?: number
  /**
   * 最大内容长度
   *
   * @default 100
   */
  maxContentLength?: number
}

/** 搜索索引缓存，首次加载后常驻内存 */
let indexCache: SearchIndex | null = null

/**
 * 搜索代数计数器
 *
 * 每次 search() 调用递增，用于检测搜索是否已被新搜索或手动取消取代。
 * 异步索引加载完成后，若当前代数与发起时不一致，说明搜索已过期。
 */
let searchGeneration = 0

/**
 * 懒加载搜索索引
 *
 * 通过动态 import() 从虚拟模块加载索引，Vite 自动处理路径解析。
 * 首次调用时加载并缓存，后续调用直接返回缓存。
 *
 * @returns 搜索索引
 */
export async function loadIndex(): Promise<SearchIndex> {
  if (indexCache) return indexCache
  const mod = await import('virtual:vita-site-search/index')
  indexCache = mod.default as SearchIndex
  return indexCache
}

/**
 * 取消当前正在进行的搜索
 *
 * 递增代数计数器，使正在等待索引加载或遍历索引的搜索立即失效。
 * 适用于用户关闭搜索弹窗等需要立即停止搜索的场景。
 */
export function cancelSearch(): void {
  searchGeneration++
}

/**
 * 检查指定代数是否仍为当前代数
 *
 * @param generation - 发起搜索时的代数
 * @returns true 表示搜索仍有效，false 表示已被取代
 */
function isGenerationCurrent(generation: number): boolean {
  return generation === searchGeneration
}

/**
 * 使用指定索引执行搜索（供测试使用）
 *
 * 不依赖虚拟模块，直接传入索引数据，适合单元测试。
 * 不支持取消机制，始终返回完整结果。
 *
 * @param query - 搜索查询文本
 * @param searchIndex - 搜索索引
 * @param options - 搜索选项
 * @param options.lang - 指定要搜索的语言
 * @param options.maxResults - 最大返回数量 @default 10
 * @param options.maxContentLength - 最大内容长度 @default 100
 * @returns 搜索结果数组，按匹配得分降序排列
 */
export function searchWithIndex(
  query: string,
  searchIndex: SearchIndex,
  options?: SearchOptions
): SearchResult[] {
  const { lang, maxResults = 10, maxContentLength = 100 } = options || {}
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const scores = new Map<string, { score: number; sectionIndex: number }>()

  for (const token of tokens) {
    const entries = searchIndex.index[token]
    if (!entries) continue

    for (const [di, si] of entries) {
      if (lang) {
        const doc = searchIndex.docs[di]
        if (!doc || doc.lang !== lang) continue
      }

      const key = `${di}:${si === -1 ? 0 : si}`
      const prev = scores.get(key)
      const addScore = si === -1 ? 5 : 1
      scores.set(key, {
        score: (prev?.score || 0) + addScore,
        sectionIndex: si === -1 ? 0 : si
      })
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, maxResults)
    .map(([key, { score, sectionIndex }]) => {
      const di = Number(key.split(':')[0])
      const doc = searchIndex.docs[di]!
      const [hash, heading, content] = doc.sections[sectionIndex] ?? doc.sections[0]!
      return {
        score,
        lang: doc.lang,
        path: doc.path,
        hash,
        title: doc.title,
        heading,
        content: content.slice(0, maxContentLength),
        matchType: doc.title.includes(query) ? ('page' as const) : ('content' as const)
      }
    })
}

/**
 * 执行搜索查询（异步，支持取消）
 *
 * 对查询文本分词后，在倒排索引中查找匹配文档，
 * 标题匹配加权 5 倍，按得分降序返回结果。
 * 首次调用时通过虚拟模块懒加载索引，后续调用使用缓存。
 *
 * 取消机制：
 * - 连续调用时，前一次搜索自动失效（代数计数器递增）
 * - 调用 cancelSearch() 可主动取消当前搜索
 * - 遍历索引时每个 token 循环检查代数，实现提早中断
 * - 被取消的搜索返回 { status: 'canceled', matched: [] }
 *
 * @param query - 搜索查询文本
 * @param options - 搜索选项
 * @param options.lang - 指定要搜索的语言
 * @param [options.maxResults] - 最大返回数量 @default 10
 * @param [options.maxContentLength] - 最大内容长度 @default 200
 * @returns {Promise<SearchResponse>} 搜索响应（含状态和匹配结果）
 */
export async function search(query: string, options?: SearchOptions): Promise<SearchResponse> {
  const generation = ++searchGeneration

  const searchIndex = await loadIndex()

  const matched = searchWithIndex(query, searchIndex, options)

  // 索引加载完成后检查代数，若已被新搜索或手动取消取代则直接返回 canceled
  if (!isGenerationCurrent(generation)) {
    return { status: 'canceled', matched: [] }
  }
  return { status: 'success', matched }
}
