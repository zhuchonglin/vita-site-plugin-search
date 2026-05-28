/**
 * @module common/tokenizer
 *
 * 中英文混合分词器，供 server（索引构建）和 client（查询分词）共同使用。
 * 边界：仅负责文本分词，不涉及索引结构或搜索逻辑。
 *
 * 分词策略：
 * - 中文：单字切分 + 相邻双字组合（bigram），兼顾召回率与索引体积
 * - 英文/数字：按空格分词并小写化，支持模糊匹配
 * - 混合文本：通过正则识别中英文边界，分别应用对应策略
 */

/**
 * 对文本进行分词
 *
 * 中文：单字 + 双字组合（保证召回率）
 * 英文/数字：按空格分词 + 小写化
 * 混合：识别中英文边界分别处理
 *
 * @param text - 待分词文本
 * @returns 分词结果数组（已去重由调用方决定，此处保留所有 token）
 *
 * @example
 * ```ts
 * tokenize('搜索功能') // ['搜', '索', '搜索', '功', '能', '功能']
 * tokenize('Hello World') // ['hello', 'world']
 * ```
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  /** 前一个中文字符，用于构建 bigram */
  let prevChineseChar = ''
  /** 匹配单个中文字符或连续的英文/数字 */
  const regex = /[\u4e00-\u9fff]|[a-zA-Z0-9]+/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const word = match[0].toLowerCase()

    if (/[\u4e00-\u9fff]/.test(word)) {
      // 中文单字 token
      tokens.push(word)

      // bigram：与前一个中文字符组合为双字 token
      if (prevChineseChar) {
        tokens.push(prevChineseChar + word)
      }

      prevChineseChar = word
    } else {
      // 英文/数字整体作为一个 token
      tokens.push(word)
      prevChineseChar = ''
    }
  }

  return tokens
}
