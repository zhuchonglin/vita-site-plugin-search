/**
 * @module shared/types
 *
 * 搜索插件的共享类型定义，供 server / client / common 三层共同引用。
 * 边界：仅包含类型声明，不包含任何运行时逻辑。
 *
 * 类型分层：
 * - 构建时类型（含 token 数据）：用于服务端索引构建
 * - 运行时类型（不含 token 数据）：用于客户端搜索和索引序列化
 *   剥离 token 数据可减少约 50% 的索引体积，因为倒排索引已包含所有匹配信息
 */

/**
 * 构建时：搜索索引中的文档段落（含分词数据）
 *
 * 仅在服务端索引构建阶段使用，不写入最终 JSON。
 */
export interface SearchSectionBuild {
  /** 最近上级标题的 hash（用于锚点跳转） */
  hash: string
  /** 最近上级标题文本 */
  heading: string
  /** 该段落的 Markdown 纯文本 */
  content: string
  /** 内容分词结果（构建时使用，不写入最终索引） */
  contentTokens: string[]
}

/**
 * 运行时：搜索索引中的文档段落
 *
 * 每个段落对应一个标题下的内容区域，
 * 通过 hash 可定位到页面内锚点。
 * 不含分词数据，减少索引体积。
 */
export interface SearchSection {
  /** 最近上级标题的 hash（用于锚点跳转） */
  hash: string
  /** 最近上级标题文本 */
  heading: string
  /** 该段落的 Markdown 纯文本 */
  content: string
}

/**
 * 构建时：搜索索引中的文档条目（含分词数据）
 *
 * 仅在服务端索引构建阶段使用，不写入最终 JSON。
 */
export interface SearchDocBuild {
  /** 路由路径 */
  path: string
  /** 页面标题 */
  title: string
  /** 标题分词结果（构建时使用，不写入最终索引） */
  titleTokens: string[]
  /** 按标题分段的段落列表 */
  sections: SearchSectionBuild[]
  /** 语言标识 */
  lang: string
}

/**
 * 运行时：搜索索引中的文档条目
 *
 * 对应一个可路由的 Markdown 页面。
 * 不含分词数据，减少索引体积。
 */
export interface SearchDoc {
  /** 路由路径 */
  path: string
  /** 页面标题 */
  title: string
  /** 按标题分段的段落列表 */
  sections: SearchSection[]
  /** 语言标识 */
  lang: string
}

/**
 * 搜索索引
 *
 * 由 docs（文档列表）和 index（倒排索引）两部分组成。
 * 倒排索引的 key 为分词 token，value 为 [docIndex, sectionIndex] 数组，
 * sectionIndex 为 -1 时表示标题匹配。
 *
 * docs 中不含分词数据（titleTokens/contentTokens），
 * 这些数据在构建倒排索引后即为冗余，剥离可减少约 50% 体积。
 */
export interface SearchIndex {
  /** 所有文档条目（不含分词数据） */
  docs: SearchDoc[]
  /** 倒排索引：token → [docIndex, sectionIndex][] */
  index: Record<string, [number, number][]>
}

/**
 * 搜索结果
 *
 * 单条搜索命中记录，包含页面路径、锚点、标题、
 * 段落内容及匹配得分，用于前端渲染搜索结果列表。
 */
export interface SearchResult {
  /** 匹配得分 */
  score: number
  /** 语言 */
  lang: string
  /** 路由路径 */
  path: string
  /** 最近标题 hash（用于锚点跳转） */
  hash: string
  /** 页面标题 */
  title: string
  /** 段落标题 */
  heading: string
  /** 匹配的文本片段 */
  content: string
  /** 匹配类型：page 匹配文档主标题，content 匹配段落内容 */
  matchType: 'page' | 'content'
}

/**
 * 搜索响应
 */
export interface SearchResponse {
  /** 搜索状态：success 正常完成，canceled 被新搜索或手动取消取代 */
  status: 'success' | 'canceled'
  /** 匹配结果列表（canceled 时为空数组） */
  matched: SearchResult[]
}
