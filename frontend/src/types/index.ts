export type UserRole = 'player' | 'gm' | 'private_gm' | 'admin';

export type User = {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  role: UserRole;
  created_at: string;
};

export type Room = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type RoomMonthlyStats = {
  room_id: number;
  room_name: string;
  sessions_done: number;
  credits_spent: number;
  rentals_spent: number;
};

export type GmSessionEntry = {
  session_id: number;
  campaign_title: string;
  campaign_type: 'campaign' | 'oneshot';
  system?: string;
  starts_at: string;
  attendees_count: number;
};

export type GmMonthlyStats = {
  campaigns_count: number;
  oneshots_count: number;
  sessions: GmSessionEntry[];
};

export type Product = {
  id: number;
  name: string;
  price: number;
  credits: number;
  duration_months?: number;
  category: string;
  is_active: boolean;
  created_at: string;
};

export type OrderStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type Order = {
  id: number;
  user_id: number;
  user_name?: string;
  product_id: number;
  product_name: string;
  amount: number;
  credits_count: number;
  duration_months?: number;
  status: OrderStatus;
  payment_comment: string;
  reject_reason?: string;
  credits_granted: boolean;
  created_at: string;
  paid_at?: string;
  confirmed_at?: string;
};

export type QRPaymentInfo = {
  order_id: number;
  amount: number;
  payment_comment: string;
  qr_image_url: string;
  qr_sbp_link: string;
  recipient_name: string;
  bank_name: string;
};

export type CreditBatchStatus = 'active' | 'exhausted' | 'expired';
export type CreditBatchType = 'credit' | 'rental' | 'gm_reward';

export type CreditBatch = {
  id: number;
  order_id?: number;
  session_id?: number;
  batch_type: CreditBatchType;
  total: number;
  remaining: number;
  status: CreditBatchStatus;
  expires_at?: string;
  purchased_at: string;
};

export type CreditBalance = {
  total_credits: number;
  total_rentals: number;
  total_gm_rewards: number;
  credit_batches: CreditBatch[];
  rental_batches: CreditBatch[];
  gm_reward_batches: CreditBatch[];
};

export type LedgerType = 'debit' | 'refund' | 'gm_reward';

export type LedgerEntry = {
  id: number;
  user_id: number;
  credit_batch_id: number;
  session_id?: number;
  entry_type: LedgerType;
  description?: string;
  created_at: string;
  created_by?: number;
};

export type CampaignType = 'campaign' | 'oneshot';
export type CampaignFunding = 'club' | 'private';
export type CampaignVisibility = 'public' | 'link';
export type CampaignStatus = 'active' | 'archived';

export type Campaign = {
  id: number;
  type: CampaignType;
  funding: CampaignFunding;
  title: string;
  system?: string;
  description?: string;
  owner_gm_user_id: number;
  visibility: CampaignVisibility;
  status: CampaignStatus;
  member_count: number;
  capacity: number;
  created_at: string;
  next_session_at?: string | null;
};

export type CampaignMemberStatus = 'pending' | 'active';

export type CampaignMember = {
  id: number;
  campaign_id: number;
  user_id: number;
  status: CampaignMemberStatus;
  joined_at: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type SessionStatus = 'planned' | 'moved' | 'canceled' | 'done';

export type GameSession = {
  id: number;
  campaign_id: number;
  room_id: number;
  room_name: string;
  campaign_title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: SessionStatus;
  description?: string;
  confirmed_count: number;
  waitlist_count: number;
  created_at: string;
};

export type SignupStatus = 'pending' | 'confirmed' | 'waitlist' | 'offered' | 'cancelled';

export type Signup = {
  id: number;
  session_id: number;
  user_id: number;
  user_name?: string;
  status: SignupStatus;
  waitlist_position?: number;
  offered_at?: string;
  created_at: string;
};

export type AttendanceStatus = 'unmarked' | 'attended' | 'no_show' | 'excused';

export type Attendance = {
  id: number;
  session_id: number;
  user_id: number;
  user_name: string;
  status: AttendanceStatus;
  unpaid: boolean;
  marked_by?: number;
  created_at: string;
  updated_at: string;
};

export type UnpaidEntry = {
  attendance_id: number;
  session_id: number;
  user_id: number;
  user_name: string;
  session_date: string;
  campaign_title: string;
};

export type CalendarEntry = {
  session_id: number;
  campaign_id: number;
  campaign_title: string;
  campaign_type: string;
  room_name: string;
  starts_at: string;
  ends_at: string;
  session_status: SessionStatus;
  signup_status?: SignupStatus;
  capacity: number;
  confirmed_count: number;
  is_gm?: boolean;
  description?: string;
  system?: string;
};

export type PublicSessionEntry = {
  session_id: number;
  campaign_id: number;
  campaign_title: string;
  system?: string;
  room_name: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  confirmed_count: number;
  spots_left: number;
};
