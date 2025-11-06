import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { BehaviorSubject, Observable, ReplaySubject, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";

import { Entity } from "src/app/core/services";
import { ButtonType } from "src/lib/flow/button/button.component";

@Component({
  selector: "app-entities-hash-lookup",
  templateUrl: "./entities-hash-lookup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesHashLookupComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  entityService = inject(Entity);

  dbg = (...d) => console.debug("BinariesHashLookupComponent:", ...d);
  err = (...d) => console.error("BinariesHashLookupComponent:", ...d);

  protected hashSearchList = new FormControl("", { updateOn: "blur" });
  private hashSearchListListener: Subscription;
  readonly ButtonType = ButtonType;

  protected hashLengths = {
    32: "md5",
    40: "sha1",
    64: "sha256",
    128: "sha512",
  };

  /**all found binaries*/
  protected findCount$: Observable<components["schemas"]["EntityFind"]>;
  protected filteredFind$: Observable<components["schemas"]["EntityFind"]>;
  protected results$ = new ReplaySubject<
    Map<string, components["schemas"]["EntityFindItem"]>
  >(1);

  /** Controls for selecting binaries for comparison */
  // A FormGroup didn't work well here with dynamically updating lists, so this is just a workaround
  protected selectedFilesCheckboxes: { [key: string]: boolean } = {};
  protected selectedFiles$ = new BehaviorSubject<string[]>([]);
  protected selectedFileCount$: Observable<number>;

  protected hashes$ = new BehaviorSubject<string[]>([]);

  ngOnInit(): void {
    this.hashSearchListListener = this.hashSearchList.valueChanges.subscribe(
      (x) => {
        this.hashes$.next(this.parseHashes(x));
      },
    );

    // this.clearForm()
    this.filteredFind$ = this.hashes$.pipe(
      ops.filter((d) => d.length > 0),
      ops.mergeMap((d) =>
        this.entityService.find({ count_entities: true }, d).pipe(
          ops.tap((found) => {
            const m = new Map<
              string,
              components["schemas"]["EntityFindItem"]
            >();
            const selectedControls: { [key: string]: boolean } = {};

            for (const row of found.items) {
              m.set(row.key, row);
              if (row?.exists && row.sha256) {
                m.set(row.key, row);
                selectedControls["binary." + row.sha256] = false;
              }
            }
            // If a hash isn't in the list of found hashes it wasn't found.

            this.results$.next(m);

            // Clear current controls
            this.selectedFilesCheckboxes = selectedControls;
            this.selectedFiles$.next([]);
          }),
        ),
      ),
      ops.map((d) => {
        const items = d.items.filter((x) => !x.is_duplicate_find);
        return { items_count: items.length, items: items };
      }),
      ops.shareReplay(1),
    );

    this.selectedFileCount$ = this.selectedFiles$.pipe(
      ops.map((value) => value.length),
    );
  }

  ngOnDestroy(): void {
    this.hashSearchListListener?.unsubscribe();
  }

  /** Updates the tracking list of which binaries have been selected */
  protected updateSelectedBinaries() {
    this.selectedFiles$.next(
      Object.entries(this.selectedFilesCheckboxes)
        .filter(([_key, value]) => value)
        .map(([key, _value]) => key),
    );
  }

  compareBinaries() {
    if (this.selectedFiles$.value.length >= 2) {
      this.router.navigate(["/pages/binaries/compare"], {
        queryParams: { entity: Array.from(this.selectedFiles$.value).sort() },
      });
    }
  }

  // md5, sha1, sha256, sha512
  // hashes must not have a hash char before start and must not have one after end
  readonly pattern =
    /(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})(?:[^0-9a-f]|$)/gm;

  parseHashes(text: string) {
    text = text.toLowerCase();

    const hashes: string[] = [];
    let search = this.pattern.exec(text);
    while (search) {
      if (hashes.indexOf(search[1]) < 0) {
        hashes.push(search[1]);
      }
      search = this.pattern.exec(text);
    }
    this.dbg(`Hashes found were:`, hashes);
    return hashes;
  }
}
