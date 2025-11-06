import { CollectionViewer } from "@angular/cdk/collections";
import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { DataSource } from "@angular/cdk/table";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from "@angular/core";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { ToastrService } from "ngx-toastr";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  combineLatest,
} from "rxjs";
import * as ops from "rxjs/operators";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";

import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { hexValidator } from "src/app/core/validation";

/** Data for a row of a 16-byte wide hexdump */
interface HexRow {
  address: number;
  hex: string[];
  ascii: string[];
}

export class HexBinaryDataSource extends DataSource<HexRow> {
  private requestSize = 8192;

  private rowWidth = 16;
  // Each row in a returned request covers 16 bytes
  private pageSize = this.requestSize / this.rowWidth;

  /** Page cache for fetched hex values */
  private cachedData: Array<HexRow>;

  private attemptedFetchPages = new Set<number>();
  private loadedByteCount = 0;
  private subscription = new Subscription();

  private pendingRequests = 0;
  loadingPages$ = new BehaviorSubject<boolean>(false);

  dataStream$: BehaviorSubject<(HexRow | undefined)[]>;

  /** Captures whether file contents for this binary actually exist. */
  fileAvailable$ = new ReplaySubject<boolean>(1);

  constructor(
    private entityService: Entity,
    private sha256: string,
    private fileSize: number,
    private offset: number,
  ) {
    super();
    // This is a sparse array by default in Firefox/Chrome, so this
    // doesn't allocate data initially
    this.cachedData = Array.from<HexRow>({ length: fileSize / this.rowWidth });
    this.dataStream$ = new BehaviorSubject<(HexRow | undefined)[]>(
      this.cachedData,
    );
  }

  connect(collectionViewer: CollectionViewer): Observable<HexRow[]> {
    this.subscription.add(
      collectionViewer.viewChange
        .pipe(ops.debounceTime(200))
        .subscribe((range) => {
          const startPage = this.getPageForIndex(range.start);
          const endPage = this.getPageForIndex(range.end - 1);
          for (let i = startPage; i <= endPage; i++) {
            this.fetchPage(i);
          }
        }),
    );
    return this.dataStream$;
  }

  disconnect(): void {
    this.subscription.unsubscribe();
  }

  private getPageForIndex(index: number): number {
    return Math.floor(index / this.pageSize);
  }

  /** Returns a list of hexadecimal for the specified range. Pages must be loaded. */
  getHexForRange(range: PositiveIntegerRange): string[] {
    const data = [];
    for (let i = range.start; i <= range.end; i++) {
      const byteRow = Math.floor(i / this.rowWidth);
      const byteRowIndex = i % this.rowWidth;

      const byte = this.cachedData[byteRow].hex[byteRowIndex];
      data.push(byte);
    }

    return data;
  }

  getLoadedByteCount(): number {
    return this.loadedByteCount;
  }

  getPendingRequests(): number {
    return this.pendingRequests;
  }

  private incrementPendingRequests() {
    this.pendingRequests++;
    this.loadingPages$.next(true);
  }

  private decrementPendingRequests() {
    this.pendingRequests--;
    if (this.pendingRequests < 0) {
      this.pendingRequests = 0;
    }
    this.loadingPages$.next(this.pendingRequests != 0);
  }

  fetchPage(page: number) {
    if (this.attemptedFetchPages.has(page)) {
      return;
    }
    this.attemptedFetchPages.add(page);

    this.incrementPendingRequests();

    this.entityService
      .hexview(this.sha256, {
        offset: this.offset + page * this.requestSize,
        max_bytes_to_read: this.requestSize,
        shortform: false,
      })
      .pipe(
        ops.first(),
        ops.catchError((e) => {
          this.attemptedFetchPages.delete(page);
          this.decrementPendingRequests();
          throw e;
        }),
      )
      .subscribe((s) => {
        this.decrementPendingRequests();

        if (s) {
          if (this.loadedByteCount === 0) {
            this.fileAvailable$.next(true);
          }

          this.loadedByteCount += s.hex_strings
            .map((data) => data.ascii.length)
            .reduce((x, y) => x + y, 0);

          const editedData = s.hex_strings.map((data) => {
            return {
              address: data.address,
              hex: data.hex,
              ascii: data.ascii.split(""),
            };
          });
          this.cachedData.splice(
            page * this.pageSize,
            s.hex_strings.length,
            ...(editedData as [HexRow]),
          );
          this.dataStream$.next(this.cachedData);
        } else {
          console.warn("Hexview: fetch for page", page, "failed!");
          if (this.loadedByteCount === 0) {
            // Our first request failed - the server is likely unable to provide us with
            // any binary contents for this file, so bail:
            this.fileAvailable$.next(false);
          }
        }
      });
  }
}

export class PositiveIntegerRange {
  constructor(
    public start: number,
    public end: number,
  ) {}

  contains(num: number): boolean {
    if (this.start < 0 || this.end < 0) {
      // Special case where the user doesn't have anything
      // selected.
      return false;
    }
    return num >= this.start && num <= this.end;
  }
}

@Component({
  selector: "azec-hexview",
  templateUrl: "./hexview.component.html",
  styleUrls: ["./hexview.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HexviewComponent extends BaseCard implements OnInit, OnDestroy {
  private toastrService = inject(ToastrService);
  private fb = inject(UntypedFormBuilder);
  private entityService = inject(Entity);
  private host = inject(ElementRef);

  /* The viewer is limited to 25MB due to a limitation with infinite scroll */
  help = `
This panel displays the raw binary file in 'hex' format, which is nicer to look at than ones and zeroes.

The rightmost column also displays the corresponding ascii character for each byte of data.

This viewer is limited to only the first ~25MB of a file.

Ctrl-C will copy selected hexadecimal.`;

  /** Constant for how many pixels high each row is. */
  protected ROW_HEIGHT = 20;
  protected CHUNK_SIZE = 8192 * 200;

  protected spinnerIcon = faSpinner;
  protected checkIcon = faCheck;

  hexViewReady$ = new ReplaySubject<boolean>();

  sha256: string;
  summarySub: Subscription;

  @ViewChild("hexViewport", { read: CdkVirtualScrollViewport })
  viewport: CdkVirtualScrollViewport;

  protected hover$ = new BehaviorSubject<number>(-1);

  private selectStartPoint = -1;
  private range = new PositiveIntegerRange(-1, -1);
  protected range$ = new BehaviorSubject<PositiveIntegerRange>(this.range);
  protected isDragging = false;

  ds: HexBinaryDataSource | undefined = undefined;
  private dsSubscription: Subscription | undefined;
  private fileAvailableSubscription: Subscription | undefined;
  /* Divides up the source data if too big to avoid overwhelming the browser */
  protected chunkIndex$ = new BehaviorSubject<number>(0);
  protected totalChunks$ = new BehaviorSubject<number>(0);

  protected dsOffset$ = new BehaviorSubject<number>(0);

  offsetForm: UntypedFormGroup;

  protected loadedBytes$ = new BehaviorSubject<number>(0);
  protected totalBytes$ = new BehaviorSubject<number>(0);

  private resizeObs?: ResizeObserver;

  ngOnInit(): void {
    this.offsetForm = this.fb.group({
      offsetGoto: this.fb.control(""),
    });

    // Force the hexview to automatically resize when the height of the element
    // changes
    this.resizeObs = new ResizeObserver((_entries) => {
      this.viewport?.checkViewportSize();
    });

    this.resizeObs.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
    this.dsSubscription?.unsubscribe();
    this.resizeObs?.disconnect();
  }

  /** Scrolls to the specified row in the current chunk. */
  private scrollToRow(row: number): Observable<(HexRow | undefined)[]> {
    this.viewport.scrollToIndex(row);

    // Allow observing the loading of this row
    return this.ds.dataStream$.pipe(
      ops.filter((data) => data[row] != undefined),
      ops.first(),
    );
  }

  /** Scrolls to the row containing the specified offset, moving chunks if required. */
  focusRow(offset: number): Observable<(HexRow | undefined)[]> {
    const rangedOffset = Math.min(offset, this.totalBytes$.value);

    const chunk = Math.trunc(rangedOffset / this.CHUNK_SIZE);

    const relativeOffset = rangedOffset - chunk * this.CHUNK_SIZE;

    const row = Math.trunc(relativeOffset / 16);

    if (chunk != this.chunkIndex$.value) {
      this.chunkIndex$.next(chunk);

      const result = new Subject<(HexRow | undefined)[]>();

      // We want to always subscribe to this (it only fires once) to actually force scrollToRow to get called
      // We also don't want to subscribe to this multiple times to avoid calling scrollToRow multiple times
      this.dsOffset$
        .pipe(
          ops.filter((x) => x === chunk),
          ops.first(),
          // Wait for the first row to be available
          ops.mergeMap((_) =>
            this.ds.dataStream$.pipe(
              ops.filter((data) => data[0] != undefined),
              ops.first(),
            ),
          ),
          ops.mergeMap((_) => this.scrollToRow(row)),
        )
        .subscribe((rows) => {
          result.next(rows);
        });

      return result;
    } else {
      return this.scrollToRow(row);
    }
  }

  protected handleDrag(offset: number) {
    if (!this.isDragging) {
      return;
    }

    this.selectBytes(this.selectStartPoint, offset);
  }

  protected stopDrag(offset: number) {
    this.selectBytes(this.selectStartPoint, offset);
    this.isDragging = false;
  }

  protected startDrag(offset: number) {
    this.selectBytes(offset, offset);
    this.selectStartPoint = offset;
    this.isDragging = true;
  }

  protected clearDrag() {
    this.selectBytes(-1, -1);
  }

  protected hexValidator(event: Event) {
    hexValidator(event, 8);
  }

  protected previousChunk() {
    this.chunkIndex$.next(Math.max(this.chunkIndex$.value - 1, 0));
  }

  protected nextChunk() {
    this.chunkIndex$.next(
      Math.min(this.chunkIndex$.value + 1, this.totalChunks$.value - 1),
    );
  }

  protected firstChunk() {
    this.chunkIndex$.next(0);
  }

  protected lastChunk() {
    this.chunkIndex$.next(this.totalChunks$.value - 1);
  }

  protected jumpAndSelectBytes([offset, length]: [number, number]) {
    // Inner subscription is a one-shot
    this.focusRow(offset).subscribe(() => {
      // Let the table settle
      setTimeout(() => {
        this.selectBytes(offset, offset + length - 1);
      }, 50);
    });
  }

  /** Selects a range of bytes. */
  selectBytes(start: number, end: number) {
    const lower = Math.min(start, end);
    const higher = Math.max(start, end);

    if (this.range.start == lower && this.range.end == higher) {
      // No update to make!
      return;
    }

    this.range = new PositiveIntegerRange(lower, higher);
    this.range$.next(this.range);
  }

  protected jumpToOffset() {
    let jumpOffset = this.offsetForm.value.offsetGoto as string;
    if (jumpOffset.startsWith("0x") || jumpOffset.startsWith("0X")) {
      jumpOffset = jumpOffset.substring(2);
    }

    this.focusRow(parseInt(jumpOffset, 16));
    this.offsetForm.setValue({ offsetGoto: "" });
  }

  protected handleCopy(event: KeyboardEvent) {
    if (event.ctrlKey && event.key == "c") {
      // Get text for region
      const hex = this.ds.getHexForRange(this.range).join("");

      // Attempt to insert this content into the browser clipboard
      // For obvious reasons, browsers limit how and where this can
      // happen, so we try to capture both possibilities here
      navigator.clipboard.writeText(hex).then(
        (_value) => {
          console.log("Hex copy succeeded.");
          this.toastrService.show(
            "Copied selected data as hex.",
            "Copied data!",
            {},
            "copy",
          );
        },
        (reason) => {
          console.log("Hex copy failed:", reason);
          this.toastrService.warning(
            "Your browser blocked the copy operation",
            "Failed to copy data",
          );
        },
      );

      // Disable any native browser copy
      event.preventDefault();
    }
  }

  protected override onEntityChange() {
    this.summarySub?.unsubscribe();
    this.summarySub = combineLatest([
      this.entity.summary$,
      this.entity.hasContent$,
      this.chunkIndex$,
    ]).subscribe(([obs, hasContent, chunkIndex]) => {
      if (hasContent) {
        this.viewport?.scrollToIndex(0, "instant");

        this.totalBytes$.next(obs.file_size);
        this.totalChunks$.next(Math.ceil(obs.file_size / this.CHUNK_SIZE));

        const offset = chunkIndex * this.CHUNK_SIZE;
        let size = this.CHUNK_SIZE;

        if (offset + size > obs.file_size) {
          size = obs.file_size - offset;
        }

        this.ds = new HexBinaryDataSource(
          this.entityService,
          obs.sha256,
          size,
          offset,
        );
        this.dsOffset$.next(chunkIndex);

        this.fileAvailableSubscription?.unsubscribe();
        this.fileAvailableSubscription = this.ds.fileAvailable$.subscribe(
          (value) => {
            if (!value) {
              // No file is available - bubble this up
              this.hexViewReady$.next(false);
            }
          },
        );

        this.dsSubscription?.unsubscribe();
        this.dsSubscription = this.ds.dataStream$.subscribe((value) => {
          this.loadedBytes$.next(this.ds.getLoadedByteCount());
          // Once data is ready, propagate that up to the loading card
          if (value) {
            this.hexViewReady$.next(true);

            // Force the viewport to render the correct number of rows
            // based on the height of the card
            setTimeout(() => {
              if (this.viewport) {
                this.viewport.checkViewportSize();
              }
            }, 50);
          } else {
            // If binary e.g. deleted from storage
            this.hexViewReady$.next(false);
          }
        });
        this.ds.fetchPage(0);
      } else {
        this.hexViewReady$.next(false);
      }
    });
  }
}
