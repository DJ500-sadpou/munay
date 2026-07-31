import { requireAdmin } from '@/lib/auth/require-admin'
import { CouponForm } from '@/components/admin/coupons/coupon-form'

export const metadata = { title: 'Nuevo cupón · Admin' }
export const dynamic = 'force-dynamic'

export default async function NewCouponPage() {
  await requireAdmin()
  return <CouponForm />
}
