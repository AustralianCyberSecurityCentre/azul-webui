import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  WritableSignal,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FeatureWithDecodedValue } from "@app/core/api/state";
import * as d3 from "d3";
import { Observable, Subscription, combineLatest } from "rxjs";
import * as ops from "rxjs/operators";

import { toObservable } from "@angular/core/rxjs-interop";
import { EntityWrap, Nav } from "@app/core/services";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";

type Renderable = {
  start: number;
  end: number;
  height: number;
  feature: FeatureWithDecodedValue;
  // colour: string
};

export type Boundary = {
  x1: number;
  x2: number;
};

export type Selected = {
  location: number[];
  row: FeatureWithDecodedValue;
};

/**card displaying offset features located in entity*/
@Component({
  selector: "azec-offset-picker",
  templateUrl: "./offset-picker.component.html",
  styleUrls: ["./offset-picker.component.css"],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class OffsetPickerComponent implements OnInit, OnDestroy {
  protected ngZone = inject(NgZone);
  private nav = inject(Nav);

  entity = input<EntityWrap | undefined>(undefined);

  protected fileSize$: Observable<number>;
  protected features$: Observable<FeatureWithDecodedValue[]>;

  protected ButtonType = ButtonType;
  protected ButtonSize = ButtonSize;

  // Internal state for boundaries
  // In pixels:
  protected boundarySignal: WritableSignal<Boundary> = signal({
    x1: -1,
    x2: -1,
  });
  // In bytes (relative to the source file):
  protected boundaryBytesSignal: WritableSignal<Boundary> = signal({
    x1: -1,
    x2: -1,
  });
  // External, only emitted once drag complete
  extent = output<Boundary>();

  private redrawer$: Subscription;

  protected isOpenSignal: WritableSignal<boolean> = signal(false);
  protected isOpen$: Observable<boolean>;

  @ViewChild("offsetDIV", { static: false }) div: ElementRef;
  @ViewChild("offsetSVG", { static: false }) svg: ElementRef;

  dbg = (...d) => console.debug("OffsetGraphComponent:", ...d);
  err = (...d) => console.error("OffsetGraphComponent:", ...d);

  constructor() {
    this.fileSize$ = toObservable(this.entity).pipe(
      ops.filter((d) => d !== undefined),
      ops.map((d) => d.summary$),
      ops.mergeAll(),
      ops.map((d) => d.file_size),
      // ops.tap((d) => this.dbg("entity file size", d)),
      ops.shareReplay(1),
    );
    this.features$ = toObservable(this.entity).pipe(
      ops.filter((d) => d !== undefined),
      ops.map((d) => d.featuresOffset$),
      ops.mergeAll(),
      // ops.tap((d) => this.dbg("features with offset", d.length)),
      ops.shareReplay(1),
    );
    this.isOpen$ = toObservable(this.isOpenSignal);
  }

  ngOnInit(): void {
    this.redrawer$?.unsubscribe();
    this.redrawer$ = combineLatest([
      this.features$,
      this.fileSize$,
      this.nav.windowSizeChange$.pipe(ops.startWith(null), ops.shareReplay(1)),
      this.isOpen$,
    ])
      .pipe(
        ops.filter(([_features, _fileSize, _nav, isOpen]) => isOpen),
        ops.debounceTime(100),
      )
      .subscribe(([features, fileSize, _a]) => {
        // this.dbg("redraw trigger", features.length, fileSize);
        // Run this on the next tick
        this.render(features, fileSize);
      });
  }

  ngOnDestroy() {
    this.redrawer$?.unsubscribe();
  }

  protected resetBoundary() {
    const bounds = {
      x1: -1,
      x2: -1,
    };

    this.boundarySignal.set(bounds);
    this.boundaryBytesSignal.set(bounds);
    this.extent.emit(bounds);
    this.updateDraggedArea(bounds);
  }

  private genData(
    features: FeatureWithDecodedValue[],
    file_size: number,
  ): Renderable[] {
    const dataset: Renderable[] = [];
    for (const feat of features) {
      for (const loc of feat.parts?.location ?? []) {
        // height should be between 0.0 and 1.0
        // 1 - ratio of width of file
        const width_ratio = Math.max(
          0,
          Math.min(0.9, ((loc[1] - loc[0]) / file_size) * 0.8 + 0.1),
        );

        dataset.push({
          start: loc[0],
          end: loc[1] != loc[0] ? loc[1] : loc[1] + 1,
          height: 1 - width_ratio,
          feature: feat,
          // colour: 'red',
        });
      }
    }
    return dataset;
  }

  /**
   * Draw the selected area.
   * @param bound The boundary to utilise.
   */
  private updateDraggedArea(bound: Boundary) {
    const start = Math.min(bound.x1, bound.x2);
    const end = Math.max(bound.x1, bound.x2);
    d3.select("#draggable")
      .attr("x", start)
      .attr("width", end - start);
  }

  private drag(file_size: number, widthMult: number, bound: Boundary) {
    return d3
      .drag()
      .on("start", (event) => {
        bound.x1 = event.x;
        bound.x2 = bound.x1 + 1;
        this.updateDraggedArea(bound);
      })

      .on("drag", (event) => {
        bound.x2 = event.x;
        this.updateDraggedArea(bound);
      })

      .on("end", () => {
        const max_pixels = file_size * widthMult;
        const start = Math.min(bound.x1, bound.x2);
        const end = Math.max(bound.x1, bound.x2);
        bound.x1 = Math.max(0, Math.min(max_pixels - 1, start));
        bound.x2 = Math.max(start + 1, Math.min(max_pixels, end));
        this.updateDraggedArea(bound);
        this.boundarySignal.set(bound);

        this.ngZone.run(() => {
          const boundaryInBytes = {
            x1: Math.floor(bound.x1 / widthMult),
            x2: Math.ceil(bound.x2 / widthMult),
          };
          this.boundaryBytesSignal.set(boundaryInBytes);
          this.extent.emit(boundaryInBytes);
        });
      });
  }

  private render(
    features: FeatureWithDecodedValue[],
    file_size: number,
    retry: number = 5,
  ) {
    const width = this.svg?.nativeElement?.clientWidth;
    const height = this.svg?.nativeElement?.clientHeight;
    if (!features || !file_size || width <= 0 || height <= 0) {
      if (retry > 0) {
        this.dbg("render retry", !!features, !!file_size, width, height, retry);
        setTimeout(() => this.render(features, file_size, retry - 1), 200);
      } else {
        this.dbg("render fail");
      }
      return;
    }

    const dataset = this.genData(features, file_size);
    this.dbg("drawing offset graph with items:", dataset.length);
    let svg;
    try {
      svg = d3.select(this.svg.nativeElement);
    } catch {
      return;
    }

    svg.selectAll("g").remove();
    // add required groups to svg
    svg
      .selectAll("g")
      .data(["backing", "hills", "dragger"])
      .enter()
      .append("g")
      .attr("id", (d) => d);

    const widthMult = width / file_size;

    const bound = this.boundarySignal();

    svg.call(this.drag(file_size, widthMult, bound));

    svg
      .select("#dragger")
      .append("rect")
      .attr("id", "draggable")
      .attr("x", () => 0)
      .attr("width", () => 0)
      .attr("y", () => 0)
      .attr("height", () => height)
      .style("pointer-events", "none");
    // add entropy bars
    svg
      .select("#hills")
      .selectAll("rect")
      .data(dataset)
      .enter()
      .append("rect")
      .classed("hill", true)
      .attr("x", (d) => d.start * widthMult)
      .attr("width", (d) => (d.end - d.start) * widthMult)
      .attr("y", (d) => height - d.height * height)
      .attr("height", (d) => d.height * height);

    this.updateDraggedArea(bound);
  }
}
