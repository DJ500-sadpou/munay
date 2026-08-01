import { requireAdmin } from '@/lib/auth/require-admin'
import { CouponForm } from '@/components/admin/coupons/coupon-form'
import { getSettingNumber } from '@/lib/queries/settings'
import { SETTINGS_DEFAULTS } from '@/lib/constants'

export const metadata = { title: 'Nuevo cupón · Admin' }
export const dynamic = 'force-dynamic'

export default async function NewCouponPage() {
  await requireAdmin()

  // [F1.1] Umbral configurable de advertencia para primera_compra (settings/00023).
  const warningThreshold = await getSettingNumber(
    'coupon_first_purchase_warning_threshold',
    SETTINGS_DEFAULTS.coupon_first_purchase_warning_threshold
  )

  return <CouponForm warningThreshold={warningThreshold} />
}
