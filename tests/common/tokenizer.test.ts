import { describe, expect, it } from 'vitest'
import { tokenize } from '../../src/common/tokenizer.js'

describe('tokenize', () => {
  describe('中文分词', () => {
    it('应将中文拆分为单字', () => {
      const result = tokenize('搜索')
      expect(result).toContain('搜')
      expect(result).toContain('索')
    })

    it('应生成相邻双字组合（bigram）', () => {
      const result = tokenize('搜索功能')
      expect(result).toContain('搜')
      expect(result).toContain('索')
      expect(result).toContain('搜索')
      expect(result).toContain('功')
      expect(result).toContain('能')
      expect(result).toContain('功能')
    })

    it('单字应在 bigram 之前', () => {
      const result = tokenize('搜索')
      const singleCharIdx = result.indexOf('搜')
      const bigramIdx = result.indexOf('搜索')
      expect(singleCharIdx).toBeLessThan(bigramIdx)
    })

    it('应处理单个中文字符', () => {
      const result = tokenize('我')
      expect(result).toEqual(['我'])
    })

    it('应处理三个连续中文字符', () => {
      const result = tokenize('搜索器')
      expect(result).toContain('搜')
      expect(result).toContain('索')
      expect(result).toContain('器')
      expect(result).toContain('搜索')
      expect(result).toContain('索器')
    })
  })

  describe('英文分词', () => {
    it('应按空格拆分英文单词', () => {
      const result = tokenize('Hello World')
      expect(result).toContain('hello')
      expect(result).toContain('world')
    })

    it('应将英文单词小写化', () => {
      const result = tokenize('TypeScript')
      expect(result).toContain('typescript')
    })

    it('应处理单个英文单词', () => {
      const result = tokenize('test')
      expect(result).toEqual(['test'])
    })
  })

  describe('数字分词', () => {
    it('应将连续数字作为一个 token', () => {
      const result = tokenize('version 123')
      expect(result).toContain('123')
    })

    it('应将字母和数字的组合作为一个 token', () => {
      const result = tokenize('v2')
      expect(result).toContain('v2')
    })
  })

  describe('中英混合', () => {
    it('应分别处理中文和英文', () => {
      const result = tokenize('搜索Search')
      expect(result).toContain('搜')
      expect(result).toContain('索')
      expect(result).toContain('搜索')
      expect(result).toContain('search')
    })

    it('应处理中文与英文之间的空格', () => {
      const result = tokenize('VitaSite 搜索')
      expect(result).toContain('vitasite')
      expect(result).toContain('搜')
      expect(result).toContain('索')
      expect(result).toContain('搜索')
    })
  })

  describe('边界情况', () => {
    it('应处理空字符串', () => {
      const result = tokenize('')
      expect(result).toEqual([])
    })

    it('应忽略标点符号', () => {
      const result = tokenize('你好，世界！')
      expect(result).not.toContain('，')
      expect(result).not.toContain('！')
      expect(result).toContain('你')
      expect(result).toContain('好')
      expect(result).toContain('世')
      expect(result).toContain('界')
    })

    it('应忽略纯空格', () => {
      const result = tokenize('   ')
      expect(result).toEqual([])
    })

    it('应忽略纯标点', () => {
      const result = tokenize('!!!???')
      expect(result).toEqual([])
    })
  })
})
