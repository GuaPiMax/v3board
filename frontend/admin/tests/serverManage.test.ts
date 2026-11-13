import { describe, expect, it } from 'vitest'
import { moveNode, parseSettings, stringifySettings, toSortPayload } from '../src/pages/server/manage/utils'

describe('节点排序请求体', () => {
  it('按完整列表的位置记录每个协议的节点', () => {
    const nodes = [
      { id: 3, type: 'vmess' },
      { id: 1, type: 'shadowsocks' },
      { id: 1, type: 'vmess' },
      { id: 2, type: 'shadowsocks' },
    ] as const
    const payload = toSortPayload([...nodes])
    expect(payload).toEqual({ vmess: { 3: 0, 1: 2 }, shadowsocks: { 1: 1, 2: 3 } })
    // 与原版相同的 JSON：协议按首次出现的顺序，节点 id 作为对象键按数字升序
    expect(JSON.stringify(payload)).toBe('{"vmess":{"1":2,"3":0},"shadowsocks":{"1":1,"2":3}}')
  })
})

const names = (list: ReadonlyArray<{ name: string }>) => list.map((node) => node.name)

describe('排序模式拖动', () => {
  const nodes = [
    { id: 1, type: 'shadowsocks', name: '香港 01' },
    { id: 2, type: 'shadowsocks', name: '香港 01 中转' },
    { id: 1, type: 'vmess', name: '日本 01' },
    { id: 1, type: 'trojan', name: '新加坡 01' },
    { id: 1, type: 'hysteria', name: '香港 Hysteria2' },
  ] as const

  it('没有过滤时与按行号移动相同', () => {
    const list = [...nodes]
    expect(names(moveNode(list, list, 0, 2))).toEqual(['香港 01 中转', '日本 01', '香港 01', '新加坡 01', '香港 Hysteria2'])
    expect(names(moveNode(list, list, 3, 0))).toEqual(['新加坡 01', '香港 01', '香港 01 中转', '日本 01', '香港 Hysteria2'])
  })

  it('搜索过滤后按节点移动（原版按行号移动，会移动错节点）', () => {
    const list = [...nodes]
    const displayed = list.filter((node) => node.name.includes('香港'))
    // 显示：香港 01、香港 01 中转、香港 Hysteria2；把「香港 01」拖到「香港 Hysteria2」的位置
    expect(names(moveNode(list, displayed, 0, 2))).toEqual(['香港 01 中转', '日本 01', '新加坡 01', '香港 Hysteria2', '香港 01'])
    // 把「香港 Hysteria2」拖到最前
    expect(names(moveNode(list, displayed, 2, 0))).toEqual(['香港 Hysteria2', '香港 01', '香港 01 中转', '日本 01', '新加坡 01'])
  })

  it('不同协议的节点 id 可以相同，按协议 + id 定位', () => {
    const list = [...nodes]
    expect(names(moveNode(list, [list[2], list[3]], 1, 0))).toEqual(['香港 01', '香港 01 中转', '新加坡 01', '日本 01', '香港 Hysteria2'])
  })
})

describe('传输协议配置的转换', () => {
  it('打开或关闭抽屉时把对象转成两空格缩进的 JSON 文本，其余不变', () => {
    expect(stringifySettings({ a: 1, network_settings: { path: '/' } }, 'network_settings')).toEqual({
      a: 1,
      network_settings: '{\n  "path": "/"\n}',
    })
    const unchanged = { network_settings: '{"path":"/"}' }
    expect(stringifySettings(unchanged, 'network_settings')).toBe(unchanged)
    expect(stringifySettings({ network_settings: null }, 'network_settings')).toEqual({ network_settings: null })
  })

  it('提交时解析 JSON 文本，空值为 null；已经是对象时保持不变（原版会变成 false），不改变字段顺序', () => {
    expect(parseSettings({ id: 1, networkSettings: '{"path":"/ws"}', name: 'a' }, 'networkSettings')).toEqual({
      id: 1,
      networkSettings: { path: '/ws' },
      name: 'a',
    })
    expect(Object.keys(parseSettings({ id: 1, networkSettings: '{}', name: 'a' }, 'networkSettings'))).toEqual([
      'id',
      'networkSettings',
      'name',
    ])
    expect(parseSettings({ networkSettings: '' }, 'networkSettings')).toEqual({ networkSettings: null })
    expect(parseSettings({}, 'networkSettings')).toEqual({ networkSettings: null })
    expect(parseSettings({ networkSettings: { path: '/' } }, 'networkSettings')).toEqual({ networkSettings: { path: '/' } })
  })

  it('JSON 有误时抛出异常', () => {
    expect(() => parseSettings({ network_settings: '{path:' }, 'network_settings')).toThrow()
  })
})
