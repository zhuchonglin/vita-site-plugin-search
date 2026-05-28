import { describe, expect, it } from 'vitest'
import { searchWithIndex } from '../../src/client/search.js'
import type { SearchIndex } from '../../src/types.js'

function createTestIndex(): SearchIndex {
  return {
    docs: [
      {
        path: '/guide/intro',
        title: '快速开始',
        sections: [
          {
            hash: '#quick-start',
            heading: '快速开始',
            content: '这是一个快速开始的指南文档，帮助你了解基本用法。'
          },
          {
            hash: '#install',
            heading: '安装',
            content: '使用 npm install 安装依赖。'
          }
        ],
        lang: 'zh-CN'
      },
      {
        path: '/guide/search',
        title: '搜索功能',
        sections: [
          {
            hash: '#search',
            heading: '搜索功能',
            content: '搜索插件支持中英文混合搜索。'
          }
        ],
        lang: 'zh-CN'
      },
      {
        path: '/en/guide/intro',
        title: 'Getting Started',
        sections: [
          {
            hash: '#quick-start',
            heading: 'Quick Start',
            content: 'This is a quick start guide to help you understand the basics.'
          }
        ],
        lang: 'en-US'
      },
      {
        path: '/en/guide/search',
        title: 'Search',
        sections: [
          {
            hash: '#search',
            heading: 'Search',
            content: 'Search plugin supports mixed Chinese and English search.'
          }
        ],
        lang: 'en-US'
      }
    ],
    index: {
      快: [[0, -1]],
      速: [[0, -1]],
      快速: [[0, -1]],
      开: [[0, -1]],
      始: [[0, -1]],
      开始: [[0, -1]],
      指: [[0, 0]],
      南: [[0, 0]],
      指南: [[0, 0]],
      安: [
        [0, 1],
        [0, -1]
      ],
      装: [
        [0, 1],
        [0, -1]
      ],
      安装: [[0, 1]],
      搜: [
        [1, -1],
        [1, 0]
      ],
      索: [
        [1, -1],
        [1, 0]
      ],
      搜索: [
        [1, -1],
        [1, 0]
      ],
      功: [[1, -1]],
      能: [[1, -1]],
      功能: [[1, -1]],
      插件: [[1, 0]],
      支持: [[1, 0]],
      get: [[2, -1]],
      getting: [[2, -1]],
      start: [[2, -1]],
      started: [[2, -1]],
      search: [
        [3, -1],
        [3, 0]
      ],
      plugin: [[3, 0]],
      supports: [[3, 0]]
    }
  }
}

describe('searchWithIndex', () => {
  const index = createTestIndex()

  describe('基本搜索', () => {
    it('应返回匹配的搜索结果', () => {
      const results = searchWithIndex('搜索', index)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.title).toBe('搜索功能')
    })

    it('应返回包含路径和 hash 的结果', () => {
      const results = searchWithIndex('搜索', index)
      expect(results[0]!.path).toBe('/guide/search')
      expect(results[0]!.hash).toBe('#search')
    })

    it('空查询应返回空数组', () => {
      const results = searchWithIndex('', index)
      expect(results).toEqual([])
    })

    it('无匹配结果应返回空数组', () => {
      const results = searchWithIndex('xyznotfound', index)
      expect(results).toEqual([])
    })
  })

  describe('标题加权', () => {
    it('标题匹配应排在内容匹配之前', () => {
      const results = searchWithIndex('搜索', index)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.path).toBe('/guide/search')
    })

    it('标题匹配得分应高于内容匹配', () => {
      const results = searchWithIndex('搜索', index)
      const titleMatch = results.find(r => r.path === '/guide/search')
      const contentMatch = results.find(r => r.path === '/guide/intro')
      if (titleMatch && contentMatch) {
        expect(titleMatch.score).toBeGreaterThan(contentMatch.score)
      }
    })
  })

  describe('matchType', () => {
    it('匹配文档主标题时 matchType 应为 page', () => {
      const results = searchWithIndex('功能', index)
      const result = results.find(r => r.path === '/guide/search')
      expect(result).toBeDefined()
      expect(result!.matchType).toBe('page')
    })

    it('仅匹配段落内容时 matchType 应为 content', () => {
      const results = searchWithIndex('插件', index)
      const result = results.find(r => r.path === '/guide/search')
      expect(result).toBeDefined()
      expect(result!.matchType).toBe('content')
    })

    it('主标题和段落内容同时匹配时 matchType 应为 page', () => {
      const results = searchWithIndex('搜索', index)
      const result = results.find(r => r.path === '/guide/search')
      expect(result).toBeDefined()
      expect(result!.matchType).toBe('page')
    })
  })

  describe('结果排序', () => {
    it('结果应按得分降序排列', () => {
      const results = searchWithIndex('搜索', index)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score)
      }
    })
  })

  describe('maxResults', () => {
    it('应限制返回结果数量', () => {
      const results = searchWithIndex('搜索', index, { maxResults: 1 })
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('默认最大返回 10 条', () => {
      const results = searchWithIndex('搜索', index)
      expect(results.length).toBeLessThanOrEqual(10)
    })
  })

  describe('内容预览', () => {
    it('应截取内容前 200 字符作为预览', () => {
      const results = searchWithIndex('指南', index)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.content.length).toBeLessThanOrEqual(200)
    })
  })

  describe('段落定位', () => {
    it('应返回匹配段落的 hash', () => {
      const results = searchWithIndex('安装', index)
      expect(results.length).toBeGreaterThan(0)
      const installResult = results.find(r => r.hash === '#install')
      expect(installResult).toBeDefined()
    })

    it('应返回匹配段落的 heading', () => {
      const results = searchWithIndex('安装', index)
      const installResult = results.find(r => r.heading === '安装')
      expect(installResult).toBeDefined()
    })
  })

  describe('语言过滤', () => {
    it('指定 lang 时应只返回该语言的结果', () => {
      const results = searchWithIndex('search', index, { lang: 'en-US' })
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.lang).toBe('en-US')
      })
    })

    it('指定 lang 为 zh-CN 时应只返回中文结果', () => {
      const results = searchWithIndex('搜索', index, { lang: 'zh-CN' })
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.lang).toBe('zh-CN')
      })
    })

    it('不指定 lang 时应返回所有语言的结果', () => {
      const zhResults = searchWithIndex('搜索', index)
      const enResults = searchWithIndex('search', index)
      expect(zhResults.some(r => r.lang === 'zh-CN')).toBe(true)
      expect(enResults.some(r => r.lang === 'en-US')).toBe(true)
    })

    it('指定不存在的 lang 时应返回空数组', () => {
      const results = searchWithIndex('搜索', index, { lang: 'ja-JP' })
      expect(results).toEqual([])
    })

    it('语言过滤应与 maxResults 正确配合', () => {
      const results = searchWithIndex('search', index, { lang: 'en-US', maxResults: 1 })
      expect(results.length).toBeLessThanOrEqual(1)
      results.forEach(result => {
        expect(result.lang).toBe('en-US')
      })
    })
  })
})
