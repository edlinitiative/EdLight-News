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
    reasons: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    hasSourceUrl: boolean;
    needsReview: boolean;
    lowConfidence: boolean;
    reasons: string[];
}, {
    hasSourceUrl: boolean;
    needsReview: boolean;
    lowConfidence: boolean;
    reasons: string[];
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
    id: string;
    name: string;
    url: string;
    language: "fr" | "ht";
    active: boolean;
    pollCadenceSec: number;
    priority: "hot" | "normal";
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
}, {
    type: "rss" | "html";
    id: string;
    name: string;
    url: string;
    language: "fr" | "ht";
    active: boolean;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
    pollCadenceSec?: number | undefined;
    priority?: "hot" | "normal" | undefined;
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
    id: string;
    url: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    hash: string;
    description: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    skipReason?: string | undefined;
}, {
    status: "new" | "processed" | "skipped";
    title: string;
    id: string;
    url: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    sourceId: string;
    hash: string;
    description: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
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
    category: z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news"]>;
    deadline: z.ZodNullable<z.ZodString>;
    evergreen: z.ZodBoolean;
    confidence: z.ZodNumber;
    qualityFlags: z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
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
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news";
    deadline: string | null;
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    };
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    extractedText?: string | null | undefined;
}, {
    title: string;
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
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news";
    deadline: string | null;
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    };
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    extractedText?: string | null | undefined;
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
    category: z.ZodOptional<z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news"]>>;
    qualityFlags: z.ZodOptional<z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
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
    id: string;
    language: "fr" | "ht";
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    summary: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    itemId: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    } | undefined;
    draftReason?: string | undefined;
}, {
    status: "draft" | "review" | "published";
    title: string;
    id: string;
    language: "fr" | "ht";
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    summary: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    itemId: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    } | undefined;
    draftReason?: string | undefined;
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
    id: string;
    url: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
    width: number;
    height: number;
}, {
    type: "carousel_image" | "story_image";
    id: string;
    url: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    };
    contentVersionId: string;
    width: number;
    height: number;
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
    status: "pending" | "in_progress" | "done" | "failed";
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
    status: "pending" | "in_progress" | "done" | "failed";
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
export { citationSchema, qualityFlagsSchema, sourceSelectorsSchema, timestampSchema };
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
    language: "fr" | "ht";
    active: boolean;
    pollCadenceSec: number;
    priority: "hot" | "normal";
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
    language: "fr" | "ht";
    active: boolean;
    selector?: string | undefined;
    selectors?: {
        listItem?: string | undefined;
        articleBody?: string | undefined;
        title?: string | undefined;
    } | undefined;
    pollCadenceSec?: number | undefined;
    priority?: "hot" | "normal" | undefined;
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
    sourceId: string;
    hash: string;
    description: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
    skipReason?: string | undefined;
}, {
    status: "new" | "processed" | "skipped";
    title: string;
    url: string;
    sourceId: string;
    hash: string;
    description: string;
    publishedAt: {
        seconds: number;
        nanoseconds: number;
    } | null;
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
    category: z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news"]>;
    deadline: z.ZodNullable<z.ZodString>;
    evergreen: z.ZodBoolean;
    confidence: z.ZodNumber;
    qualityFlags: z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
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
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news";
    deadline: string | null;
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    };
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    extractedText?: string | null | undefined;
}, {
    title: string;
    sourceId: string;
    rawItemId: string;
    summary: string;
    canonicalUrl: string;
    category: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news";
    deadline: string | null;
    evergreen: boolean;
    confidence: number;
    qualityFlags: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    };
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    extractedText?: string | null | undefined;
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
    category: z.ZodOptional<z.ZodEnum<["scholarship", "opportunity", "news", "event", "resource", "local_news"]>>;
    qualityFlags: z.ZodOptional<z.ZodObject<{
        hasSourceUrl: z.ZodBoolean;
        needsReview: z.ZodBoolean;
        lowConfidence: z.ZodBoolean;
        reasons: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    }, {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
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
    language: "fr" | "ht";
    summary: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    itemId: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    } | undefined;
    draftReason?: string | undefined;
}, {
    status: "draft" | "review" | "published";
    title: string;
    language: "fr" | "ht";
    summary: string;
    citations: {
        sourceName: string;
        sourceUrl: string;
    }[];
    itemId: string;
    channel: "web" | "ig" | "wa";
    body: string;
    category?: "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | undefined;
    qualityFlags?: {
        hasSourceUrl: boolean;
        needsReview: boolean;
        lowConfidence: boolean;
        reasons: string[];
    } | undefined;
    draftReason?: string | undefined;
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
    url: string;
    contentVersionId: string;
    width: number;
    height: number;
}, {
    type: "carousel_image" | "story_image";
    url: string;
    contentVersionId: string;
    width: number;
    height: number;
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
    status: "pending" | "in_progress" | "done" | "failed";
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
    status: "pending" | "in_progress" | "done" | "failed";
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
export type CreateSource = z.infer<typeof createSourceSchema>;
export type CreateRawItem = z.infer<typeof createRawItemSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type CreateContentVersion = z.infer<typeof createContentVersionSchema>;
export type CreateAsset = z.infer<typeof createAssetSchema>;
export type CreatePublishQueueEntry = z.infer<typeof createPublishQueueEntrySchema>;
export type CreateMetric = z.infer<typeof createMetricSchema>;
//# sourceMappingURL=schemas.d.ts.map