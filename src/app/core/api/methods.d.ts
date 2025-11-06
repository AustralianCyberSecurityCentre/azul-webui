/**
 * OpenAPI endpoints divided into HTTP verb subsets.
 */

import { paths } from "./openapi";

/**
 * A tool to filter the OpenAPI paths spec by anything that matches the pattern of `T`.
 */
type ValidPathKeys<T> = {
  [K in keyof paths]: paths[K] extends T ? K : never;
}[keyof paths];

/**
 * An OpenAPI operation that supports GET queries.
 */
type GETPath = {
  get: {
    requestBody?: never;
    responses: {
      /** This should always have a valid 200 response. */
      200: {
        content?: {
          "application/json": unknown;
        };
      };
      [code: number]: {
        content?: {
          "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid GET paths in a URL:spec format.
 */
export type ValidGETPaths = {
  [P in ValidPathKeys<GETPath>]: paths[P];
};

/**
 * An OpenAPI operation that supports downloading octet types.
 */
type GETDownloadPath = {
  get: {
    requestBody?: never;
    responses: {
      200: {
        content: {
          readonly "application/octet-stream": unknown;
        };
      };
      readonly 404: {
        content?: never;
      };
      readonly 422: {
        content: {
          readonly "application/json": unknown;
        };
      };
      readonly 500: {
        content: {
          readonly "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid GET streaming download paths in a URL:spec format.
 */
type ValidGETDownloadPaths = {
  [P in ValidPathKeys<GETDownloadPath>]: paths[P];
};

/**
 * An OpenAPI operation that supports POST queries.
 */
export type POSTPath = {
  post: {
    requestBody?: {
      content: {
        "application/json": unknown;
      };
    };
    responses: {
      /** This should always have a valid 200 response. */
      200: {
        content?: {
          "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid POST paths in a URL:spec format.
 */
export type ValidPOSTPaths = {
  [P in ValidPathKeys<POSTPath>]: paths[P];
};

/**
 * An OpenAPI operation that supports file uploads.
 */
type POSTUploadPath = {
  post: {
    requestBody: {
      content: {
        "multipart/form-data": unknown;
      };
    };
    responses: {
      /** This should always have a valid 200 response. */
      200: {
        content?: {
          "application/json": unknown;
        };
      };
      [code: number]: {
        content?: {
          "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid POST upload paths in a URL:spec format.
 */
export type ValidPOSTUploadPaths = {
  [P in ValidPathKeys<POSTUploadPath>]: paths[P];
};

/**
 * An OpenAPI operation that supports HEAD calls.
 */
type HEADPath = {
  head: {
    responses: {
      /** This should always have a valid 200 response. */
      200: {
        content?: {
          "application/json": unknown;
        };
      };
      [code: number]: {
        content?: {
          "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid HEAD paths in a URL:spec format.
 */
export type ValidHEADPaths = {
  [P in ValidPathKeys<HEADPath>]: paths[P];
};

/**
 * An OpenAPI operation that supports DELETE calls.
 */
type DELETEPath = {
  delete: {
    responses: {
      /** This should always have a valid 200 response. */
      200: {
        content?: {
          "application/json": unknown;
        };
      };
      [code: number]: {
        content?: {
          "application/json": unknown;
        };
      };
    };
  };
};

/**
 * All the valid DELETE paths in a URL:spec format.
 */
export type ValidDELETEPaths = {
  [P in ValidPathKeys<DELETEPath>]: paths[P];
};
