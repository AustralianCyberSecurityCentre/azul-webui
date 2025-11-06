import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { faCheck, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";

import { Entity, EntityWrap, Nav, Security } from "src/app/core/services";
import { ButtonSize, ButtonType } from "src/lib/flow/button/button.component";

type FeatureData = {
  features: string[];
  values: Map<string, string[]>;
  entities: Map<string, Set<string>>;
};

@Component({
  selector: "app-entities-compare",
  templateUrl: "./entities-compare.component.html",
  styleUrls: ["./entities-compare.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BinariesCompareComponent implements OnInit {
  entityService = inject(Entity);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  securityService = inject(Security);
  private nav = inject(Nav);

  protected faTrashCan = faTrashCan;
  protected faCheck = faCheck;

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  entities$: Observable<EntityWrap[]>;
  maxBytes$: Observable<number>;

  featureData$: Observable<FeatureData>;

  rawBinaries: string[] = [];
  rawBinaries$: Observable<string[]>;

  ngOnInit(): void {
    this.rawBinaries$ = this.route.queryParamMap.pipe(
      ops.map((d) => {
        this.rawBinaries = d.getAll("entity");
        return this.rawBinaries;
      }),
    );

    this.entities$ = this.rawBinaries$.pipe(
      // deduplicate and sort
      ops.map((sha256List) => Array.from(new Set(sha256List)).sort()),
      ops.map((d) => {
        const ret = [];
        for (const entityId of d) {
          if (!entityId) {
            console.error(
              "Entity is not set during comparison skipping binary",
            );
            return;
          }
          ret.push(this.entityService.entity(entityId));
        }
        return ret;
      }),
      // redraw entropy graphs
      ops.tap(() =>
        setTimeout(() => this.nav.windowSizeChange$.next(null), 200),
      ),
      ops.shareReplay(1),
    );

    this.maxBytes$ = this.entities$.pipe(
      ops.mergeAll(),
      ops.mergeMap((d) => d.entropy$),
      ops.filter((d) => !!d),
      ops.map((d) => d.block_count * d.block_size),
      ops.max((x, y) => (x > y ? x : y)),
      ops.shareReplay(1),
    );

    let features: Set<string>;
    let values: Map<string, Set<string>>;
    let entities: Map<string, Set<string>>;
    this.featureData$ = this.entities$.pipe(
      ops.tap(() => {
        features = new Set<string>();
        values = new Map<string, Set<string>>();
        entities = new Map<string, Set<string>>();
      }),
      ops.mergeAll(),
      // as const fixes tuple
      ops.mergeMap((d) =>
        d.rawFeatures$.pipe(ops.map((f) => [f, d.sha256] as const)),
      ),
      ops.tap(([f, id]) => {
        for (const row of f) {
          features.add(row.name);
          if (!values.has(row.name)) {
            values.set(row.name, new Set());
          }
          values.get(row.name).add(row.value.toString());
          const fv = row.name + row.value;
          if (!entities.has(fv)) {
            entities.set(fv, new Set());
          }
          entities.get(fv).add(id);
        }
      }),
      ops.map((_d) => {
        const tValues = new Map<string, string[]>();
        for (const [k, v] of values) {
          tValues.set(k, Array.from(v).sort());
        }
        return {
          features: Array.from(features).sort(),
          values: tValues,
          entities: entities,
        };
      }),
      ops.shareReplay(1),
    );
  }

  removeEntity(id: string) {
    const nexts = this.rawBinaries.filter((x) => x != id);
    this.router.navigate([], { queryParams: { entity: nexts } });
  }
}
