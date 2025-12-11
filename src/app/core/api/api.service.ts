import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  Observable,
  Subject,
  defer,
  firstValueFrom,
  from,
  merge,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";

import { OidcSecurityService } from "angular-auth-oidc-client";
import Axios, { AxiosError } from "axios";
import { CacheRequestConfig, setupCache } from "axios-cache-interceptor";
import { ToastrService } from "ngx-toastr";
import {
  ValidDELETEPaths,
  ValidGETDownloadPaths,
  ValidGETPaths,
  ValidHEADPaths,
  ValidPOSTPaths,
  ValidPOSTUploadPaths,
} from "src/app/core/api/methods";
import { components, paths } from "src/app/core/api/openapi";
import { DownloadType, FileUpload } from "src/app/core/api/state";
import { config } from "src/app/settings";

/**
 * RxJS wrapper for Axios.
 *
 * Request/response pairs, unless disabled on a per request basis, are cached
 * for 5 minutes. This helps avoid constantly re-requesting items as users
 * browse around between different views.
 */
class AxiosClient {
  private axios = Axios.create();
  private cache = setupCache(this.axios);

  constructor(private oidcSecurityService: OidcSecurityService) {
    if (config.oauth_enabled) {
      this.axios.interceptors.request.use(async (config) => {
        const accessToken = await firstValueFrom(
          this.oidcSecurityService.getAccessToken(),
        );
        config.headers.set("Authorization", "Bearer " + accessToken);
        return config;
      });
    }
  }

  private request<T>(config: CacheRequestConfig): Observable<T> {
    return defer(() =>
      from(
        this.cache.request({
          cache: {
            // 5 minutes
            ttl: 1000 * 60 * 5,
            // Ignore server cache-control to avoid double-caching
            interpretHeader: false,
          },
          paramsSerializer: { indexes: null },
          ...config,
        }),
      ),
    ).pipe(ops.map((response) => response.data));
  }

  clearCache(): Observable<void> {
    return defer(() => {
      const clearRequest = this.cache.storage.clear();
      if (clearRequest !== undefined) {
        return from(clearRequest as Promise<void> | PromiseLike<void>);
      } else {
        return of(undefined);
      }
    });
  }

  upload<T>(
    url: string,
    data: unknown,
    settings: CacheRequestConfig = {},
  ): Observable<number | T> {
    const uploadProgress = new Subject<number>();
    const request = this.request<T>({
      ...settings,
      onUploadProgress(progress) {
        if (progress.total) {
          uploadProgress.next(progress.loaded / progress.total);
        }
      },
      url: url,
      data: data,
      method: "POST",
    });

    return merge(uploadProgress, request).pipe(
      // Complete the observable when request finishes, returning the last
      // value from the request
      ops.takeWhile((x) => typeof x === "number", true),
    );
  }

  download<T>(
    url: string,
    expectedSize?: number,
    settings: CacheRequestConfig = {},
  ): Observable<number | T> {
    const downloadProgress = new Subject<number>();
    const request = this.request<T>({
      onDownloadProgress(progress) {
        const actualTotal =
          progress.total !== undefined ? progress.total : expectedSize;
        if (actualTotal !== undefined) {
          downloadProgress.next(progress.loaded / actualTotal);
        }
      },
      ...settings,
      url: url,
      method: "GET",
    });

    return merge(downloadProgress, request).pipe(
      // Complete the observable when request finishes, returning the last
      // value from the request
      ops.takeWhile((x) => typeof x === "number", true),
    );
  }

  get<T>(url: string, settings: CacheRequestConfig = {}): Observable<T> {
    return this.request({
      ...settings,
      url: url,
      method: "GET",
    });
  }

  delete<T>(url: string, settings: CacheRequestConfig = {}): Observable<T> {
    return this.request({
      ...settings,
      url: url,
      method: "DELETE",
    });
  }

  head<T>(url: string, settings: CacheRequestConfig = {}): Observable<T> {
    return this.request({
      ...settings,
      url: url,
      method: "HEAD",
    });
  }

  post<T>(
    url: string,
    data: unknown,
    settings: CacheRequestConfig = {},
  ): Observable<T> {
    return this.request({
      ...settings,
      url: url,
      data: data,
      method: "POST",
    });
  }
}

@Injectable({
  providedIn: "root",
})
export class ApiService {
  toastrService = inject(ToastrService);
  private oidcService = inject(OidcSecurityService);

  dbg = (...d) => console.debug("ApiService:", ...d);
  err = (...d) => console.error("ApiService:", ...d);

  // list of security exclusions to filter queries with on the backend
  currentExclusions: string[];
  // list of security inclusions used to filter opensearch using AND for Rels to ensure only documents with the selected RELs are shown
  currentInclusions: string[];
  // collection of security dicts received from responses
  private receivedSecurities$ = new BehaviorSubject(new Set<string>());
  combinedSecurity$: Observable<string>;

  private http: AxiosClient;

  constructor() {
    this.http = new AxiosClient(this.oidcService);

    // load exclusions from browser data
    this.currentExclusions = JSON.parse(
      localStorage.getItem("currentExclusions") || "[]",
    );
    // load inclusions from browser data
    this.currentInclusions = JSON.parse(
      localStorage.getItem("currentInclusions") || "[]",
    );
    if (this.currentExclusions.length > 0) {
      console.warn(
        "Excluding server data with markings:",
        this.currentExclusions,
      );
    }
    this.combinedSecurity$ = this.receivedSecurities$.pipe(
      ops.map((d) => Array.from(d.values())),
      ops.filter((d) => d.length > 0),
      ops.mergeMap((d) => this.securityMax(d)),
    );
  }

  /**raise toast if http error is not in allow list*/
  handle<T>(
    e: AxiosError,
    allowdata: T = undefined,
    allow: number[] = undefined,
  ): Observable<T> {
    if (!allow) {
      allow = [];
    }

    if (
      allow.indexOf(e?.response?.status) >= 0 ||
      allow.indexOf(e?.status) >= 0
    ) {
      return of(allowdata);
    }

    const etitle = `API: ${e.message}`;
    this.toastrService.error(e.config?.url, etitle, { timeOut: 20000 });

    console.warn("Internal error handler failed to handle error:", e.message);
    throw e.message;
  }

  private genericDetailedErrorHandler<T>(
    e: AxiosError,
    allowdata: T,
    acceptedErrorStatus: number[],
    handlerFunction: (AxiosError) => Observable<T>,
  ) {
    if (!acceptedErrorStatus) {
      return this.handle(e, allowdata, []);
    }
    let responseCode = 0;
    if (acceptedErrorStatus.indexOf(e?.response?.status) >= 0) {
      responseCode = e?.response?.status;
    } else if (acceptedErrorStatus.indexOf(e?.status) >= 0) {
      responseCode = e?.status;
    }
    if (responseCode === 0) {
      return this.handle(e, allowdata, []);
    }
    return handlerFunction(e);
  }

  /**raise toast if http error is not in allow list*/
  handleFindDetailed<T>(
    e: AxiosError,
    allowdata: T = undefined,
    acceptedErrorStatus: number[] = undefined,
  ): Observable<T> {
    return this.genericDetailedErrorHandler(
      e,
      allowdata,
      acceptedErrorStatus,
      (innerE: AxiosError) => {
        const etitle = `Term Query Error: ${innerE.message}`;
        const responseDetail = innerE.response?.data as { detail: string };
        if (typeof responseDetail?.detail !== "string") {
          // can't do a detailed handling.
          return this.handle(innerE, allowdata, []);
        }
        this.toastrService.error(responseDetail?.detail, etitle, {
          timeOut: 20000,
        });
        throw innerE;
      },
    );
  }

  /**raise toast if http error is not in allow list*/
  handleStreamDetailed<T>(
    e: AxiosError,
    allowdata: T = undefined,
    acceptedErrorStatus: number[] = undefined,
  ): Observable<T> {
    return this.genericDetailedErrorHandler(
      e,
      allowdata,
      acceptedErrorStatus,
      (innerE: AxiosError) => {
        const etitle = `API: ${innerE.message}`;
        const detailedMessage = innerE.response?.data as {
          message: string;
          ref: string;
        };
        if (typeof detailedMessage?.message !== "string") {
          // can't do a detailed handling.
          return this.handle(innerE, allowdata, []);
        }
        this.toastrService.error(detailedMessage?.message, etitle, {
          timeOut: 20000,
        });

        console.warn(
          "Internal error handler failed to handle error:",
          e.message,
        );
        throw e;
      },
    );
  }

  /**change the current set of excluded security markings*/
  changeExclusions(excludedData: string[], includedData?: string[]) {
    // update local storage with new exclusion list
    localStorage.setItem("currentExclusions", JSON.stringify(excludedData));
    if (includedData.length > 0) {
      localStorage.setItem("currentInclusions", JSON.stringify(includedData));
    } else {
      localStorage.setItem("currentInclusions", JSON.stringify([]));
    }
    // refresh the page, so we clear our cache and reload using new security controls
    location.reload();
  }

  /**update whether AND or OR is used in OpenSearch with security filters for RELs */
  changeRelFilterOption(data: boolean) {
    // update local storage with filter option
    localStorage.setItem("relsFilterOption", JSON.stringify(data));
    // reload will be called in the changeExclusions function
  }

  //**get the saved filter option for RELs */
  getRelFilterOption(): string {
    return localStorage.getItem("relsFilterOption") || "false";
  }

  /** Clears all storage. */
  clearCache(): Observable<void> {
    return this.http.clearCache();
  }

  /**add the current set of exclusions to the parameters dict for an outgoing request*/
  private addExcl(p: { [id: string]: unknown }) {
    if (this.currentExclusions.length > 0) {
      p["x"] = this.currentExclusions;
    }
    // add the included RELs if user wants to filter by RELs in opensearch using AND instead of OR
    if (this.currentInclusions.length > 0) {
      p["i"] = this.currentInclusions;
    }
  }

  /**update set of received securities with a new entry*/
  private addReceivedSecurity(sec: string) {
    const tmp = this.receivedSecurities$.getValue();
    if (!tmp.has(sec)) {
      // only recompute if set has changed
      tmp.add(sec);
      this.receivedSecurities$.next(tmp);
    }
  }

  /**
   * Formats a URL at runtime with the given parameters.
   *
   * @param url The base URL of format "/xyz/{param1}/abc/{param2}"
   * @param params A dictionary of replacements for the URL
   */
  private formatURL(url: string, params: Record<string, unknown> | undefined) {
    // Manually iterate to assert that we have captured all params exactly once
    if (params !== undefined) {
      for (const [key, value] of Object.entries(params)) {
        // Find the key in the URL
        const searchKey = "{" + key + "}";

        const templateStart = url.indexOf(searchKey);

        if (templateStart === -1) {
          throw "Failed to find template key: " + key;
        }

        const templateEnd = templateStart + searchKey.length;

        url =
          url.slice(0, templateStart) +
          encodeURIComponent("" + value) +
          url.slice(templateEnd);
      }
    }

    // Ensure there are no remaining templates
    if (url.indexOf("{") !== -1) {
      throw "URL template has unfilled slots: " + url;
    }

    return url;
  }

  /**
   * Performs a GET operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param path optional arguments for the URL
   */
  private getOperation<T extends keyof ValidGETPaths>(
    url: T,
    params?: ValidGETPaths[T]["get"]["parameters"]["query"],
    path?: ValidGETPaths[T]["get"]["parameters"]["path"],
    config?: CacheRequestConfig,
  ): Observable<
    ValidGETPaths[T]["get"]["responses"][200]["content"]["application/json"]
  > {
    if (params === undefined) {
      params = {};
    }

    this.addExcl(params);
    return this.http.get(this.formatURL(url, path), {
      ...config,
      params: params,
    });
  }

  /**
   * Performs a POST operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param body JSON body to POST
   * @param path optional arguments for the URL
   */
  private postOperation<T extends keyof ValidPOSTPaths>(
    url: T,
    body?: ValidPOSTPaths[T]["post"]["requestBody"]["content"]["application/json"],
    params?: ValidPOSTPaths[T]["post"]["parameters"]["query"],
    path?: ValidPOSTPaths[T]["post"]["parameters"]["path"],
  ): Observable<
    ValidPOSTPaths[T]["post"]["responses"][200]["content"]["application/json"]
  > {
    this.addExcl(params);
    return this.http.post<
      ValidPOSTPaths[T]["post"]["responses"][200]["content"]["application/json"]
    >(this.formatURL(url, path), body, {
      params: params,
    });
  }

  /**
   * Performs a HEAD operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param path optional arguments for the URL
   */
  private headOperation<T extends keyof ValidHEADPaths>(
    url: T,
    params?: ValidHEADPaths[T]["head"]["parameters"]["query"],
    path?: ValidHEADPaths[T]["head"]["parameters"]["path"],
  ): Observable<
    ValidHEADPaths[T]["head"]["responses"][200]["content"]["application/json"]
  > {
    this.addExcl(params);
    return this.http.head<
      ValidHEADPaths[T]["head"]["responses"][200]["content"]["application/json"]
    >(this.formatURL(url, path), {
      params: params,
    });
  }

  /**
   * Performs a HEAD operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param path optional arguments for the URL
   */
  private deleteOperation<T extends keyof ValidDELETEPaths>(
    url: T,
    params?: ValidDELETEPaths[T]["delete"]["parameters"]["query"],
    path?: ValidDELETEPaths[T]["delete"]["parameters"]["path"],
  ): Observable<
    ValidDELETEPaths[T]["delete"]["responses"][200]["content"]["application/json"]
  > {
    this.addExcl(params);
    return this.http.delete<
      ValidDELETEPaths[T]["delete"]["responses"][200]["content"]["application/json"]
    >(this.formatURL(url, path), {
      params: params,
    });
  }

  /**
   * Performs a POST upload operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * This is a streaming alternative to {@link postOperation}.
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param body JSON body to POST
   * @param path optional arguments for the URL
   */
  private uploadOperation<T extends keyof ValidPOSTUploadPaths, BodyType>(
    url: T,
    body?: FileUpload<BodyType>,
    params?: ValidPOSTUploadPaths[T]["post"]["parameters"]["query"],
    path?: ValidPOSTUploadPaths[T]["post"]["parameters"]["path"],
  ): Observable<
    | ValidPOSTUploadPaths[T]["post"]["responses"][200]["content"]["application/json"]
    | number
  > {
    // Convert data to FormData
    const dataFD = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) {
        // multipart forms don't support arrays directly. the common pattern is just
        // to append multiple elements with the same name.
        for (const innerValue of value) {
          dataFD.append(key, innerValue);
        }
      } else {
        dataFD.append(key, value);
      }
    }

    this.addExcl(params);
    return this.http.upload<
      ValidPOSTUploadPaths[T]["post"]["responses"][200]["content"]["application/json"]
    >(this.formatURL(url, path), dataFD, {
      cache: false,
      params: params,
    });
  }

  /**
   * Performs a GET download operation with the OpenAPI spec corresponding to the given URL (which must be static).
   *
   * This is a streaming alternative to {@link getOperation} for Blob files.
   *
   * Parameters will automatically match the given OpenAPI spec.
   *
   * Path parameters should be given to a path of format "/xyz/{param1}/abc/{param2}" and will be swapped
   * in at runtime.
   *
   * @param params query parameters for the URL
   * @param body JSON body to POST
   * @param path optional arguments for the URL
   */
  private downloadOperation<
    T extends keyof ValidGETDownloadPaths,
    DType extends keyof DownloadType,
  >(
    url: T,
    responseType: DType,
    expectedSize?: number,
    params?: ValidGETDownloadPaths[T]["get"]["parameters"]["query"],
    path?: ValidGETDownloadPaths[T]["get"]["parameters"]["path"],
  ): Observable<DownloadType[DType] | undefined> {
    this.addExcl(params);
    return this.http
      .download<Blob>(this.formatURL(url, path), expectedSize, {
        cache: false,
        responseType: responseType,
        params: params,
      })
      .pipe(
        ops.catchError((e) => this.handleStreamDetailed(e, undefined, [422])),
      );
  }

  /**get details for the current user from restapi*/
  userDetail() {
    return this.getOperation("/api/v0/users/me").pipe(
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**get a boolean determining if the current user is an admin or not.*/
  isUserAdmin() {
    return this.getOperation("/api/v0/security/is_admin").pipe(
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**get details for the current user from opensearch*/
  userDetailOpensearch(
    params?: ValidGETPaths["/api/v0/users/me/opensearch"]["get"]["parameters"]["query"],
  ) {
    return this.getOperation("/api/v0/users/me/opensearch", params).pipe(
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**calculate most restrictive combination of security strings*/
  securityMax(
    secs: ValidPOSTPaths["/api/v1/security/max"]["post"]["requestBody"]["content"]["application/json"],
  ) {
    return this.postOperation("/api/v1/security/max", secs).pipe(
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**build a security string from security labels*/
  securityNormalise(
    secs: ValidPOSTPaths["/api/v1/security/normalise"]["post"]["requestBody"]["content"]["application/json"],
  ) {
    return this.postOperation("/api/v1/security/normalise", secs).pipe(
      ops.catchError((e) => this.handleFindDetailed(e, undefined, [400])),
      ops.catchError((e) => this.handle(e, undefined, [400])),
    );
  }

  /**get presets and display information for security module*/
  securitySettings() {
    return this.getOperation("/api/v0/security").pipe(
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**upload a binary file to an Azul source with the binary encoded in form data*/
  binaryUploadSource(
    data: FileUpload<
      ValidPOSTUploadPaths["/api/v0/binaries/source"]["post"]["requestBody"]["content"]["multipart/form-data"]
    >,
    extract?: boolean,
    password?: string,
  ): Observable<readonly components["schemas"]["BinaryData"][] | undefined> {
    const params: ValidPOSTUploadPaths["/api/v0/binaries/source"]["post"]["parameters"]["query"] =
      {
        refresh: true,
        extract: extract,
        password: password,
      };
    return this.uploadOperation("/api/v0/binaries/source", data, params).pipe(
      ops.catchError((e) =>
        this.handleStreamDetailed(e, undefined, [422, 425]),
      ),
    );
  }

  /**upload a binary file as a child with the binary encoded in form data*/
  binaryUploadChild(
    data: FileUpload<
      ValidPOSTUploadPaths["/api/v0/binaries/child"]["post"]["requestBody"]["content"]["multipart/form-data"]
    >,
    extract?: boolean,
    password?: string,
  ): Observable<readonly components["schemas"]["BinaryData"][] | undefined> {
    const params: ValidPOSTUploadPaths["/api/v0/binaries/child"]["post"]["parameters"]["query"] =
      {
        refresh: true,
        extract: extract,
        password: password,
      };
    return this.uploadOperation("/api/v0/binaries/child", data, params).pipe(
      ops.catchError((e) => this.handleStreamDetailed(e, undefined, [422])),
    );
  }

  /**download a binary file*/
  binaryDownload(
    sha256: string,
    expectedSize?: number,
  ): Observable<number | Blob> {
    return this.downloadOperation(
      "/api/v0/binaries/{sha256}/content",
      "blob",
      expectedSize,
      {},
      {
        sha256,
      },
    );
  }

  /**download a text stream for a binary*/
  textStream(
    binary_sha256: string,
    datastream_sha256: string,
  ): Observable<string> {
    return this.downloadOperation(
      "/api/v0/binaries/{sha256}/content/{stream}",
      "text",
      undefined,
      {},
      { sha256: binary_sha256, stream: datastream_sha256 },
    ).pipe(
      // Filter out progress numbers
      ops.filter((x) => typeof x === "string"),
    );
  }

  /**download a byte stream for a binary*/
  byteStream(sha256: string, stream: string): Observable<Blob> {
    return this.downloadOperation(
      "/api/v0/binaries/{sha256}/content/{stream}",
      "blob",
      undefined,
      {},
      { sha256: sha256, stream: stream },
    ).pipe(
      // Filter out progress numbers
      ops.filter((x) => x instanceof Blob),
    );
  }

  binaryExpedite(
    sha256: string,
    query: paths["/api/v0/binaries/{sha256}/expedite"]["post"]["parameters"]["query"] = {},
  ) {
    return this.postOperation(
      "/api/v0/binaries/{sha256}/expedite",
      {} as never,
      query,
      {
        sha256,
      },
    ).pipe(ops.catchError((e) => this.handle(e, 333, [])));
  }

  /**search azul for binaries matching certain criteria*/
  entityFind(
    params: paths["/api/v0/binaries"]["post"]["parameters"]["query"],
    hashes?: string[],
  ): Observable<components["schemas"]["EntityFind"] | undefined> {
    let body = undefined;
    if (hashes) {
      body = {
        hashes,
      };
    }
    return this.postOperation("/api/v0/binaries", body, params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handleFindDetailed(e, undefined, [422])),
    );
  }

  /** Search azul for binaries matching certain criteria */
  entityFindAll(
    params: paths["/api/v0/binaries/all"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimple"] | undefined> {
    return this.postOperation("/api/v0/binaries/all", body, params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handleFindDetailed(e, undefined, [422])),
    );
  }

  /** Search azul for binaries matching parent binaries */
  entityFindAllParents(
    params: paths["/api/v0/binaries/all/parents"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all/parents"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimpleFamily"] | undefined> {
    return this.postOperation(
      "/api/v0/binaries/all/parents",
      body,
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handleFindDetailed(e, undefined, [422])),
    );
  }

  /** Search azul for binaries matching child binaries */
  entityFindAllChildren(
    params: paths["/api/v0/binaries/all/children"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all/children"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimpleFamily"] | undefined> {
    return this.postOperation(
      "/api/v0/binaries/all/children",
      body,
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handleFindDetailed(e, undefined, [422])),
    );
  }

  /**check that an entity exists in azul*/
  entityCheckExists(sha256: string): Observable<boolean> {
    return this.headOperation("/api/v0/binaries/{sha256}", {}, { sha256 }).pipe(
      ops.map((_d) => true),
      ops.catchError((e) => this.handle(e, false, [404])),
    );
  }

  /**check that a binary has content in dispatcher/storage*/
  entityHasContent(sha256: string): Observable<boolean> {
    return this.headOperation(
      "/api/v0/binaries/{sha256}/content",
      {},
      { sha256 },
    ).pipe(
      ops.map((_d) => true),
      ops.catchError((e) => this.handle(e, false, [404])),
    );
  }

  /**fetches simple metadata for the given entity*/
  entityReadMain(
    sha256: string,
    query: paths["/api/v0/binaries/{sha256}"]["get"]["parameters"]["query"] = {},
  ): Observable<
    | components["schemas"]["Response__class__azul_bedrock.models_restapi.binaries.BinaryMetadata__"]
    | undefined
  > {
    return this.getOperation("/api/v0/binaries/{sha256}", query, {
      sha256,
    }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityReadTags(
    sha256: string,
    cache: false | undefined = undefined,
  ): Observable<readonly components["schemas"]["EntityTag"][]> {
    return this.getOperation(
      "/api/v0/binaries/{sha256}/tags",
      {},
      { sha256 },
      { cache },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data.items),
      ops.catchError((e) =>
        this.handle(e, [] as components["schemas"]["EntityTag"][], [404]),
      ),
    );
  }

  entityReadNearby(
    sha256: string,
  ): Observable<components["schemas"]["ReadNearby"] | undefined> {
    return this.getOperation(
      "/api/v0/binaries/{sha256}/nearby",
      {},
      { sha256 },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityReadSimilar(
    sha256: string,
    params: ValidGETPaths["/api/v0/binaries/{sha256}/similar"]["get"]["parameters"]["query"] = {},
  ): Observable<components["schemas"]["SimilarMatch"] | undefined> {
    return this.getOperation("/api/v0/binaries/{sha256}/similar", params, {
      sha256,
    }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityReadSimilarSsdeep(
    params: ValidGETPaths["/api/v0/binaries/similar/ssdeep"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["SimilarFuzzyMatch"] | undefined> {
    return this.getOperation("/api/v0/binaries/similar/ssdeep", params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityReadSimilarTLSH(
    params: ValidGETPaths["/api/v0/binaries/similar/tlsh"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["SimilarFuzzyMatch"] | undefined> {
    return this.getOperation("/api/v0/binaries/similar/tlsh", params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityStatus(
    sha256: string,
  ): Observable<readonly components["schemas"]["StatusEvent"][]> {
    return this.getOperation(
      "/api/v0/binaries/{sha256}/statuses",
      {},
      { sha256 },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data.items),
      ops.catchError((e) => {
        this.handle(e, [], [404]);
        return of([]);
      }),
    );
  }

  entityHasNewerMetadata(
    sha256: string,
    params: ValidGETPaths["/api/v0/binaries/{sha256}/new"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["BinaryDocuments"] | undefined> {
    return this.getOperation("/api/v0/binaries/{sha256}/new", params, {
      sha256,
    }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  entityQueryEvents(
    sha256: string,
    event_type: components["schemas"]["BinaryAction"],
  ): Observable<components["schemas"]["OpensearchDocuments"]> {
    return this.getOperation(
      "/api/v0/binaries/{sha256}/events",
      { event_type },
      { sha256 },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [404])),
    );
  }

  /**add a tag to a particlar entity*/
  entityCreateTags(sha256: string, tag: string, security: string) {
    return this.postOperation(
      "/api/v0/binaries/{sha256}/tags/{tag}",
      { security },
      {},
      { sha256, tag },
    ).pipe(ops.catchError((e) => this.handle(e, undefined, [])));
  }

  /**remove a tag from an entity*/
  entityDeleteTag(sha256: string, tag: string) {
    return this.deleteOperation(
      "/api/v0/binaries/{sha256}/tags/{tag}",
      {} as never,
      { sha256, tag },
    ).pipe(ops.catchError((e) => this.handle(e, undefined, [])));
  }

  /**read all existing tags for binaries*/
  entityReadAllTags(): Observable<
    components["schemas"]["ReadTags"] | undefined
  > {
    return this.getOperation("/api/v0/binaries/tags").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**Fetches the model for binaries from OpenSearch. */
  entityGetModel(): Observable<
    components["schemas"]["EntityModel"] | undefined
  > {
    return this.getOperation("/api/v0/binaries/model").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**Fetches the model for binaries from OpenSearch. */
  entityFindAutocomplete(
    term: string,
    offset: number,
  ): Observable<
    | components["schemas"]["Response_typing.Annotated_typing.Union_azul_bedrock.models_restapi.binaries_auto_complete.AutocompleteNone__azul_bedrock.models_restapi.binaries_auto_complete.AutocompleteInitial__azul_bedrock.models_restapi.binaries_auto_complete.AutocompleteFieldName__azul_bedrock.models_restapi.binaries_auto_complete.AutocompleteFieldValue__azul_bedrock.models_restapi.binaries_auto_complete.AutocompleteError___FieldInfo_annotation_NoneType__required_True__discriminator__type___"]["data"]
    | undefined
  > {
    return this.getOperation("/api/v0/binaries/autocomplete", {
      term,
      offset,
    }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  featureCountValues(
    items: string[],
    params: paths["/api/v0/features/values/counts"]["post"]["parameters"]["query"] = {},
  ): Observable<
    | components["schemas"]["Response_dict_str__azul_bedrock.models_restapi.features.FeatureMulticountRet_"]["data"]
    | undefined
  > {
    return this.postOperation(
      "/api/v0/features/values/counts",
      { items },
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  featureCountBinaries(
    items: string[],
    params: paths["/api/v0/features/entities/counts"]["post"]["parameters"]["query"] = {},
  ): Observable<
    | components["schemas"]["Response_dict_str__azul_bedrock.models_restapi.features.FeatureMulticountRet_"]["data"]
    | undefined
  > {
    return this.postOperation(
      "/api/v0/features/entities/counts",
      { items },
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  featureValuesCountBinaries(
    items: components["schemas"]["ValueCountItem"][],
    params: paths["/api/v0/features/values/entities/counts"]["post"]["parameters"]["query"] = {},
  ): Observable<
    | components["schemas"]["Response_dict_str__dict_str__azul_bedrock.models_restapi.features.ValueCountRet__"]["data"]
    | undefined
  > {
    return this.postOperation(
      "/api/v0/features/values/entities/counts",
      { items },
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  featureValuePartsCountBinaries(
    items: components["schemas"]["ValuePartCountItem"][],
    params: paths["/api/v0/features/values/parts/entities/counts"]["post"]["parameters"]["query"] = {},
  ): Observable<
    | components["schemas"]["Response_dict_str__dict_str__azul_bedrock.models_restapi.features.ValuePartCountRet__"]["data"]
    | undefined
  > {
    return this.postOperation(
      "/api/v0/features/values/parts/entities/counts",
      { items },
      params,
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**create a tag on a feature value*/
  featureCreateValueTags(
    tag: string,
    security: string,
    feature: string,
    value: string,
  ) {
    return this.postOperation(
      "/api/v0/features/tags/{tag}",
      { security },
      { feature, value },
      { tag },
    ).pipe(ops.catchError((e) => this.handle(e)));
  }

  /**remove a tag from a feature value*/
  featureDeleteValueTag(tag: string, feature: string, value: string) {
    return this.deleteOperation(
      "/api/v0/features/tags/{tag}",
      { feature, value },
      { tag },
    ).pipe(ops.catchError((e) => this.handle(e)));
  }

  /**read all existing tags for binaries*/
  featureReadAllTags(): Observable<
    components["schemas"]["ReadFeatureValueTags"] | undefined
  > {
    return this.getOperation("/api/v0/features/all/tags").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  featureReadTags(
    tag: string,
  ): Observable<components["schemas"]["ReadFeatureTagValues"] | undefined> {
    return this.getOperation("/api/v0/features/tags/{tag}", {}, { tag }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**search for a feature matching some criteria*/
  featureFind(
    params: paths["/api/v0/features"]["get"]["parameters"]["query"] = {},
  ): Observable<readonly components["schemas"]["Feature"][] | undefined> {
    return this.getOperation("/api/v0/features", params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data.items),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /**find values for a specific feature*/
  featureFindValues(
    feature: string,
    body: paths["/api/v0/features/feature/{feature}"]["post"]["requestBody"]["content"]["application/json"],
    params: paths["/api/v0/features/feature/{feature}"]["post"]["parameters"]["query"] = {},
  ): Observable<components["schemas"]["ReadFeatureValues"] | undefined> {
    return this.postOperation(
      "/api/v0/features/feature/{feature}",
      body,
      params,
      {
        feature,
      },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /** find feature values */
  featurePivotValues(
    body: paths["/api/v0/features/pivot"]["post"]["requestBody"]["content"]["application/json"],
    params: paths["/api/v0/features/pivot"]["post"]["parameters"]["query"] = {},
  ): Observable<components["schemas"]["FeaturePivotResponse"] | undefined> {
    return this.postOperation("/api/v0/features/pivot", body, params).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  sourceReadAll(): Observable<
    | components["schemas"]["Response_dict_str__azul_bedrock.models_settings.Source_"]["data"]
    | undefined
  > {
    return this.getOperation("/api/v0/sources").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
    );
  }

  /**read info for a specific source*/
  sourceRead(
    name: string,
  ): Observable<
    | components["schemas"]["azul_bedrock__models_restapi__sources__Source"]
    | undefined
  > {
    return this.getOperation("/api/v0/sources/{name}", {}, { name }).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  sourceRefsRead(
    source: string,
    term: string,
  ): Observable<readonly components["schemas"]["ReferenceSet"][]> {
    return this.getOperation(
      "/api/v0/sources/{source}/references",
      { term },
      { source },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data.items),
      ops.catchError((e) => this.handle(e, [], [404])),
    );
  }

  sourceSubmissionsRead(
    source: string,
    track_source_references?: string,
    timestamp?: string,
  ): Observable<readonly components["schemas"]["ReferenceSet"][]> {
    return this.getOperation(
      "/api/v0/sources/{source}/submissions",
      { track_source_references, timestamp },
      { source },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data.items),
      ops.catchError((e) => this.handle(e, [], [404])),
    );
  }

  /**get has content for entity */
  entityHasBinary(sha256: string): Observable<boolean> {
    return this.headOperation(
      "/api/v0/binaries/{sha256}/content",
      {},
      { sha256 },
    ).pipe(
      ops.map((_d) => true),
      ops.catchError((e) => this.handle(e, false, [404])),
    );
  }

  /**get hexview information for entity */
  entityHexView(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/hexview"]["get"]["parameters"]["query"] = {},
  ): Observable<components["schemas"]["BinaryHexView"] | undefined> {
    return this.getOperation("/api/v0/binaries/{sha256}/hexview", params, {
      sha256,
    }).pipe(ops.catchError((e) => this.handle(e, undefined, [404])));
  }

  /**get string information for entity */
  entityStrings(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/strings"]["get"]["parameters"]["query"] = {},
  ): Observable<components["schemas"]["BinaryStrings"] | undefined> {
    return this.getOperation("/api/v0/binaries/{sha256}/strings", params, {
      sha256,
    }).pipe(ops.catchError((e) => this.handle(e, undefined, [404])));
  }

  /**get string information for entity */
  entitySearchHex(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/search/hex"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["BinaryStrings"] | undefined> {
    return this.getOperation("/api/v0/binaries/{sha256}/search/hex", params, {
      sha256,
    }).pipe(ops.catchError((e) => this.handle(e, undefined, [404])));
  }

  pluginGetAll(): Observable<
    readonly components["schemas"]["LatestPluginWithVersions"][]
  > {
    return this.getOperation("/api/v0/plugins").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, [], [])),
    );
  }

  pluginGetAllStatuses(): Observable<
    readonly components["schemas"]["PluginStatusSummary"][]
  > {
    return this.getOperation("/api/v0/plugins/status").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, [], [])),
    );
  }

  pluginGet(
    name: string,
    version: string,
  ): Observable<components["schemas"]["PluginInfo"] | undefined> {
    return this.getOperation(
      "/api/v0/plugins/{name}/versions/{version}",
      {},
      { name, version },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  purgeSubmission<Purge extends boolean = false>(
    track_source_references: string,
    timestamp: string,
    purge?: Purge,
  ): Observable<
    | (Purge extends true
        ? components["schemas"]["Response_azul_bedrock.models_restapi.purge.PurgeSimulation___azul_bedrock.models_restapi.purge.PurgeResults"]
        : components["schemas"]["PurgeSimulation"])
    | undefined
  > {
    return this.deleteOperation(
      "/api/v0/purge/submission/{track_source_references}",
      { timestamp, purge },
      { track_source_references },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  purgeLink<Purge extends boolean = false>(
    track_link: string,
    purge?: Purge,
  ): Observable<
    | (Purge extends true
        ? components["schemas"]["Response_azul_bedrock.models_restapi.purge.PurgeSimulation___azul_bedrock.models_restapi.purge.PurgeResults"]
        : components["schemas"]["PurgeSimulation"])
    | undefined
  > {
    return this.deleteOperation(
      "/api/v0/purge/link/{track_link}",
      { purge },
      { track_link },
    ).pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }

  /** Fetches the latest global statistics from the server */
  statisticsGet(): Observable<
    components["schemas"]["StatisticSummary"] | undefined
  > {
    return this.getOperation("/api/v0/statistics").pipe(
      ops.tap((d) => this.addReceivedSecurity(d.meta.security)),
      ops.map((d) => d.data),
      ops.catchError((e) => this.handle(e, undefined, [])),
    );
  }
}
