import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { components } from "@app/core/api/openapi";
import { FuzzyMatchWithSummary } from "@app/core/api/state";
import { Entity } from "@app/core/services";
import { Observable, combineLatest, of } from "rxjs";
import { map, shareReplay, switchMap } from "rxjs/operators";
import { BaseCard } from "../base-card.component";

type HashType = "ssdeep" | "tlsh";

@Component({
  selector: "azec-similarfuzzyhash",
  templateUrl: "./similarfuzzyhash.component.html",
  styleUrls: ["./similarfuzzyhash.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SimilarfuzzyhashComponent extends BaseCard {
  entityService = inject(Entity);

  help = `
This attempts to find binaries that are similar by comparing their ssdeep or tlsh fuzzy hashes.
The similarity is a measure of how many parts of the file are shared by both.

Note that files can only be compared this way if they are somewhat similar in size.
`;
  protected provider$: Observable<FuzzyMatchWithSummary>;

  hashType = input.required<HashType>();

  protected transformedFind$: Observable<{
    items_count: number;
    items: (components["schemas"]["EntityFindItem"] & {
      similarity: number;
    })[];
  }>;

  protected override onEntityChange(): void {
    switch (this.hashType()) {
      case "ssdeep":
        this.provider$ = this.entity.similar_ssdeep$;
        break;
      case "tlsh":
        this.provider$ = this.entity.similar_tlsh$;
        break;
    }

    this.transformedFind$ = this.provider$.pipe(
      switchMap((data) => {
        const enrichedRows$ = data.matches.map((match) =>
          match._localEntitySummary$.pipe(
            map((summary) => ({
              ...summary,
              similarity: match.score,
            })),
          ),
        );
        // If there are no similar ssdeeps return an empty result
        if (enrichedRows$.length === 0) {
          return of({
            items_count: 0,
            items: [],
          });
        }
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
