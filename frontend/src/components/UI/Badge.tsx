import type { SignupStatus, OrderStatus, SessionStatus, AttendanceStatus } from '../../types/index';

type BadgeColor = 'pink' | 'blue' | 'purple' | 'green' | 'yellow' | 'orange';

interface BadgeProps {
  text: string;
  color: BadgeColor;
}

export function Badge({ text, color }: BadgeProps) {
  return <span className={`badge badge-${color}`}>{text}</span>;
}

export function SignupBadge({ status }: { status: SignupStatus }) {
  const map: Record<SignupStatus, { text: string; color: BadgeColor }> = {
    pending:   { text: 'Ожидает ответа', color: 'yellow' },
    confirmed: { text: 'Подтверждён', color: 'green' },
    waitlist:  { text: 'Лист ожидания', color: 'yellow' },
    offered:   { text: 'Предложено', color: 'purple' },
    cancelled: { text: 'Отменён', color: 'orange' },
  };
  const { text, color } = map[status];
  return <Badge text={text} color={color} />;
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { text: string; color: BadgeColor }> = {
    pending: { text: 'Ожидает оплаты', color: 'yellow' },
    awaiting_confirmation: { text: 'На проверке', color: 'purple' },
    confirmed: { text: 'Подтверждён', color: 'green' },
    rejected: { text: 'Отклонён', color: 'orange' },
    expired: { text: 'Истёк', color: 'orange' },
    cancelled: { text: 'Отменён', color: 'orange' },
  };
  const { text, color } = map[status];
  return <Badge text={text} color={color} />;
}

export function SessionBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { text: string; color: BadgeColor }> = {
    planned: { text: 'Запланирована', color: 'blue' },
    moved: { text: 'Перенесена', color: 'yellow' },
    canceled: { text: 'Отменена', color: 'orange' },
    done: { text: 'Завершена', color: 'green' },
  };
  const { text, color } = map[status];
  return <Badge text={text} color={color} />;
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const map: Record<AttendanceStatus, { text: string; color: BadgeColor }> = {
    unmarked: { text: 'Не отмечен', color: 'yellow' },
    attended: { text: 'Присутствовал', color: 'green' },
    no_show: { text: 'Не пришёл', color: 'orange' },
    excused: { text: 'Уважительная', color: 'blue' },
  };
  const { text, color } = map[status];
  return <Badge text={text} color={color} />;
}