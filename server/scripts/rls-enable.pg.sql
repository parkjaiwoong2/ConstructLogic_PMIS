-- Supabase RLS (Row Level Security) 활성화
-- 공개 스키마 테이블에 RLS 적용

-- account_items
ALTER TABLE public.account_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.account_items FOR ALL USING (true) WITH CHECK (true);

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- expense_documents
ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.expense_documents FOR ALL USING (true) WITH CHECK (true);

-- expense_items
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.expense_items FOR ALL USING (true) WITH CHECK (true);

-- approval_history
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.approval_history FOR ALL USING (true) WITH CHECK (true);

-- account_mapping_rules
ALTER TABLE public.account_mapping_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.account_mapping_rules FOR ALL USING (true) WITH CHECK (true);
