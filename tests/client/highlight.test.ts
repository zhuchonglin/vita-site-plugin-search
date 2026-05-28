import { describe, expect, it } from 'vitest'
import { highlight } from '../../src/client/highlight.js'

describe('highlight', () => {
  describe('基本功能', () => {
    it('应高亮匹配的内容', () => {
      const result = highlight('test', 'this is a test content')
      expect(result).toBe('this is a <mark>test</mark> content')
    })

    it('应高亮多个匹配的内容', () => {
      const result = highlight('test', 'test this test content test')
      expect(result).toBe('<mark>test</mark> this <mark>test</mark> content <mark>test</mark>')
    })

    it('应使用自定义标签', () => {
      const result = highlight('test', 'this is a test content', 'span')
      expect(result).toBe('this is a <span>test</span> content')
    })
  })

  describe('边界情况', () => {
    it('应处理无匹配的情况', () => {
      const result = highlight('test', 'this is a different content')
      expect(result).toBe('this is a different content')
    })

    it('应处理空查询字符串', () => {
      const result = highlight('', 'this is a test content')
      expect(result).toBe('this is a test content')
    })

    it('应处理空内容字符串', () => {
      const result = highlight('test', '')
      expect(result).toBe('')
    })

    it('应处理查询和内容都为空的情况', () => {
      const result = highlight('', '')
      expect(result).toBe('')
    })

    it('应处理查询与内容完全匹配的情况', () => {
      const result = highlight('test', 'test')
      expect(result).toBe('<mark>test</mark>')
    })
  })

  describe('特殊字符', () => {
    it('应处理中文字符', () => {
      const result = highlight('搜索', '这是搜索功能')
      expect(result).toBe('这是<mark>搜索</mark>功能')
    })

    it('应处理数字', () => {
      const result = highlight('123', '版本号是 123')
      expect(result).toBe('版本号是 <mark>123</mark>')
    })

    it('应处理混合字符', () => {
      const result = highlight('v2', '当前版本是 v2')
      expect(result).toBe('当前版本是 <mark>v2</mark>')
    })
  })
})
