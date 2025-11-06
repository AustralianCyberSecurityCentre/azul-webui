import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { HttpErrorResponse } from "@angular/common/http";
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
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { ToastrService } from "ngx-toastr";
import { BehaviorSubject, Observable, Subscription, of } from "rxjs";
import * as ops from "rxjs/operators";
import { ContinuousScroll } from "src/app/common/continuous-scroll/continuous-scroll.class";
import { components, operations } from "src/app/core/api/openapi";
import { Entity } from "src/app/core/services";
import { BaseCard } from "../base-card.component";

type AggregatedStrings = components["schemas"]["BinaryStrings"] & {
  strings: components["schemas"]["SearchResult"][];
};

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
  private host = inject(ElementRef);

  help = `
This panel displays bits of text that were found in the file.

Text can be encoded in various different ways, and Azul will try a variety of methods to extract these 'strings'.

The location of each string in the file is also displayed.

NOTE - only the first 10MB of a file is checked for strings for efficiency reasons.
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

  strings$ = new BehaviorSubject<AggregatedStrings>(undefined);
  _stringsLoaded$: Observable<number> = new Observable<number>();

  sha256: string;
  cs: ContinuousScroll;

  private _take_n_strings = 1000;

  @ViewChild(CdkVirtualScrollViewport)
  viewport: CdkVirtualScrollViewport;

  viewportHeight = "70vh";

  private lastRequest: Subscription | undefined = undefined;
  private formSubscription: Subscription | undefined = undefined;
  private aiSupportedListener: Subscription | undefined = undefined;
  private fileFormatListener: Subscription | undefined = undefined;
  private dataListener: Subscription | undefined = undefined;
  private lastQueryParams:
    | operations["get_strings_api_v0_binaries__sha256__strings_get"]["parameters"]["query"]
    | undefined;
  data$: Observable<components["schemas"]["EntityFind"] | null>;

  /** If an update to the strings table has been requested for first time */
  isLoadingInitial$ = new BehaviorSubject(false);
  /** If an update to the strings table has been requested after intial request (shows non intrusive spinner) */
  isLoading$ = new BehaviorSubject(false);

  isAISupported$ = new Observable<boolean>();
  fileFormat$ = new Observable<string>();

  form: UntypedFormGroup;
  private filter = "";
  private filterType: "filter" | "regex" = "filter";
  private aiToggle: boolean = false;
  private fileType = "";

  private resizeObs?: ResizeObserver;

  ngOnInit(): void {
    this.form = this.fb.group({
      filter: this.fb.control(""),
      filterType: this.fb.control("filter"),
      aiToggle: this.fb.control(false),
    });

    this.formSubscription = this.form.valueChanges
      .pipe(ops.debounceTime(500))
      .subscribe(() => {
        this.filter = this.form.value.filter;
        this.filterType = this.form.value.filterType;
        this.aiToggle = this.form.value.aiToggle;
        // Force the scroll element to jump to the top
        this.cs.offset = 0;
        this.update();
      });

    // Force the strings view viewport to automatically resize when the height of the element
    // changes
    this.resizeObs = new ResizeObserver((_entries) => {
      this.viewport?.checkViewportSize();
    });

    this.resizeObs.observe(this.host.nativeElement);

    const params = { term: this.sha256 };

    this.data$ = this.entityService.find(params).pipe(
      ops.catchError((e) => {
        if (e instanceof HttpErrorResponse) {
          return of(null);
        }
        throw e;
      }),
    );

    this.fileFormat$ = this.data$.pipe(
      ops.map((data) => {
        if (data?.items?.length > 0) {
          const firstItem = data.items[0];
          return this.extractFilterType(firstItem.file_format);
        } else {
          return "";
        }
      }),
      ops.shareReplay(1),
    );

    this.isAISupported$ = this.fileFormat$.pipe(
      ops.map((format) => this.isAISupportedType(format)),
      ops.shareReplay(1),
    );

    this.fileFormatListener = this.fileFormat$.subscribe((format) => {
      this.fileType = format;
    });

    this.aiSupportedListener = this.isAISupported$.subscribe((supported) => {
      const aiToggleControl = this.form.get("aiToggle");
      if (supported) {
        aiToggleControl?.enable();
      } else {
        aiToggleControl?.disable();
      }
    });
  }

  ngOnDestroy() {
    this.lastRequest?.unsubscribe();
    this.formSubscription?.unsubscribe();
    this.resizeObs?.disconnect();
    this.aiSupportedListener?.unsubscribe();
    this.fileFormatListener?.unsubscribe();
  }

  updateData() {
    this.entity.summary$.subscribe((obs) => {
      this.sha256 = obs.sha256;

      this.cs = new ContinuousScroll();
      //override functions that need local context
      this.cs.update = () => {
        this.update();
      };
      this.cs.getDataLength = () => {
        return this.viewport.getDataLength();
      };

      //get first set of data
      this.cs.update();
    });
  }

  /** get next values */
  update() {
    // If we are loading the first set of entries, display a loading indicator
    // else show a less intrusive spinner
    if (this.cs.offset === 0) {
      this.isLoadingInitial$.next(true);
    } else {
      this.isLoading$.next(true);
    }

    // If there is a pending request, make sure we don't get results
    // from it
    this.lastRequest?.unsubscribe();

    // Compose the cachable part of the query for comparison later
    const searchQuery = {
      take_n_strings: this._take_n_strings,
      min_length: 4,
      //Add extra param if the ai toggle is on to return ai-filtered strings
      ...(this.aiToggle && {
        file_format: this.extractFilterType(this.fileType),
      }),
    };

    if (this.filter !== "") {
      searchQuery[this.filterType] = this.filter;
    }

    this.lastRequest = this.entityService
      .strings(this.sha256, {
        offset: this.cs.offset,
        ...searchQuery,
      })
      .pipe(
        ops.take(1),
        ops.catchError((e) => {
          if (e instanceof HttpErrorResponse) {
            return of(null);
          }
          throw e;
        }),
      )
      .subscribe((s: AggregatedStrings) => {
        // Add previous string entries for pagination to the current set of strings
        // if previous entries exist
        // If the search query parameters have changed, clear it out as previous hits
        // may not match
        if (
          this.strings$?.value != undefined &&
          JSON.stringify(searchQuery) === JSON.stringify(this.lastQueryParams)
        ) {
          // workaround for when ai string filter is toggled on, off, and back on.
          // stops duplicate strings being added to strings$
          if (s.strings[0] != this.strings$.value.strings[0]) {
            s.strings = [...this.strings$.value.strings, ...s.strings];
          }
        }
        this._stringsLoaded$ = of(1);
        this.strings$.next(s);
        // can now ask for more again
        if (s) {
          this.cs.reset(false, s.next_offset, s.has_more);
        }

        this.lastQueryParams = searchQuery;

        this.isLoading$.next(false);
        this.isLoadingInitial$.next(false);
        // show toast if AI string filter timed out
        if (s && s.time_out === true) {
          this.toastrService.warning(
            "String filter timeout",
            "Too many strings were filtered out and the execution timeout was reached. A reduced subset of strings is being shown.",
          );
        }
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
}
