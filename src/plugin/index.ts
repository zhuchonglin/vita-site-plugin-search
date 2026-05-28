/**
 * @module server/index
 *
 * 搜索插件的服务端入口，定义 VitaSitePlugin 实例。
 * 边界：仅负责插件注册和生命周期编排，核心逻辑委托给 splitter / builder。
 *
 * 生命周期：
 * - config：注册 Vite 虚拟模块插件，供客户端异步导入搜索索引
 * - afterParse：收集每个 Markdown 文档的分段数据
 *
 * 索引交付方式：
 * 通过 Vite 虚拟模块 `virtual:vita-site-search/index` 提供搜索索引，
 * 客户端通过动态 import() 按需加载。相比 fetch JSON 文件的方式，
 * 虚拟模块由 Vite 管理路径解析，天然支持子目录部署（base 配置）。
 */

import type { MdParseResult, VitaSiteApp, VitaSitePlugin } from 'vita-site/server'
import type { SearchSectionBuild } from '../types.js'
import { buildSearchIndex } from './builder.js'
import { splitByHeadings } from './splitter.js'

/**
 * 搜索插件配置选项
 *
 * 在创建插件实例时传入，控制索引构建和搜索行为。
 */
export interface SearchPluginOptions {}

const VIRTUAL_SEARCH_INDEX_ID = 'virtual:vita-site-search/index'
const RESOLVED_SEARCH_INDEX_ID = '\0' + VIRTUAL_SEARCH_INDEX_ID

/**
 * 创建搜索插件
 *
 * 插件在构建期间完成两件事：
 * 1. config 阶段：注册 Vite 虚拟模块插件，供客户端按需加载搜索索引
 * 2. afterParse 阶段：对每个 Markdown 文件按标题分段并分词，暂存到内存
 *
 * 索引在 Vite 构建/开发时通过虚拟模块动态生成，
 * 客户端通过 `import('virtual:vita-site-search/index')` 按需加载。
 *
 * @param _options - 插件配置选项（预留扩展，当前未使用）
 * @returns VitaSite 插件实例
 */
export function searchPlugin(_options: SearchPluginOptions = {}): VitaSitePlugin {
  /** 暂存所有文档的分段数据，key 为 meta.relativePath */
  const docs = new Map<string, { title: string; sections: SearchSectionBuild[] }>()
  /** app 实例引用，在 afterParse 中赋值，供 Vite 插件 load 钩子使用 */
  let appRef: VitaSiteApp | null = null

  return {
    name: 'vita-site-plugin-search',

    /**
     * 配置钩子
     *
     * 注册 Vite 虚拟模块插件，将搜索索引作为虚拟模块提供。
     * 客户端通过动态 import() 按需加载，Vite 自动处理路径和 base 配置。
     *
     * @returns 包含 Vite 插件的配置
     */
    config() {
      return {
        vite: {
          plugins: [
            {
              name: 'vita-site-plugin-search-vite',
              resolveId(id: string): string | null {
                if (id === VIRTUAL_SEARCH_INDEX_ID) {
                  return RESOLVED_SEARCH_INDEX_ID
                }
                return null
              },
              load(id: string): string | null {
                if (id === RESOLVED_SEARCH_INDEX_ID) {
                  if (!appRef) {
                    return 'export default { docs: [], index: {} }'
                  }
                  const { routes } = appRef.router.generate()
                  const searchIndex = buildSearchIndex(docs, routes, appRef.lang)
                  return `export default ${JSON.stringify(searchIndex)}`
                }
                return null
              }
            }
          ]
        }
      }
    },
    /**
     * 应用创建回调
     *
     * 记录 app 实例引用，供 Vite 插件 load 钩子使用。
     *
     * @param app - VitaSite 应用实例
     */
    appCreated(app: VitaSiteApp): void {
      appRef = app
    },
    /**
     * Markdown 解析完成后回调
     *
     * 将原始 Markdown 内容按标题分段，暂存到 docs Map 中。
     * lang 由 buildSearchIndex 从路由信息中获取，路由无 lang 时回退到 app 默认语言。
     *
     * @param result - Markdown 解析结果（含 content、meta 等）
     */
    afterParse(result: MdParseResult): void {
      const { content, meta } = result
      const relativePath = meta.relativePath

      const sections = splitByHeadings(content, meta.tocList || [])

      docs.set(relativePath, {
        title: meta.title || '',
        sections
      })
    }
  }
}
