-- Seeds the nine frame presets shipped with the app.
-- slot_coordinates is normalised (0..1) and describes every shot rect plus the
-- per-participant cells inside it. Widths/heights below intentionally use the
-- same proportions the client renderer derives from src/lib/layout.ts.
-- Run after 0001_init.sql.

INSERT INTO frames (name, slug, overlay_url, thumbnail_url, layout_type, slot_coordinates, max_participants, is_premium)
VALUES
  ('Classic Cream', 'classic-cream', '', '', '1x4_strip',
   '[{"shot":0,"rect":{"x":0.05,"y":0.045,"w":0.90,"h":0.185},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, FALSE),
  ('Mono Strip', 'mono-strip', '', '', '1x4_strip',
   '[{"shot":0,"rect":{"x":0.05,"y":0.045,"w":0.90,"h":0.185},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, FALSE),
  ('Retro Sun', 'retro-sun', '', '', '1x4_strip',
   '[{"shot":0,"rect":{"x":0.05,"y":0.045,"w":0.90,"h":0.185},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, FALSE),
  ('Grid Paper', 'grid-paper', '', '', '2x2_grid',
   '[{"shot":0,"rect":{"x":0.04,"y":0.04,"w":0.44,"h":0.40},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, FALSE),
  ('Wide Linen', 'wide-linen', '', '', '1x2_wide',
   '[{"shot":0,"rect":{"x":0.04,"y":0.04,"w":0.44,"h":0.78},"cells":[{"x":0,"y":0,"w":1,"h":0.5},{"x":0,"y":0.5,"w":1,"h":0.5}]}]'::jsonb,
   2, FALSE),
  ('Film Noir', 'film-noir', '', '', '1x4_strip',
   '[{"shot":0,"rect":{"x":0.07,"y":0.05,"w":0.86,"h":0.18},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, TRUE),
  ('Neon Night', 'neon-night', '', '', '1x4_strip',
   '[{"shot":0,"rect":{"x":0.07,"y":0.05,"w":0.86,"h":0.18},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, TRUE),
  ('Bloom Grid', 'bloom-grid', '', '', '2x2_grid',
   '[{"shot":0,"rect":{"x":0.05,"y":0.05,"w":0.43,"h":0.39},"cells":[{"x":0,"y":0,"w":0.5,"h":1},{"x":0.5,"y":0,"w":0.5,"h":1}]}]'::jsonb,
   2, TRUE),
  ('Pop Wide', 'pop-wide', '', '', '1x2_wide',
   '[{"shot":0,"rect":{"x":0.05,"y":0.05,"w":0.42,"h":0.76},"cells":[{"x":0,"y":0,"w":1,"h":0.5},{"x":0,"y":0.5,"w":1,"h":0.5}]}]'::jsonb,
   2, TRUE)
ON CONFLICT (slug) DO NOTHING;
