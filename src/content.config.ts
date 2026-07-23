import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),
		comment: z.boolean().optional().default(true),
		password: z.string().optional().default(""),
		passwordHint: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});

const projectsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
	schema: z.object({
		name: z.string(),
		subtitle: z.string(),
		status: z.string(),
		progress: z.number().min(0).max(100),
		updated: z.date(),
		repositoryUrl: z.string().optional(),
		description: z.string(),
		projectDescription: z.string(),
		mainWork: z.array(z.string()).default([]),
		projectResult: z.string(),
		highlights: z.array(z.string()).default([]),
		completedStages: z
			.array(
				z.object({
					name: z.string(),
					items: z.array(z.string()).default([]),
				}),
			)
			.default([]),
		nextStages: z.array(z.string()).default([]),
		skills: z.array(z.string()).default([]),
		draft: z.boolean().optional().default(false),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	projects: projectsCollection,
};
