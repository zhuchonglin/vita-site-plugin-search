# @vita-site/plugin-container

VitaSite 容器插件，为 Markdown 提供四种提示容器：`info`、`success`、`warning`、`error`。

## 安装

```bash
pnpm add @vita-site/plugin-container
```

## 使用

```ts
import { defineConfig } from 'vita-site/server'
import { containerPlugin } from '@vita-site/plugin-container'

export default defineConfig({
  plugins: [containerPlugin()]
})
```

## 语法

```markdown
::: type:title
内容
:::
```

- **type**：容器类型，支持 `info` / `success` / `warning` / `error`
- **title**（可选）：自定义标题，省略时默认使用类型大写形式（如 `INFO`）

### 示例

默认标题：

```md
::: info
这是一条提示信息
:::
```

自定义标题：

```md
::: info:温馨提示
这是一条提示信息
:::
```

## 渲染输出

以 `::: info:提示\n内容\n:::` 为例，渲染结果为：

```html

<div class="v-container info">
  <div class="v-container-title-wrapper">
    <svg width="18" height="18" viewBox="64 64 896 896" class="icon">
      <!-- 对应类型的 SVG path -->
    </svg>
    <h4 class="title">提示</h4>
  </div>
  <p>内容</p>
</div>
```

## 需要定义的 CSS 类

插件本身不内置样式，你需要在项目中定义以下 CSS 类：

| 类名                                  | 作用                  |
|-------------------------------------|---------------------|
| `.v-container`                      | 容器基础样式（边框、圆角、内边距等）  |
| `.v-container.info`                 | info 类型容器样式         |
| `.v-container.success`              | success 类型容器样式      |
| `.v-container.warning`              | warning 类型容器样式      |
| `.v-container.error`                | error 类型容器样式        |
| `.v-container-title-wrapper`        | 标题行容器（图标 + 标题的横向排列） |
| `.v-container-title-wrapper .icon`  | SVG 图标样式（颜色、对齐等）    |
| `.v-container-title-wrapper .title` | 标题文字样式              |

### 样式参考

```css
.v-state-container {
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
  border: 1px solid;
}

.v-state-container-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.v-state-container-header .icon {
  flex-shrink: 0;
}

.v-state-container-header .title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.v-state-container.info {
  background-color: #f0f5ff;
  border-color: #adc6ff;
  color: #2f54eb;
}

.v-state-container.success {
  background-color: #f6ffed;
  border-color: #b7eb8f;
  color: #52c41a;
}

.v-state-container.warning {
  background-color: #fffbe6;
  border-color: #ffe58f;
  color: #faad14;
}

.v-state-container.error {
  background-color: #fff2f0;
  border-color: #ffccc7;
  color: #ff4d4f;
}
```

## 容器类型与图标

| 类型        | 默认标题    | 图标      |
|-----------|---------|---------|
| `info`    | INFO    | 信息圆圈图标  |
| `success` | SUCCESS | 勾选圆圈图标  |
| `warning` | WARNING | 三角感叹号图标 |
| `error`   | ERROR   | 叉号圆圈图标  |
