import { Injectable, inject } from "@angular/core";

import { Store } from "@ngrx/store";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  combineLatest,
  from,
  of,
  partition,
  timer,
} from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { FeatureService, b64ToReadable } from "src/app/core/feature.service";
import * as fromGlobalSettings from "./store/global-settings/global-selector";
import * as tInfo from "./api/info";
import { cacheData, getCacheKeys, getCachedValue, hashObject } from "./util";
import { components, paths } from "./api/openapi";
import {
  FeatureWithDecodedValue,
  FuzzyMatchWithSummary,
  SimilarMatchWithSummary,
  BulkEntitySummarySubmit,
  SimilarRowWithSummary,
  PathWithSummary,
} from "./api/state";

/** turns a list of items into a list of list of items, constrained by max items per chunk */
function chunkify<T>(items: T[], max: number): T[][] {
  const ret = [];
  let chunk = [];
  for (const item of items) {
    if (chunk.length >= max) {
      ret.push(chunk);
      chunk = [];
    }
    chunk.push(item);
  }
  ret.push(chunk);
  return ret;
}

/**wraps an entity type and id into a collection of observables and helper functions
to access entity data from backend*/
export class EntityWrap {
  dbg = (...d) => console.debug("Entity:", ...d);
  err = (...d) => console.error("Entity:", ...d);

  sha256: string;

  summary$: Observable<components["schemas"]["EntityFind"]["items"][0]>;
  hasContent$: Observable<boolean>;
  security$: Observable<readonly string[]>;
  sources$: Observable<readonly components["schemas"]["BinarySource"][]>;
  instances$: Observable<readonly components["schemas"]["EntityInstance"][]>;
  instancesKv$: Observable<
    Map<string, components["schemas"]["EntityInstance"]>
  >;
  // no counts or tags. just features and values
  rawFeatures$: Observable<FeatureWithDecodedValue[]>;
  features$: Observable<FeatureWithDecodedValue[]>;
  // Add additional tags to features if they were added while the entity was still being cached
  featureAddedTags$: BehaviorSubject<components["schemas"]["FeatureValueTag"]> =
    new BehaviorSubject<components["schemas"]["FeatureValueTag"]>(null);
  streams$: Observable<readonly components["schemas"]["DatastreamInstances"][]>;
  info$: Observable<readonly components["schemas"]["BinaryInfo"][]>;
  parents$: Observable<readonly components["schemas"]["PathNode"][]>;
  children$: Observable<readonly components["schemas"]["PathNode"][]>;
  nearby$: Observable<components["schemas"]["ReadNearby"]>;
  similar_ssdeep$: Observable<FuzzyMatchWithSummary>;
  similar_tlsh$: Observable<FuzzyMatchWithSummary>;
  similar$: Observable<SimilarMatchWithSummary>;
  /**tags can be created by user, need to be refetched when this occurs*/
  tags$: BehaviorSubject<readonly components["schemas"]["EntityTag"][] | null> =
    new BehaviorSubject(null);
  tagsSub: Subscription;

  featuresOffset$: Observable<FeatureWithDecodedValue[]>;

  statuses$: Observable<readonly components["schemas"]["StatusEvent"][]>;

  entropy$: Observable<tInfo.Entropy>;
  sandbox$: Observable<tInfo.Sandbox[]>;
  documents$: Observable<components["schemas"]["BinaryDocuments"]>;
  hasNewer$: Observable<components["schemas"]["BinaryDocuments"]>;

  diagnostics$: Observable<
    readonly components["schemas"]["BinaryDiagnostic"][]
  >;

  queriesSummary$: ReplaySubject<
    readonly components["schemas"]["QueryInfo"][]
  > = new ReplaySubject(1);

  /**Refresh the entities tags*/
  refreshTags() {
    // Refresh tags if they haven't been set yet
    if (this.tags$.value == null) {
      this.api
        .entityReadTags(this.sha256)
        .pipe(ops.first())
        .subscribe((tags) => {
          this.tags$.next(tags);
        });
      return;
    } else {
      // Refresh tags if the count has changed, otherwise keep trying.
      const oldTagLength = this.tags$.value.length;
      // Only to prevent lots of subscriptions building up so no need to unsubscribe in destructor, because it will
      // stop after 10seconds.
      this.tagsSub?.unsubscribe();
      this.tagsSub = this.api
        .entityReadTags(this.sha256, false)
        .pipe(
          // Repeat 10 times as Opensearch may not immediately be in sync.
          ops.repeat({ delay: 1000, count: 10 }),
          ops.skipWhile((newTags) => oldTagLength === newTags.length),
          ops.take(1),
        )
        .subscribe((newTags) => {
          this.tags$.next(newTags);
        });
    }
  }

  refreshStatus() {
    this.statuses$ = this.api
      .entityStatus(this.sha256)
      .pipe(ops.shareReplay(1));
  }

  refreshSimilar() {
    this.similar$ = this._pollSimilar(
      this.api.entityReadSimilar(this.sha256, { recalculate: true }),
    );
  }

  _pollSimilar(obs$: Observable<components["schemas"]["SimilarMatch"]>) {
    return obs$
      .pipe(
        ops.mergeMap((d) => {
          if (!d || d.status == "complete") {
            return of(d);
          }
          const complete = new Subject<boolean>();
          return timer(5000, 5000).pipe(
            // Re-check ReadSimilar every 5seconds until it's ready
            ops.takeUntil(complete),
            ops.mergeMap(() =>
              this.api.entityReadSimilar(this.sha256, { recalculate: true }),
            ),
            ops.startWith(d),
            ops.tap((d) =>
              d.status == "complete" ? complete.next(true) : null,
            ),
          );
        }),
        ops.shareReplay(1),
      )
      .pipe(
        // Optimize loading of related entities
        ops.map((similar: SimilarMatchWithSummary) => {
          const allEntities: BulkEntitySummarySubmit[] = [];
          similar?.matches.forEach((d: SimilarRowWithSummary) => {
            const sub$ = new ReplaySubject<
              components["schemas"]["EntityFindItem"]
            >(1);
            allEntities.push({ eid: d.sha256, sub$: sub$ });
            d._localEntitySummary$ = sub$;
          });
          this.entityService.requestBulkEntitySummary(allEntities);
          return similar;
        }),
        ops.shareReplay(1),
      );
  }

  refreshNewer() {
    this.hasNewer$ = this.documents$.pipe(
      ops.map((d) => d.newest),
      ops.mergeMap((d) =>
        this.api.entityHasNewerMetadata(this.sha256, { timestamp: d }),
      ),
      ops.shareReplay(1),
    );
  }

  expedite() {
    return this.api.binaryExpedite(this.sha256, { bypass_cache: true }).pipe(
      ops.map(() => 100),
      ops.shareReplay(1),
    );
  }

  /**find info from a specific author (e.g. entropy)*/
  private infoSpecific$(
    category: string,
    name: string,
  ): Observable<components["schemas"]["BinaryInfo"]["info"][""]> {
    return this.info$.pipe(
      ops.map((d) => {
        if (!d) {
          return null;
        }
        for (const info of d) {
          if (
            info.instance
              .toLowerCase()
              .includes(`${category}.${name}`.toLowerCase())
          ) {
            return info.info;
          }
        }
        return null;
      }),
    );
  }

  constructor(
    private api: ApiService,
    private store: Store,
    private featureService: FeatureService,
    eid: string,
    detail: components["schemas"]["BinaryMetadataDetail"][],
    private entityService: EntityService,
  ) {
    this.dbg(`Create entity ${eid}`);
    this.sha256 = eid;

    this.refreshTags();
    this.refreshStatus();

    // in the following we use "ops.shareReplay(1)"
    // this prevents errors from causing the data to be re-requested constantly
    // under certain circumstances when shareReplay is used, while still caching data.
    const main$ = combineLatest([
      this.store.select(fromGlobalSettings.selectBucketSize),
      this.store.select(fromGlobalSettings.selectShowDebugInfo),
    ]).pipe(
      ops.switchMap(([bucketSize, getDebugInfo]) =>
        this.api.entityReadMain(this.sha256, {
          bucket_size: bucketSize,
          include_queries: getDebugInfo,
          detail: detail,
        }),
      ),
      ops.tap((v) => {
        this.dbg("DebugTabComponent: Queries set", v?.meta?.queries);
        this.queriesSummary$.next(v?.meta?.queries ? v.meta.queries : []);
      }),
      ops.shareReplay(1),
    );

    this.hasContent$ = this.api
      .entityHasContent(this.sha256)
      .pipe(ops.shareReplay(1));

    const mainData$ = main$.pipe(
      ops.map((d) => d.data),
      ops.shareReplay(1),
    );
    // set up the easy observables
    this.summary$ = this.api.entityFind({}, [eid]).pipe(
      ops.map((v) => v.items[0]),
      ops.shareReplay(1),
    );
    this.security$ = mainData$.pipe(
      ops.map((d) => d.security),
      ops.shareReplay(1),
    );
    this.sources$ = mainData$.pipe(
      ops.map((d) => d.sources),
      ops.shareReplay(1),
    );

    this.instances$ = mainData$.pipe(
      ops.map((d) => d.instances),
      ops.shareReplay(1),
    );
    this.instancesKv$ = mainData$.pipe(
      ops.map((d) => {
        const tmp = new Map<string, components["schemas"]["EntityInstance"]>();
        for (const r of d.instances) {
          tmp.set(r.key, r);
        }
        return tmp;
      }),
      ops.shareReplay(1),
    );
    this.streams$ = mainData$.pipe(
      ops.map((d) => d.streams),
      ops.shareReplay(1),
    );
    this.info$ = mainData$.pipe(
      ops.map((d) => d.info),
      ops.shareReplay(1),
    );
    this.diagnostics$ = mainData$.pipe(
      ops.map((d) => d.diagnostics),
      ops.filter((d) => d !== undefined),
      ops.shareReplay(1),
    );

    this.similar$ = this._pollSimilar(
      mainData$.pipe(
        ops.mergeMap((_) =>
          this.api.entityReadSimilar(this.sha256, { recalculate: false }),
        ),
        ops.shareReplay(1),
      ),
    );

    const featuresChanged$ = new BehaviorSubject(true);
    this.rawFeatures$ = mainData$.pipe(
      ops.map((d) => {
        return d.features as FeatureWithDecodedValue[];
      }),
      ops.tap((features) => {
        for (const v of features) {
          // decode binary feature values
          if (v.type == "binary") {
            try {
              v.XValueDecoded = b64ToReadable(v.value as string);
            } catch {
              console.error(
                "Incorrect binary feature encoding name: " +
                  v.name +
                  " value: " +
                  v.value,
              );
            }
          }
        }
      }),
      ops.combineLatestWith(this.featureService.descriptionMap$),
      ops.map(([features, descriptionMap]) => {
        const fe = features as FeatureWithDecodedValue[];
        fe.forEach((x) => {
          x.description = descriptionMap.get(x.name);
        });
        return fe;
      }),
      // look for uncounted feature values and recount
      ops.tap((features) => {
        of(null)
          .pipe(
            ops.mergeMap(() =>
              chunkify(
                features.filter((x) => !x?.XBinaries),
                1000,
              ),
            ),
            ops.map((chunk_fv) => {
              const query_fvs = chunk_fv.map((f) => {
                return { name: f.name, value: f.value };
              });
              return this.api
                .featureValuesCountBinaries(query_fvs, { skip_count: true })
                .pipe(
                  ops.tap((d) => {
                    for (const fv of chunk_fv) {
                      const counted = d?.[fv.name]?.[fv.value.toString()];
                      if (!counted) {
                        continue;
                      }
                      fv.XBinaries = counted?.entities;
                    }
                  }),
                  ops.tap(() => featuresChanged$.next(true)),
                );
            }, 1),
            ops.concatAll(),
            ops.mergeMap(() =>
              chunkify(
                features.filter((x) => !x?.XBinaries),
                1000,
              ),
            ),
            ops.map((chunk_fv) => {
              const query_fvs = chunk_fv.map((f) => {
                return { name: f.name, value: f.value };
              });
              return this.api.featureValuesCountBinaries(query_fvs, {}).pipe(
                ops.tap((d) => {
                  for (const fv of chunk_fv) {
                    const counted = d?.[fv.name]?.[fv.value.toString()];
                    if (!counted) {
                      continue;
                    }
                    fv.XBinaries = counted?.entities;
                  }
                }),
                ops.tap(() => featuresChanged$.next(true)),
              );
            }, 1),
            ops.concatAll(),
          )
          .subscribe();
      }),
      ops.shareReplay(1),
    );

    this.parents$ = mainData$.pipe(
      ops.map((d) => d.parents as PathWithSummary[]),
      // Optimize loading of related entities
      ops.map((parents) => {
        const allEntities: BulkEntitySummarySubmit[] = [];
        parents.forEach((d) => {
          const sub$ = new ReplaySubject<
            components["schemas"]["EntityFindItem"]
          >(1);
          allEntities.push({
            eid: d.sha256,
            sub$: sub$,
          });
          d._localEntitySummary$ = sub$;
        });
        this.entityService.requestBulkEntitySummary(allEntities);
        return parents;
      }),
      ops.shareReplay(1),
    );

    this.children$ = mainData$.pipe(
      ops.map((d) => d.children as PathWithSummary[]),
      // Optimize loading of related entities
      ops.map((children) => {
        const allEntities: BulkEntitySummarySubmit[] = [];
        children.forEach((d) => {
          const sub$ = new ReplaySubject<
            components["schemas"]["EntityFindItem"]
          >(1);
          allEntities.push({
            eid: d.sha256,
            sub$: sub$,
          });
          d._localEntitySummary$ = sub$;
        });
        this.entityService.requestBulkEntitySummary(allEntities);
        return children;
      }),
      ops.shareReplay(1),
    );

    this.nearby$ = this.api.entityReadNearby(eid).pipe(ops.shareReplay(1));

    this.documents$ = mainData$.pipe(
      ops.map((d) => d.documents),
      ops.shareReplay(1),
    );
    this.hasNewer$ = null;

    const parseFuzzyHashResult = (similar_fuzzy: FuzzyMatchWithSummary) => {
      if (!similar_fuzzy?.matches) {
        return null;
      }
      const allEntities: BulkEntitySummarySubmit[] = [];
      similar_fuzzy.matches.forEach((d) => {
        const sub$ = new ReplaySubject<components["schemas"]["EntityFindItem"]>(
          1,
        );
        allEntities.push({ eid: d.sha256, sub$: sub$ });
        d._localEntitySummary$ = sub$;
      });
      this.entityService.requestBulkEntitySummary(allEntities);
      return similar_fuzzy;
    };

    this.similar_ssdeep$ = this.summary$.pipe(
      ops.mergeMap((d) =>
        d?.ssdeep
          ? this.api.entityReadSimilarSsdeep({
              ssdeep: d.ssdeep,
              max_matches: 20,
            })
          : of(null),
      ),
      // Optimize loading of related entities
      ops.map(parseFuzzyHashResult),
      ops.shareReplay(1),
    );

    this.similar_tlsh$ = this.summary$.pipe(
      ops.mergeMap((d) =>
        d?.tlsh
          ? this.api.entityReadSimilarTLSH({ tlsh: d.tlsh, max_matches: 20 })
          : of(null),
      ),
      // Optimize loading of related entities
      ops.map(parseFuzzyHashResult),
      ops.shareReplay(1),
    );

    this.features$ = featuresChanged$.pipe(
      ops.switchMap(() => this.rawFeatures$),
      ops.tap((features) => {
        let data = [];
        const mults = ["filepath_unix", "filepath_unixr"];
        for (const row of features) {
          row.XPartsBinaries = [];
          for (const k in row.parts) {
            if (k === "location") {
              continue;
            }
            if (mults.indexOf(k) >= 0) {
              for (const rval of row.parts[k]) {
                if (rval !== "") {
                  row.XPartsBinaries.push({
                    part: k,
                    value: rval,
                    cb: new ReplaySubject<number>(1),
                  });
                }
              }
            } else if (row.parts[k] !== "") {
              row.XPartsBinaries.push({
                part: k,
                value: row.parts[k],
                cb: new ReplaySubject<number>(1),
              });
            }
          }
          data = data.concat(row.XPartsBinaries);
        }
        // This subscription will unsubscribe itself and because the entity is stored in the cache we should allow
        // the subscription to finish.
        this.featureService.getPartValuesCount$(data);
      }),
      // Append extra tags to cached entity without having to reload the entity from the server.
      ops.combineLatestWith(this.featureAddedTags$),
      ops.map(([features, featureTagAdded]) => {
        if (!featureTagAdded) {
          return features;
        }
        const featureIdentifier = `${featureTagAdded.feature_name}-${featureTagAdded.feature_value}`;
        for (const f of features) {
          if (featureIdentifier === `${f.name}-${f.value}`) {
            if (!f.tags) {
              f.tags = [featureTagAdded];
            } // Append tag unless it's a duplicate
            else if (!f.tags.some((tag) => tag.tag === featureTagAdded.tag)) {
              f.tags = [...f.tags, featureTagAdded];
            }
            break;
          }
        }
        return features;
      }),
      ops.shareReplay(1),
    );

    // keep only features with offsets
    this.featuresOffset$ = featuresChanged$.pipe(
      ops.switchMap(() => this.rawFeatures$),
      ops.map((d) => d.filter((row) => row.parts.location?.length > 0)),
      ops.shareReplay(1),
    );

    this.entropy$ = this.infoSpecific$("plugin", "entropy").pipe(
      ops.map((d) => (d ? (d["entropy"] as tInfo.Entropy) : undefined)),
      ops.shareReplay(1),
    );

    this.sandbox$ = mainData$.pipe(
      ops.map((d) => {
        if (!d?.info) {
          return null;
        }
        const s: tInfo.Sandbox[] = [];
        for (const info of d.info) {
          const sandbox = info
            ? (info["sandbox"] as tInfo.Sandbox[])
            : undefined;
          if (!sandbox) {
            continue;
          }
          for (const v of sandbox) {
            // if needed, try to correlate with stream based on author
            if (!v.pcap && v.pcap_author) {
              for (const st of d.streams) {
                if (
                  st.instances.length > 0 &&
                  st.instances[0].indexOf(v.pcap_author) >= 0 &&
                  st.file_format_legacy == "Network capture"
                ) {
                  v.pcap = st.sha256;
                }
              }
            }
            s.push(v);
          }
        }
        return s;
      }),
      ops.shareReplay(1),
    );
  }
}

@Injectable({
  providedIn: "root",
})
export class EntityService {
  private api = inject(ApiService);
  private store = inject(Store);
  private featureService = inject(FeatureService);
  private trigger$ = new Subject<void>();
  dbg = (...d) => console.debug("EntityService:", ...d);
  err = (...d) => console.error("EntityService:", ...d);
  requestBulkEntitySummary(ents: BulkEntitySummarySubmit[]): Subscription {
    if (!(ents?.length > 0)) {
      return;
    }
    const _entity_simple_key = (eid: string = "") => `${eid}`;
    const eSimple = "entity_simple";
    const [uncached$, cached$] = partition(
      ents,
      (v) => getCacheKeys(eSimple).indexOf(_entity_simple_key(v.eid)) === -1,
    );

    from(cached$).subscribe((v) => {
      getCachedValue<Observable<components["schemas"]["EntityFindItem"]>>(
        eSimple,
        _entity_simple_key(v.eid),
      )
        .pipe(ops.take(1))
        .subscribe((newValue) => {
          // Read the value if we get something back
          if (newValue) {
            v.sub$.next(newValue);
            v.sub$.complete();
          } else {
            console.error(
              `Failed to load cached value during bulk request, for entity with id '${v.eid}'`,
            );
          }
        });
    });

    return from(uncached$)
      .pipe(
        ops.bufferTime(15, null, 10),
        ops.filter((ds) => ds.length > 0),
        ops.concatMap((ds) => {
          const entIds = ds.map((x) => {
            return x.eid;
          });
          return this.api.entityFind({}, entIds).pipe(
            ops.first(),
            ops.tap((r) => {
              for (const d of ds) {
                const ent = r.items.find((item) => item.sha256 === d.eid);
                if (!ent) {
                  console.warn(
                    `Couldn't find data for entity with id '${d.eid}'`,
                  );
                }
                d.sub$.next(ent);
                d.sub$.complete();
                cacheData(
                  eSimple,
                  1000,
                  _entity_simple_key(d.eid),
                  () => d.sub$,
                );
              }
            }),
          );
        }),
        ops.catchError((err) => {
          console.error("Failed to get file metadata. Error: ", err);
          return of();
        }),
      )
      .subscribe();
  }

  /**return entity wrapper for supplied id*/
  entity(
    eid: string,
    detail: components["schemas"]["BinaryMetadataDetail"][] = [],
  ) {
    const fn = () =>
      new EntityWrap(
        this.api,
        this.store,
        this.featureService,
        eid,
        detail,
        this,
      );
    return cacheData("entity", 5, `${eid}.${detail}`, fn);
  }

  /**return find observable for requested search results*/
  find(
    params: paths["/api/v0/binaries"]["post"]["parameters"]["query"],
    body?: string[],
  ): Observable<components["schemas"]["EntityFind"]> {
    const hash = hashObject(params) + hashObject({ body: body });
    return cacheData("entity_find", 10, hash, () =>
      this.api.entityFind(params, body).pipe(ops.shareReplay(1)),
    );
  }

  findPageable(
    params: paths["/api/v0/binaries/all"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimple"]> {
    return this.api.entityFindAll(params, body).pipe(ops.shareReplay(1));
  }

  findPageableParents(
    params: paths["/api/v0/binaries/all/parents"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all/parents"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimpleFamily"]> {
    return this.api.entityFindAllParents(params, body).pipe(ops.shareReplay(1));
  }

  findPageableChildren(
    params: paths["/api/v0/binaries/all/children"]["post"]["parameters"]["query"],
    body: paths["/api/v0/binaries/all/children"]["post"]["requestBody"]["content"]["application/json"],
  ): Observable<components["schemas"]["EntityFindSimpleFamily"]> {
    return this.api
      .entityFindAllChildren(params, body)
      .pipe(ops.shareReplay(1));
  }

  /** cached wrapper for hexview api call */
  hexview(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/hexview"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["BinaryHexView"]> {
    const p: paths["/api/v0/binaries/{sha256}/hexview"]["get"]["parameters"]["query"] & {
      XEntityId: string;
    } = {
      ...params,
      // For uniqueness when caching
      XEntityId: sha256,
    };

    const fn = () =>
      this.api.entityHexView(sha256, params).pipe(ops.shareReplay(1));
    return cacheData("hexview", 10, hashObject(p), fn);
  }
  /** cached wrapper for hexview api call */
  strings(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/strings"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["BinaryStrings"]> {
    const p: paths["/api/v0/binaries/{sha256}/strings"]["get"]["parameters"]["query"] & {
      XEntityId: string;
    } = {
      ...params,
      // For uniqueness when caching
      XEntityId: sha256,
    };

    const fn = () =>
      this.api.entityStrings(sha256, params).pipe(ops.shareReplay(1));
    return cacheData("strings", 10, hashObject(p), fn);
  }

  /** cached wrapper for binary searching api call */
  searchHex(
    sha256: string,
    params: paths["/api/v0/binaries/{sha256}/search/hex"]["get"]["parameters"]["query"],
  ): Observable<components["schemas"]["BinaryStrings"]> {
    const p: paths["/api/v0/binaries/{sha256}/search/hex"]["get"]["parameters"]["query"] & {
      XEntityId: string;
    } = {
      ...params,
      // For uniqueness when caching
      XEntityId: sha256,
    };

    const fn = () =>
      this.api.entitySearchHex(sha256, params).pipe(ops.shareReplay(1));
    return cacheData("searchHex", 10, hashObject(p), fn);
  }

  /**return download observable with progress for requested hash*/
  download(
    sha256: string,
    expectedSize: number | undefined,
  ): Observable<number> {
    function download(filename: string, text: Blob) {
      const element = document.createElement("a");
      element.setAttribute("href", URL.createObjectURL(text));
      element.setAttribute("download", filename + ".cart");
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    }
    return this.api.binaryDownload(sha256, expectedSize).pipe(
      ops.map((d) => {
        if (typeof d === "number") {
          return d * 100;
        } else {
          download(sha256, d);
          return 100;
        }
      }),
      ops.shareReplay(1),
    );
  }

  /**Fetch a stream for this entity as an unneutered blob.  Allowable streams vetted server side. */
  streamBlob(sha256: string, streamHash: string): Observable<Blob> {
    return this.api.byteStream(sha256, streamHash);
  }

  /**Trigger a download of the specified stream.*/
  downloadStream(sha256: string, streamHash: string, filename: string) {
    function down(filename: string, blob: Blob) {
      const element = document.createElement("a");
      element.setAttribute("href", URL.createObjectURL(blob));
      element.setAttribute("download", filename);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    }

    return this.streamBlob(sha256, streamHash).pipe(
      ops.map((d) => {
        return down(filename, d);
      }),
      ops.shareReplay(1),
    );
  }

  /**add a tag to an entity*/
  createTag(sha256: string, tag: string, security: string) {
    return this.api.entityCreateTags(sha256, tag, security);
  }

  /**remove a tag from an entity*/
  deleteTag(sha256: string, tag: string) {
    return this.api.entityDeleteTag(sha256, tag);
  }

  // tags$: BehaviorSubject<tBin.get_v0_binaries_sha256_tags["resp"]["items"]> =
  //   new BehaviorSubject<tBin.get_v0_binaries_sha256_tags["resp"]["items"]>(
  //     null,
  //   );
  /**Refresh the entities tags*/
  refreshTags(
    tags$: BehaviorSubject<readonly components["schemas"]["EntityTag"][]>,
    sha256: string,
  ) {
    // Refresh tags if they haven't been set yet
    if (tags$.value == null) {
      this.api
        .entityReadTags(sha256)
        .pipe(ops.first())
        .subscribe((tags) => {
          tags$.next(tags);
        });
      return;
    } else {
      // Refresh tags if the count has changed, otherwise keep trying.
      const oldTagLength = tags$.value.length;
      this.api
        .entityReadTags(sha256, false)
        .pipe(
          // Repeat 10 times as Opensearch may not immediately be in sync.
          ops.repeat({ delay: 1000, count: 10 }),
          ops.skipWhile((newTags) => oldTagLength === newTags.length),
          ops.take(1),
        )
        .subscribe((newTags) => {
          tags$.next(newTags);
        });
    }
  }

  /**Fetches the current binary model keys. */
  getModel() {
    return this.api.entityGetModel();
  }

  /**Fetches the current binary model keys. */
  findAutocomplete(term: string, offset: number) {
    return this.api.entityFindAutocomplete(term, offset);
  }

  /**Purges (or simulates a purge of) a reference set. */
  purgeReferenceSet<Purge extends boolean = false>(
    track_source_references: string,
    timestamp: string,
    purge: Purge,
  ) {
    return this.api.purgeSubmission<Purge>(
      track_source_references,
      timestamp,
      purge,
    );
  }

  /**Purges a link between files. */
  purgeLink<Purge extends boolean = false>(track_link: string, purge: Purge) {
    return this.api.purgeLink<Purge>(track_link, purge);
  }

  entityTriggerSearch(): void {
    this.trigger$.next();
  }

  onEntitySearchTriggered(): Observable<void> {
    return this.trigger$.asObservable();
  }
}
