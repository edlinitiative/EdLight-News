import { z } from "zod";
/** Firestore Timestamp is validated as an object with seconds & nanoseconds */
declare const timestampSchema: z.ZodObject<{
    seconds: z.ZodNumber;
    nanoseconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    seconds: number;
    nanoseconds: number;
}, {
    seconds: number;
    nanoseconds: number;
}>;
declare const citationSchema: z.ZodObject<{
    sourceName: z.ZodString;
    sourceUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceName: string;
    sourceUrl: string;
}, {
    sourceName: string;
    sourceUrl: string;
}>;
declare const qualityFlagsSchema: z.ZodObject<{
    hasSourceUrl: z.ZodBoolean;
    needsReview: z.ZodBoolean;
    lowConfidence: z.ZodBoolean;
    weakSource: z.ZodOptional<z.ZodBoolean>;
    missingDeadline: z.ZodOptional<z.ZodBoolean>;
    offMission: z.ZodOptional<z.ZodBoolean>;
    reasons: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    hasSourceUrl: boolean;
    needsReview: boolean;
    lowConfidence: boolean;
    reasons: string[];
    weakSource?: boolean | undefined;
    missingDeadline?: boolean | undefined;
    offMission?: boolean | undefined;
}, {
    hasSourceUrl: boolean;
    needsReview: boolean;
    lowConfidence: boolean;
    reasons: string[];
    weakSource?: boolean | undefined;
    missingDeadline?: boolean | undefined;
    offMission?: boolean | undefined;
}>;
declare const sourceSelectorsSchema: z.ZodObject<{
    listItem: z.ZodOptional<z.ZodString>;
    articleBody: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    listItem?: string | undefined;
    articleBody?: string | undefined;
    title?: string | undefined;
}, {
    listItem?: string | undefined;
    articleBody?: string | undefined;
    title?: string | undefined;
}>;
declare const geoTagSchema: z.ZodEnum<["HT", "Diaspora", "Global"]>;
declare const imageSourceSchema: z.ZodEnum<["publisher", "wikidata", "branded", "screenshot"]>;
declare const imageMetaSchema: z.ZodObject<{
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    fetchedAt: z.ZodOptional<z.ZodString>;
    originalImageUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    width?: number | undefined;
    height?: number | undefined;
    fetchedAt?: string | undefined;
    originalImageUrl?: string | undefined;
}, {
    width?: number | undefined;
    height?: number | undefined;
    fetchedAt?: string | undefined;
    originalImageUrl?: string | undefined;
}>;
declare const imageAttributionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    license: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    url?: string | undefined;
    license?: string | undefined;
}, {
    name?: string | undefined;
    url?: string | undefined;
    license?: string | undefined;
}>;
declare const entityRefSchema: z.ZodObject<{
    personName: z.ZodOptional<z.ZodString>;
    wikidataId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    personName?: string | undefined;
    wikidataId?: string | undefined;
}, {
    personName?: string | undefined;
    wikidataId?: string | undefined;
}>;
declare const itemSourceSchema: z.ZodObject<{
    name: z.ZodString;
    originalUrl: z.ZodString;
    aggregatorUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    originalUrl: string;
    aggregatorUrl?: string | undefined;
}, {
    name: string;
    originalUrl: string;
    aggregatorUrl?: string | undefined;
}>;
declare const opportunitySchema: z.ZodObject<{
    deadline: z.ZodOptional<z.ZodString>;
    eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    coverage: z.ZodOptional<z.ZodString>;
    howToApply: z.ZodOptional<z.ZodString>;
    officialLink: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deadline?: string | undefined;
    eligibility?: string[] | undefined;
    coverage?: string | undefined;
    howToApply?: string | undefined;
    officialLink?: string | undefined;
}, {
    deadline?: string | undefined;
    eligibility?: string[] | undefined;
    coverage?: string | undefined;
    howToApply?: string | undefined;
    officialLink?: string | undefined;
}>;
declare const synthesisSourceRefSchema: z.ZodObject<{
    itemId: z.ZodString;
    title: z.ZodString;
    sourceName: z.ZodString;
    publishedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sourceName: string;
    title: string;
    itemId: string;
    publishedAt?: string | undefined;
}, {
    sourceName: string;
    title: string;
    itemId: string;
    publishedAt?: string | undefined;
}>;
declare const synthesisMetaSchema: z.ZodObject<{
    sourceItemIds: z.ZodArray<z.ZodString, "many">;
    sourceCount: z.ZodNumber;
    publisherDomains: z.ZodArray<z.ZodString, "many">;
    model: z.ZodString;
    promptVersion: z.ZodString;
    validationPassed: z.ZodBoolean;
    lastSynthesizedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceItemIds: string[];
    sourceCount: number;
    publisherDomains: string[];
    model: string;
    promptVersion: string;
    validationPassed: boolean;
    lastSynthesizedAt: string;
}, {
    sourceItemIds: string[];
    sourceCount: number;
    publisherDomains: string[];
    model: string;
    promptVersion: string;
    validationPassed: boolean;
    lastSynthesizedAt: string;
}>;
declare const contentSectionSchema: z.ZodObject<{
    heading: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    heading: string;
    content: string;
}, {
    heading: string;
    content: string;
}>;
export declare const sourceCitationSchema: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    url: string;
}, {
    name: string;
    url: string;
}>;
export declare const utilitySeriesSchema: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
export declare const utilityTypeSchema: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>;
export declare const utilityAudienceSchema: z.ZodEnum<["lycee", "universite", "international"]>;
export declare const utilityRegionSchema: z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>;
export declare const utilityCitationSchema: z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    label: string;
}, {
    url: string;
    label: string;
}>;
export declare const extractedFactsSchema: z.ZodObject<{
    deadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        dateISO: z.ZodString;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }, {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }>, "many">>;
    requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    eligibility?: string[] | undefined;
    deadlines?: {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }[] | undefined;
    requirements?: string[] | undefined;
    steps?: string[] | undefined;
}, {
    eligibility?: string[] | undefined;
    deadlines?: {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }[] | undefined;
    requirements?: string[] | undefined;
    steps?: string[] | undefined;
}>;
export declare const utilityMetaSchema: z.ZodObject<{
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
    utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>;
    region: z.ZodOptional<z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">>;
    audience: z.ZodOptional<z.ZodArray<z.ZodEnum<["lycee", "universite", "international"]>, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    citations: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    extractedFacts: z.ZodOptional<z.ZodObject<{
        deadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            dateISO: z.ZodString;
            sourceUrl: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }, {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }>, "many">>;
        requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
    }, {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
    }>>;
    rotationKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
    citations: {
        url: string;
        label: string;
    }[];
    region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
    audience?: ("lycee" | "universite" | "international")[] | undefined;
    tags?: string[] | undefined;
    extractedFacts?: {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
    } | undefined;
    rotationKey?: string | undefined;
}, {
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
    citations: {
        url: string;
        label: string;
    }[];
    region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
    audience?: ("lycee" | "universite" | "international")[] | undefined;
    tags?: string[] | undefined;
    extractedFacts?: {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
    } | undefined;
    rotationKey?: string | undefined;
}>;
export declare const utilitySourceSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["rss", "html", "pdf", "calendar"]>;
    allowlistDomain: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    region: z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">;
    utilityTypes: z.ZodArray<z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>, "many">;
    parsingHints: z.ZodOptional<z.ZodObject<{
        selectorMain: z.ZodOptional<z.ZodString>;
        selectorDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    }, {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    }>>;
    active: z.ZodBoolean;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "rss" | "html" | "pdf" | "calendar";
    url: string;
    label: string;
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    id: string;
    allowlistDomain: string;
    priority: number;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile")[];
    active: boolean;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    rotationKey?: string | undefined;
    parsingHints?: {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    } | undefined;
}, {
    type: "rss" | "html" | "pdf" | "calendar";
    url: string;
    label: string;
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    id: string;
    allowlistDomain: string;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile")[];
    active: boolean;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    rotationKey?: string | undefined;
    priority?: number | undefined;
    parsingHints?: {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    } | undefined;
}>;
export declare const utilityQueueEntrySchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "done", "failed"]>;
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    langTargets: z.ZodArray<z.ZodEnum<["fr", "ht"]>, "many">;
    sourceIds: z.ZodArray<z.ZodString, "many">;
    runAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    attempts: z.ZodNumber;
    lastError: z.ZodOptional<z.ZodString>;
    failReasons: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "processing" | "done" | "failed";
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    langTargets: ("fr" | "ht")[];
    sourceIds: string[];
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    rotationKey?: string | undefined;
    lastError?: string | undefined;
    failReasons?: string[] | undefined;
}, {
    status: "queued" | "processing" | "done" | "failed";
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    langTargets: ("fr" | "ht")[];
    sourceIds: string[];
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    rotationKey?: string | undefined;
    lastError?: string | undefined;
    failReasons?: string[] | undefined;
}>;
export declare const sourceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    type: z.ZodEnum<["rss", "html"]>;
    selector: z.ZodOptional<z.ZodString>;
    selectors: z.ZodOptional<z.ZodObject<{
        listItem: z.ZodOptional<z.ZodString>;
        articleBody: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    }, {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    }>>;
    language: z.ZodEnum<["fr", "ht"]>;
    active: z.ZodBoolean;
    pollCadenceSec: z.ZodDefault<z.ZodNumber>;
    priority: z.ZodDefault<z.ZodEnum<["hot", "normal"]>>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "rss" | "html";
    name: string;
    url: string;
    id: string;
    priority: "hot" | "normal";
    active: boolean;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    language: "fr" | "ht";
    pollCadenceSec: number;
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
}, {
    type: "rss" | "html";
    name: string;
    url: string;
    id: string;
    active: boolean;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    language: "fr" | "ht";
    priority?: "hot" | "normal" | undefined;
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
    pollCadenceSec?: number | undefined;
}>;
export declare const rawItemSchema: z.ZodObject<{
    id: z.ZodString;
    sourceId: z.ZodString;
    hash: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    description: z.ZodString;
    publishedAt: z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>;
    status: z.ZodEnum<["new", "processed", "skipped"]>;
    skipReason: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "new" | "processed" | "skipped";
    title: string;
    url: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    hash: string;
    description: string;
    skipReason?: string | undefined;
}, {
    status: "new" | "processed" | "skipped";
    title: string;
    url: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    hash: string;
    description: string;
    skipReason?: string | undefined;
}>;
export declare const itemSchema: z.ZodObject<{
    id: z.ZodString;
    rawItemId: z.ZodString;
    sourceId: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    canonicalUrl: z.ZodString;
    extractedText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news", "bourses", "concours", "stages", "programmes"]>;
    deadline: z.ZodNullable<z.ZodString>;
    evergreen: z.ZodBoolean;
    confidence: z.ZodNumber;
    qualityFlags: z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        weakSource: z.ZodOptional<z.ZodBoolean>;
        missingDeadline: z.ZodOptional<z.ZodBoolean>;
        offMission: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }>;
    citations: z.ZodArray<z.ZodObject<{
        sourceName: z.ZodString;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        sourceUrl: string;
    }, {
        sourceName: string;
        sourceUrl: string;
    }>, "many">;
    vertical: z.ZodOptional<z.ZodString>;
    geoTag: z.ZodOptional<z.ZodEnum<["HT", "Diaspora", "Global"]>>;
    audienceFitScore: z.ZodOptional<z.ZodNumber>;
    dedupeGroupId: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        originalUrl: z.ZodString;
        aggregatorUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    }, {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    }>>;
    opportunity: z.ZodOptional<z.ZodObject<{
        deadline: z.ZodOptional<z.ZodString>;
        eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        coverage: z.ZodOptional<z.ZodString>;
        howToApply: z.ZodOptional<z.ZodString>;
        officialLink: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    }, {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    }>>;
    publishedAt: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageSource: z.ZodOptional<z.ZodEnum<["publisher", "wikidata", "branded", "screenshot"]>>;
    imageConfidence: z.ZodOptional<z.ZodNumber>;
    imageMeta: z.ZodOptional<z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fetchedAt: z.ZodOptional<z.ZodString>;
        originalImageUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    }, {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    }>>;
    imageAttribution: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        license: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    }, {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    }>>;
    entity: z.ZodOptional<z.ZodObject<{
        personName: z.ZodOptional<z.ZodString>;
        wikidataId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    }, {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    }>>;
    itemType: z.ZodOptional<z.ZodEnum<["source", "synthesis", "utility"]>>;
    clusterId: z.ZodOptional<z.ZodString>;
    synthesisMeta: z.ZodOptional<z.ZodObject<{
        sourceItemIds: z.ZodArray<z.ZodString, "many">;
        sourceCount: z.ZodNumber;
        publisherDomains: z.ZodArray<z.ZodString, "many">;
        model: z.ZodString;
        promptVersion: z.ZodString;
        validationPassed: z.ZodBoolean;
        lastSynthesizedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    }, {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    }>>;
    utilityMeta: z.ZodOptional<z.ZodObject<{
        series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
        utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>;
        region: z.ZodOptional<z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">>;
        audience: z.ZodOptional<z.ZodArray<z.ZodEnum<["lycee", "universite", "international"]>, "many">>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        citations: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            label: string;
        }, {
            url: string;
            label: string;
        }>, "many">;
        extractedFacts: z.ZodOptional<z.ZodObject<{
            deadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                dateISO: z.ZodString;
                sourceUrl: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }, {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }>, "many">>;
            requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        }, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        }>>;
        rotationKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    }, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    }>>;
    lastMajorUpdateAt: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>>;
    effectiveDate: z.ZodOptional<z.ZodString>;
    sourceList: z.ZodOptional<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        title: z.ZodString;
        sourceName: z.ZodString;
        publishedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }, {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }>, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    title: string;
    deadline: string | null;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes";
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    };
    source?: {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    } | undefined;
    opportunity?: {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    } | undefined;
    publishedAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
    imageUrl?: string | null | undefined;
    imageSource?: "publisher" | "wikidata" | "branded" | "screenshot" | undefined;
    imageConfidence?: number | undefined;
    imageMeta?: {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    } | undefined;
    imageAttribution?: {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    } | undefined;
    entity?: {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    } | undefined;
    itemType?: "source" | "synthesis" | "utility" | undefined;
    clusterId?: string | undefined;
    synthesisMeta?: {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    } | undefined;
    utilityMeta?: {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    } | undefined;
    lastMajorUpdateAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    effectiveDate?: string | undefined;
    sourceList?: {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }[] | undefined;
}, {
    title: string;
    deadline: string | null;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes";
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    };
    source?: {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    } | undefined;
    opportunity?: {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    } | undefined;
    publishedAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
    imageUrl?: string | null | undefined;
    imageSource?: "publisher" | "wikidata" | "branded" | "screenshot" | undefined;
    imageConfidence?: number | undefined;
    imageMeta?: {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    } | undefined;
    imageAttribution?: {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    } | undefined;
    entity?: {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    } | undefined;
    itemType?: "source" | "synthesis" | "utility" | undefined;
    clusterId?: string | undefined;
    synthesisMeta?: {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    } | undefined;
    utilityMeta?: {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    } | undefined;
    lastMajorUpdateAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    effectiveDate?: string | undefined;
    sourceList?: {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }[] | undefined;
}>;
export declare const contentVersionSchema: z.ZodObject<{
    id: z.ZodString;
    itemId: z.ZodString;
    channel: z.ZodEnum<["web", "ig", "wa"]>;
    language: z.ZodEnum<["fr", "ht"]>;
    title: z.ZodString;
    summary: z.ZodString;
    body: z.ZodString;
    status: z.ZodEnum<["draft", "review", "published"]>;
    draftReason: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news", "bourses", "concours", "stages", "programmes"]>>;
    qualityFlags: z.ZodOptional<z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        weakSource: z.ZodOptional<z.ZodBoolean>;
        missingDeadline: z.ZodOptional<z.ZodBoolean>;
        offMission: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }>>;
    citations: z.ZodArray<z.ZodObject<{
        sourceName: z.ZodString;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        sourceUrl: string;
    }, {
        sourceName: string;
        sourceUrl: string;
    }>, "many">;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        content: string;
    }, {
        heading: string;
        content: string;
    }>, "many">>;
    whatChanged: z.ZodOptional<z.ZodString>;
    synthesisTags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceCitations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "review" | "published";
    title: string;
    itemId: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    language: "fr" | "ht";
    summary: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    } | undefined;
    draftReason?: string | undefined;
    sections?: {
        heading: string;
        content: string;
    }[] | undefined;
    whatChanged?: string | undefined;
    synthesisTags?: string[] | undefined;
    sourceCitations?: {
        name: string;
        url: string;
    }[] | undefined;
}, {
    status: "draft" | "review" | "published";
    title: string;
    itemId: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    language: "fr" | "ht";
    summary: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    } | undefined;
    draftReason?: string | undefined;
    sections?: {
        heading: string;
        content: string;
    }[] | undefined;
    whatChanged?: string | undefined;
    synthesisTags?: string[] | undefined;
    sourceCitations?: {
        name: string;
        url: string;
    }[] | undefined;
}>;
export declare const assetSchema: z.ZodObject<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    type: z.ZodEnum<["carousel_image", "story_image"]>;
    url: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "carousel_image" | "story_image";
    width: number;
    height: number;
    url: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
}, {
    type: "carousel_image" | "story_image";
    width: number;
    height: number;
    url: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
}>;
export declare const publishQueueEntrySchema: z.ZodObject<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    target: z.ZodEnum<["ig", "wa"]>;
    status: z.ZodEnum<["pending", "in_progress", "done", "failed"]>;
    scheduledAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    attemptCount: z.ZodNumber;
    lastError: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "done" | "failed" | "pending" | "in_progress";
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
    target: "ig" | "wa";
    scheduledAt: {
        seconds: number;
        nanoseconds: number;
    };
    attemptCount: number;
    lastError?: string | undefined;
    completedAt?: {
        seconds: number;
        nanoseconds: number;
    } | undefined;
}, {
    status: "done" | "failed" | "pending" | "in_progress";
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
    target: "ig" | "wa";
    scheduledAt: {
        seconds: number;
        nanoseconds: number;
    };
    attemptCount: number;
    lastError?: string | undefined;
    completedAt?: {
        seconds: number;
        nanoseconds: number;
    } | undefined;
}>;
export declare const metricSchema: z.ZodObject<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    channel: z.ZodEnum<["web", "ig", "wa"]>;
    views: z.ZodNumber;
    clicks: z.ZodNumber;
    shares: z.ZodNumber;
    recordedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    channel: "web" | "ig" | "wa";
    contentVersionId: string;
    views: number;
    clicks: number;
    shares: number;
    recordedAt: {
        seconds: number;
        nanoseconds: number;
    };
}, {
    id: string;
    channel: "web" | "ig" | "wa";
    contentVersionId: string;
    views: number;
    clicks: number;
    shares: number;
    recordedAt: {
        seconds: number;
        nanoseconds: number;
    };
}>;
export { citationSchema, contentSectionSchema, entityRefSchema, geoTagSchema, imageAttributionSchema, imageMetaSchema, imageSourceSchema, itemSourceSchema, opportunitySchema, qualityFlagsSchema, sourceSelectorsSchema, synthesisMetaSchema, synthesisSourceRefSchema, timestampSchema, };
export declare const createSourceSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    type: z.ZodEnum<["rss", "html"]>;
    selector: z.ZodOptional<z.ZodString>;
    selectors: z.ZodOptional<z.ZodObject<{
        listItem: z.ZodOptional<z.ZodString>;
        articleBody: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    }, {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    }>>;
    language: z.ZodEnum<["fr", "ht"]>;
    active: z.ZodBoolean;
    pollCadenceSec: z.ZodDefault<z.ZodNumber>;
    priority: z.ZodDefault<z.ZodEnum<["hot", "normal"]>>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    type: "rss" | "html";
    name: string;
    url: string;
    priority: "hot" | "normal";
    active: boolean;
    language: "fr" | "ht";
    pollCadenceSec: number;
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
}, {
    type: "rss" | "html";
    name: string;
    url: string;
    active: boolean;
    language: "fr" | "ht";
    priority?: "hot" | "normal" | undefined;
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
    pollCadenceSec?: number | undefined;
}>;
export declare const createRawItemSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    sourceId: z.ZodString;
    hash: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    description: z.ZodString;
    publishedAt: z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>;
    status: z.ZodEnum<["new", "processed", "skipped"]>;
    skipReason: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    status: "new" | "processed" | "skipped";
    title: string;
    url: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    sourceId: string;
    hash: string;
    description: string;
    skipReason?: string | undefined;
}, {
    status: "new" | "processed" | "skipped";
    title: string;
    url: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    sourceId: string;
    hash: string;
    description: string;
    skipReason?: string | undefined;
}>;
export declare const createItemSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    rawItemId: z.ZodString;
    sourceId: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    canonicalUrl: z.ZodString;
    extractedText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news", "bourses", "concours", "stages", "programmes"]>;
    deadline: z.ZodNullable<z.ZodString>;
    evergreen: z.ZodBoolean;
    confidence: z.ZodNumber;
    qualityFlags: z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        weakSource: z.ZodOptional<z.ZodBoolean>;
        missingDeadline: z.ZodOptional<z.ZodBoolean>;
        offMission: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }>;
    citations: z.ZodArray<z.ZodObject<{
        sourceName: z.ZodString;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        sourceUrl: string;
    }, {
        sourceName: string;
        sourceUrl: string;
    }>, "many">;
    vertical: z.ZodOptional<z.ZodString>;
    geoTag: z.ZodOptional<z.ZodEnum<["HT", "Diaspora", "Global"]>>;
    audienceFitScore: z.ZodOptional<z.ZodNumber>;
    dedupeGroupId: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        originalUrl: z.ZodString;
        aggregatorUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    }, {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    }>>;
    opportunity: z.ZodOptional<z.ZodObject<{
        deadline: z.ZodOptional<z.ZodString>;
        eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        coverage: z.ZodOptional<z.ZodString>;
        howToApply: z.ZodOptional<z.ZodString>;
        officialLink: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    }, {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    }>>;
    publishedAt: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageSource: z.ZodOptional<z.ZodEnum<["publisher", "wikidata", "branded", "screenshot"]>>;
    imageConfidence: z.ZodOptional<z.ZodNumber>;
    imageMeta: z.ZodOptional<z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fetchedAt: z.ZodOptional<z.ZodString>;
        originalImageUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    }, {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    }>>;
    imageAttribution: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        license: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    }, {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    }>>;
    entity: z.ZodOptional<z.ZodObject<{
        personName: z.ZodOptional<z.ZodString>;
        wikidataId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    }, {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    }>>;
    itemType: z.ZodOptional<z.ZodEnum<["source", "synthesis", "utility"]>>;
    clusterId: z.ZodOptional<z.ZodString>;
    synthesisMeta: z.ZodOptional<z.ZodObject<{
        sourceItemIds: z.ZodArray<z.ZodString, "many">;
        sourceCount: z.ZodNumber;
        publisherDomains: z.ZodArray<z.ZodString, "many">;
        model: z.ZodString;
        promptVersion: z.ZodString;
        validationPassed: z.ZodBoolean;
        lastSynthesizedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    }, {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    }>>;
    utilityMeta: z.ZodOptional<z.ZodObject<{
        series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
        utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>;
        region: z.ZodOptional<z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">>;
        audience: z.ZodOptional<z.ZodArray<z.ZodEnum<["lycee", "universite", "international"]>, "many">>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        citations: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            label: string;
        }, {
            url: string;
            label: string;
        }>, "many">;
        extractedFacts: z.ZodOptional<z.ZodObject<{
            deadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                dateISO: z.ZodString;
                sourceUrl: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }, {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }>, "many">>;
            requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            eligibility: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        }, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        }>>;
        rotationKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    }, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    }>>;
    lastMajorUpdateAt: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>>;
    effectiveDate: z.ZodOptional<z.ZodString>;
    sourceList: z.ZodOptional<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        title: z.ZodString;
        sourceName: z.ZodString;
        publishedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }, {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }>, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    title: string;
    deadline: string | null;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes";
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    };
    source?: {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    } | undefined;
    opportunity?: {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    } | undefined;
    publishedAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
    imageUrl?: string | null | undefined;
    imageSource?: "publisher" | "wikidata" | "branded" | "screenshot" | undefined;
    imageConfidence?: number | undefined;
    imageMeta?: {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    } | undefined;
    imageAttribution?: {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    } | undefined;
    entity?: {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    } | undefined;
    itemType?: "source" | "synthesis" | "utility" | undefined;
    clusterId?: string | undefined;
    synthesisMeta?: {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    } | undefined;
    utilityMeta?: {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    } | undefined;
    lastMajorUpdateAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    effectiveDate?: string | undefined;
    sourceList?: {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }[] | undefined;
}, {
    title: string;
    deadline: string | null;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes";
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    };
    source?: {
        name: string;
        originalUrl: string;
        aggregatorUrl?: string | undefined;
    } | undefined;
    opportunity?: {
        deadline?: string | undefined;
        eligibility?: string[] | undefined;
        coverage?: string | undefined;
        howToApply?: string | undefined;
        officialLink?: string | undefined;
    } | undefined;
    publishedAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
    imageUrl?: string | null | undefined;
    imageSource?: "publisher" | "wikidata" | "branded" | "screenshot" | undefined;
    imageConfidence?: number | undefined;
    imageMeta?: {
        width?: number | undefined;
        height?: number | undefined;
        fetchedAt?: string | undefined;
        originalImageUrl?: string | undefined;
    } | undefined;
    imageAttribution?: {
        name?: string | undefined;
        url?: string | undefined;
        license?: string | undefined;
    } | undefined;
    entity?: {
        personName?: string | undefined;
        wikidataId?: string | undefined;
    } | undefined;
    itemType?: "source" | "synthesis" | "utility" | undefined;
    clusterId?: string | undefined;
    synthesisMeta?: {
        sourceItemIds: string[];
        sourceCount: number;
        publisherDomains: string[];
        model: string;
        promptVersion: string;
        validationPassed: boolean;
        lastSynthesizedAt: string;
    } | undefined;
    utilityMeta?: {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile";
        citations: {
            url: string;
            label: string;
        }[];
        region?: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[] | undefined;
        audience?: ("lycee" | "universite" | "international")[] | undefined;
        tags?: string[] | undefined;
        extractedFacts?: {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
    } | undefined;
    lastMajorUpdateAt?: {
        seconds: number;
        nanoseconds: number;
    } | null | undefined;
    effectiveDate?: string | undefined;
    sourceList?: {
        sourceName: string;
        title: string;
        itemId: string;
        publishedAt?: string | undefined;
    }[] | undefined;
}>;
export declare const createContentVersionSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    itemId: z.ZodString;
    channel: z.ZodEnum<["web", "ig", "wa"]>;
    language: z.ZodEnum<["fr", "ht"]>;
    title: z.ZodString;
    summary: z.ZodString;
    body: z.ZodString;
    status: z.ZodEnum<["draft", "review", "published"]>;
    draftReason: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news", "bourses", "concours", "stages", "programmes"]>>;
    qualityFlags: z.ZodOptional<z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        weakSource: z.ZodOptional<z.ZodBoolean>;
        missingDeadline: z.ZodOptional<z.ZodBoolean>;
        offMission: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    }>>;
    citations: z.ZodArray<z.ZodObject<{
        sourceName: z.ZodString;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceName: string;
        sourceUrl: string;
    }, {
        sourceName: string;
        sourceUrl: string;
    }>, "many">;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        content: string;
    }, {
        heading: string;
        content: string;
    }>, "many">>;
    whatChanged: z.ZodOptional<z.ZodString>;
    synthesisTags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceCitations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    status: "draft" | "review" | "published";
    title: string;
    itemId: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    language: "fr" | "ht";
    summary: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    } | undefined;
    draftReason?: string | undefined;
    sections?: {
        heading: string;
        content: string;
    }[] | undefined;
    whatChanged?: string | undefined;
    synthesisTags?: string[] | undefined;
    sourceCitations?: {
        name: string;
        url: string;
    }[] | undefined;
}, {
    status: "draft" | "review" | "published";
    title: string;
    itemId: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    language: "fr" | "ht";
    summary: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
        weakSource?: boolean | undefined;
        missingDeadline?: boolean | undefined;
        offMission?: boolean | undefined;
    } | undefined;
    draftReason?: string | undefined;
    sections?: {
        heading: string;
        content: string;
    }[] | undefined;
    whatChanged?: string | undefined;
    synthesisTags?: string[] | undefined;
    sourceCitations?: {
        name: string;
        url: string;
    }[] | undefined;
}>;
export declare const createAssetSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    type: z.ZodEnum<["carousel_image", "story_image"]>;
    url: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    type: "carousel_image" | "story_image";
    width: number;
    height: number;
    url: string;
    contentVersionId: string;
}, {
    type: "carousel_image" | "story_image";
    width: number;
    height: number;
    url: string;
    contentVersionId: string;
}>;
export declare const createPublishQueueEntrySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    target: z.ZodEnum<["ig", "wa"]>;
    status: z.ZodEnum<["pending", "in_progress", "done", "failed"]>;
    scheduledAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    attemptCount: z.ZodNumber;
    lastError: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt">, "strip", z.ZodTypeAny, {
    status: "done" | "failed" | "pending" | "in_progress";
    contentVersionId: string;
    target: "ig" | "wa";
    scheduledAt: {
        seconds: number;
        nanoseconds: number;
    };
    attemptCount: number;
    lastError?: string | undefined;
    completedAt?: {
        seconds: number;
        nanoseconds: number;
    } | undefined;
}, {
    status: "done" | "failed" | "pending" | "in_progress";
    contentVersionId: string;
    target: "ig" | "wa";
    scheduledAt: {
        seconds: number;
        nanoseconds: number;
    };
    attemptCount: number;
    lastError?: string | undefined;
    completedAt?: {
        seconds: number;
        nanoseconds: number;
    } | undefined;
}>;
export declare const createMetricSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    contentVersionId: z.ZodString;
    channel: z.ZodEnum<["web", "ig", "wa"]>;
    views: z.ZodNumber;
    clicks: z.ZodNumber;
    shares: z.ZodNumber;
    recordedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id">, "strip", z.ZodTypeAny, {
    channel: "web" | "ig" | "wa";
    contentVersionId: string;
    views: number;
    clicks: number;
    shares: number;
    recordedAt: {
        seconds: number;
        nanoseconds: number;
    };
}, {
    channel: "web" | "ig" | "wa";
    contentVersionId: string;
    views: number;
    clicks: number;
    shares: number;
    recordedAt: {
        seconds: number;
        nanoseconds: number;
    };
}>;
export declare const createUtilitySourceSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["rss", "html", "pdf", "calendar"]>;
    allowlistDomain: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    region: z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">;
    utilityTypes: z.ZodArray<z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]>, "many">;
    parsingHints: z.ZodOptional<z.ZodObject<{
        selectorMain: z.ZodOptional<z.ZodString>;
        selectorDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    }, {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    }>>;
    active: z.ZodBoolean;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    type: "rss" | "html" | "pdf" | "calendar";
    url: string;
    label: string;
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    allowlistDomain: string;
    priority: number;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile")[];
    active: boolean;
    rotationKey?: string | undefined;
    parsingHints?: {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    } | undefined;
}, {
    type: "rss" | "html" | "pdf" | "calendar";
    url: string;
    label: string;
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    allowlistDomain: string;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile")[];
    active: boolean;
    rotationKey?: string | undefined;
    priority?: number | undefined;
    parsingHints?: {
        selectorMain?: string | undefined;
        selectorDate?: string | undefined;
    } | undefined;
}>;
export declare const createUtilityQueueEntrySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "done", "failed"]>;
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    langTargets: z.ZodArray<z.ZodEnum<["fr", "ht"]>, "many">;
    sourceIds: z.ZodArray<z.ZodString, "many">;
    runAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    attempts: z.ZodNumber;
    lastError: z.ZodOptional<z.ZodString>;
    failReasons: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
    updatedAt: z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        seconds: number;
        nanoseconds: number;
    }, {
        seconds: number;
        nanoseconds: number;
    }>;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    status: "queued" | "processing" | "done" | "failed";
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    langTargets: ("fr" | "ht")[];
    sourceIds: string[];
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    rotationKey?: string | undefined;
    lastError?: string | undefined;
    failReasons?: string[] | undefined;
}, {
    status: "queued" | "processing" | "done" | "failed";
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek";
    langTargets: ("fr" | "ht")[];
    sourceIds: string[];
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    rotationKey?: string | undefined;
    lastError?: string | undefined;
    failReasons?: string[] | undefined;
}>;
export type CreateSource = z.infer<typeof createSourceSchema>;
export type CreateRawItem = z.infer<typeof createRawItemSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type CreateContentVersion = z.infer<typeof createContentVersionSchema>;
export type CreateAsset = z.infer<typeof createAssetSchema>;
export type CreatePublishQueueEntry = z.infer<typeof createPublishQueueEntrySchema>;
export type CreateMetric = z.infer<typeof createMetricSchema>;
export type CreateUtilitySource = z.infer<typeof createUtilitySourceSchema>;
export type CreateUtilityQueueEntry = z.infer<typeof createUtilityQueueEntrySchema>;
//# sourceMappingURL=schemas.d.ts.map