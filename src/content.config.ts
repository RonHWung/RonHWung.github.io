import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const month = z.string().regex(/^\d{4}-\d{2}$/, '日期必须使用 YYYY-MM');
const media = z.object({
  src: z.string().startsWith('/media/'),
  alt: z.string().min(1),
  position: z.string().optional(),
});

const artworks = defineCollection({
  loader: glob({ base: './src/content/artworks', pattern: '**/*.md' }),
  schema: z.object({
    order: z.number().int().positive(),
    image: media,
    title: z.string().optional(),
    video: z.url().optional(),
    tools: z.array(z.string()).default([]),
    featured: z.boolean().default(true),
  }),
});

const moments = defineCollection({
  loader: glob({ base: './src/content/moments', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    date: month,
    order: z.number().int().default(10),
    kind: z.enum(['making', 'event', 'portrait', 'note']),
    makingFor: z.enum(['self', 'friend']).optional(),
    tags: z.array(z.string()).default([]),
    collections: z.array(z.enum(['making', 'campus', 'journeys', 'celebrations', 'portraits'])),
    summary: z.string().min(1),
    cover: media.optional(),
    images: z.array(media).default([]),
    featured: z.boolean().default(false),
    visibility: z.enum(['draft', 'approved']).default('approved'),
  }),
});

export const collections = { artworks, moments };
