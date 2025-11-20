import { ConnectionPositionPair } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Observable, Subject, of } from "rxjs";
import * as ops from "rxjs/operators";
import { EntityWrap } from "src/app/core/entity.service";
import { Entropy } from "src/app/core/api/info";

type Dataset = {
  entropy: number;
  colour: string;

  start: string;
  bound?: string;

  width: number;
  height: number;
  x: number;
  y: number;
};

type ExEntropy = Entropy & {
  dataset: Dataset[];
};

type Bounds = {
  label: string;
  min: number;
  max: number;
};

// Hover events allow us to debounce user input:
type DataHoverEvent = {
  type: "data";
  index: number;
  data: Dataset;
  element: HTMLElement;
};

type BoundsHoverEvent = {
  type: "bounds";
  data: Bounds;
  element: HTMLElement;
};

type NoHoverEvent = {
  type: "none";
  element: null;
};

type HoverEvent = DataHoverEvent | BoundsHoverEvent | NoHoverEvent;

@Component({
  selector: "azco-entropy",
  templateUrl: "./entropy.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EntropyComponent {
  protected svgHeight = 100;
  protected svgWidth = 100;
  protected minHeightOfZero = 5;
  protected scaleFactor = this.svgHeight / 9;

  protected bounds: Bounds[] = [
    { label: "text", min: 4.0, max: 4.6 },
    { label: "executable", min: 4.9, max: 5.3 },
    { label: "packed executable", min: 6.7, max: 6.9 },
    { label: "encrypted executable", min: 7.1, max: 7.2 },
    { label: "encryption/compression", min: 7.7, max: 8.0 },
    { label: "zeroes", min: -this.minHeightOfZero / 10, max: 0.0 },
  ];

  /** CDK overlay change listener. */
  protected hoverEvents$ = new Subject<HoverEvent>();

  /** Which element is currently being hovered over */
  protected elementHover$ = new Subject<number>();

  protected entropyData$: Observable<ExEntropy>;

  protected positionPairs: ConnectionPositionPair[] = [
    // Have the popup below the entropy bar by default
    {
      offsetX: 0,
      offsetY: 0,
      originX: "start",
      originY: "bottom",
      overlayX: "start",
      overlayY: "top",
    },
    // Else have it expand out the top
    {
      offsetX: 0,
      offsetY: 0,
      originX: "start",
      originY: "top",
      overlayX: "start",
      overlayY: "bottom",
    },
    // If origin is at the right edge, align the tooltip's right edge to the bar's right edge (tooltip grows leftward)
    {
      offsetX: 0,
      offsetY: 0,
      originX: "end",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
    },
    // If the bar is at the right edge and there is no room below, have the tooltip grow leftward and upward
    {
      offsetX: 0,
      offsetY: 0,
      originX: "end",
      originY: "top",
      overlayX: "end",
      overlayY: "bottom",
    },
  ];

  @Input() minBytes: number = 0;
  @Input() horizontal: boolean = true;
  @Input() fullHeightBars: boolean = false;
  @Input() showLevels$: Observable<boolean> = of(true);
  @Input() height: string = "200px";
  @Input() set rawEntropy$(ent$: EntityWrap["entropy$"]) {
    this.entropy$ = ent$.pipe(ops.shareReplay(1));
    this.entropyData$ = this.entropy$.pipe(
      ops.filter((d) => !!d),
      ops.map((d) => this.genData(d)),
    );
  }

  entropy$: Observable<Entropy>;

  protected dataHover(index: number, element: HTMLElement, data: Dataset) {
    this.elementHover$.next(index);
    this.hoverEvents$.next({
      type: "data",
      element,
      data,
      index,
    });
  }

  protected hoverHide() {
    this.elementHover$.next(-1);
    this.hoverEvents$.next({
      type: "none",
      element: null,
    });
  }

  protected boundsHover(element: HTMLElement, data: Bounds) {
    this.elementHover$.next(-1);
    this.hoverEvents$.next({
      type: "bounds",
      element,
      data,
    });
  }

  /**
   * Converts raw entropy data into a usable structure for rendering.
   *
   * @param entropys The raw entropy data supplied by the server.
   * @returns Processed/trimmed entropy data.
   */
  private genData(entropys: Entropy): ExEntropy {
    const ret = <ExEntropy>entropys;
    ret.dataset = [];
    const elCount = entropys.blocks.length;
    const barIncrement = this.svgWidth / elCount;

    for (const index in entropys.blocks) {
      const bentropy = entropys.blocks[index];
      const start =
        "0x" + (entropys.block_size * +index).toString(16).toUpperCase();

      let bound = null;
      for (const b of this.bounds) {
        if (bentropy > b.min && bentropy < b.max) {
          bound = b.label;
        }
      }

      const barDepth = bentropy * this.scaleFactor + 1;

      let barPosition;
      if (this.horizontal) {
        if (!this.fullHeightBars) {
          barPosition = {
            width: barIncrement,
            height: barDepth,
            x: barIncrement * +index,
            y: this.svgHeight - barDepth,
          };
        } else {
          barPosition = {
            width: barIncrement,
            height: this.svgHeight,
            x: barIncrement * +index,
            y: 0,
          };
        }
      } else {
        // In the vertical comparison view, the entropy graph doesn't consider
        // height/depth:
        barPosition = {
          width: this.svgWidth,
          height: barIncrement,
          x: 0,
          y: barIncrement * +index,
        };
      }

      ret.dataset.push({
        entropy: bentropy,
        start,
        bound,
        colour: this.genColour(bentropy),
        ...barPosition,
      });
    }
    return ret;
  }

  /**
   * Generate the colour of an entropy column, depending on its entropy value
   */
  protected genColour(entropy: number, alpha: number = 1) {
    if (entropy <= 0.01) {
      // Gray if we have no entropy for this section
      return `rgba(128, 128, 128, ${alpha})`;
    }

    const hue = Math.floor(60 + (entropy / 8) * 300);
    return `hsla(${hue}, 100%, 40%, ${alpha})`;
  }
}
