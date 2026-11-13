-- 014: live updates. Row changes publish a tiny "something changed" hint on the Postgres channel
-- `carmaa_live`; every API process LISTENs and forwards it to connected browsers (GET /api/v1/live,
-- Server-Sent Events). The hint carries only a topic (+ user id for private topics) — never content;
-- browsers re-fetch through the normal, authorised API.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION carmaa_live_notify(payload jsonb) RETURNS void AS $$
BEGIN PERFORM pg_notify('carmaa_live', payload::text); END
$$ LANGUAGE plpgsql;

-- private: notifications -> the owner
CREATE OR REPLACE FUNCTION carmaa_live_trg_notifications() RETURNS trigger AS $$
BEGIN PERFORM carmaa_live_notify(jsonb_build_object('t','notifications','u',NEW.user_id)); RETURN NULL; END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS carmaa_live_notifications ON notifications;
CREATE TRIGGER carmaa_live_notifications AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_notifications();

-- private: messages (new / edited / deleted) -> both participants
CREATE OR REPLACE FUNCTION carmaa_live_trg_messages() RETURNS trigger AS $$
DECLARE c record;
BEGIN
  SELECT buyer_id, seller_id INTO c FROM conversations WHERE id = NEW.conversation_id;
  IF FOUND THEN
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',c.buyer_id,'c',NEW.conversation_id));
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',c.seller_id,'c',NEW.conversation_id));
  END IF;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS carmaa_live_messages ON messages;
CREATE TRIGGER carmaa_live_messages AFTER INSERT OR UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_messages();

-- private: likes on a message -> both participants
CREATE OR REPLACE FUNCTION carmaa_live_trg_message_likes() RETURNS trigger AS $$
DECLARE r record; mid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN mid := OLD.message_id; ELSE mid := NEW.message_id; END IF;
  SELECT c.id AS cid, c.buyer_id, c.seller_id INTO r FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = mid;
  IF FOUND THEN
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',r.buyer_id,'c',r.cid));
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',r.seller_id,'c',r.cid));
  END IF;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS carmaa_live_message_likes ON message_likes;
CREATE TRIGGER carmaa_live_message_likes AFTER INSERT OR DELETE ON message_likes FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_message_likes();

-- private: read receipts -> both participants
CREATE OR REPLACE FUNCTION carmaa_live_trg_reads() RETURNS trigger AS $$
DECLARE c record;
BEGIN
  SELECT buyer_id, seller_id INTO c FROM conversations WHERE id = NEW.conversation_id;
  IF FOUND THEN
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',c.buyer_id,'c',NEW.conversation_id));
    PERFORM carmaa_live_notify(jsonb_build_object('t','messages','u',c.seller_id,'c',NEW.conversation_id));
  END IF;
  RETURN NULL;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS carmaa_live_reads ON conversation_reads;
CREATE TRIGGER carmaa_live_reads AFTER INSERT OR UPDATE ON conversation_reads FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_reads();

-- public topics
CREATE OR REPLACE FUNCTION carmaa_live_trg_topic() RETURNS trigger AS $$
BEGIN PERFORM carmaa_live_notify(jsonb_build_object('t', TG_ARGV[0])); RETURN NULL; END
$$ LANGUAGE plpgsql;

-- listings: ignore pure view-counter / timestamp updates (they happen on every page view)
DROP TRIGGER IF EXISTS carmaa_live_listings_ins ON listings;
CREATE TRIGGER carmaa_live_listings_ins AFTER INSERT OR DELETE ON listings FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('listings');
DROP TRIGGER IF EXISTS carmaa_live_listings_upd ON listings;
CREATE TRIGGER carmaa_live_listings_upd AFTER UPDATE ON listings FOR EACH ROW
  WHEN ((to_jsonb(OLD) - 'view_count' - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'view_count' - 'updated_at'))
  EXECUTE FUNCTION carmaa_live_trg_topic('listings');

DROP TRIGGER IF EXISTS carmaa_live_showrooms ON showrooms;
CREATE TRIGGER carmaa_live_showrooms AFTER INSERT OR UPDATE OR DELETE ON showrooms FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('showrooms');
DROP TRIGGER IF EXISTS carmaa_live_follows ON follows;
CREATE TRIGGER carmaa_live_follows AFTER INSERT OR DELETE ON follows FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('showrooms');
DROP TRIGGER IF EXISTS carmaa_live_reviews ON showroom_reviews;
CREATE TRIGGER carmaa_live_reviews AFTER INSERT OR UPDATE OR DELETE ON showroom_reviews FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('showrooms');

DROP TRIGGER IF EXISTS carmaa_live_stories ON stories;
CREATE TRIGGER carmaa_live_stories AFTER INSERT OR DELETE ON stories FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('stories');

DROP TRIGGER IF EXISTS carmaa_live_news_likes ON news_likes;
CREATE TRIGGER carmaa_live_news_likes AFTER INSERT OR DELETE ON news_likes FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('news');
DROP TRIGGER IF EXISTS carmaa_live_news_comments ON news_comments;
CREATE TRIGGER carmaa_live_news_comments AFTER INSERT OR UPDATE OR DELETE ON news_comments FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('news');
DROP TRIGGER IF EXISTS carmaa_live_news_comment_likes ON news_comment_likes;
CREATE TRIGGER carmaa_live_news_comment_likes AFTER INSERT OR DELETE ON news_comment_likes FOR EACH ROW EXECUTE FUNCTION carmaa_live_trg_topic('news');
