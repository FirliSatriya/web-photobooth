-- ===========================================================================
-- Remote Collaborative Web Photobooth — Supabase schema
-- Mirrors section 7 of the PRD with the small additions the app needs
-- (layout + filter on rooms, share token on photo outputs, counters).
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Frame / template collection -------------------------------------------
CREATE TABLE IF NOT EXISTS frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    overlay_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    layout_type VARCHAR(20) NOT NULL CHECK (layout_type IN ('1x4_strip', '2x2_grid', '1x2_wide')),
    slot_coordinates JSONB NOT NULL,
    max_participants INT DEFAULT 2,
    is_premium BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Photobooth rooms --------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    host_session_token VARCHAR(255) NOT NULL,
    tier VARCHAR(10) DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
    max_participants INT DEFAULT 2,
    retakes_used INT DEFAULT 0,
    max_retakes INT DEFAULT 1,
    selected_frame_id UUID REFERENCES frames(id),
    selected_frame_slug VARCHAR(100),
    layout_type VARCHAR(20) DEFAULT '1x4_strip' CHECK (layout_type IN ('1x4_strip', '2x2_grid', '1x2_wide')),
    filter_id VARCHAR(20) DEFAULT 'none',
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code) WHERE status IN ('waiting', 'active');

-- 3. Session pass transactions ---------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    gateway_order_id VARCHAR(100) UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'IDR',
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Temporary photo / boomerang outputs ------------------------------------
CREATE TABLE IF NOT EXISTS photo_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    final_image_url TEXT NOT NULL,
    boomerang_video_url TEXT,
    share_token VARCHAR(64) UNIQUE,
    delete_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_outputs_token ON photo_outputs(share_token);
CREATE INDEX IF NOT EXISTS idx_photo_outputs_delete_after ON photo_outputs(delete_after);

-- 5. RLS --------------------------------------------------------------------
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frames are readable" ON frames;
CREATE POLICY "frames are readable" ON frames
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "rooms are readable by code" ON rooms;
CREATE POLICY "rooms are readable by code" ON rooms
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "outputs are readable" ON photo_outputs;
CREATE POLICY "outputs are readable" ON photo_outputs
    FOR SELECT USING (delete_after > NOW());

-- Writes go through the service role only (API routes / edge functions).

-- 6. Housekeeping ------------------------------------------------------------
-- Requires pg_cron. Enable it from the Supabase dashboard, then:
-- SELECT cron.schedule('purge-photobooth', '*/15 * * * *', $$
--   DELETE FROM photo_outputs WHERE delete_after < NOW();
--   UPDATE rooms SET status = 'expired'
--     WHERE expires_at < NOW() AND status IN ('waiting', 'active');
-- $$);
