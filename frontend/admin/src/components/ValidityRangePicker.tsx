import { DatePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

type Seconds = number | string | null | undefined

interface ValidityRangePickerProps {
  startedAt: Seconds
  endedAt: Seconds
  /** 与原版一致：返回 unix 秒的字符串（moment.format('X')），清空时为 null */
  onChange: (startedAt: string | null, endedAt: string | null) => void
}

const toDayjs = (seconds: Seconds) => (seconds ? dayjs(Number(seconds) * 1000) : null)
const toSeconds = (date: Dayjs | null | undefined) => (date ? String(date.unix()) : null)

// 有效期（优惠券、礼品卡）：原版 RangePicker，精确到分钟
export function ValidityRangePicker({ startedAt, endedAt, onChange }: ValidityRangePickerProps) {
  const handle = (dates: [Dayjs | null, Dayjs | null] | null) => onChange(toSeconds(dates?.[0]), toSeconds(dates?.[1]))
  return (
    <DatePicker.RangePicker
      style={{ width: '100%' }}
      // 与 antd 3 一致：选择日期时默认带上当前时间（antd 6 默认 00:00）
      showTime={{ format: 'HH:mm', defaultOpenValue: [dayjs(), dayjs()] }}
      format="YYYY-MM-DD HH:mm"
      placeholder={['Start Time', 'End Time']}
      separator="~"
      value={[toDayjs(startedAt), toDayjs(endedAt)]}
      onChange={handle}
      onOk={handle}
    />
  )
}
