import type { Pathway, PathwayGoalKey, DatasetCountry } from "@edlight-news/types";
import { type CreatePathway } from "@edlight-news/types";
export declare function create(data: CreatePathway): Promise<Pathway>;
export declare function get(id: string): Promise<Pathway | null>;
export declare function listAll(): Promise<Pathway[]>;
export declare function listByGoalKey(goalKey: PathwayGoalKey): Promise<Pathway[]>;
export declare function listByCountry(country: DatasetCountry): Promise<Pathway[]>;
export declare function update(id: string, data: Partial<CreatePathway>): Promise<void>;
/** Upsert by goalKey + country (used for seeding). */
export declare function upsertByGoalKey(data: CreatePathway): Promise<{
    pathway: Pathway;
    created: boolean;
}>;
export declare function count(): Promise<number>;
//# sourceMappingURL=pathways.d.ts.map