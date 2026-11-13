import { modal } from '@/app/staticApi'

/**
 * 删除前确认（原版优惠券、礼品卡、知识库等页面的写法）。
 * 与原版一致：点「确定」后确认框立即关闭，删除在后台进行（原版的 onOk 不返回 dispatch 的结果，确定按钮不显示加载中）。
 */
export function confirmDelete(onOk: () => unknown) {
  modal.confirm({
    title: '警告',
    content: '确定要删除该条项目吗？',
    onOk: () => {
      void onOk()
    },
    okText: '确定',
    cancelText: '取消',
  })
}
