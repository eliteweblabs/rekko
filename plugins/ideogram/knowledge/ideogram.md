# Ideogram — AI images & company logos

Requires **Ideogram** add-on and `IDEOGRAM_API_KEY` on the Railway service.

## Chat → Admin company logo (hands-off)

Preferred end-to-end flow for replacing the **header wordmark** without manual upload/crop:

1. **`generate_logo_concepts`** — `prompt` = brand brief, `save_to_media: true`, `num_images: 4` (design style, square).
2. Show the user concept URLs or media ids; pick one (or let them choose in chat).
3. **`apply_generated_logo_to_company`** — `media_id` from step 1, `slot: logo` (default). Traces raster → SVG when possible, then updates Admin → Company.
4. **`get_company_settings`** — confirm `logo_public_url` / branding.

If tracing fails (photo-real gradients, SVG too large), the apply tool can fall back to **raster logo** when `use_raster_fallback: true` (default).

Manual steps (same outcome):

- `trace_image_to_svg` — save traced SVG to the media library.
- `set_company_branding_from_media` — core tool; pass traced SVG or original PNG `media_id`, `slot: logo | icon | og`.

**OG share image** must stay raster — use `set_company_branding_from_media` with `slot: og` and a PNG/JPEG from Ideogram (not traced SVG).

## Other tools

| Tool | Use |
|------|-----|
| `generate_image` | General prompts; `save_to_media` for permanent `/api/media/{slug}` URLs |
| `remix_image` / `edit_image` | Refine a concept from `media_id` |
| `upscale_image` | Sharpen before trace (x2) |
| `describe_image` | Caption / prompt suggestion |
| `save_image_to_media` | Persist temporary Ideogram URLs |
| `generate_social_post_image` | Preset aspect ratios for posts |

## Tracing limits

Potrace works best on **flat, high-contrast** marks (design-style logo concepts). Soft shading and many colors produce huge or messy SVGs. Prompt for: white or solid background, minimal mark, vector-friendly, 1–2 ink colors.

## Website vs company logo

- **Company logo** — Admin → Company header (`/api/branding/logo`); use apply/trace flow above.
- **Site hero / page art** — media library + `write_github_file` in the website repo; do not confuse with company branding.
