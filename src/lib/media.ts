import type { Cover } from "@/data";
import type { DB } from "@/lib/db";

/** Uploads a cover that is still a local data: or blob: URL and returns the cover with a permanent address. YouTube links and already-hosted files pass through. */
export const persistCover = async (db: DB, cover: Cover, prefix: string): Promise<Cover> => {
    if (cover.kind === "none" || cover.kind === "youtube" || !/^(data|blob):/.test(cover.src)) return cover;
    const blob = await (await fetch(cover.src)).blob();
    const ext = blob.type.split("/")[1]?.replace("quicktime", "mov").replace("jpeg", "jpg") ?? "bin";
    const file = new File([blob], `${Date.now()}.${ext}`, { type: blob.type });
    const url = await db.upload(file, `${prefix}/${file.name}`);
    return { kind: cover.kind, src: url };
};
