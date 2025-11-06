import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { Entity } from "src/app/core/services";

import { BaseCard } from "../base-card.component";
import { components, SimilarMatchRow } from "src/app/core/api/openapi";
import { SimilarMatchWithSummary } from "src/app/core/api/state";

@Component({
  selector: "azec-similar",
  templateUrl: "./similar.component.html",
  styleUrls: ["./similar.component.css"],
  standalone: false,
})
export class SimilarComponent extends BaseCard {
  entityService = inject(Entity);
  private router = inject(Router);

  help = `
The similarity calculation attempts to find similar binaries to the current one.
It compares feature values produced on this binary and attempts to match them with other binaries.

Note:
The binaries found may have additional features that the current one does not have.
Multiple plugins may produce identical features on a binary, which is why the count here may be higher than in the feature value table.

For performance reasons, the results are only calculated after a user clicks the button, and may take some time to process.
`;

  protected ready$ = new BehaviorSubject(false);

  protected override onEntityChange() {
    this.ready$.next(true);
    this.similar$ = this.entity.similar$.pipe(
      ops.tap((d) => {
        this.selected = [];
        for (const row of d?.matches || []) {
          if (this.selected.length >= 5) {
            break;
          }
          if (row.score_percent < 60) {
            break;
          }
          this.selected.push(row);
        }
      }),
    );
  }

  selected: components["schemas"]["SimilarMatchRow"][] = [];

  similar$: Observable<SimilarMatchWithSummary>;

  clickRecalculate() {
    this.entity.refreshSimilar();
    this.onEntityChange();
  }

  clickRow(row: SimilarMatchRow) {
    // if (!this.compareSelect) { return }
    if (this.selected.includes(row)) {
      this.selected = this.selected.filter((x) => x != row);
    } else {
      this.selected.push(row);
    }
  }

  clickGo() {
    // rows to list of binaries
    const binaries = new Set();
    binaries.add(this.entity.sha256);
    for (const row of this.selected) {
      binaries.add(row.sha256);
    }
    this.router.navigate(["/pages/binaries/compare"], {
      queryParams: { entity: Array.from(binaries).sort() },
    });
  }
}
