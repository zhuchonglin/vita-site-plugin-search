import type { TocTree } from 'vita-site/server'
import { describe, expect, it } from 'vitest'
import { splitByHeadings } from '../../src/server/splitter.js'

function createTocList(
  items: Array<{ name: string; hash: string; children?: TocTree[] }>
): TocTree[] {
  return items.map(item => ({
    name: item.name,
    hash: item.hash,
    level: 2,
    children: item.children || []
  }))
}

describe('splitByHeadings', () => {
  describe('基本分段', () => {
    it('应将无标题的内容归入第一个段落', () => {
      const result = splitByHeadings('这是开头内容\n## 第一节\n第一节内容', [])
      expect(result.length).toBe(2)
      expect(result[0]!.heading).toBe('')
      expect(result[0]!.content).toBe('这是开头内容')
      expect(result[1]!.heading).toBe('第一节')
      expect(result[1]!.content).toBe('第一节内容')
    })

    it('应按标题将内容分段', () => {
      const content = `## 第一节
第一段内容

## 第二节
第二段内容`

      const result = splitByHeadings(content, [])
      expect(result.length).toBe(2)
      expect(result[0]!.heading).toBe('第一节')
      expect(result[1]!.heading).toBe('第二节')
    })

    it('应处理多级标题', () => {
      const content = `## 标题一
内容一

### 子标题
子内容

## 标题二
内容二`

      const result = splitByHeadings(content, [])
      expect(result.length).toBe(3)
      expect(result[0]!.heading).toBe('标题一')
      expect(result[1]!.heading).toBe('子标题')
      expect(result[2]!.heading).toBe('标题二')
    })
  })

  describe('hash 映射', () => {
    it('应从 tocList 映射标题到 hash', () => {
      const tocList = createTocList([
        { name: '快速开始', hash: '#quick-start' },
        { name: '安装', hash: '#install' }
      ])

      const content = `## 快速开始
内容

## 安装
安装内容`

      const result = splitByHeadings(content, tocList)
      expect(result[0]!.hash).toBe('#quick-start')
      expect(result[1]!.hash).toBe('#install')
    })

    it('标题不在 tocList 中时 hash 应为空', () => {
      const content = '## 未知标题\n内容'
      const result = splitByHeadings(content, [])
      expect(result[0]!.hash).toBe('')
    })

    it('应支持嵌套 tocList 的 hash 映射', () => {
      const tocList = createTocList([
        {
          name: '指南',
          hash: '#guide',
          children: [{ name: '子标题', hash: '#sub-heading', level: 2, children: [] }]
        }
      ])

      const content = '## 子标题\n内容'
      const result = splitByHeadings(content, tocList)
      expect(result[0]!.hash).toBe('#sub-heading')
    })
  })

  describe('contentTokens', () => {
    it('每个段落应包含 contentTokens 分词结果', () => {
      const content = '## 搜索\n搜索功能测试'
      const result = splitByHeadings(content, [])
      expect(result[0]!.contentTokens.length).toBeGreaterThan(0)
      expect(result[0]!.contentTokens).toContain('搜索')
    })
  })

  describe('HTML 标签移除', () => {
    it('应移除内容中的 HTML 标签', () => {
      const content = '## 标题\n<strong>粗体</strong>和<em>斜体</em>'
      const result = splitByHeadings(content, [])
      expect(result[0]!.content).toBe('粗体和斜体')
    })

    it('应移除标题中的 HTML 标签', () => {
      const content = '## <code>安装</code>指南\n内容'
      const result = splitByHeadings(content, [])
      expect(result[0]!.heading).toBe('安装指南')
    })

    it('应移除带属性的 HTML 标签', () => {
      const content = '## 标题\n<a href="https://example.com">链接</a>'
      const result = splitByHeadings(content, [])
      expect(result[0]!.content).toBe('链接')
    })

    it('应移除自闭合 HTML 标签', () => {
      const content = '## 标题\n第一行<br/>第二行'
      const result = splitByHeadings(content, [])
      expect(result[0]!.content).toBe('第一行第二行')
    })

    it('HTML 标签不应出现在分词结果中', () => {
      const content = '## 标题\n<strong>搜索</strong>功能'
      const result = splitByHeadings(content, [])
      expect(result[0]!.contentTokens).not.toContain('strong')
      expect(result[0]!.contentTokens).toContain('搜索')
    })
  })

  describe('边界情况', () => {
    it('应处理空内容', () => {
      const result = splitByHeadings('', [])
      expect(result.length).toBe(1)
      expect(result[0]!.heading).toBe('')
      expect(result[0]!.content).toBe('')
    })

    it('应处理只有标题没有内容', () => {
      const content = '## 标题'
      const result = splitByHeadings(content, [])
      expect(result.length).toBe(1)
      expect(result[0]!.heading).toBe('标题')
      expect(result[0]!.content).toBe('')
    })

    it('应处理只有内容没有标题', () => {
      const content = '这是一段没有标题的内容'
      const result = splitByHeadings(content, [])
      expect(result.length).toBe(1)
      expect(result[0]!.heading).toBe('')
      expect(result[0]!.content).toBe('这是一段没有标题的内容')
    })

    it('应处理连续标题（无内容间隔）', () => {
      const content = '## A\n## B\n## C'
      const result = splitByHeadings(content, [])
      expect(result.length).toBe(3)
      expect(result[0]!.heading).toBe('A')
      expect(result[1]!.heading).toBe('B')
      expect(result[2]!.heading).toBe('C')
    })

    it('应忽略非标题的 # 符号', () => {
      const content = '这不是标题 ## 也不是\n## 这才是标题'
      const result = splitByHeadings(content, [])
      expect(result.length).toBe(2)
      expect(result[0]!.heading).toBe('')
      expect(result[1]!.heading).toBe('这才是标题')
    })
  })
})
