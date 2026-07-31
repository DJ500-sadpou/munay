import { requireAdmin } from '@/lib/auth/require-admin'
import { getCouponById } from '@/lib/queries/coupons'
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

  return (
    <CouponForm
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
