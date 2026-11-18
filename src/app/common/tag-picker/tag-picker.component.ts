import { AsyncPipe, CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  Input,
  model,
  OnInit,
  signal,
  WritableSignal,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  FieldTree,
  maxLength,
  pattern,
  required,
  SchemaPath,
} from "@angular/forms/signals";
import { ApiService } from "@app/core/api/api.service";
import { FlowModule } from "@lib/flow/flow.module";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import * as ops from "rxjs/operators";

export function configureTagValidation(tagNamePath: SchemaPath<string>) {
  required(tagNamePath);
  pattern(tagNamePath, /^[a-z0-9-]*$/);
  maxLength(tagNamePath, 25);
}

export interface tagPickerModel {
  tag: string;
}

@Component({
  selector: "az-tag-picker",
  imports: [FlowModule, AsyncPipe, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./tag-picker.component.html",
})
export class TagPickerComponent implements OnInit {
  private api = inject(ApiService);
  private elementRef = inject(ElementRef);

  tagFieldTree = model.required<FieldTree<string>>();

  @Input() refreshTags$: BehaviorSubject<boolean>;

  isEntityTag = input<boolean>(true);

  protected allEntityTagsSub: Subscription;

  allEntityTags$: Observable<string[]>;
  allEntityTagsFiltered$: Observable<string[]>;

  allFeatureTags$: Observable<string[]>;
  allFeatureTagsFiltered$: Observable<string[]>;

  showExistingTagsSignal: WritableSignal<boolean> = signal(false);

  tagName$: Observable<string>;

  constructor() {
    this.tagName$ = toObservable(computed(() => this.tagFieldTree()().value()));
  }

  ngOnInit(): void {
    this.allEntityTags$ = this.refreshTags$.pipe(
      ops.switchMap(() => {
        // FUTURE - should get cache value first and then query with no cache
        return this.api.entityReadAllTags(true);
      }),
      ops.map((tagValues) => {
        const output: string[] = [];
        tagValues.tags.forEach((tagVal) => {
          output.push(tagVal.tag);
        });
        output.sort();
        return output;
      }),
      ops.shareReplay(1),
    );
    this.allEntityTagsFiltered$ = this.tagName$.pipe(
      ops.startWith(""),
      ops.combineLatestWith(this.allEntityTags$),
      ops.map(([newTagValue, tagList]) => {
        const result: string[] = [];
        tagList.forEach((val) => {
          if (newTagValue.length > 0) {
            if (val.includes(newTagValue)) {
              // Only add tags if they contain some of the text in the value field.
              result.push(val);
            }
          } else {
            // Add all the tags
            result.push(val);
          }
        });
        return result;
      }),
      ops.shareReplay(1),
    );

    this.allFeatureTags$ = this.refreshTags$.pipe(
      ops.switchMap(() => {
        // FUTURE - should get cache value first and then query with no cache
        return this.api.featureReadAllTags(true);
      }),
      ops.map((tagValues) => {
        const output: string[] = [];
        tagValues.tags.forEach((tagVal) => {
          output.push(tagVal.tag);
        });
        output.sort();
        return output;
      }),
      ops.shareReplay(1),
    );

    this.allFeatureTagsFiltered$ = this.tagName$.pipe(
      ops.startWith(""),
      ops.combineLatestWith(this.allFeatureTags$),
      ops.map(([newTagValue, tagList]) => {
        const result: string[] = [];
        tagList.forEach((val) => {
          if (newTagValue.length > 0) {
            if (val.includes(newTagValue)) {
              // Only add tags if they contain some of the text in the value field.
              result.push(val);
            }
          } else {
            // Add all the tags
            result.push(val);
          }
        });

        return result;
      }),
      ops.shareReplay(1),
    );
  }

  setTagValue(tagValue: string) {
    this.tagFieldTree()().controlValue.set(tagValue);
    this.showExistingTagsSignal.set(false);
  }

  private getSuggestionElements(): HTMLElement[] {
    const host = this.elementRef.nativeElement as HTMLElement;
    return Array.from(
      host.querySelectorAll<HTMLElement>("[id^='tag-suggestion-']"),
    );
  }

  private focusSuggestionAt(index: number) {
    const items = this.getSuggestionElements();
    if (items.length === 0) {
      return;
    }
    const index_suggestion = Math.max(0, Math.min(index, items.length - 1));
    items[index_suggestion].focus();
  }

  private focusTagInput() {
    const host = this.elementRef.nativeElement as HTMLElement;
    host.querySelector<HTMLInputElement>("#tagInput")?.focus();
  }

  /* Only set the tag value on selection values like space or enter, and allow
  arrow keys to move focus between suggestions. */
  keyDownActionOnTagValue(event: KeyboardEvent, tagValue: string) {
    if (event.key === "Enter" || event.key === "Space") {
      this.setTagValue(tagValue);
    } else if (event.key === "Escape") {
      this.showExistingTagsSignal.set(false);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const items = this.getSuggestionElements();
      const index = items.indexOf(event.target as HTMLElement);
      if (index <= 0) {
        this.focusTagInput();
      } else {
        this.focusSuggestionAt(index - 1);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const items = this.getSuggestionElements();
      const index = items.indexOf(event.target as HTMLElement);
      this.focusSuggestionAt(index + 1);
    }
  }

  /* Hide the available selection upon clicking enter or space.
  Alternatively moves focus into suggestion box with down arrow */
  closeOnEnter(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === "Space") {
      this.showExistingTagsSignal.set(false);
    } else if (event.key === "ArrowDown" && this.showExistingTagsSignal()) {
      event.preventDefault();
      this.focusSuggestionAt(0);
    }
  }

  handleFocusOut(evnt: FocusEvent) {
    /*Close suggestions if focus is lost on the suggest input and it's child elements.*/
    const targetId = (evnt.relatedTarget as HTMLElement)?.id;
    if (!targetId) {
      this.showExistingTagsSignal.set(false);
    } else if (
      targetId !== "tagInput" &&
      !targetId.startsWith("tag-suggestion-")
    ) {
      this.showExistingTagsSignal.set(false);
    }
  }
}
