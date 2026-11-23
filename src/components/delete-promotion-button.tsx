'use client';

import AdminSubmitButton from './admin-submit-button';
import { deletePromotion } from '@/app/admin/promotions/actions';

export default function DeletePromotionButton({ id, code }: { id: string; code: string }) {
  return <form action={deletePromotion} onSubmit={(event) => {
    if (!window.confirm(`Delete coupon ${code}? Customers will no longer be able to use it.`)) event.preventDefault();
  }}><input type="hidden" name="id" value={id}/><AdminSubmitButton>Delete coupon</AdminSubmitButton></form>;
}
