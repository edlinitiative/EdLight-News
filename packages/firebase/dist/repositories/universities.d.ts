import type { University, DatasetCountry } from "@edlight-news/types";
import { type CreateUniversity } from "@edlight-news/types";
export declare function create(data: CreateUniversity): Promise<University>;
export declare function get(id: string): Promise<University | null>;
export declare function listAll(): Promise<University[]>;
export declare function listByCountry(country: DatasetCountry): Promise<University[]>;
export declare function update(id: string, data: Partial<CreateUniversity>): Promise<void>;
/** Upsert by name + country (used for seeding). */
export declare function upsertByName(data: CreateUniversity): Promise<{
    university: University;
    created: boolean;
}>;
export declare function count(): Promise<number>;
export declare function countByCountry(country: DatasetCountry): Promise<number>;
//# sourceMappingURL=universities.d.ts.map