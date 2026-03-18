import { Component, inject } from "@angular/core";
import { Observable, combineLatest } from "rxjs";
import { map, shareReplay, switchMap } from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";

@Component({
  selector: "azec-similar-entropy",
  templateUrl: "./similar-entropy.component.html",
  standalone: false,
})
export class SimilarEntropyComponent extends BaseCard {
  entityService = inject(Entity);

  help = `
This attempts to find binaries that are similar by comparing their entropy.
The similarity is a measure of how many common sections the two entropies have.

Note that files can only be compared this way if they are somewhat similar in size.
And they must have a sufficiently large entropy. (at least 10% (40 out of the maximum possible 800))
`;
  protected transformedFind$: Observable<{
    items_count: number;
    items: (components["schemas"]["EntityFindItem"] & {
      similarity: number;
    })[];
  }>;

  protected onEntityChange(): void {
    this.transformedFind$ = this.entity.similar_entropy$.pipe(
      switchMap((data) => {
        const enrichedRows$ = data.matches.map((match) =>
          match._localEntitySummary$.pipe(
            map((summary) => ({
              ...summary,
              similarity: match.score,
            })),
          ),
        );

        return combineLatest(enrichedRows$).pipe(
          map((items) => ({
            items_count: items.length,
            items,
          })),
        );
      }),
      shareReplay(1),
    );
  }
}
