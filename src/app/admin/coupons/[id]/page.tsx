import { requireAdmin } from '@/lib/auth/require-admin'
import { getCouponById } from '@/lib/queries/coupons'
import { getSettingNumber } from '@/lib/queries/settings'
import { SETTINGS_DEFAULTS } from '@/lib/constants'
import { CouponForm } from '@/components/admin/coupons/coupon-form'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Editar cupón · Admin' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCouponPage({ params }: PageProps) {
  await requireAdmin()

  const { id } = await params
  const coupon = await getCouponById(id)

  if (!coupon) notFound()

  // [F1.1] Umbral configurable de advertencia para primera_compra (settings/00023).
  const warningThreshold = await getSettingNumber(
    'coupon_first_purchase_warning_threshold',
    SETTINGS_DEFAULTS.coupon_first_purchase_warning_threshold
  )

  return (
    <CouponForm
      warningThreshold={warningThreshold}
      coupon={{
        id: coupon.id,
        codigo: coupon.codigo,
        tipo: coupon.tipo,
        porcentaje_descuento: coupon.porcentaje_descuento,
        monto_minimo_compra: coupon.monto_minimo_compra,
        fecha_inicio: coupon.fecha_inicio,
        fecha_fin: coupon.fecha_fin,
        activo: coupon.activo,
        usos_maximos: coupon.usos_maximos,
        usos_actuales: coupon.usos_actuales,
      }}
    />
  )
}
