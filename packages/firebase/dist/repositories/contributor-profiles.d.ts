import type { ContributorProfile, ContributorRole } from "@edlight-news/types";
import { type CreateContributorProfile } from "@edlight-news/types";
export declare function create(data: CreateContributorProfile): Promise<ContributorProfile>;
export declare function get(id: string): Promise<ContributorProfile | null>;
export declare function getByEmail(email: string): Promise<ContributorProfile | null>;
export declare function listAll(): Promise<ContributorProfile[]>;
export declare function listVerified(): Promise<ContributorProfile[]>;
export declare function listByRole(role: ContributorRole): Promise<ContributorProfile[]>;
export declare function update(id: string, data: Partial<CreateContributorProfile>): Promise<void>;
export declare function count(): Promise<number>;
//# sourceMappingURL=contributor-profiles.d.ts.map