import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A blog post. Fields match the site's Post type (src/features/blog/posts.ts), which cms.tsx maps it onto.
 * Headings (H2) in the body become the article's "On this page" list.
 */
export const post = defineType({
    name: "post",
    title: "Blog post",
    type: "document",
    groups: [{ name: "main", title: "Post", default: true }, { name: "extras", title: "Answer, FAQ and sources" }],
    fields: [
        defineField({ name: "title", type: "string", group: "main", validation: (r) => r.required().max(110) }),
        defineField({ name: "slug", type: "slug", group: "main", description: "The address: outgive.tech/blog/<slug>", options: { source: "title", maxLength: 80 }, validation: (r) => r.required() }),
        defineField({ name: "description", title: "Summary", type: "text", rows: 3, group: "main", description: "Shown on the blog page and in Google results. Aim for 120 to 160 characters.", validation: (r) => r.required().max(220) }),
        defineField({
            name: "audience", title: "Written for", type: "string", group: "main", initialValue: "charities",
            options: { list: [{ title: "Charities", value: "charities" }, { title: "Fundraisers", value: "fundraisers" }, { title: "Donors", value: "donors" }], layout: "radio", direction: "horizontal" },
            validation: (r) => r.required(),
        }),
        defineField({ name: "publishedAt", title: "Published on", type: "date", group: "main", initialValue: () => new Date().toISOString().slice(0, 10), validation: (r) => r.required() }),
        defineField({ name: "updatedAt", title: "Last checked on", type: "date", group: "main", description: "Change this when you re-check facts or figures in the post." }),
        defineField({ name: "author", type: "string", group: "main", description: "Leave empty to show “The Outgive team”." }),
        defineField({
            name: "cover", title: "Cover image", type: "image", group: "main", options: { hotspot: true },
            description: "Optional. Without one, the post gets a coloured card for its audience. Best at 1600×1000 or wider.",
            fields: [defineField({ name: "alt", title: "Describe the image", type: "string" })],
        }),
        defineField({
            name: "body", type: "array", group: "main", validation: (r) => r.required(),
            of: [
                defineArrayMember({
                    type: "block",
                    styles: [{ title: "Paragraph", value: "normal" }, { title: "Heading", value: "h2" }, { title: "Subheading", value: "h3" }, { title: "Quote", value: "blockquote" }],
                    marks: { annotations: [{ name: "link", type: "object", title: "Link", fields: [{ name: "href", type: "url", title: "Address", validation: (r) => r.uri({ scheme: ["http", "https", "mailto"], allowRelative: true }) }] }] },
                }),
                defineArrayMember({ type: "image", options: { hotspot: true }, fields: [{ name: "alt", type: "string", title: "Describe the image" }, { name: "caption", type: "string" }] }),
                defineArrayMember({
                    name: "note", title: "Highlighted note", type: "object",
                    fields: [{ name: "title", type: "string", initialValue: "Tip" }, { name: "text", type: "text", rows: 3 }],
                    preview: { select: { title: "title", subtitle: "text" } },
                }),
            ],
        }),
        defineField({ name: "answer", title: "The short answer", type: "text", rows: 4, group: "extras", description: "Two or three sentences under the title that answer the question directly. Search engines and AI assistants quote this." }),
        defineField({ name: "takeaways", title: "Key takeaways", type: "array", group: "extras", of: [{ type: "string" }] }),
        defineField({
            name: "faq", title: "Frequently asked questions", type: "array", group: "extras",
            of: [{ type: "object", fields: [{ name: "question", type: "string" }, { name: "answer", type: "text", rows: 3 }], preview: { select: { title: "question", subtitle: "answer" } } }],
        }),
        defineField({
            name: "sources", type: "array", group: "extras",
            of: [{ type: "object", fields: [{ name: "name", type: "string" }, { name: "url", type: "url" }], preview: { select: { title: "name", subtitle: "url" } } }],
        }),
    ],
    orderings: [{ title: "Newest first", name: "newest", by: [{ field: "publishedAt", direction: "desc" }] }],
    preview: { select: { title: "title", subtitle: "audience", media: "cover" } },
});
