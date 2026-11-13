import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MdEditor from 'react-markdown-editor-lite'
import MarkdownIt from 'markdown-it'

it('the existing knowledge editor renders with the patched markdown-it and nanoid dependency', () => {
  const markdown = new MarkdownIt({ html: true, linkify: true, typographer: true })
  const html = renderToStaticMarkup(createElement(MdEditor, {
    value: '# Example',
    renderHTML: (value: string) => markdown.render(value),
  }))
  expect(html).toContain('textarea')
  expect(html).toContain('Example')
  expect(markdown.render('# Example')).toContain('<h1>Example</h1>')
})
