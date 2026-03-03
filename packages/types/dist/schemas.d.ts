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
    imageUrl: z.ZodOptional<z.ZodString>;
    imageCaption: z.ZodOptional<z.ZodString>;
    imageCredit: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    heading: string;
    content: string;
    imageUrl?: string | undefined;
    imageCaption?: string | undefined;
    imageCredit?: string | undefined;
}, {
    heading: string;
    content: string;
    imageUrl?: string | undefined;
    imageCaption?: string | undefined;
    imageCredit?: string | undefined;
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
export declare const utilitySeriesSchema: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
export declare const utilityTypeSchema: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>;
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
    notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    eligibility?: string[] | undefined;
    deadlines?: {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }[] | undefined;
    requirements?: string[] | undefined;
    steps?: string[] | undefined;
    notes?: string[] | undefined;
}, {
    eligibility?: string[] | undefined;
    deadlines?: {
        sourceUrl: string;
        label: string;
        dateISO: string;
    }[] | undefined;
    requirements?: string[] | undefined;
    steps?: string[] | undefined;
    notes?: string[] | undefined;
}>;
export declare const utilityMetaSchema: z.ZodObject<{
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
    utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>;
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
        notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
        notes?: string[] | undefined;
    }, {
        eligibility?: string[] | undefined;
        deadlines?: {
            sourceUrl: string;
            label: string;
            dateISO: string;
        }[] | undefined;
        requirements?: string[] | undefined;
        steps?: string[] | undefined;
        notes?: string[] | undefined;
    }>>;
    rotationKey: z.ZodOptional<z.ZodString>;
    calendarHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
        notes?: string[] | undefined;
    } | undefined;
    rotationKey?: string | undefined;
    calendarHash?: string | undefined;
}, {
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
        notes?: string[] | undefined;
    } | undefined;
    rotationKey?: string | undefined;
    calendarHash?: string | undefined;
}>;
export declare const utilitySourceSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["rss", "html", "pdf", "calendar"]>;
    allowlistDomain: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    region: z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">;
    utilityTypes: z.ZodArray<z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>, "many">;
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    id: string;
    allowlistDomain: string;
    priority: number;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code")[];
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    id: string;
    allowlistDomain: string;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code")[];
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
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
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
        series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
        utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>;
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
            notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
            notes?: string[] | undefined;
        }, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
            notes?: string[] | undefined;
        }>>;
        rotationKey: z.ZodOptional<z.ZodString>;
        calendarHash: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
    }, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag: z.ZodOptional<z.ZodBoolean>;
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
    imageUrl?: string | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
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
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag?: boolean | undefined;
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
    imageUrl?: string | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
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
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag?: boolean | undefined;
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
        imageUrl: z.ZodOptional<z.ZodString>;
        imageCaption: z.ZodOptional<z.ZodString>;
        imageCredit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        content: string;
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
    }, {
        heading: string;
        content: string;
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
        series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
        utilityType: z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>;
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
            notes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
            notes?: string[] | undefined;
        }, {
            eligibility?: string[] | undefined;
            deadlines?: {
                sourceUrl: string;
                label: string;
                dateISO: string;
            }[] | undefined;
            requirements?: string[] | undefined;
            steps?: string[] | undefined;
            notes?: string[] | undefined;
        }>>;
        rotationKey: z.ZodOptional<z.ZodString>;
        calendarHash: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
    }, {
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag: z.ZodOptional<z.ZodBoolean>;
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
    imageUrl?: string | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
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
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag?: boolean | undefined;
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
    imageUrl?: string | null | undefined;
    extractedText?: string | null | undefined;
    vertical?: string | undefined;
    geoTag?: "HT" | "Diaspora" | "Global" | undefined;
    audienceFitScore?: number | undefined;
    dedupeGroupId?: string | undefined;
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
        series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
        utilityType: "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code";
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
            notes?: string[] | undefined;
        } | undefined;
        rotationKey?: string | undefined;
        calendarHash?: string | undefined;
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
    successTag?: boolean | undefined;
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
        imageUrl: z.ZodOptional<z.ZodString>;
        imageCaption: z.ZodOptional<z.ZodString>;
        imageCredit: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        content: string;
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
    }, {
        heading: string;
        content: string;
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
        imageUrl?: string | undefined;
        imageCaption?: string | undefined;
        imageCredit?: string | undefined;
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
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
    rotationKey: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["rss", "html", "pdf", "calendar"]>;
    allowlistDomain: z.ZodString;
    priority: z.ZodDefault<z.ZodNumber>;
    region: z.ZodArray<z.ZodEnum<["HT", "US", "CA", "FR", "DO", "RU", "Global"]>, "many">;
    utilityTypes: z.ZodArray<z.ZodEnum<["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile", "school_calendar", "code"]>, "many">;
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    allowlistDomain: string;
    priority: number;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code")[];
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
    region: ("HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU")[];
    allowlistDomain: string;
    utilityTypes: ("study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar" | "code")[];
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
    series: z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>;
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
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
    series: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode";
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
export declare const datasetCountrySchema: z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>;
export declare const academicLevelSchema: z.ZodEnum<["bachelor", "master", "phd", "short_programs"]>;
export declare const tuitionBandSchema: z.ZodEnum<["low", "medium", "high", "unknown"]>;
export declare const datasetCitationSchema: z.ZodObject<{
    label: z.ZodString;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    label: string;
}, {
    url: string;
    label: string;
}>;
export declare const datasetDeadlineSchema: z.ZodObject<{
    label: z.ZodString;
    monthRange: z.ZodOptional<z.ZodString>;
    dateISO: z.ZodOptional<z.ZodString>;
    sourceUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceUrl: string;
    label: string;
    dateISO?: string | undefined;
    monthRange?: string | undefined;
}, {
    sourceUrl: string;
    label: string;
    dateISO?: string | undefined;
    monthRange?: string | undefined;
}>;
export declare const universitySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    country: z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>;
    city: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    levelSupport: z.ZodOptional<z.ZodArray<z.ZodEnum<["bachelor", "master", "phd", "short_programs"]>, "many">>;
    tuitionBand: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "unknown"]>>;
    admissionsUrl: z.ZodString;
    internationalAdmissionsUrl: z.ZodOptional<z.ZodString>;
    scholarshipUrl: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodObject<{
        englishTests: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        frenchTests: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        applicationPlatform: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    }, {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    }>>;
    typicalDeadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        monthRange: z.ZodOptional<z.ZodString>;
        dateISO: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }, {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }>, "many">>;
    haitianFriendly: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
    name: string;
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    admissionsUrl: string;
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    requirements?: {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    } | undefined;
    tags?: string[] | undefined;
    city?: string | undefined;
    languages?: string[] | undefined;
    levelSupport?: ("bachelor" | "master" | "phd" | "short_programs")[] | undefined;
    tuitionBand?: "high" | "medium" | "low" | "unknown" | undefined;
    internationalAdmissionsUrl?: string | undefined;
    scholarshipUrl?: string | undefined;
    typicalDeadlines?: {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }[] | undefined;
    haitianFriendly?: boolean | undefined;
}, {
    name: string;
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    admissionsUrl: string;
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    requirements?: {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    } | undefined;
    tags?: string[] | undefined;
    city?: string | undefined;
    languages?: string[] | undefined;
    levelSupport?: ("bachelor" | "master" | "phd" | "short_programs")[] | undefined;
    tuitionBand?: "high" | "medium" | "low" | "unknown" | undefined;
    internationalAdmissionsUrl?: string | undefined;
    scholarshipUrl?: string | undefined;
    typicalDeadlines?: {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }[] | undefined;
    haitianFriendly?: boolean | undefined;
}>;
export declare const scholarshipKindSchema: z.ZodEnum<["program", "directory"]>;
export declare const scholarshipHaitianEligibilitySchema: z.ZodEnum<["yes", "no", "unknown"]>;
export declare const scholarshipDeadlineAccuracySchema: z.ZodEnum<["exact", "month-only", "varies", "unknown"]>;
export declare const scholarshipFundingTypeSchema: z.ZodEnum<["full", "partial", "stipend", "tuition-only", "unknown"]>;
export declare const scholarshipSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    country: z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>;
    eligibleCountries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    level: z.ZodArray<z.ZodEnum<["bachelor", "master", "phd", "short_programs"]>, "many">;
    fundingType: z.ZodEnum<["full", "partial", "stipend", "tuition-only", "unknown"]>;
    kind: z.ZodOptional<z.ZodEnum<["program", "directory"]>>;
    haitianEligibility: z.ZodOptional<z.ZodEnum<["yes", "no", "unknown"]>>;
    deadlineAccuracy: z.ZodOptional<z.ZodEnum<["exact", "month-only", "varies", "unknown"]>>;
    deadline: z.ZodOptional<z.ZodObject<{
        dateISO: z.ZodOptional<z.ZodString>;
        month: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    }, {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    }>>;
    officialUrl: z.ZodString;
    howToApplyUrl: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    eligibilitySummary: z.ZodOptional<z.ZodString>;
    recurring: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
    name: string;
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    level: ("bachelor" | "master" | "phd" | "short_programs")[];
    fundingType: "unknown" | "full" | "partial" | "stipend" | "tuition-only";
    officialUrl: string;
    deadline?: {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    } | undefined;
    requirements?: string[] | undefined;
    tags?: string[] | undefined;
    eligibleCountries?: string[] | undefined;
    kind?: "program" | "directory" | undefined;
    haitianEligibility?: "unknown" | "yes" | "no" | undefined;
    deadlineAccuracy?: "unknown" | "exact" | "month-only" | "varies" | undefined;
    howToApplyUrl?: string | undefined;
    eligibilitySummary?: string | undefined;
    recurring?: boolean | undefined;
}, {
    name: string;
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    level: ("bachelor" | "master" | "phd" | "short_programs")[];
    fundingType: "unknown" | "full" | "partial" | "stipend" | "tuition-only";
    officialUrl: string;
    deadline?: {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    } | undefined;
    requirements?: string[] | undefined;
    tags?: string[] | undefined;
    eligibleCountries?: string[] | undefined;
    kind?: "program" | "directory" | undefined;
    haitianEligibility?: "unknown" | "yes" | "no" | undefined;
    deadlineAccuracy?: "unknown" | "exact" | "month-only" | "varies" | undefined;
    howToApplyUrl?: string | undefined;
    eligibilitySummary?: string | undefined;
    recurring?: boolean | undefined;
}>;
export declare const calendarEventTypeSchema: z.ZodEnum<["rentree", "registration", "exam", "results", "admissions", "closure"]>;
export declare const calendarLevelSchema: z.ZodEnum<["ns1", "ns2", "ns3", "ns4", "bac", "university", "general"]>;
export declare const haitiCalendarEventSchema: z.ZodObject<{
    id: z.ZodString;
    institution: z.ZodString;
    eventType: z.ZodEnum<["rentree", "registration", "exam", "results", "admissions", "closure"]>;
    level: z.ZodArray<z.ZodEnum<["ns1", "ns2", "ns3", "ns4", "bac", "university", "general"]>, "many">;
    title: z.ZodString;
    startDateISO: z.ZodOptional<z.ZodString>;
    endDateISO: z.ZodOptional<z.ZodString>;
    dateISO: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    officialUrl: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    level: ("ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general")[];
    officialUrl: string;
    institution: string;
    eventType: "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";
    dateISO?: string | undefined;
    notes?: string | undefined;
    startDateISO?: string | undefined;
    endDateISO?: string | undefined;
    location?: string | undefined;
}, {
    title: string;
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    level: ("ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general")[];
    officialUrl: string;
    institution: string;
    eventType: "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";
    dateISO?: string | undefined;
    notes?: string | undefined;
    startDateISO?: string | undefined;
    endDateISO?: string | undefined;
    location?: string | undefined;
}>;
export declare const pathwayGoalKeySchema: z.ZodEnum<["study_abroad", "career", "scholarship", "haiti_calendar"]>;
export declare const pathwaySchema: z.ZodObject<{
    id: z.ZodString;
    title_fr: z.ZodString;
    title_ht: z.ZodString;
    goalKey: z.ZodEnum<["study_abroad", "career", "scholarship", "haiti_calendar"]>;
    country: z.ZodOptional<z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>>;
    steps: z.ZodArray<z.ZodObject<{
        title_fr: z.ZodString;
        title_ht: z.ZodString;
        description_fr: z.ZodString;
        description_ht: z.ZodString;
        links: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            label: string;
        }, {
            url: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }, {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }>, "many">;
    recommendedUniversityIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    recommendedScholarshipIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
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
    steps: {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }[];
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    title_ht: string;
    goalKey: "study_abroad" | "career" | "scholarship" | "haiti_calendar";
    country?: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN" | undefined;
    recommendedUniversityIds?: string[] | undefined;
    recommendedScholarshipIds?: string[] | undefined;
}, {
    steps: {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }[];
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    title_ht: string;
    goalKey: "study_abroad" | "career" | "scholarship" | "haiti_calendar";
    country?: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN" | undefined;
    recommendedUniversityIds?: string[] | undefined;
    recommendedScholarshipIds?: string[] | undefined;
}>;
export declare const datasetNameSchema: z.ZodEnum<["universities", "scholarships", "haiti_calendar", "pathways", "haiti_history_almanac", "haiti_holidays"]>;
export declare const datasetJobSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "done", "failed"]>;
    dataset: z.ZodEnum<["universities", "scholarships", "haiti_calendar", "pathways", "haiti_history_almanac", "haiti_holidays"]>;
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
    sourceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    targetId: z.ZodOptional<z.ZodString>;
    lastError: z.ZodOptional<z.ZodString>;
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
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    dataset: "haiti_calendar" | "universities" | "scholarships" | "pathways" | "haiti_history_almanac" | "haiti_holidays";
    sourceIds?: string[] | undefined;
    lastError?: string | undefined;
    targetId?: string | undefined;
}, {
    status: "queued" | "processing" | "done" | "failed";
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    dataset: "haiti_calendar" | "universities" | "scholarships" | "pathways" | "haiti_history_almanac" | "haiti_holidays";
    sourceIds?: string[] | undefined;
    lastError?: string | undefined;
    targetId?: string | undefined;
}>;
export declare const contributorRoleSchema: z.ZodEnum<["intern", "editor", "admin"]>;
export declare const contributorProfileSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["intern", "editor", "admin"]>;
    verified: z.ZodBoolean;
    payoutRate: z.ZodOptional<z.ZodNumber>;
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
    verified: boolean;
    name: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    role: "admin" | "intern" | "editor";
    email?: string | undefined;
    payoutRate?: number | undefined;
}, {
    verified: boolean;
    name: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    role: "admin" | "intern" | "editor";
    email?: string | undefined;
    payoutRate?: number | undefined;
}>;
export declare const draftStatusSchema: z.ZodEnum<["draft", "submitted", "approved", "rejected"]>;
export declare const draftSchema: z.ZodObject<{
    id: z.ZodString;
    authorId: z.ZodString;
    title_fr: z.ZodString;
    body_fr: z.ZodString;
    title_ht: z.ZodOptional<z.ZodString>;
    body_ht: z.ZodOptional<z.ZodString>;
    series: z.ZodOptional<z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>>;
    status: z.ZodEnum<["draft", "submitted", "approved", "rejected"]>;
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
    reviewNote: z.ZodOptional<z.ZodString>;
    payoutDue: z.ZodOptional<z.ZodNumber>;
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
    status: "draft" | "submitted" | "approved" | "rejected";
    citations: {
        url: string;
        label: string;
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
    title_fr: string;
    authorId: string;
    body_fr: string;
    series?: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode" | undefined;
    title_ht?: string | undefined;
    body_ht?: string | undefined;
    reviewNote?: string | undefined;
    payoutDue?: number | undefined;
}, {
    status: "draft" | "submitted" | "approved" | "rejected";
    citations: {
        url: string;
        label: string;
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
    title_fr: string;
    authorId: string;
    body_fr: string;
    series?: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode" | undefined;
    title_ht?: string | undefined;
    body_ht?: string | undefined;
    reviewNote?: string | undefined;
    payoutDue?: number | undefined;
}>;
export declare const createUniversitySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    country: z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>;
    city: z.ZodOptional<z.ZodString>;
    languages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    levelSupport: z.ZodOptional<z.ZodArray<z.ZodEnum<["bachelor", "master", "phd", "short_programs"]>, "many">>;
    tuitionBand: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "unknown"]>>;
    admissionsUrl: z.ZodString;
    internationalAdmissionsUrl: z.ZodOptional<z.ZodString>;
    scholarshipUrl: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodObject<{
        englishTests: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        frenchTests: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        applicationPlatform: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    }, {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    }>>;
    typicalDeadlines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        monthRange: z.ZodOptional<z.ZodString>;
        dateISO: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }, {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }>, "many">>;
    haitianFriendly: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
}, "id" | "updatedAt" | "verifiedAt">, "strip", z.ZodTypeAny, {
    name: string;
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    admissionsUrl: string;
    sources: {
        url: string;
        label: string;
    }[];
    requirements?: {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    } | undefined;
    tags?: string[] | undefined;
    city?: string | undefined;
    languages?: string[] | undefined;
    levelSupport?: ("bachelor" | "master" | "phd" | "short_programs")[] | undefined;
    tuitionBand?: "high" | "medium" | "low" | "unknown" | undefined;
    internationalAdmissionsUrl?: string | undefined;
    scholarshipUrl?: string | undefined;
    typicalDeadlines?: {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }[] | undefined;
    haitianFriendly?: boolean | undefined;
}, {
    name: string;
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    admissionsUrl: string;
    sources: {
        url: string;
        label: string;
    }[];
    requirements?: {
        englishTests?: string[] | undefined;
        frenchTests?: string[] | undefined;
        applicationPlatform?: string | undefined;
    } | undefined;
    tags?: string[] | undefined;
    city?: string | undefined;
    languages?: string[] | undefined;
    levelSupport?: ("bachelor" | "master" | "phd" | "short_programs")[] | undefined;
    tuitionBand?: "high" | "medium" | "low" | "unknown" | undefined;
    internationalAdmissionsUrl?: string | undefined;
    scholarshipUrl?: string | undefined;
    typicalDeadlines?: {
        sourceUrl: string;
        label: string;
        dateISO?: string | undefined;
        monthRange?: string | undefined;
    }[] | undefined;
    haitianFriendly?: boolean | undefined;
}>;
export declare const createScholarshipSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    country: z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>;
    eligibleCountries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    level: z.ZodArray<z.ZodEnum<["bachelor", "master", "phd", "short_programs"]>, "many">;
    fundingType: z.ZodEnum<["full", "partial", "stipend", "tuition-only", "unknown"]>;
    kind: z.ZodOptional<z.ZodEnum<["program", "directory"]>>;
    haitianEligibility: z.ZodOptional<z.ZodEnum<["yes", "no", "unknown"]>>;
    deadlineAccuracy: z.ZodOptional<z.ZodEnum<["exact", "month-only", "varies", "unknown"]>>;
    deadline: z.ZodOptional<z.ZodObject<{
        dateISO: z.ZodOptional<z.ZodString>;
        month: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
        sourceUrl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    }, {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    }>>;
    officialUrl: z.ZodString;
    howToApplyUrl: z.ZodOptional<z.ZodString>;
    requirements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    eligibilitySummary: z.ZodOptional<z.ZodString>;
    recurring: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
}, "id" | "updatedAt" | "verifiedAt">, "strip", z.ZodTypeAny, {
    name: string;
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    sources: {
        url: string;
        label: string;
    }[];
    level: ("bachelor" | "master" | "phd" | "short_programs")[];
    fundingType: "unknown" | "full" | "partial" | "stipend" | "tuition-only";
    officialUrl: string;
    deadline?: {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    } | undefined;
    requirements?: string[] | undefined;
    tags?: string[] | undefined;
    eligibleCountries?: string[] | undefined;
    kind?: "program" | "directory" | undefined;
    haitianEligibility?: "unknown" | "yes" | "no" | undefined;
    deadlineAccuracy?: "unknown" | "exact" | "month-only" | "varies" | undefined;
    howToApplyUrl?: string | undefined;
    eligibilitySummary?: string | undefined;
    recurring?: boolean | undefined;
}, {
    name: string;
    country: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN";
    sources: {
        url: string;
        label: string;
    }[];
    level: ("bachelor" | "master" | "phd" | "short_programs")[];
    fundingType: "unknown" | "full" | "partial" | "stipend" | "tuition-only";
    officialUrl: string;
    deadline?: {
        sourceUrl: string;
        dateISO?: string | undefined;
        notes?: string | undefined;
        month?: number | undefined;
    } | undefined;
    requirements?: string[] | undefined;
    tags?: string[] | undefined;
    eligibleCountries?: string[] | undefined;
    kind?: "program" | "directory" | undefined;
    haitianEligibility?: "unknown" | "yes" | "no" | undefined;
    deadlineAccuracy?: "unknown" | "exact" | "month-only" | "varies" | undefined;
    howToApplyUrl?: string | undefined;
    eligibilitySummary?: string | undefined;
    recurring?: boolean | undefined;
}>;
export declare const createHaitiCalendarEventSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    institution: z.ZodString;
    eventType: z.ZodEnum<["rentree", "registration", "exam", "results", "admissions", "closure"]>;
    level: z.ZodArray<z.ZodEnum<["ns1", "ns2", "ns3", "ns4", "bac", "university", "general"]>, "many">;
    title: z.ZodString;
    startDateISO: z.ZodOptional<z.ZodString>;
    endDateISO: z.ZodOptional<z.ZodString>;
    dateISO: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    officialUrl: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
}, "id" | "updatedAt" | "verifiedAt">, "strip", z.ZodTypeAny, {
    title: string;
    sources: {
        url: string;
        label: string;
    }[];
    level: ("ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general")[];
    officialUrl: string;
    institution: string;
    eventType: "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";
    dateISO?: string | undefined;
    notes?: string | undefined;
    startDateISO?: string | undefined;
    endDateISO?: string | undefined;
    location?: string | undefined;
}, {
    title: string;
    sources: {
        url: string;
        label: string;
    }[];
    level: ("ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general")[];
    officialUrl: string;
    institution: string;
    eventType: "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";
    dateISO?: string | undefined;
    notes?: string | undefined;
    startDateISO?: string | undefined;
    endDateISO?: string | undefined;
    location?: string | undefined;
}>;
export declare const createPathwaySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    title_fr: z.ZodString;
    title_ht: z.ZodString;
    goalKey: z.ZodEnum<["study_abroad", "career", "scholarship", "haiti_calendar"]>;
    country: z.ZodOptional<z.ZodEnum<["US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global"]>>;
    steps: z.ZodArray<z.ZodObject<{
        title_fr: z.ZodString;
        title_ht: z.ZodString;
        description_fr: z.ZodString;
        description_ht: z.ZodString;
        links: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            label: string;
        }, {
            url: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }, {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }>, "many">;
    recommendedUniversityIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    recommendedScholarshipIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
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
}, "id" | "updatedAt">, "strip", z.ZodTypeAny, {
    steps: {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }[];
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    title_ht: string;
    goalKey: "study_abroad" | "career" | "scholarship" | "haiti_calendar";
    country?: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN" | undefined;
    recommendedUniversityIds?: string[] | undefined;
    recommendedScholarshipIds?: string[] | undefined;
}, {
    steps: {
        title_fr: string;
        title_ht: string;
        description_fr: string;
        description_ht: string;
        links: {
            url: string;
            label: string;
        }[];
    }[];
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    title_ht: string;
    goalKey: "study_abroad" | "career" | "scholarship" | "haiti_calendar";
    country?: "HT" | "Global" | "US" | "CA" | "FR" | "DO" | "RU" | "UK" | "MX" | "CN" | undefined;
    recommendedUniversityIds?: string[] | undefined;
    recommendedScholarshipIds?: string[] | undefined;
}>;
export declare const createDatasetJobSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "done", "failed"]>;
    dataset: z.ZodEnum<["universities", "scholarships", "haiti_calendar", "pathways", "haiti_history_almanac", "haiti_holidays"]>;
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
    sourceIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    targetId: z.ZodOptional<z.ZodString>;
    lastError: z.ZodOptional<z.ZodString>;
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
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    dataset: "haiti_calendar" | "universities" | "scholarships" | "pathways" | "haiti_history_almanac" | "haiti_holidays";
    sourceIds?: string[] | undefined;
    lastError?: string | undefined;
    targetId?: string | undefined;
}, {
    status: "queued" | "processing" | "done" | "failed";
    runAt: {
        seconds: number;
        nanoseconds: number;
    };
    attempts: number;
    dataset: "haiti_calendar" | "universities" | "scholarships" | "pathways" | "haiti_history_almanac" | "haiti_holidays";
    sourceIds?: string[] | undefined;
    lastError?: string | undefined;
    targetId?: string | undefined;
}>;
export declare const createContributorProfileSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["intern", "editor", "admin"]>;
    verified: z.ZodBoolean;
    payoutRate: z.ZodOptional<z.ZodNumber>;
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
    verified: boolean;
    name: string;
    role: "admin" | "intern" | "editor";
    email?: string | undefined;
    payoutRate?: number | undefined;
}, {
    verified: boolean;
    name: string;
    role: "admin" | "intern" | "editor";
    email?: string | undefined;
    payoutRate?: number | undefined;
}>;
export declare const createDraftSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    authorId: z.ZodString;
    title_fr: z.ZodString;
    body_fr: z.ZodString;
    title_ht: z.ZodOptional<z.ZodString>;
    body_ht: z.ZodOptional<z.ZodString>;
    series: z.ZodOptional<z.ZodEnum<["StudyAbroad", "Career", "ScholarshipRadar", "ScholarshipRadarWeekly", "HaitiHistory", "HaitiFactOfTheDay", "HaitianOfTheWeek", "HaitiEducationCalendar", "EdLightCode"]>>;
    status: z.ZodEnum<["draft", "submitted", "approved", "rejected"]>;
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
    reviewNote: z.ZodOptional<z.ZodString>;
    payoutDue: z.ZodOptional<z.ZodNumber>;
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
    status: "draft" | "submitted" | "approved" | "rejected";
    citations: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    authorId: string;
    body_fr: string;
    series?: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode" | undefined;
    title_ht?: string | undefined;
    body_ht?: string | undefined;
    reviewNote?: string | undefined;
    payoutDue?: number | undefined;
}, {
    status: "draft" | "submitted" | "approved" | "rejected";
    citations: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    authorId: string;
    body_fr: string;
    series?: "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar" | "EdLightCode" | undefined;
    title_ht?: string | undefined;
    body_ht?: string | undefined;
    reviewNote?: string | undefined;
    payoutDue?: number | undefined;
}>;
export declare const almanacConfidenceSchema: z.ZodEnum<["high", "medium"]>;
export declare const almanacCreatedBySchema: z.ZodEnum<["seed", "admin", "intern", "import"]>;
export declare const almanacTagSchema: z.ZodEnum<["independence", "culture", "education", "politics", "science", "military", "economy", "literature", "art", "religion", "sports", "disaster", "diplomacy", "resistance", "revolution"]>;
export declare const haitiHistoryAlmanacEntrySchema: z.ZodObject<{
    id: z.ZodString;
    monthDay: z.ZodString;
    year: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    title_fr: z.ZodString;
    summary_fr: z.ZodString;
    student_takeaway_fr: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodEnum<["independence", "culture", "education", "politics", "science", "military", "economy", "literature", "art", "religion", "sports", "disaster", "diplomacy", "resistance", "revolution"]>, "many">>;
    illustration: z.ZodOptional<z.ZodObject<{
        imageUrl: z.ZodString;
        pageUrl: z.ZodString;
        pageTitle: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["wikimedia_commons", "manual"]>>;
        author: z.ZodOptional<z.ZodString>;
        license: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    }, {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    }>>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    confidence: z.ZodEnum<["high", "medium"]>;
    createdBy: z.ZodEnum<["seed", "admin", "intern", "import"]>;
    verifiedAt: z.ZodObject<{
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
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    confidence: "high" | "medium";
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    title_fr: string;
    monthDay: string;
    summary_fr: string;
    student_takeaway_fr: string;
    createdBy: "seed" | "admin" | "intern" | "import";
    tags?: ("independence" | "culture" | "education" | "politics" | "science" | "military" | "economy" | "literature" | "art" | "religion" | "sports" | "disaster" | "diplomacy" | "resistance" | "revolution")[] | undefined;
    year?: number | null | undefined;
    illustration?: {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    } | undefined;
}, {
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    confidence: "high" | "medium";
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    title_fr: string;
    monthDay: string;
    summary_fr: string;
    student_takeaway_fr: string;
    createdBy: "seed" | "admin" | "intern" | "import";
    tags?: ("independence" | "culture" | "education" | "politics" | "science" | "military" | "economy" | "literature" | "art" | "religion" | "sports" | "disaster" | "diplomacy" | "resistance" | "revolution")[] | undefined;
    year?: number | null | undefined;
    illustration?: {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    } | undefined;
}>;
export declare const createHaitiHistoryAlmanacEntrySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    monthDay: z.ZodString;
    year: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    title_fr: z.ZodString;
    summary_fr: z.ZodString;
    student_takeaway_fr: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodEnum<["independence", "culture", "education", "politics", "science", "military", "economy", "literature", "art", "religion", "sports", "disaster", "diplomacy", "resistance", "revolution"]>, "many">>;
    illustration: z.ZodOptional<z.ZodObject<{
        imageUrl: z.ZodString;
        pageUrl: z.ZodString;
        pageTitle: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["wikimedia_commons", "manual"]>>;
        author: z.ZodOptional<z.ZodString>;
        license: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    }, {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    }>>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    confidence: z.ZodEnum<["high", "medium"]>;
    createdBy: z.ZodEnum<["seed", "admin", "intern", "import"]>;
    verifiedAt: z.ZodObject<{
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
}, "id" | "updatedAt" | "verifiedAt">, "strip", z.ZodTypeAny, {
    confidence: "high" | "medium";
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    monthDay: string;
    summary_fr: string;
    student_takeaway_fr: string;
    createdBy: "seed" | "admin" | "intern" | "import";
    tags?: ("independence" | "culture" | "education" | "politics" | "science" | "military" | "economy" | "literature" | "art" | "religion" | "sports" | "disaster" | "diplomacy" | "resistance" | "revolution")[] | undefined;
    year?: number | null | undefined;
    illustration?: {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    } | undefined;
}, {
    confidence: "high" | "medium";
    sources: {
        url: string;
        label: string;
    }[];
    title_fr: string;
    monthDay: string;
    summary_fr: string;
    student_takeaway_fr: string;
    createdBy: "seed" | "admin" | "intern" | "import";
    tags?: ("independence" | "culture" | "education" | "politics" | "science" | "military" | "economy" | "literature" | "art" | "religion" | "sports" | "disaster" | "diplomacy" | "resistance" | "revolution")[] | undefined;
    year?: number | null | undefined;
    illustration?: {
        imageUrl: string;
        pageUrl: string;
        license?: string | undefined;
        confidence?: number | undefined;
        pageTitle?: string | undefined;
        provider?: "wikimedia_commons" | "manual" | undefined;
        author?: string | undefined;
    } | undefined;
}>;
export type CreateHaitiHistoryAlmanacEntry = z.infer<typeof createHaitiHistoryAlmanacEntrySchema>;
export declare const haitiHolidaySchema: z.ZodObject<{
    id: z.ZodString;
    monthDay: z.ZodString;
    name_fr: z.ZodString;
    name_ht: z.ZodString;
    description_fr: z.ZodOptional<z.ZodString>;
    description_ht: z.ZodOptional<z.ZodString>;
    isNationalHoliday: z.ZodOptional<z.ZodBoolean>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    monthDay: string;
    name_fr: string;
    name_ht: string;
    description_fr?: string | undefined;
    description_ht?: string | undefined;
    isNationalHoliday?: boolean | undefined;
}, {
    id: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    sources: {
        url: string;
        label: string;
    }[];
    verifiedAt: {
        seconds: number;
        nanoseconds: number;
    };
    monthDay: string;
    name_fr: string;
    name_ht: string;
    description_fr?: string | undefined;
    description_ht?: string | undefined;
    isNationalHoliday?: boolean | undefined;
}>;
export declare const createHaitiHolidaySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    monthDay: z.ZodString;
    name_fr: z.ZodString;
    name_ht: z.ZodString;
    description_fr: z.ZodOptional<z.ZodString>;
    description_ht: z.ZodOptional<z.ZodString>;
    isNationalHoliday: z.ZodOptional<z.ZodBoolean>;
    sources: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        label: string;
    }, {
        url: string;
        label: string;
    }>, "many">;
    verifiedAt: z.ZodObject<{
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
}, "id" | "updatedAt" | "verifiedAt">, "strip", z.ZodTypeAny, {
    sources: {
        url: string;
        label: string;
    }[];
    monthDay: string;
    name_fr: string;
    name_ht: string;
    description_fr?: string | undefined;
    description_ht?: string | undefined;
    isNationalHoliday?: boolean | undefined;
}, {
    sources: {
        url: string;
        label: string;
    }[];
    monthDay: string;
    name_fr: string;
    name_ht: string;
    description_fr?: string | undefined;
    description_ht?: string | undefined;
    isNationalHoliday?: boolean | undefined;
}>;
export type CreateHaitiHoliday = z.infer<typeof createHaitiHolidaySchema>;
export declare const historyPublishLogSchema: z.ZodObject<{
    id: z.ZodString;
    dateISO: z.ZodString;
    publishedItemId: z.ZodOptional<z.ZodString>;
    almanacEntryIds: z.ZodArray<z.ZodString, "many">;
    holidayId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["done", "skipped", "failed"]>;
    error: z.ZodOptional<z.ZodString>;
    validationWarnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    validationErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
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
    status: "skipped" | "done" | "failed";
    dateISO: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    almanacEntryIds: string[];
    publishedItemId?: string | undefined;
    holidayId?: string | undefined;
    error?: string | undefined;
    validationWarnings?: string[] | undefined;
    validationErrors?: string[] | undefined;
}, {
    status: "skipped" | "done" | "failed";
    dateISO: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    almanacEntryIds: string[];
    publishedItemId?: string | undefined;
    holidayId?: string | undefined;
    error?: string | undefined;
    validationWarnings?: string[] | undefined;
    validationErrors?: string[] | undefined;
}>;
export declare const almanacRawCategorySchema: z.ZodEnum<["political", "education", "culture", "international", "economy", "social", "science", "birth", "death"]>;
export declare const almanacRawSourceTypeSchema: z.ZodEnum<["government", "academic", "institutional", "press", "reference"]>;
export declare const almanacRawVerificationStatusSchema: z.ZodEnum<["unverified", "verified"]>;
export declare const almanacRawSourceSchema: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    url: string;
}, {
    name: string;
    url: string;
}>;
export declare const haitiHistoryAlmanacRawSchema: z.ZodObject<{
    id: z.ZodString;
    monthDay: z.ZodString;
    year: z.ZodNumber;
    title: z.ZodString;
    shortSummary: z.ZodString;
    category: z.ZodEnum<["political", "education", "culture", "international", "economy", "social", "science", "birth", "death"]>;
    sourcePrimary: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    sourceSecondary: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>;
    sourceType: z.ZodEnum<["government", "academic", "institutional", "press", "reference"]>;
    verificationStatus: z.ZodEnum<["unverified", "verified"]>;
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
    title: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    category: "international" | "culture" | "education" | "science" | "economy" | "political" | "social" | "birth" | "death";
    monthDay: string;
    year: number;
    shortSummary: string;
    sourcePrimary: {
        name: string;
        url: string;
    };
    sourceType: "government" | "academic" | "institutional" | "press" | "reference";
    verificationStatus: "unverified" | "verified";
    sourceSecondary?: {
        name: string;
        url: string;
    } | undefined;
}, {
    title: string;
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    category: "international" | "culture" | "education" | "science" | "economy" | "political" | "social" | "birth" | "death";
    monthDay: string;
    year: number;
    shortSummary: string;
    sourcePrimary: {
        name: string;
        url: string;
    };
    sourceType: "government" | "academic" | "institutional" | "press" | "reference";
    verificationStatus: "unverified" | "verified";
    sourceSecondary?: {
        name: string;
        url: string;
    } | undefined;
}>;
export declare const createHaitiHistoryAlmanacRawSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    monthDay: z.ZodString;
    year: z.ZodNumber;
    title: z.ZodString;
    shortSummary: z.ZodString;
    category: z.ZodEnum<["political", "education", "culture", "international", "economy", "social", "science", "birth", "death"]>;
    sourcePrimary: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    sourceSecondary: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>;
    sourceType: z.ZodEnum<["government", "academic", "institutional", "press", "reference"]>;
    verificationStatus: z.ZodEnum<["unverified", "verified"]>;
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
    title: string;
    category: "international" | "culture" | "education" | "science" | "economy" | "political" | "social" | "birth" | "death";
    monthDay: string;
    year: number;
    shortSummary: string;
    sourcePrimary: {
        name: string;
        url: string;
    };
    sourceType: "government" | "academic" | "institutional" | "press" | "reference";
    verificationStatus: "unverified" | "verified";
    sourceSecondary?: {
        name: string;
        url: string;
    } | undefined;
}, {
    title: string;
    category: "international" | "culture" | "education" | "science" | "economy" | "political" | "social" | "birth" | "death";
    monthDay: string;
    year: number;
    shortSummary: string;
    sourcePrimary: {
        name: string;
        url: string;
    };
    sourceType: "government" | "academic" | "institutional" | "press" | "reference";
    verificationStatus: "unverified" | "verified";
    sourceSecondary?: {
        name: string;
        url: string;
    } | undefined;
}>;
export type CreateHaitiHistoryAlmanacRaw = z.infer<typeof createHaitiHistoryAlmanacRawSchema>;
export declare const igPostTypeSchema: z.ZodEnum<["scholarship", "opportunity", "news", "histoire", "utility"]>;
export declare const igQueueStatusSchema: z.ZodEnum<["queued", "scheduled", "rendering", "posted", "skipped", "scheduled_ready_for_manual"]>;
export declare const igDecisionSchema: z.ZodObject<{
    igEligible: z.ZodBoolean;
    igType: z.ZodNullable<z.ZodEnum<["scholarship", "opportunity", "news", "histoire", "utility"]>>;
    igPriorityScore: z.ZodNumber;
    reasons: z.ZodArray<z.ZodString, "many">;
    igPostAfter: z.ZodOptional<z.ZodString>;
    igExpiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reasons: string[];
    igEligible: boolean;
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire" | null;
    igPriorityScore: number;
    igPostAfter?: string | undefined;
    igExpiresAt?: string | undefined;
}, {
    reasons: string[];
    igEligible: boolean;
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire" | null;
    igPriorityScore: number;
    igPostAfter?: string | undefined;
    igExpiresAt?: string | undefined;
}>;
export declare const igSlideSchema: z.ZodObject<{
    heading: z.ZodString;
    bullets: z.ZodArray<z.ZodString, "many">;
    footer: z.ZodOptional<z.ZodString>;
    backgroundImage: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    heading: string;
    bullets: string[];
    footer?: string | undefined;
    backgroundImage?: string | undefined;
}, {
    heading: string;
    bullets: string[];
    footer?: string | undefined;
    backgroundImage?: string | undefined;
}>;
export declare const igMemeTemplateSchema: z.ZodEnum<["drake", "expanding-brain", "distracted", "starter-pack", "two-buttons", "tell-me", "nobody", "reaction", "comparison"]>;
export declare const igMemePanelSchema: z.ZodObject<{
    text: z.ZodString;
    emoji: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    emoji?: string | undefined;
}, {
    text: string;
    emoji?: string | undefined;
}>;
export declare const igMemeSlideSchema: z.ZodObject<{
    template: z.ZodEnum<["drake", "expanding-brain", "distracted", "starter-pack", "two-buttons", "tell-me", "nobody", "reaction", "comparison"]>;
    panels: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        emoji: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        emoji?: string | undefined;
    }, {
        text: string;
        emoji?: string | undefined;
    }>, "many">;
    topicLine: z.ZodOptional<z.ZodString>;
    tone: z.ZodEnum<["witty", "wholesome", "ironic", "hype"]>;
}, "strip", z.ZodTypeAny, {
    template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
    panels: {
        text: string;
        emoji?: string | undefined;
    }[];
    tone: "witty" | "wholesome" | "ironic" | "hype";
    topicLine?: string | undefined;
}, {
    template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
    panels: {
        text: string;
        emoji?: string | undefined;
    }[];
    tone: "witty" | "wholesome" | "ironic" | "hype";
    topicLine?: string | undefined;
}>;
export declare const igFormattedPayloadSchema: z.ZodObject<{
    slides: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        bullets: z.ZodArray<z.ZodString, "many">;
        footer: z.ZodOptional<z.ZodString>;
        backgroundImage: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        heading: string;
        bullets: string[];
        footer?: string | undefined;
        backgroundImage?: string | undefined;
    }, {
        heading: string;
        bullets: string[];
        footer?: string | undefined;
        backgroundImage?: string | undefined;
    }>, "many">;
    caption: z.ZodString;
    memeSlide: z.ZodOptional<z.ZodObject<{
        template: z.ZodEnum<["drake", "expanding-brain", "distracted", "starter-pack", "two-buttons", "tell-me", "nobody", "reaction", "comparison"]>;
        panels: z.ZodArray<z.ZodObject<{
            text: z.ZodString;
            emoji: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            emoji?: string | undefined;
        }, {
            text: string;
            emoji?: string | undefined;
        }>, "many">;
        topicLine: z.ZodOptional<z.ZodString>;
        tone: z.ZodEnum<["witty", "wholesome", "ironic", "hype"]>;
    }, "strip", z.ZodTypeAny, {
        template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
        panels: {
            text: string;
            emoji?: string | undefined;
        }[];
        tone: "witty" | "wholesome" | "ironic" | "hype";
        topicLine?: string | undefined;
    }, {
        template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
        panels: {
            text: string;
            emoji?: string | undefined;
        }[];
        tone: "witty" | "wholesome" | "ironic" | "hype";
        topicLine?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    slides: {
        heading: string;
        bullets: string[];
        footer?: string | undefined;
        backgroundImage?: string | undefined;
    }[];
    caption: string;
    memeSlide?: {
        template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
        panels: {
            text: string;
            emoji?: string | undefined;
        }[];
        tone: "witty" | "wholesome" | "ironic" | "hype";
        topicLine?: string | undefined;
    } | undefined;
}, {
    slides: {
        heading: string;
        bullets: string[];
        footer?: string | undefined;
        backgroundImage?: string | undefined;
    }[];
    caption: string;
    memeSlide?: {
        template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
        panels: {
            text: string;
            emoji?: string | undefined;
        }[];
        tone: "witty" | "wholesome" | "ironic" | "hype";
        topicLine?: string | undefined;
    } | undefined;
}>;
export declare const igQueueItemSchema: z.ZodObject<{
    id: z.ZodString;
    sourceContentId: z.ZodString;
    igType: z.ZodEnum<["scholarship", "opportunity", "news", "histoire", "utility"]>;
    score: z.ZodNumber;
    status: z.ZodEnum<["queued", "scheduled", "rendering", "posted", "skipped", "scheduled_ready_for_manual"]>;
    scheduledFor: z.ZodOptional<z.ZodString>;
    igPostId: z.ZodOptional<z.ZodString>;
    reasons: z.ZodArray<z.ZodString, "many">;
    payload: z.ZodOptional<z.ZodObject<{
        slides: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            bullets: z.ZodArray<z.ZodString, "many">;
            footer: z.ZodOptional<z.ZodString>;
            backgroundImage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }, {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }>, "many">;
        caption: z.ZodString;
        memeSlide: z.ZodOptional<z.ZodObject<{
            template: z.ZodEnum<["drake", "expanding-brain", "distracted", "starter-pack", "two-buttons", "tell-me", "nobody", "reaction", "comparison"]>;
            panels: z.ZodArray<z.ZodObject<{
                text: z.ZodString;
                emoji: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                emoji?: string | undefined;
            }, {
                text: string;
                emoji?: string | undefined;
            }>, "many">;
            topicLine: z.ZodOptional<z.ZodString>;
            tone: z.ZodEnum<["witty", "wholesome", "ironic", "hype"]>;
        }, "strip", z.ZodTypeAny, {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        }, {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    }, {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    }>>;
    dryRunPath: z.ZodOptional<z.ZodString>;
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
    status: "skipped" | "queued" | "scheduled" | "rendering" | "posted" | "scheduled_ready_for_manual";
    reasons: string[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire";
    sourceContentId: string;
    score: number;
    scheduledFor?: string | undefined;
    igPostId?: string | undefined;
    payload?: {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    } | undefined;
    dryRunPath?: string | undefined;
}, {
    status: "skipped" | "queued" | "scheduled" | "rendering" | "posted" | "scheduled_ready_for_manual";
    reasons: string[];
    id: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire";
    sourceContentId: string;
    score: number;
    scheduledFor?: string | undefined;
    igPostId?: string | undefined;
    payload?: {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    } | undefined;
    dryRunPath?: string | undefined;
}>;
export declare const createIGQueueItemSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    sourceContentId: z.ZodString;
    igType: z.ZodEnum<["scholarship", "opportunity", "news", "histoire", "utility"]>;
    score: z.ZodNumber;
    status: z.ZodEnum<["queued", "scheduled", "rendering", "posted", "skipped", "scheduled_ready_for_manual"]>;
    scheduledFor: z.ZodOptional<z.ZodString>;
    igPostId: z.ZodOptional<z.ZodString>;
    reasons: z.ZodArray<z.ZodString, "many">;
    payload: z.ZodOptional<z.ZodObject<{
        slides: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            bullets: z.ZodArray<z.ZodString, "many">;
            footer: z.ZodOptional<z.ZodString>;
            backgroundImage: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }, {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }>, "many">;
        caption: z.ZodString;
        memeSlide: z.ZodOptional<z.ZodObject<{
            template: z.ZodEnum<["drake", "expanding-brain", "distracted", "starter-pack", "two-buttons", "tell-me", "nobody", "reaction", "comparison"]>;
            panels: z.ZodArray<z.ZodObject<{
                text: z.ZodString;
                emoji: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                text: string;
                emoji?: string | undefined;
            }, {
                text: string;
                emoji?: string | undefined;
            }>, "many">;
            topicLine: z.ZodOptional<z.ZodString>;
            tone: z.ZodEnum<["witty", "wholesome", "ironic", "hype"]>;
        }, "strip", z.ZodTypeAny, {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        }, {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    }, {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    }>>;
    dryRunPath: z.ZodOptional<z.ZodString>;
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
    status: "skipped" | "queued" | "scheduled" | "rendering" | "posted" | "scheduled_ready_for_manual";
    reasons: string[];
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire";
    sourceContentId: string;
    score: number;
    scheduledFor?: string | undefined;
    igPostId?: string | undefined;
    payload?: {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    } | undefined;
    dryRunPath?: string | undefined;
}, {
    status: "skipped" | "queued" | "scheduled" | "rendering" | "posted" | "scheduled_ready_for_manual";
    reasons: string[];
    igType: "utility" | "scholarship" | "opportunity" | "news" | "histoire";
    sourceContentId: string;
    score: number;
    scheduledFor?: string | undefined;
    igPostId?: string | undefined;
    payload?: {
        slides: {
            heading: string;
            bullets: string[];
            footer?: string | undefined;
            backgroundImage?: string | undefined;
        }[];
        caption: string;
        memeSlide?: {
            template: "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
            panels: {
                text: string;
                emoji?: string | undefined;
            }[];
            tone: "witty" | "wholesome" | "ironic" | "hype";
            topicLine?: string | undefined;
        } | undefined;
    } | undefined;
    dryRunPath?: string | undefined;
}>;
export type CreateIGQueueItem = z.infer<typeof createIGQueueItemSchema>;
export type CreateUniversity = z.infer<typeof createUniversitySchema>;
export type CreateScholarship = z.infer<typeof createScholarshipSchema>;
export type CreateHaitiCalendarEvent = z.infer<typeof createHaitiCalendarEventSchema>;
export type CreatePathway = z.infer<typeof createPathwaySchema>;
export type CreateDatasetJob = z.infer<typeof createDatasetJobSchema>;
export type CreateContributorProfile = z.infer<typeof createContributorProfileSchema>;
export type CreateDraft = z.infer<typeof createDraftSchema>;
//# sourceMappingURL=schemas.d.ts.map