-- Bug: usuario nao-admin salva "Acesso rapido" no dashboard, a UI mostra o
-- resultado (estado otimista no client), mas o UPDATE em perfis e bloqueado
-- silenciosamente pela RLS (so existe policy de UPDATE para admin). No F5 a
-- pagina le o banco de novo, quick_links nunca foi gravado, atalhos somem.
--
-- Adiciona policy de self-update restrita: o proprio usuario so pode alterar
-- quick_links do seu registro, nunca perfil/escola_id/ativo/email (evita
-- auto-promocao a admin ou troca de escola via este canal). Usa current_perfil()
-- (security definer, ja usada pelas demais policies) para nao reconsultar
-- perfis dentro da propria policy de perfis — subquery direta em perfis aqui
-- causa "infinite recursion detected in policy for relation perfis".
create policy "perfil self update quick links" on public.perfis for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and escola_id = (select escola_id from current_perfil())
    and perfil = (select perfil from current_perfil())
    and ativo = (select ativo from current_perfil())
    and email = (select email from current_perfil())
  );
