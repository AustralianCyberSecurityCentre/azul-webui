import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  switchMap,
  catchError,
  of,
  map,
  tap,
  combineLatest,
} from "rxjs";
import { ApiService } from "src/app/core/api/api.service";
import { components } from "src/app/core/api/openapi";
import { toSignal } from "@angular/core/rxjs-interop";

type RetrohuntsResponse = components["schemas"]["RetrohuntsResponse"];

export interface RetrohuntQueryParams {
  limit?: number;
}

@Injectable({ providedIn: "root" })
export class RetrohuntService {
  private api = inject(ApiService);

  private params$ = new BehaviorSubject<RetrohuntQueryParams>({ limit: 50 });

  //separate trigger for forced refreshes
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  //internal subject that actually holds the hunts
  private _retrohuntSubject = new BehaviorSubject<RetrohuntsResponse["data"]>(
    [],
  );

  //public observable the component subscribes to
  retrohunts = toSignal(this._retrohuntSubject.asObservable(), {
    initialValue: [],
  });

  constructor() {
    combineLatest([this.params$, this.refreshTrigger$])
      .pipe(
        switchMap(([params]) =>
          this.api.listRetrohunts(params).pipe(
            map((raw) => {
              // Normalize BEFORE typing
              const wrapped: RetrohuntsResponse = Array.isArray(raw)
                ? { data: raw }
                : raw;
              return wrapped;
            }),
            catchError((err) => {
              console.error("RetrohuntService error:", err);

              const fallback: RetrohuntsResponse = { data: [] };
              return of(fallback);
            }),
          ),
        ),
      )
      .subscribe((response) => {
        this._retrohuntSubject.next([...response.data]);
      });
  }

  setParams(params: Partial<RetrohuntQueryParams>) {
    this.params$.next({ ...this.params$.value, ...params });
  }

  //CLEAN refresh
  refresh() {
    this.refreshTrigger$.next();
  }

  /** Submit a new retrohunt */
  submitHunt(
    body: {
      search_type: string;
      search: string;
      submitter: string;
      security: string;
    },
    params?: { x?: string[]; i?: string[]; include_queries?: boolean },
  ) {
    return this.api.submitRetrohunt(body, params);
  }

  cancelHunt(huntId: string) {
    return this.api.cancelRetrohunt(huntId);
  }

  //remove a hunt locally without refreshing
  removeHuntLocally(huntId: string) {
    const current = this._retrohuntSubject.value;
    const updated = current.filter((h) => h.id !== huntId);
    this._retrohuntSubject.next([...updated]); // force new reference
  }
}
