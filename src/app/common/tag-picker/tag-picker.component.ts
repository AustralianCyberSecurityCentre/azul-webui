import {
  Component,
  computed,
  inject,
  Input,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Observable } from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { components } from "src/app/core/api/openapi";
import { FlowModule } from "src/lib/flow/flow.module";
import { InputComponent } from "src/lib/flow/input/input.component";

@Component({
  selector: "az-tag-picker",
  imports: [FlowModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./tag-picker.component.html",
})
export class TagPickerComponent {
  private api = inject(ApiService);

  @ViewChild("tagInput") private tagInput: InputComponent;
  protected faMagnifyingGlass = faMagnifyingGlass;

  // FUTURE this should be  a signal as part of a form.
  @Input() tagName: FormControl<string>;
  // Signal to keep signals up to date on value of tagName.
  protected _tagInputChange() {
    this.valueAsSignal.set(String(this.tagName.value));
  }

  valueAsSignal: WritableSignal<string> = signal("");
  entityTagsSignal: Signal<string[]>;
  entityTagsFiltered: Signal<string[]> = computed(() => {
    const result: string[] = [];
    this.entityTagsSignal().forEach((val) => {
      const currentTagName = this.valueAsSignal();
      if (currentTagName.length > 0) {
        if (val.includes(currentTagName)) {
          // Only add tags if they contain some of the text in the value field.
          result.push(val);
        }
      } else {
        // Add all the tags
        result.push(val);
      }
    });
    return result;
  });

  featureTags$: Observable<components["schemas"]["ReadFeatureValueTags"]>;
  showExistingTagsSignal: WritableSignal<boolean> = signal(false);

  constructor() {
    this.entityTagsSignal = toSignal(
      this.api.entityReadAllTags().pipe(
        ops.map((tagValues) => {
          const output: string[] = [];
          tagValues.tags.forEach((tagVal) => {
            output.push(tagVal.tag);
          });
          output.sort();
          return output;
        }),
        ops.shareReplay(1),
      ),
    );
    this.featureTags$ = this.api.featureReadAllTags().pipe(ops.shareReplay(1));
  }

  setTagValue(tagValue: string) {
    this.tagName.setValue(tagValue);
    this.showExistingTagsSignal.set(false);
  }

  /* Only set the tag value on selection values like space or enter. */
  keyDownActionOnTagValue(event: KeyboardEvent, tagValue: string) {
    if (event.key === "Enter" || event.key === "Space") {
      this.setTagValue(tagValue);
    } else if (event.key === "Escape") {
      this.showExistingTagsSignal.set(false);
    }
  }

  /* Hide the available selection upon clicking enter or space */
  closeOnEnter(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === "Space") {
      this.showExistingTagsSignal.set(false);
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
