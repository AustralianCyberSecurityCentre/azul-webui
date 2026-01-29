import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { HttpErrorResponse } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  Signal,
  ViewChild,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { ToastrService } from "ngx-toastr";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subscription,
  combineLatest,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";
import { components, operations } from "src/app/core/api/openapi";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";
import { HexStringSyncService } from "../hex-string-sync.service";

type AggregatedStrings = components["schemas"]["BinaryStrings"];

// class StringScrollManager{
// }

type FileInfo = { file_size: number; file_type: string };

@Component({
  selector: "azec-strings",
  templateUrl: "./strings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StringsComponent extends BaseCard implements OnInit, OnDestroy {
  private toastrService = inject(ToastrService);
  private fb = inject(UntypedFormBuilder);
  private entityService = inject(Entity);
  private hexStringSyncService = inject(HexStringSyncService);

  help = `
This panel displays bits of text that were found in the file.

Text can be encoded in various different ways, and Azul will try a variety of methods to extract these 'strings'.

The location of each string in the file is also displayed.

NOTE - only the first 10MB of a file is checked for strings by default toggle 'All strings' to search the whole file.
`;
  protected faSpinner = faSpinner;

  SUPPORTED_AI_FILTER_TYPES = [
    "executable/windows/dll32",
    "executable/windows/dll64",
    "executable/windows/pe",
    "executable/windows/pe32",
    "executable/windows/pe64",
    "executable/pe32",
    "executable/dll32",
  ];

  protected override onEntityChange() {
    this.updateData();
  }

  _stringsLoaded$: Observable<boolean> = new Observable<boolean>();
  lastHexOffsetJump: number = -1;

  // 10 MiB
  protected readonly allStringsMinSize10Mib = 1000 * 1000 * 10;

  private lastRequest: Subscription | undefined = undefined;
  private formSubscription: Subscription | undefined = undefined;
  private summarySubscription: Subscription | undefined = undefined;
  private aiSupportedSubscription: Subscription | undefined = undefined;

  private lastQueryParams:
    | operations["get_strings_api_v0_binaries__sha256__strings_get"]["parameters"]["query"]
    | undefined;
  data$: Observable<components["schemas"]["EntityFind"] | null>;

  /** If an update to the strings table has been requested for first time */
  isLoadingInitial$ = new BehaviorSubject(false);

  protected showAllStringsToggle: boolean = false;

  @ViewChild("stringViewport", { read: CdkVirtualScrollViewport })
  viewport: CdkVirtualScrollViewport;

  // Proxy signal is created to avoid
  stringIndexFromHexHoverSignal: Signal<number>;
  stringIndexFromHexHoverSub: Subscription;

  isLastActionScroll: boolean = false;

  isAISupported$ = new Observable<boolean>();

  form: UntypedFormGroup;
  private filter = "";
  private filterType: "filter" | "regex" = "filter";
  private aiToggle: boolean = false;

  private searchQuery:
    | { take_n_strings: number; min_length: number; file_format: string }
    | undefined = undefined;

  constructor() {
    super();
    this.form = this.fb.group({
      filter: this.fb.control(""),
      filterType: this.fb.control("filter"),
      aiToggle: this.fb.control(this.aiToggle),
      showAllStringsToggle: this.fb.control(this.showAllStringsToggle),
    });

    this.data$ = this.sha256Subject.pipe(
      ops.switchMap((sha256: string) => {
        const params = { term: sha256 };
        return this.entityService.find(params).pipe(
          ops.catchError((e) => {
            if (e instanceof HttpErrorResponse) {
              return of(null);
            }
            throw e;
          }),
        );
      }),
      ops.shareReplay(1),
    );

    // Set these up first so the formSubscription can use the fileFormat$ subscription.
    this.fileInfo$ = this.data$.pipe(
      ops.map((data) => {
        if (data?.items?.length > 0) {
          const firstItem = data.items[0];
          return {
            file_size: firstItem.file_size,
            file_type: this.extractFilterType(firstItem.file_format),
          };
        } else {
          return { file_size: 0, file_type: "" };
        }
      }),
      ops.shareReplay(1),
    );
    this.isAISupported$ = this.fileInfo$.pipe(
      ops.map((fileInfo) => this.isAISupportedType(fileInfo.file_type)),
      ops.shareReplay(1),
    );
    // Needed to fully disable the ai checkbox if AI isn't supported.
    this.aiSupportedSubscription = this.isAISupported$.subscribe(
      (supported) => {
        const aiToggleControl = this.form.get("aiToggle");
        aiToggleControl.setValue(false);
        if (supported) {
          aiToggleControl?.enable();
        } else {
          aiToggleControl?.disable();
        }
      },
    );

    // Continually jump to index
    this.stringIndexFromHexHoverSub = combineLatest([
      toObservable(this.hexStringSyncService.HexOffsetSignal),
      toObservable(this.currentStringsSignal),
    ])
      .pipe(
        ops.map(([hexOffset, currentStringList]) => {
          console.log("STARTING THE THING!");
          if (hexOffset === -1) {
            console.log("HEX OFFSET is -1");
            return -1;
          }
          // Binary search for string with the correct offset in the list of strings.
          const stringVal = currentStringList;
          if (stringVal === undefined) {
            return -1;
          }
          if (stringVal.length > 0) {
            // TODO - remove
            // console.info("ENTERING CHECK OF");
            // console.info(`${hexOffset} < ${stringVal[0].offset - this.SCROLL_UP_JUMP_AMOUNT}`)
            // console.info(`${hexOffset} > ${stringVal[stringVal.length - 1].offset + this.SCROLL_UP_JUMP_AMOUNT}`)
            if (
              hexOffset < stringVal[0].offset - this.SCROLL_UP_JUMP_AMOUNT ||
              hexOffset >
                stringVal[stringVal.length - 1].offset +
                  this.SCROLL_UP_JUMP_AMOUNT
            ) {
              this.jumpToFileOffset(hexOffset);
              return -1;
            }
          }

          let min_index = 0;
          let max_index = stringVal.length;
          let mid_index = -1;
          while (min_index < max_index) {
            mid_index = min_index + Math.floor((max_index - min_index) / 2);
            if (stringVal[mid_index].offset < hexOffset) {
              min_index = mid_index + 1;
            } else {
              max_index = mid_index;
            }
          }
          // Math max to avoid min_index being -1 when before the first string.
          return Math.max(0, min_index - 1);
        }),
      )
      .subscribe((indexToJumpTo) => {
        console.log("looking at scrolling to index.", indexToJumpTo);
        if (indexToJumpTo > -1 && this.viewport) {
          this.viewport.scrollToIndex(indexToJumpTo);
        }
      });
  }

  ngOnInit(): void {
    this.formSubscription = this.form.valueChanges
      .pipe(ops.debounceTime(500))
      .subscribe(() => {
        this.filter = this.form.value.filter;
        this.filterType = this.form.value.filterType;
        this.aiToggle = this.form.value.aiToggle;
        this.showAllStringsToggle = this.form.value.showAllStringsToggle;
        // Force the scroll element to jump to the top
        this.jumpToFileOffset(0);
      });
  }

  ngOnDestroy() {
    this.lastRequest?.unsubscribe();
    this.formSubscription?.unsubscribe();
    this.summarySubscription?.unsubscribe();
    this.aiSupportedSubscription?.unsubscribe();
    this.stringIndexFromHexHoverSub?.unsubscribe();
  }

  updateData() {
    this.summarySubscription?.unsubscribe();
    this.summarySubscription = this.entity.summary$.subscribe((obs) => {
      this.sha256Subject.next(obs.sha256);
      //get first set of data
      this.jumpToFileOffset(0);
    });
  }

  /** get next values */
  // update() {
  //   // If there is a pending request, make sure we don't get results
  //   // from it
  //   this.lastRequest?.unsubscribe();
  //   this.lastRequest =
  // }

  // protected scrollOccurred(index: number){
  //   // // console.info("new index")
  //   // // console.info(index) // Whatever item your up to in the list.
  //   // // console.info("viewport size", this.viewport.getViewportSize()) // Fixed size based on window
  //   // // console.info("viewport measureScrollOffset", this.viewport.measureScrollOffset()) // raw valu of the scroll bar index*item height? (22194 @ 765 ~29.01176px)
  //   // // console.info("viewport render range", this.viewport.getRenderedRange()) // - index range (703-841)
  //   // // console.info("viewport data length", this.viewport.getDataLength()) // number of strings loaded. e.g 1k then 2k then 3k...
  //   this.scrollManager.scrollOccurred(index)
  // }

  //check to disable ai toggle for unsupported file_format
  private isAISupportedType(file_format: string): boolean {
    return this.SUPPORTED_AI_FILTER_TYPES.some((type) =>
      file_format.startsWith(type),
    );
  }

  //get file_format
  private extractFilterType(file_format: string): string {
    const match = this.SUPPORTED_AI_FILTER_TYPES.find((type) =>
      file_format.startsWith(type),
    );
    return match || "";
  }

  private currentMinByteOffset: number = -1;
  private currentMaxByteOffset: number = -1;
  private fileLength: number = -1;
  private _take_n_strings = 1000;
  private MIN_LENGTH_STRING = 4;
  private SCROLL_UP_JUMP_AMOUNT = 1024 * 20; // 20kB jump - TODO optimise a little.

  sha256Subject: ReplaySubject<string> = new ReplaySubject();
  fileInfo$ = new Observable<FileInfo>();

  currentStringsSignal: WritableSignal<
    components["schemas"]["SearchResult"][]
  > = signal(undefined);
  scrollUpInProgressSignal: WritableSignal<boolean> = signal(false);
  scrollDownInProgressSignal: WritableSignal<boolean> = signal(false);
  scrollUpCache: components["schemas"]["SearchResult"][] = [];
  scrollUpCacheMinOffset: number = -1;
  scrollUpOffsetMultiplier: number = 1;
  reachedEndOfFile: boolean = false;

  scrollUpSub: Subscription = undefined;
  scrollDownSub: Subscription = undefined;

  // Start loading more strings when within 100 of the current edge (up or down)
  protected SCROLL_BUFFER_INDEX = 200;

  cleanupSubscriptions() {
    this.scrollUpSub?.unsubscribe();
    this.scrollDownSub?.unsubscribe();
  }

  __createQueryCommon(
    fileInfo: FileInfo,
    sha256: string,
    startOffset: number,
    maxBytesToRead: number,
  ) {
    // Compose the cachable part of the query for comparison later
    const searchQuery = {
      take_n_strings: this._take_n_strings,
      min_length: this.MIN_LENGTH_STRING,
      //Add extra param if the ai toggle is on to return ai-filtered strings
      ...(this.aiToggle && {
        file_format: this.extractFilterType(fileInfo.file_type),
      }),
    };

    this.searchQuery = searchQuery;

    if (this.filter !== "") {
      searchQuery[this.filterType] = this.filter;
    }

    // If the max bytes to read is less than 0 leave it as the default.
    if (maxBytesToRead > 0) {
      searchQuery["max_bytes_to_read"] = maxBytesToRead;
    }
    return this.entityService.strings(sha256, {
      offset: startOffset,
      ...searchQuery,
    });
  }

  _resetScrollUpCache() {
    this.scrollUpCacheMinOffset = -1;
    this.scrollUpCache = [];
    this.scrollUpOffsetMultiplier = 1;
  }

  _scrollUpFileInner(offsetForQuery: number) {
    this.scrollUpSub?.unsubscribe();
    this.scrollUpInProgressSignal.set(true);

    this.scrollUpSub = combineLatest([
      this.fileInfo$,
      this.sha256Subject.asObservable(),
    ])
      .pipe(
        ops.switchMap(([fileInfo, sha256]) => {
          // Read all strings from the offset that's been guessed and the target value.
          const maxBytesToRead = this.currentMinByteOffset - offsetForQuery;
          return this.__createQueryCommon(
            fileInfo,
            sha256,
            offsetForQuery,
            maxBytesToRead,
          );
        }),
        ops.catchError((e) => {
          if (e instanceof HttpErrorResponse) {
            return of(null);
          }
          throw e;
        }),
        ops.take(1),
      )
      .subscribe((s: AggregatedStrings) => {
        // If there is an error ensure scroll can recover
        if (!s) {
          this.scrollUpInProgressSignal.set(false);
          return;
        }

        // strings have loaded so process accordingly.

        // Add previous string entries for pagination to the current set of strings
        // if previous entries exist
        // If the search query parameters have changed, clear it out as previous hits
        // may not match
        if (this.scrollUpCacheMinOffset === -1) {
          this.scrollUpCacheMinOffset = offsetForQuery;
        }
        this.scrollUpCache = [...this.scrollUpCache, ...s.strings];
        if (s.strings.length >= this._take_n_strings) {
          this._scrollUpFileInner(s.strings[s.strings.length - 1].offset);
          return;
        }
        // Inital scroll provided no data so try scrolling again.
        if (s.strings.length === 0 && this.scrollUpCache.length === 0) {
          this.scrollUpOffsetMultiplier += 1;
          this._scrollUpFileInner(this._calculateScrollUpOffset());
          return;
        }

        if (
          this.currentStringsSignal() != undefined &&
          JSON.stringify(this.searchQuery) ===
            JSON.stringify(this.lastQueryParams)
        ) {
          this.currentStringsSignal.update((previous) => {
            return [...this.scrollUpCache, ...previous];
          });
        } else {
          this.currentStringsSignal.set([...this.scrollUpCache]);
        }
        this.lastQueryParams = this.searchQuery;
        // show toast if AI string filter timed out
        if (s.time_out === true) {
          this.toastrService.warning(
            "String filter timeout",
            "Too many strings were filtered out and the execution timeout was reached. A reduced subset of strings is being shown.",
          );
        }

        // can now ask for more again
        this.currentMinByteOffset = this.scrollUpCacheMinOffset;
        this._resetScrollUpCache();
        this.scrollUpInProgressSignal.set(false);
      });
  }

  _calculateScrollUpOffset(): number {
    let offsetForQuery = this.currentMinByteOffset - this.SCROLL_UP_JUMP_AMOUNT;
    if (offsetForQuery < 0) {
      offsetForQuery = 0;
    }
    return offsetForQuery * this.scrollUpOffsetMultiplier;
  }

  // Scroll up a file loading strings before the minimum offset.
  _scrollUpFile(): boolean {
    // Already up to the start of the file so nothing to do.
    if (this.currentMinByteOffset === 0) {
      return false;
    }
    this._scrollUpFileInner(this._calculateScrollUpOffset());
  }

  // Scroll down a file loading strings after the maximum offset.
  _scrollDownFile(): boolean {
    // If we are loading the first set of entries, display a loading indicator
    // else show a less intrusive spinner
    if (this.currentMaxByteOffset <= -1) {
      this.currentMaxByteOffset = 0;
      this.isLoadingInitial$.next(true);
    }

    // Already have all the strings don't try and scroll any further.
    if (this.reachedEndOfFile) {
      return false;
    }

    this.scrollDownSub?.unsubscribe();
    this.scrollDownInProgressSignal.set(true);
    const offsetForQuery = this.currentMaxByteOffset;
    this.scrollDownSub = combineLatest([
      this.fileInfo$,
      this.sha256Subject.asObservable(),
    ])
      .pipe(
        ops.switchMap(([fileInfo, sha256]) => {
          let maxBytesToRead = -1;
          // Toggle ability to show/hide All strings.
          if (this.showAllStringsToggle === true) {
            maxBytesToRead = fileInfo.file_size;
          }
          return this.__createQueryCommon(
            fileInfo,
            sha256,
            offsetForQuery,
            maxBytesToRead,
          );
        }),
        ops.catchError((e) => {
          if (e instanceof HttpErrorResponse) {
            return of(null);
          }
          throw e;
        }),
        ops.take(1),
      )
      .subscribe((s: AggregatedStrings) => {
        this._stringsLoaded$ = of(true);
        if (this.isLoadingInitial$.value) {
          this.isLoadingInitial$.next(false);
        }
        // If there is an error ensure scroll can recover
        if (!s) {
          this.scrollDownInProgressSignal.set(false);
          return;
        }

        // strings have loaded so process accordingly.

        // Add previous string entries for pagination to the current set of strings
        // if previous entries exist
        // If the search query parameters have changed, clear it out as previous hits
        // may not match
        if (
          this.currentStringsSignal() != undefined &&
          JSON.stringify(this.searchQuery) ===
            JSON.stringify(this.lastQueryParams)
        ) {
          this.currentStringsSignal.update((previous) => {
            return [...previous, ...s.strings];
          });
        } else {
          this.currentStringsSignal.set([...s.strings]);
        }
        this.lastQueryParams = this.searchQuery;
        // show toast if AI string filter timed out
        if (s.time_out === true) {
          this.toastrService.warning(
            "String filter timeout",
            "Too many strings were filtered out and the execution timeout was reached. A reduced subset of strings is being shown.",
          );
        }
        // can now ask for more again
        this.currentMaxByteOffset = s.next_offset;
        this.reachedEndOfFile = !s.has_more;
        this.scrollDownInProgressSignal.set(false);
      });
  }

  scrollOccurred(index: number): boolean {
    this.isLastActionScroll = true;
    // Scroll already in progress keep waiting.
    if (
      this.scrollUpInProgressSignal() === true ||
      this.scrollDownInProgressSignal() === true
    ) {
      // console.info("scroll in progress")
      return false;
    }
    if (
      this.currentStringsSignal().length === 0 ||
      this.currentStringsSignal() === undefined
    ) {
      return false;
    }

    // Only load new data if close to the edge of the strings.
    if (index + this.SCROLL_BUFFER_INDEX > this.currentStringsSignal().length) {
      // console.info("scrolling down!")
      return this._scrollDownFile();
    } else if (index - this.SCROLL_BUFFER_INDEX < 0) {
      // console.info("scrolling up!")
      return this._scrollUpFile();
    }
    return false;
  }

  // Jump to arbitrary offset within file (if it is within the current range of loaded strings or close to just scroll).
  jumpToFileOffset(offset: number) {
    this.isLastActionScroll = false;
    if (
      this.scrollUpInProgressSignal() === true ||
      this.scrollDownInProgressSignal() === true
    ) {
      // console.info("scroll/jump in progress")
      return false;
    }
    if (offset < 4000) {
      // console.info("jumping to 0!")
      this.reset();
      this.currentMinByteOffset = 0;
      this._scrollDownFile();
    } else if (
      offset < this.currentMaxByteOffset &&
      offset > this.currentMinByteOffset
    ) {
      // console.info("already in range dw!")
      return;
    } else {
      // console.info("Jumping in both directions.")
      this.reset();
      this.currentMinByteOffset = offset;
      this.currentMaxByteOffset = offset;
      this._scrollDownFile();
      this._scrollUpFile();
    }
  }

  reset() {
    if (this.currentStringsSignal() !== undefined) {
      this.currentStringsSignal.set([]);
    }
    this.currentMaxByteOffset = -1;
    this.currentMinByteOffset = -1;
    this.scrollUpInProgressSignal.set(false);
    this.scrollDownInProgressSignal.set(false);
    this.reachedEndOfFile = false;
  }
}
