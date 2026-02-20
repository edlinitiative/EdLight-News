import type { Asset } from "@edlight-news/types";
import { type CreateAsset } from "@edlight-news/types";
export declare function createAsset(data: CreateAsset): Promise<Asset>;
export declare function getAsset(id: string): Promise<Asset | null>;
export declare function listByContentVersion(contentVersionId: string): Promise<Asset[]>;
export declare function deleteAsset(id: string): Promise<void>;
//# sourceMappingURL=assets.d.ts.map