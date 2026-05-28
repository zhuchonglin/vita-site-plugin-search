/**
 * 高亮显式匹配的内容
 *
 * @param query 查询内容
 * @param content 需要高亮的内容
 * @param tag 高亮标签
 */
export function highlight(query: string, content: string, tag: string = 'mark'): string {
  if (!query) {
    return content
  }
  return content.split(query).join(`<${tag}>${query}</${tag}>`)
}
