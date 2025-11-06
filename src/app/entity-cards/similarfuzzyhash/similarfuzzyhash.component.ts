import { Component, Input, inject } from "@angular/core";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";
import { Observable } from "rxjs";
import { formatFloat } from "src/app/core/util";
import { FuzzyMatchWithSummary } from "src/app/core/api/state";
import { components } from "src/app/core/api/openapi";
import { map, shareReplay, switchMap } from "rxjs/operators";
import { combineLatest } from "rxjs";

type HashType = "ssdeep" | "tlsh";

@Component({
  selector: "azec-similarfuzzyhash",
  templateUrl: "./similarfuzzyhash.component.html",
  styleUrls: ["./similarfuzzyhash.component.css"],
  standalone: false,
})
export class SimilarfuzzyhashComponent extends BaseCard {
  entityService = inject(Entity);

  help = `
This attempts to find binaries that are similar by comparing their ssdeep or tlsh fuzzy hashes.
The similarity is a measure of how many parts of the file are shared by both.

Note that files can only be compared this way if they are somewhat similar in size.
`;
  protected formatFloat = formatFloat;

  protected provider$: Observable<FuzzyMatchWithSummary>;

  @Input()
  protected hashType: HashType;

  protected transformedFind$: Observable<{
    items_count: number;
    items: (components["schemas"]["EntityFindItem"] & {
      similarity: number;
    })[];
  }>;

  protected onEntityChange(): void {
    switch (this.hashType) {
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
