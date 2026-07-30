import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminNotFound() {
  return (
    <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="mx-auto max-w-sm border-destructive/30 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Acceso denegado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            No tienes permisos para acceder a esta sección.
          </p>
          <div className="flex gap-2 pt-2">
            <Button asChild variant="default" className="flex-1">
              <Link href="/admin/login">Iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
