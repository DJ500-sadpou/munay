-- =============================================================
-- Migración 00005 — Storage buckets y políticas.
--
-- Bucket: product-images (público para lectura, privado para escritura).
-- Las imágenes se suben vía Edge Function o admin panel con service role.
-- =============================================================

-- Crear bucket público para imágenes de productos.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Política: cualquiera puede LEER imágenes (es bucket público, pero
-- igual dejamos explícita la policy por si se cambia a privado).
drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Política: solo admins pueden SUBIR/borrar imágenes.
drop policy if exists "product-images: admin write" on storage.objects;
create policy "product-images: admin write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
  );

drop policy if exists "product-images: admin update" on storage.objects;
create policy "product-images: admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin()
  );

drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin()
  );

comment on table storage.objects is 'Bucket product-images: lectura pública, escritura solo admin.';
