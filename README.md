# @vita-site/plugin-search

VitaSite 全文搜索插件，为 Markdown 站点提供中英文混合搜索能力。

## 特性

- **中英文混合分词** — 中文单字 + 双字组合（bigram），英文按空格分词并小写化
- **倒排索引** — 构建时生成倒排索引，客户端按需加载，搜索高效
- **标题加权** — 标题匹配权重为内容匹配的 5 倍
- **虚拟模块交付** — 通过 Vite 虚拟模块提供搜索索引，天然支持子目录部署（base 配置）
- **懒加载** — 搜索索引在首次搜索时按需加载并缓存
- **搜索取消** — 基于代数计数器的取消机制，连续搜索自动使前一次失效
- **内容高亮** — 提供搜索结果高亮工具函数
- **多语言支持** — 可按语言过滤搜索结果

## 安装

```bash
pnpm add @vita-site/plugin-search
```

## 使用

### 注册插件

在 VitaSite 配置中注册搜索插件：

```ts
import searchPlugin from '@vita-site/plugin-search/server'

export default {
  plugins: [searchPlugin()]
}
```

插件会在构建期间自动完成：
1. 收集所有 Markdown 文档，按标题分段并分词
2. 生成倒排索引，通过虚拟模块 `virtual:vita-site-search/index` 交付

### 客户端搜索

```ts
import { search, cancelSearch, highlight } from '@vita-site/plugin-search'

// 执行搜索
const response = await search('搜索关键词', {
  lang: 'zh',           // 可选，按语言过滤
  maxResults: 10,       // 可选，最大结果数，默认 10
  maxContentLength: 200 // 可选，内容截取长度，默认 200
})

if (response.status === 'success') {
  for (const result of response.matched) {
    console.log(result.title, result.path, result.heading)
    console.log(highlight('搜索关键词', result.content))
  }
}

// 取消搜索（例如用户关闭搜索弹窗时）
cancelSearch()
```

### 内容高亮

```ts
import { highlight } from '@vita-site/plugin-search'

highlight('搜索', '这是一个搜索功能的示例')
// → '这是一个<mark>搜索</mark>功能的示例'

highlight('search', 'search result', 'em')
// → '<em>search</em> result'
```

## API

### 服务端

#### `searchPlugin(options?)`

创建搜索插件实例，注册为 VitaSite 插件。

```ts
import { type SearchPluginOptions } from '@vita-site/plugin-search/server'

declare function searchPlugin(options?: SearchPluginOptions): VitaSitePlugin
```

| 参数        | 类型                    | 说明                |
|-----------|-----------------------|-------------------|
| `options` | `SearchPluginOptions` | 插件配置（预留扩展，当前无必填项） |

### 客户端

#### `search(query, options?)`

执行异步搜索，支持取消机制。首次调用时懒加载搜索索引。

```ts
declare function search(query: string, options?: SearchOptions): Promise<SearchResponse>
```

**SearchOptions**

| 参数                 | 类型       | 默认值   | 说明      |
|--------------------|----------|-------|---------|
| `lang`             | `string` | —     | 按语言过滤结果 |
| `maxResults`       | `number` | `10`  | 最大返回结果数 |
| `maxContentLength` | `number` | `200` | 内容截取长度  |

**SearchResponse**

| 字段        | 类型                        | 说明                            |
|-----------|---------------------------|-------------------------------|
| `status`  | `'success' \| 'canceled'` | 搜索状态，`canceled` 表示被新搜索或手动取消取代 |
| `matched` | `SearchResult[]`          | 匹配结果列表                        |

#### `searchWithIndex(query, searchIndex, options?)`

使用指定索引执行同步搜索（供测试使用），不支持取消机制。

```ts
declare function searchWithIndex(
  query: string,
  searchIndex: SearchIndex,
  options?: SearchOptions
): SearchResult[]
```

#### `cancelSearch()`

取消当前正在进行的搜索，递增代数计数器使正在进行的搜索立即失效。

```ts
declare function cancelSearch(): void
```

#### `loadIndex()`

懒加载搜索索引，首次调用时通过虚拟模块加载并缓存。

```ts
declare function loadIndex(): Promise<SearchIndex>
```

#### `highlight(query, content, tag?)`

高亮匹配内容，将查询文本用指定标签包裹。

```ts
declare function highlight(query: string, content: string, tag?: string): string
```

| 参数        | 类型       | 默认值      | 说明    |
|-----------|----------|----------|-------|
| `query`   | `string` | —        | 查询文本  |
| `content` | `string` | —        | 待高亮内容 |
| `tag`     | `string` | `'mark'` | 高亮标签名 |

### 共享

#### `tokenize(text)`

中英文混合分词器，供索引构建和查询分词共同使用。

```ts
declare function tokenize(text: string): string[]
```

```ts
tokenize('搜索功能')   // ['搜', '索', '搜索', '功', '能', '功能']
tokenize('Hello World') // ['hello', 'world']
```

## 类型

### SearchResult

```ts
interface SearchResult {
  score: number               // 匹配得分
  lang: string                // 语言标识
  path: string                // 路由路径
  hash: string                // 锚点 hash（用于页面内跳转）
  title: string               // 页面标题
  heading: string             // 段落标题
  content: string             // 匹配的文本片段
  matchType: 'page' | 'content' // page 匹配主标题，content 匹配段落内容
}
```

### SearchIndex

```ts
interface SearchIndex {
  docs: SearchDoc[]                              // 文档列表
  index: Record<string, [number, number][]>      // 倒排索引：token → [docIndex, sectionIndex][]
}
```

## 架构

```
src/
├── server/          # 服务端：插件注册、索引构建、内容分段
│   ├── index.ts     # 插件入口，生命周期编排
│   ├── builder.ts   # 倒排索引构建器
│   └── splitter.ts  # Markdown 按标题分段器
├── client/          # 客户端：搜索执行、内容高亮
│   ├── index.ts     # 客户端导出
│   ├── search.ts    # 搜索逻辑（含取消机制）
│   ├── highlight.ts # 高亮工具
│   └── virtual.d.ts # 虚拟模块类型声明
├── common/          # 共享：分词器
│   └── tokenizer.ts # 中英文混合分词
├── types.ts         # 共享类型定义
└── index.ts         # 包入口
```

### 数据流

```
Markdown 文件
    ↓ afterParse
splitByHeadings() → 按标题分段
    ↓
buildSearchIndex() → 分词 + 构建倒排索引
    ↓
虚拟模块交付（Vite virtual module）
    ↓
客户端 loadIndex() → 懒加载索引
    ↓
search() → 分词查询 + 倒排索引匹配 + 评分排序
    ↓
SearchResult[]
```

### 评分策略

- 标题匹配加权 **5 倍**（`sectionIndex === -1`）
- 内容匹配权重 **1 倍**
- 多个查询 token 命中同一文档/段落时得分累加
- 最终按得分降序排列，截取 `maxResults` 条

### 索引体积优化

构建时使用 `SearchDocBuild`（含 `titleTokens` / `contentTokens`）生成倒排索引，输出时剥离 token 数据转为 `SearchDoc`，减少约 50% 索引体积。客户端搜索仅需倒排索引 + 文档元信息，无需预分词结果。

## License

MIT
