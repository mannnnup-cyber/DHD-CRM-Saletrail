BEGIN;

-- Per-person CRM reads only. No WhatsApp network request or phone read receipt.
CREATE TABLE public.whatsapp_inbox_receipts (
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, message_id)
);
ALTER TABLE public.whatsapp_inbox_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_inbox_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.whatsapp_inbox_receipts TO service_role;
CREATE INDEX whatsapp_inbox_receipts_message_idx ON public.whatsapp_inbox_receipts(message_id);

CREATE FUNCTION public.wa_inbox_unread(p_actor uuid, p_chats text[])
RETURNS TABLE(chat_id text, unread_count bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = p_actor AND u.is_active IS TRUE AND u.role IN ('owner', 'manager')) THEN
    RAISE EXCEPTION 'Inbox access denied';
  END IF;
  IF p_chats IS NULL OR cardinality(p_chats) > 500 OR array_position(p_chats, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid chat list';
  END IF;
  RETURN QUERY
    SELECT c.id, count(m.id) FILTER (WHERE r.message_id IS NULL)
    FROM (SELECT DISTINCT unnest(p_chats) AS id) c
    LEFT JOIN public.whatsapp_messages m ON m.chat_id = c.id AND m.provider = 'evolution' AND m.direction = 'inbound'
    LEFT JOIN public.whatsapp_inbox_receipts r ON r.message_id = m.id AND r.actor_id = p_actor
    GROUP BY c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.wa_inbox_unread(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_inbox_unread(uuid, text[]) TO service_role;

CREATE FUNCTION public.wa_inbox_seen(p_actor uuid, p_chat text, p_messages uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE expected integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.id = p_actor AND u.is_active IS TRUE AND u.role IN ('owner', 'manager')) THEN
    RAISE EXCEPTION 'Inbox access denied';
  END IF;
  IF p_messages IS NULL OR cardinality(p_messages) < 1 OR cardinality(p_messages) > 1000 OR array_position(p_messages, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid message list';
  END IF;
  SELECT count(DISTINCT id) INTO expected FROM unnest(p_messages) id;
  IF expected <> (SELECT count(*) FROM public.whatsapp_messages m WHERE m.id = ANY(p_messages) AND m.chat_id = p_chat AND m.provider = 'evolution' AND m.direction = 'inbound') THEN
    RAISE EXCEPTION 'Displayed messages do not belong to this chat';
  END IF;
  -- Exact IDs avoid clearing arrivals during reading, including delayed messages
  -- carrying timestamps older than the last message currently displayed.
  INSERT INTO public.whatsapp_inbox_receipts(actor_id, message_id)
    SELECT p_actor, m.id FROM public.whatsapp_messages m
    WHERE m.id = ANY(p_messages) AND m.chat_id = p_chat AND m.provider = 'evolution' AND m.direction = 'inbound'
    ON CONFLICT (actor_id, message_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.wa_inbox_seen(uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_inbox_seen(uuid, text, uuid[]) TO service_role;

COMMIT;
