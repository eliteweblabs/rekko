import type { APIRoute } from 'astro';
import { brandingLogoTextPngGet } from '../../../lib/brandingLogoTextRoute';

export const prerender = false;

export const GET: APIRoute = brandingLogoTextPngGet;
