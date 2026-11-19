import { INQUIRY_STATUSES, ORDER_STATUSES, type InquiryStatus, type OrderStatus } from './db/schema';

export const STATUS_LABEL: Record<string, string> = {
  new: 'New inquiry', under_review: 'Under review', quotation_prepared: 'Quotation prepared', quotation_sent: 'Quotation sent',
  sample_requested: 'Sample requested', sample_approved: 'Sample approved', order_confirmed: 'Order confirmed',
  in_production: 'In production', quality_inspection: 'Quality inspection', shipped: 'Shipped', completed: 'Completed',
};

export const INQUIRY_STEPS: readonly InquiryStatus[] = INQUIRY_STATUSES;
export const ORDER_STEPS: readonly OrderStatus[] = ORDER_STATUSES;

/** The statuses a staff member may move an inquiry to from where it is (any forward step, or one back). */
export function allowedNext(from: InquiryStatus): InquiryStatus[] {
  const i = INQUIRY_STATUSES.indexOf(from);
  return INQUIRY_STATUSES.filter((_, j) => j !== i && j >= i - 1);
}
