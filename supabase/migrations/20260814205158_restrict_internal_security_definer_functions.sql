REVOKE ALL ON FUNCTION public.can_access(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_employee_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_candidate_big_five_scores() FROM PUBLIC, anon, authenticated;
