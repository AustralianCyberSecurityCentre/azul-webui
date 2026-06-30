import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ApiService } from "@app/core/api/api.service";
import { components } from "@app/core/api/openapi";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  of,
  switchMap,
} from "rxjs";

type RetrohuntsResponse = components["schemas"]["RetrohuntsResponse"];

export interface RetrohuntQueryParams {
  limit?: number;
}

@Injectable({ providedIn: "root" })
export class RetrohuntService {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

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
    const destroyRef = inject(DestroyRef);

    combineLatest([this.params$, this.refreshTrigger$])
      .pipe(
        takeUntilDestroyed(destroyRef),
        switchMap(([params]) =>
          this.api.listRetrohunts(params).pipe(
            map((raw) => {
              const wrapped: RetrohuntsResponse = Array.isArray(raw)
                ? { data: raw }
                : raw;
              return wrapped;
            }),
            catchError((err) => {
              console.error("RetrohuntService error:", err);
              return of({ data: [] } satisfies RetrohuntsResponse);
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
