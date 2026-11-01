# Ideogram AI images

Custom image generation for pages, decks, social posts, and logos via Ideogram 3 on the Reave App server (`IDEOGRAM_API_KEY` — never expose to the browser).

## Requirements

1. `ideogram` in install config `features[]`, **or** `website` (bundles image tools with the client website pack)
2. `IDEOGRAM_API_KEY` on the Reave App Railway service
3. Optional: `IDEOGRAM_MODEL` (default `ideogram-3`)

When the **ideogram** (or **website**) module is on, all tools below are registered for the agent and this playbook is visible. If `IDEOGRAM_API_KEY` is missing, calls return a configuration error until the key is set on the Reave App service.

## When to use which tool

| Need | Tool |
|------|------|
| New image from a text prompt | `generate_image` |
| Several concepts at once | `generate_image_variations` or `generate_image` with `num_images` |
| Logo / brand mark concepts | `generate_logo_concepts` |
| Instagram / social sizing | `generate_social_post_image` (`format`: square, portrait, story, landscape, feed, pin) |
| Keep a permanent URL | `generate_image` with **`save_to_media: true`**, or `save_image_to_media` after generate |
| Change an existing image with a prompt | `remix_image` |
| Enlarge resolution | `upscale_image` (`upscale_factor`: x2, x4, x8) |
| Inpaint a region | `edit_image` with `mask_url` / `mask_media_id` / `mask_base64` (black = repaint) |
| Inpaint unavailable | `edit_image` without mask → remix |
| Reverse-engineer a prompt | `describe_image` |
| Attach to a client project | `save_image_to_project` (project `slug` + image source) |
| Browse past saves | `list_generated_images` (media library rows tagged `ideogram`) |

## Image inputs (remix, upscale, edit, describe, save)

Provide **one** of:

- `url` — public HTTPS URL (Ideogram temporary links work briefly)
- `media_id` — media library UUID or slug
- `data_base64` — raw or `data:image/…;base64,…`

## Media library workflow (required for the live site)

Ideogram CDN URLs **expire**. For anything the owner will use on the website or in a deck:

1. Generate with `save_to_media: true`, **or**
2. `generate_image` then `save_image_to_media` on each `url`
3. Set a stable **slug** when saving; reference **`/api/media/{slug}`** from the website repo (see `content-management` Images section)
4. Do **not** commit large hero images to the website git repo

Saved Ideogram rows use media category `ideogram` and appear in Admin → Media like other uploads.

## Shortcuts

- **`generate_logo_concepts`** — design style, square, default 4 variations; pass `prompt` or `brand`
- **`generate_social_post_image`** — prepends social-safe art direction; picks aspect from `format`

## Admin → Company logo (header wordmark)

1. `generate_image` with `save_to_media: true` (square logo concepts: `generate_logo_concepts`)
2. `set_company_branding_from_media` with `media_id` and `slot: "logo"` — no manual upload/crop
3. Optional: `get_company_settings` to confirm `logo_public_url`

Site repo hero/inline images still use `/api/media/{slug}` via `write_github_file` — that is separate from the header logo in Company settings.

## Pair with website editor

When updating site imagery: `generate_image` (with `save_to_media`) → note `publicUrl` / slug → `write_github_file` to point the page at `/api/media/{slug}`. Stock alternative: `search_stock_photos` (Pexels attribution rules apply).

## Health

`GET /api/health` reports `ideogram` configured when `IDEOGRAM_API_KEY` is set.

## Common mistakes

- Claiming Ideogram is unavailable without checking this install’s tool manifest (`GET /api/admin/agent-tools` when signed in) or calling `list_knowledge` / `read_knowledge` slug `ideogram`
- Using expired Ideogram URLs on the live site instead of the media library
- Confusing **Cursor’s** Ideogram MCP (developer docs only) with **Reave admin chat** tools on the deployed app
