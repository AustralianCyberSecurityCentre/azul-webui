import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { HttpErrorResponse } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  WritableSignal,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { disabled, form, max, min, validate } from "@angular/forms/signals";
import { components } from "@app/core/api/openapi";
import { Entity } from "@app/core/services";
import { selectEnableHexStringSync } from "@app/core/store/global-settings/global-selector";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Store } from "@ngrx/store";
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
import { BaseCard } from "../base-card.component";
import { HexStringSyncService } from "../hex-string-sync.service";

type AggregatedStrings = components["schemas"]["BinaryStrings"];

type FileInfo = { file_size: number; file_type: string };

export type filterType = "filter" | "regex";
interface StringsFilterForm {
  filter: string;
  filterType: filterType;
  aiToggle: boolean;
  showAllStringsToggle: boolean;
  min_length_strings: number;
  max_length_strings: number;
}

@Component({
  selector: "azec-strings",
  templateUrl: "./strings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StringsComponent extends BaseCard implements OnInit, OnDestroy {
  private toastrService = inject(ToastrService);
  private entityService = inject(Entity);
  private hexStringSyncService = inject(HexStringSyncService);
  private store = inject(Store);

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

  // 10 MiB
  protected readonly allStringsMinSize10Mib = 1000 * 1000 * 10;

  private lastRequest: Subscription | undefined = undefined;
  private summarySubscription: Subscription | undefined = undefined;
  private aiSupportedSubscription: Subscription | undefined = undefined;

  /** If an update to the strings table has been requested for first time */
  isLoadingInitialSignal: WritableSignal<boolean> = signal(false);

  @ViewChild("stringViewport", { read: CdkVirtualScrollViewport })
  viewport: CdkVirtualScrollViewport;

  // Subscription to hex views changing position.
  stringIndexFromHexHoverSub: Subscription;

  isAISupported$ = new Observable<boolean>();
  protected isAiToggleDisabled: WritableSignal<boolean> = signal(true);

  protected stringsFilterModel: WritableSignal<StringsFilterForm> = signal({
    filter: "",
    filterType: "filter",
    aiToggle: false,
    showAllStringsToggle: false,
    min_length_strings: 4,
    max_length_strings: 200,
  });
  protected stringsFilterForm = form(this.stringsFilterModel, (f) => {
    disabled(f.aiToggle, {
      when: () => this.isAiToggleDisabled(),
    });
    min(f.min_length_strings, 2, {
      message: "min string must be at least 2.",
    });
    max(f.min_length_strings, 200, {
      message: "min string can be at most 200.",
    });
    max(f.max_length_strings, 200, {
      message: "max string can be at most 200.",
    });
    min(f.min_length_strings, 2, {
      message: "max string must be at least 2.",
    });
    validate(f.min_length_strings, ({ value, valueOf }) => {
      if (value() > valueOf(f.max_length_strings)) {
        return {
          kind: "minMaxLengthError",
          message:
            "Minimum length must be less than or equal to max length of strings.",
        };
      }
      return null;
    });
  });

  constructor() {
    super();
    this.isAISupported$ = combineLatest([
      this.fileInfoSubject.asObservable(),
    ]).pipe(
      ops.map(([fileInfo]) => this.isAISupportedType(fileInfo.file_type)),
      ops.shareReplay(1),
    );
    // Needed to fully disable the ai checkbox if AI isn't supported.
    this.aiSupportedSubscription = this.isAISupported$.subscribe(
      (supported) => {
        this.stringsFilterModel.update((v) => ({ ...v, aiToggle: false }));
        if (supported) {
          this.isAiToggleDisabled.set(false);
        } else {
          this.isAiToggleDisabled.set(true);
        }
      },
    );

    // Continually jump to index
    this.stringIndexFromHexHoverSub = combineLatest([
      toObservable(this.hexStringSyncService.HexOffsetSignal),
      toObservable(this.currentStringsSignal),
      this.store.select(selectEnableHexStringSync),
    ])
      .pipe(
        ops.map(([hexOffset, currentStringList, enableHexStringSync]) => {
          // If the syncing is disabled do nothing
          if (enableHexStringSync === false) {
            return -1;
          }
          if (hexOffset === -1) {
            return -1;
          }
          // Binary search for string with the correct offset in the list of strings.
          const stringVal = currentStringList;
          if (stringVal === undefined) {
            return -1;
          }
          if (stringVal.length > 0) {
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
          let mid_index;
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
        if (indexToJumpTo > -1 && this.viewport) {
          this.viewport?.scrollToIndex(indexToJumpTo);
        }
      });

    effect(() => {
      // Changes to this model trigger the effect
      this.stringsFilterModel();
      // There is many signals inside this function so don't allow them changing to trigger the effect.
      untracked(() => {
        if (this.stringsFilterForm().valid()) {
          this.jumpToFileOffset(0);
        }
      });
    });
  }

  ngOnInit(): void {
    this._setupScrollOccurredSubscription();
  }

  ngOnDestroy() {
    this.scrollUpSub?.unsubscribe();
    this.scrollDownSub?.unsubscribe();
    this.scrollOccurredSub?.unsubscribe();
    this.lastRequest?.unsubscribe();
    this.summarySubscription?.unsubscribe();
    this.aiSupportedSubscription?.unsubscribe();
    this.stringIndexFromHexHoverSub?.unsubscribe();
  }

  updateData() {
    this.summarySubscription?.unsubscribe();
    this.summarySubscription = this.entity.summary$.subscribe((obs) => {
      this.sha256Subject.next(obs.sha256);
      let file_size = 0;
      if (obs?.file_size) {
        file_size = obs.file_size;
      }
      let file_format = "";
      if (obs?.file_format) {
        file_format = obs.file_format;
      }

      this.fileInfoSubject.next({
        file_size: file_size,
        file_type: file_format,
      });
      //get first set of data
      this.jumpToFileOffset(0);
    });
  }

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

  // --------------------------------------- Hex viewer synchronization code.

  private currentMinByteOffset: number = -1;
  private currentMaxByteOffset: number = -1;
  private _take_n_strings = 1000;
  private SCROLL_UP_JUMP_AMOUNT = 1024 * 20; // 20kB jump - arbitrary and may need adjusting in the future

  sha256Subject: ReplaySubject<string> = new ReplaySubject();
  fileInfoSubject = new ReplaySubject<FileInfo>();

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
  scrollOccurredSub: Subscription = undefined;
  scrollIndexSubject: BehaviorSubject<number> = new BehaviorSubject(-1);

  // Start loading more strings when within 100 of the current edge (up or down)
  protected SCROLL_BUFFER_INDEX = 200;

  // The common API query used to scroll up and down the file.
  private __createQueryCommon(
    fileInfo: FileInfo,
    sha256: string,
    startOffset: number,
    maxBytesToRead: number,
  ) {
    // Compose the cachable part of the query for comparison later
    const searchQuery = {
      take_n_strings: this._take_n_strings,
      min_length: this.stringsFilterModel().min_length_strings,
      max_length: this.stringsFilterModel().max_length_strings,
      //Add extra param if the ai toggle is on to return ai-filtered strings
      ...(this.stringsFilterModel().aiToggle && {
        file_format: this.extractFilterType(fileInfo.file_type),
      }),
    };

    if (this.stringsFilterModel().filter !== "") {
      searchQuery[this.stringsFilterModel().filterType] =
        this.stringsFilterModel().filter;
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

  // Reset the scroll cache, the cache is used to cache strings if the file jump is too large and there are more
  // than 1000 strings between the jump point and the destination offset.
  private _resetScrollUpCache() {
    this.scrollUpCacheMinOffset = -1;
    this.scrollUpCache = [];
    this.scrollUpOffsetMultiplier = 1;
  }

  /* Find the strings that should be above the current point, while scrolling up.
  NOTE - this jumps a set distance and looks for all strings between that random jump and the previous earliest
  offset in the file.
  IF - there are no strings in that range, gradually expands the range to look for strings in a larger and larger
  section of the file.
  IF - there are 1000 strings or less between the two points, the strings are loaded into the known list of strings.
  IF - there are more than 1000 strings, cache the found strings and then search for all the additional strings that
  will be in-between the space that wasn't searched yet, do this recursively until all strings are found.
  */
  private _scrollUpFileInner(offsetForQuery: number) {
    // Already at the top of the file don't try and scroll.
    if (this.currentMinByteOffset === 0) {
      return;
    }

    this.scrollUpSub?.unsubscribe();
    this.scrollUpInProgressSignal.set(true);

    this.scrollUpSub = combineLatest([
      this.fileInfoSubject.asObservable(),
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

        if (this.scrollUpCacheMinOffset < offsetForQuery) {
          this.scrollUpCacheMinOffset = offsetForQuery;
        }
        this.scrollUpCache = [...this.scrollUpCache, ...s.strings];
        if (s.strings.length >= this._take_n_strings) {
          this._scrollUpFileInner(s.strings[s.strings.length - 1].offset);
          return;
        }
        // Initial scroll provided no data so try scrolling again.
        if (s.strings.length === 0 && this.scrollUpCache.length === 0) {
          this.scrollUpOffsetMultiplier += 1;
          this._scrollUpFileInner(this._calculateScrollUpOffset());
          return;
        }

        if (this.currentStringsSignal() === undefined) {
          this.currentStringsSignal.set([...this.scrollUpCache]);
        } else {
          this.currentStringsSignal.update((previous) => {
            return [...this.scrollUpCache, ...previous];
          });
          // try and keep view port at the same point.
          this.viewport?.scrollToIndex(
            this.scrollIndexSubject.value + this.scrollUpCache.length,
          );
        }
        // show toast if AI string filter timed out
        if (s.time_out === true) {
          this.toastrService.warning(
            "String filter timeout",
            "Too many strings were filtered out and the execution timeout was reached. A reduced subset of strings is being shown.",
          );
        }

        // can now ask for more again
        this.currentMinByteOffset = this.scrollUpCacheMinOffset;
        // Keep scrolling up until the top of the files or 1000 strings have been found.
        // This is useful if you start and the very bottom of the file.
        if (
          this.currentMinByteOffset !== 0 &&
          this.currentStringsSignal().length < this._take_n_strings
        ) {
          this._scrollUpFile();
        }
        this.scrollUpInProgressSignal.set(false);
      });
  }

  // Calculate how far above the previous offset to jump to try and load strings.
  private _calculateScrollUpOffset(): number {
    let offsetForQuery =
      this.currentMinByteOffset -
      this.SCROLL_UP_JUMP_AMOUNT * this.scrollUpOffsetMultiplier;
    if (offsetForQuery < 0) {
      offsetForQuery = 0;
    }
    return offsetForQuery;
  }

  // Scroll up a file loading strings before the minimum offset.
  private _scrollUpFile() {
    // Already up to the start of the file so nothing to do.
    if (this.currentMinByteOffset === 0) {
      // Ensure scrollupinprogress is now false as it may be true when this function is called from _scrollUpFileInner
      this.scrollUpInProgressSignal.set(false);
    }
    this._resetScrollUpCache();
    this._scrollUpFileInner(this._calculateScrollUpOffset());
  }

  // Scroll down a file loading strings after the maximum offset.
  private _scrollDownFile(): boolean {
    // If we are loading the first set of entries, display a loading indicator
    // else show a less intrusive spinner
    if (this.currentMaxByteOffset <= -1) {
      this.currentMaxByteOffset = 0;
      this.isLoadingInitialSignal.set(true);
    }

    // Already have all the strings don't try and scroll any further.
    if (this.reachedEndOfFile) {
      return false;
    }

    this.scrollDownSub?.unsubscribe();
    this.scrollDownInProgressSignal.set(true);
    const offsetForQuery = this.currentMaxByteOffset;
    this.scrollDownSub = combineLatest([
      this.fileInfoSubject.asObservable(),
      this.sha256Subject.asObservable(),
    ])
      .pipe(
        ops.switchMap(([fileInfo, sha256]) => {
          let maxBytesToRead = -1;
          // Toggle ability to show/hide All strings.
          if (this.stringsFilterModel().showAllStringsToggle === true) {
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
        if (this.isLoadingInitialSignal()) {
          this.isLoadingInitialSignal.set(false);
        }
        // If there is an error ensure scroll can recover
        if (!s) {
          this.scrollDownInProgressSignal.set(false);
          return;
        }
        if (this.currentStringsSignal() === undefined) {
          this.currentStringsSignal.set([...s.strings]);
        } else {
          this.currentStringsSignal.update((previous) => {
            return [...previous, ...s.strings];
          });
        }
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
    return true;
  }

  // Pass the scroll event on to the index subject so it can be slightly throttled.
  scrollOccurred(index: number) {
    this.scrollIndexSubject.next(index);
  }

  // Handles a scroll occurring with a throttle to reduce how many events get processed.
  private _setupScrollOccurredSubscription() {
    this.scrollOccurredSub?.unsubscribe();
    this.scrollOccurredSub = this.scrollIndexSubject
      .pipe(
        ops.throttleTime(100),
        ops.filter((_index) => {
          // Scroll already in progress keep waiting.
          if (
            this.scrollUpInProgressSignal() === true ||
            this.scrollDownInProgressSignal() === true
          ) {
            return false;
          }
          // A scroll can't occur until at least the initial data is loaded so wait for that.
          if (
            this.currentStringsSignal().length === 0 ||
            this.currentStringsSignal() === undefined
          ) {
            return false;
          }
          return true;
        }),
      )
      .subscribe((index) => {
        // Only load new data if close to the edge of the strings.
        // Close to the bottom and haven't reached the end of the file.
        if (
          index + this.SCROLL_BUFFER_INDEX >
            this.currentStringsSignal().length &&
          this.reachedEndOfFile !== true
        ) {
          return this._scrollDownFile();
        } else if (index - this.SCROLL_BUFFER_INDEX < 0) {
          return this._scrollUpFile();
        }
      });
  }

  // Jump to arbitrary offset within file (ignore request if the strings have already been loaded).
  jumpToFileOffset(offset: number) {
    // If a scroll is in progress don't start another scroll event.
    if (
      this.scrollUpInProgressSignal() === true ||
      this.scrollDownInProgressSignal() === true
    ) {
      return false;
    }
    // If it's within the scroll up windows, just do a scroll down from the top.
    if (offset < this.SCROLL_UP_JUMP_AMOUNT) {
      this.reset();
      this.currentMinByteOffset = 0;
      this._scrollDownFile();
    } else if (
      offset < this.currentMaxByteOffset &&
      offset > this.currentMinByteOffset
    ) {
      console.error(
        "Trying to jump to an offset within the loaded file this shouldn't happen.",
      );
      return false;
    } else {
      // Jumping to an offset outside of the current loaded range so clear the current range and then load the strings above and below the target point.
      this.reset();
      this.currentMinByteOffset = offset;
      this.currentMaxByteOffset = offset;
      this._scrollDownFile();
      this._scrollUpFile();
    }
    return true;
  }

  // Clear the existing strings and set scroll relevant properties back to defaults
  // Can only be called while a scroll is not in progress.
  reset() {
    if (
      this.scrollUpInProgressSignal() === true ||
      this.scrollDownInProgressSignal() === true
    ) {
      return false;
    }
    if (this.currentStringsSignal() !== undefined) {
      this.currentStringsSignal.set([]);
    }
    this.currentMaxByteOffset = -1;
    this.currentMinByteOffset = -1;
    this.scrollUpInProgressSignal.set(false);
    this.scrollDownInProgressSignal.set(false);
    this.reachedEndOfFile = false;
    return true;
  }
}
