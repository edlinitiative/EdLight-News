import type { Draft, DraftStatus } from "@edlight-news/types";
import { type CreateDraft } from "@edlight-news/types";
export declare function create(data: CreateDraft): Promise<Draft>;
export declare function get(id: string): Promise<Draft | null>;
export declare function listAll(): Promise<Draft[]>;
export declare function listByStatus(status: DraftStatus): Promise<Draft[]>;
export declare function listByAuthor(authorId: string): Promise<Draft[]>;
export declare function update(id: string, data: Partial<CreateDraft>): Promise<void>;
export declare function updateStatus(id: string, status: DraftStatus): Promise<void>;
export declare function count(): Promise<number>;
//# sourceMappingURL=drafts.d.ts.map