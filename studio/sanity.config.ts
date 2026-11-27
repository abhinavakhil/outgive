import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { post } from "./schemaTypes/post";

export default defineConfig({
    name: "outgive",
    title: "Outgive blog",
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
    plugins: [structureTool(), visionTool()],
    schema: { types: [post] },
    document: {
        // "Open preview" on a post opens it on the live site.
        productionUrl: async (prev, { document }) => {
            const slug = (document as { slug?: { current?: string } }).slug?.current;
            return slug ? `https://www.outgive.tech/blog/${slug}` : prev;
        },
    },
});
