// 与原版一致的 cookie 读写（dark_mode 等），默认有效期 525600 分钟（一年）
export function getCookie(name: string): string {
  return document.cookie.split('; ').reduce((acc, part) => {
    const [k, v] = part.split('=')
    return k === name ? decodeURIComponent(v ?? '') : acc
  }, '')
}

export function setCookie(name: string, value: string | number, minutes = 525600, path = '/', domain?: string) {
  const expires = new Date(Date.now() + 60000 * minutes).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=${path}${domain ? `;domain=${domain}` : ''}`
}
