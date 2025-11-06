/**
 * Additional values injected into responses to API requests
 * by the web UI in order to maintain state or enable better enrichment
 * or parsing of results.
 */

import { BehaviorSubject, Observable, ReplaySubject } from "rxjs";
import { components } from "./openapi";

/**
 * The kinds of data that can be returned when downloading a file.
 */
export interface DownloadType {
  blob: Blob;
  text: string;
}

/**
 * The OpenAPI spec doesn't define *how* a file should be uploaded, just a that a multipart field
 * exists for this. This types it into a JavaScript File object to be explicit about what we want.
 */
export type FileUpload<T> = Omit<T, "binary"> & {
  binary: File;
};

/**
 * Additional metadata used to render queries in a HTML-friendly format.
 */
export type QueryInfoExpanded = components["schemas"]["QueryInfo"] & {
  queryAsString?: string;
  argsAsString?: string;
  kwargsAsString?: string;
  responseAsString?: string;
};

/**
 * Adds entity metadata to a similarity response.
 */
export type SimilarRowWithSummary = components["schemas"]["SimilarMatchRow"] & {
  _localEntitySummary$: Observable<components["schemas"]["EntityFindItem"]>;
};

/**
 * Adds entity metadata to a series of rows.
 */
export type SimilarMatchWithSummary = components["schemas"]["SimilarMatch"] & {
  matches: SimilarRowWithSummary[];
};

/**
 * Adds entity metadata to a related entity response.
 */
export type PathWithSummary = components["schemas"]["PathNode"] & {
  _localEntitySummary$: Observable<components["schemas"]["EntityFindItem"]>;
};

/**
 * Adds entity metadata to a search response.
 */
export type BulkEntitySummarySubmit = {
  eid: string;
  sub$: ReplaySubject<components["schemas"]["EntityFindItem"]>;
};

/**
 * Adds decoded information to a feature value.
 */
export type FeatureWithDecodedValue =
  components["schemas"]["BinaryFeatureValue"] & {
    description?: string;
    XValueDecoded?: string;
    XBinaries?: number;
    XPartsBinaries?: {
      part: string;
      value: string;
      cb: ReplaySubject<number>;
    }[];
    // Make tags mutable as we manipulate this if a user adds a feature on the fly
    tags: components["schemas"]["FeatureValueTag"][];
  };

/**
 * Adds entity metadata to a fuzzy search row.
 */
export type FuzzyMatchRowWithSummary =
  components["schemas"]["SimilarFuzzyMatchRow"] & {
    _localEntitySummary$: Observable<components["schemas"]["EntityFindItem"]>;
  };

/**
 * Adds entity metadata to a fuzzy search response.
 */
export type FuzzyMatchWithSummary = {
  matches: FuzzyMatchRowWithSummary[];
};

/**
 * Adds entity metadata to a plugin status event.
 */
export type PluginItemWithSummary = components["schemas"]["StatusEvent"] & {
  entitySummary$?: Observable<components["schemas"]["EntityFindItem"]>;
};

/**
 * Adds entity metadata to a plugin status events.
 */
export type PluginItemsWithSummary = components["schemas"]["StatusGroup"] & {
  items: PluginItemWithSummary[];
};

/**
 * Enables multiple string queries to be combined together in a mutable fashion.
 */
export type MultiPageResults = components["schemas"]["BinaryStrings"] & {
  strings: components["schemas"]["SearchResult"][];
};

/**
 * EntityFindItem with purge related fields for rendering in the entity table.
 */
export type EntityFindItemWithPurgeExtras =
  components["schemas"]["EntityFindItem"] & {
    track_link?: string;
    author_name?: string;
    author_category?: string;
    timestamp?: string;
  };

/**
 * EntityFind restapi response with added purge items.
 */
export type EntityFindWithPurgeExtras = components["schemas"]["EntityFind"] & {
  readonly items: readonly EntityFindItemWithPurgeExtras[];
};

/**
 * EntitryFindItem with purge extras and extra information to verify the state of the row.
 */
export type EntityFindRow = EntityFindItemWithPurgeExtras & {
  // add checked property for each row
  checked?: boolean;
  // add similarity property for each row if comparing with ssdeep or TLSH
  similarity?: number;
};

/**
 * An entity with tags that are updated independently.
 */
export type EntityFindRowWithUpdatedTags = EntityFindRow & {
  tags$: BehaviorSubject<readonly components["schemas"]["EntityTag"][]>;
};

/**
 * A feature value with a parsed value.
 */
export type FeatureValueWithReference =
  components["schemas"]["ReadFeatureValuesValue"] & {
    XValueDecoded?: string;
  };

/**
 * A set of feature values with parsed values.
 */
export type FeatureValuesWithReference =
  components["schemas"]["ReadFeatureValues"] & {
    values: FeatureValueWithReference[];
  };

/**
 * A feature value with the number of attributed binaries.
 */
export type FeatureValueWithNumBinaries = FeatureValueWithReference & {
  XNumBinaries$: ReplaySubject<number>;
};

/**
 * A set of feature values with the number of attributed binaries.
 */
export type FeatureValuesWithNumBinaries = FeatureValuesWithReference & {
  values: FeatureValueWithNumBinaries[];
};

/**
 * Global settings that are changed by the user at runtime.
 */
export type MutableSettings = components["schemas"]["Settings"] & {
  labels: components["schemas"]["SecurityLabels"];
  presets: string[];
};

/**
 * Additional runtime properties for a feature.
 */
export type FeatureWithParsedProperties = components["schemas"]["Feature"] & {
  XDescriptions: string[];
  XAuthors: string[];
  XTags: string;
  XNumBinaries$: ReplaySubject<number>;
  XNumValues$: ReplaySubject<number>;
};

/**
 * A feature tag with a count of binaries.
 */
type FeatureTagWithNumBinaries = components["schemas"]["FeatureValueTag"] & {
  XNumBinaries$?: ReplaySubject<number>;
};

/**
 * A set of feature tags with a count of binaries.
 */
type FeatureTagsWithNumBinaries = {
  items: FeatureTagWithNumBinaries[];
};
