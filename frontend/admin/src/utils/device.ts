/** 与原版一致：UA 含 mobile 视为移动端（节点列表等会切换为移动端样式） */
export const isMobile = () => window.navigator.userAgent.toLowerCase().includes('mobile')
