import { inject, Injectable } from "@angular/core";
import { Observable, of, ReplaySubject, Subscription } from "rxjs";
import * as ops from "rxjs/operators";

import { ApiService } from "src/app/core/api/api.service";
import { components } from "./api/openapi";
import { FeatureValuesWithReference } from "./api/state";

type CB<T> = {
  name?: string;
  value?: string;
  part?: string;
  cb?: ReplaySubject<T>;
};

function countChain<T, U>(
  data: CB<T>[],
  transformer: (x: CB<T>, y: U) => T,
  apiFast: (x: CB<T>[]) => Observable<U>,
  apiSlow: (x: CB<T>[]) => Observable<U>,
): Subscription {
  return of(data)
    .pipe(
      // ensure the pipeline unsubscribes when done.
      ops.take(1),
      // fast count api
      ops.mergeMap((i) =>
        apiFast(i).pipe(
          ops.map((r) => {
            const missing = [];
            for (const d of i) {
              const tmp = transformer(d, r);
              if (tmp != undefined) {
                d.cb.next(tmp);
              } else {
                missing.push(d);
              }
            }
            return missing;
          }),
        ),
      ),
      ops.mergeAll(),
      ops.bufferTime(100, null, 50), // max items per query
      ops.filter((ds) => ds.length > 0), // nothing in the buffer
      ops.mergeMap(
        (i) =>
          apiSlow(i).pipe(
            ops.map((r) => {
              const missing = [];
              for (const d of i) {
                const tmp = transformer(d, r);
                if (tmp != undefined) {
                  d.cb.next(tmp);
                } else {
                  missing.push(d);
                }
              }
              return missing;
            }),
          ),
        1,
      ),
      ops.map(() => null),
    )
    .subscribe();
}

@Injectable({
  providedIn: "root",
})
export class FeatureService {
  private api = inject(ApiService);

  tags$: Observable<components["schemas"]["ReadFeatureValueTags"]>;
  descriptionMap$: Observable<Map<string, string>>;

  constructor() {
    this.tags$ = this.api.featureReadAllTags().pipe(ops.shareReplay(1));

    this.descriptionMap$ = this.features$().pipe(
      ops.map((d) => {
        const items = d;
        const tmp = new Map<string, string>();
        if (!items) {
          return tmp;
        }
        for (const row of items) {
          if (row.descriptions?.length > 0) {
            tmp.set(row.name, row.descriptions[0]?.desc);
          }
        }
        return tmp;
      }),
      ops.shareReplay(),
    );
  }

  featuresWithTag$(tag: string) {
    return this.api.featureReadTags(tag).pipe(ops.shareReplay(1));
  }

  getAllFeatures$(): Observable<
    readonly components["schemas"]["Feature"][] | undefined
  > {
    return this.features$();
  }

  features$(
    author: string = "",
    author_version: string = "",
  ): Observable<readonly components["schemas"]["Feature"][] | undefined> {
    const params = {
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
    };
    return this.api.featureFind(params);
  }

  featuresCountBinaries$(
    data: CB<number>[],
    author: string = "",
    author_version: string = "",
  ): Subscription {
    const params = {
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
    };
    return countChain(
      data,
      (x, y) => y[x.name]?.entities,
      (i) =>
        this.api.featureCountBinaries(
          i.map((x) => x.name),
          { skip_count: true, ...params },
        ),
      (i) =>
        this.api.featureCountBinaries(
          i.map((x) => x.name),
          { ...params },
        ),
    );
  }

  featuresCountValues$(
    data: CB<number>[],
    author: string = "",
    author_version: string = "",
  ): Subscription {
    const params = {
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
    };
    return countChain<number, unknown>(
      data,
      (x, y) => y[x.name]?.values,
      (i) =>
        this.api.featureCountValues(
          i.map((x) => x.name),
          { skip_count: true, ...params },
        ),
      (i) =>
        this.api.featureCountValues(
          i.map((x) => x.name),
          { ...params },
        ),
    );
  }

  featureValuesCountBinaries$(
    data: CB<number>[],
    author: string = "",
    author_version: string = "",
  ): Subscription {
    const params = {
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
    };
    return countChain<number, unknown>(
      data,
      (x, y) => y[x.name]?.[x.value]?.entities,
      (i) =>
        this.api.featureValuesCountBinaries(
          i.map((x) => {
            return { name: x.name, value: x.value };
          }),
          { skip_count: true, ...params },
        ),
      (i) =>
        this.api.featureValuesCountBinaries(
          i.map((x) => {
            return { name: x.name, value: x.value };
          }),
          { ...params },
        ),
    );
  }

  getPartValuesCount$(
    data: CB<number>[],
    author: string = "",
    author_version: string = "",
  ): Subscription {
    const params = {
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
    };
    return countChain<number, unknown>(
      data,
      (x, y) => y[x.value]?.[x.part]?.entities,
      (i) =>
        this.api.featureValuePartsCountBinaries(
          i.map((x) => {
            return { part: x.part, value: x.value };
          }),
          { skip_count: true, ...params },
        ),
      (i) =>
        this.api.featureValuePartsCountBinaries(
          i.map((x) => {
            return { part: x.part, value: x.value };
          }),
          { ...params },
        ),
    );
  }

  /** read details for a specific feature */
  featureRead(
    feature: string,
    term: string = "",
    sort_asc: boolean = false,
    author: string = "",
    author_version: string = "",
    num_values: number = 500,
    after: string = "",
  ): Observable<FeatureValuesWithReference> {
    const params = {
      sort_asc: sort_asc,
      ...(term && { term: term }),
      ...(author && { author: author }),
      ...(author_version && { author_version: author_version }),
      ...(num_values && { num_values: num_values }),
    };
    return this.api.featureFindValues(feature, { after: after }, params).pipe(
      ops.map((x) => {
        const d = x as FeatureValuesWithReference;

        for (const v of d.values) {
          if (d.type == "binary") {
            try {
              v.XValueDecoded = b64ToReadable(v.value);
            } catch {
              console.error(
                "Possible mixed types for feature: " +
                  feature +
                  " value: " +
                  v.value +
                  " was expecting base64",
              );
            }
          }
        }
        return d;
      }),
    );
  }

  /** add a tag to a feature value */
  createTag(feature: string, value: string, tag: string, security: string) {
    return this.api.featureCreateValueTags(tag, security, feature, value);
  }

  /** remove a tag from a feature value */
  deleteTag(feature: string, value: string, tag: string) {
    return this.api.featureDeleteValueTag(tag, feature, value);
  }
}

export function b64ToReadable(value: string): string {
  /** Convert base64 string (binary type features) to an escaped ascii repr */
  return atob(value).replace(/./gs, function (c) {
    const code = c.charCodeAt(0);
    switch (true) {
      case code == 9:
        return "\\t";
      case code == 10:
        return "\\n";
      case code == 13:
        return "\\r";
      case code > 31 && code < 127:
        return c;
      default:
        return "\\x" + ("0" + (c.charCodeAt(0) & 0xff).toString(16)).slice(-2);
    }
  });
}
