import type { Scholarship, DatasetCountry } from "@edlight-news/types";
import { type CreateScholarship } from "@edlight-news/types";
export declare function create(data: CreateScholarship): Promise<Scholarship>;
export declare function get(id: string): Promise<Scholarship | null>;
export declare function listAll(): Promise<Scholarship[]>;
export declare function listByCountry(country: DatasetCountry): Promise<Scholarship[]>;
/** List scholarships with deadlines within the next N days. */
export declare function listClosingSoon(days: number): Promise<Scholarship[]>;
/** List scholarships where HT is in eligibleCountries. */
export declare function listEligibleForHaiti(): Promise<Scholarship[]>;
export declare function update(id: string, data: Partial<CreateScholarship>): Promise<void>;
/** Upsert by name (used for seeding). */
export declare function upsertByName(data: CreateScholarship): Promise<{
    scholarship: Scholarship;
    created: boolean;
}>;
export declare function count(): Promise<number>;
//# sourceMappingURL=scholarships.d.ts.map