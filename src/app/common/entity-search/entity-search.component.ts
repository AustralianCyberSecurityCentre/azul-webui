import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import createFuzzySearch, { FuzzySearcher } from "@nozbe/microfuzz";
import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  combineLatest,
  concat,
  defer,
  of,
} from "rxjs";
import * as ops from "rxjs/operators";
import { components } from "src/app/core/api/openapi";
import { Entity } from "src/app/core/services";
import { InputComponent } from "src/lib/flow/input/input.component";

type NameSection = {
  value: string;
  underlined: boolean;
};

type Suggestion = {
  fieldName: NameSection[];
  fieldType: string;
  originalFieldName: string;
};

@Component({
  selector: "azco-entity-search",
  templateUrl: "./entity-search.component.html",
  standalone: false,
})
export class EntitySearchComponent implements OnInit, OnDestroy {
  private entityService = inject(Entity);

  /**
   * If the AST is currently fresh and valid.
   */
  @ViewChild("termInput") private textInputElement: InputComponent;

  protected faMagnifyingGlass = faMagnifyingGlass;

  /**
   * Form control to store textual user information into.
   */
  @Input()
  term: FormControl;

  /** Suggestion model for autocomplete */
  private model$ = new Subject<FuzzySearcher<Suggestion>>();

  /** Autocomplete context */
  protected autocompleteContext$: Observable<
    components["schemas"]["Response_Union_AutocompleteNone_AutocompleteInitial_AutocompleteFieldName_AutocompleteFieldValue_AutocompleteError___FieldInfo_annotation_NoneType__required_True__discriminator__type___"]["data"]
  >;
  /** Suggestions for the current autocomplete. */
  protected suggestions$ = new ReplaySubject<Suggestion[]>(1);
  protected suggestionsSub: Subscription;

  protected termValid$: Observable<boolean>;
  protected termIsHash$: Observable<boolean>;

  protected caretChange$ = new EventEmitter<null>();
  protected showAutocomplete$ = new BehaviorSubject(false);

  // Match md5, sha1, sha256, sha512
  readonly pattern =
    /^(?:[^0-9a-f]|^)([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/;

  ngOnInit(): void {
    // Load the model greedily and only once
    this.entityService
      .getModel()
      .pipe(
        ops.map((modelKeys) =>
          Object.entries(modelKeys.keys).map(([key, value]) => ({
            fieldName: [],
            fieldType: value,
            originalFieldName: key,
          })),
        ),
        ops.map((modelKeys) =>
          createFuzzySearch(modelKeys, {
            getText: (item) => [item.originalFieldName],
          }),
        ),
        ops.shareReplay(1),
      )
      .subscribe((result) => this.model$.next(result));

    const cleanedTerm$ = concat(
      defer(() => of(this.term.value)),
      this.term.valueChanges,
    ).pipe(ops.map((value) => value || ""));

    const caretChangeWithInitial = concat(
      defer(() => of(undefined)),
      this.caretChange$,
    );

    this.termIsHash$ = cleanedTerm$.pipe(
      ops.map((term) => {
        if (this.pattern.test(term)) {
          return true;
        }
        return false;
      }),
    );

    this.autocompleteContext$ = combineLatest([
      cleanedTerm$,
      caretChangeWithInitial,
      this.showAutocomplete$,
    ]).pipe(
      ops.debounceTime(50),
      ops.shareReplay(1),
      ops.map(([term, _caret, _show_autocomplete]) => {
        // Attempt to determine what token is currently selected
        if (this.textInputElement) {
          return this.entityService
            .findAutocomplete(
              term,
              Math.max(
                this.textInputElement.inputElement.nativeElement
                  .selectionStart - 1,
                0,
              ),
            )
            .pipe(ops.shareReplay(1));
        }
      }),
      ops.filter((value) => !!value),
      ops.mergeAll(),
      ops.shareReplay(1),
    );

    this.termValid$ = this.autocompleteContext$.pipe(
      ops.map((context) => context.type != "Error"),
    );

    // Suggestions might not always be visible, but cache these
    // in a variable due to the time it can take to calculate these
    this.suggestionsSub = combineLatest([
      this.autocompleteContext$,
      this.model$,
    ]).subscribe(([context, model]) => {
      let results: Suggestion[] = [];

      if (
        (context.type === "FieldValue" && !context.key) ||
        context.type === "FieldName"
      ) {
        results = model(context.prefix)
          .sort((a, b) => a.score - b.score)
          .splice(0, 10)
          .map((result) => {
            // Map the found ranges in the resulting text as underlines
            const name = result.item.originalFieldName;

            const output: NameSection[] = [];
            let lastIndex = 0;
            for (const match of result.matches[0]) {
              const [start, finish] = match;
              if (lastIndex < start) {
                output.push({
                  value: name.substring(lastIndex, start),
                  underlined: false,
                });
              }

              if (lastIndex > start) {
                // Overlapping highlight; skip
                continue;
              }

              output.push({
                value: name.substring(start, finish + 1),
                underlined: true,
              });

              lastIndex = finish + 1;
            }

            if (lastIndex < name.length) {
              output.push({
                value: name.substring(lastIndex),
                underlined: false,
              });
            }

            return {
              fieldName: output,
              fieldType: result.item.fieldType,
              originalFieldName: result.item.originalFieldName,
            };
          });
      }

      this.suggestions$.next(results);
    });
  }

  fillSuggestion(event, sug: Suggestion) {
    /* Populates the current input with the selected suggested value.
    Keeping any text prior to the suggestion.
    Must switch focus back to the input to allow for a new blur event to fire.
    handleBlur will only close the suggestions when focus is lost to a non-child element.
    */
    // Determine the leading text to keep.
    const replacementText = sug.originalFieldName + ':""';
    const currentTextAsList = String(this.term.value).split(" ");
    // Remove the text being replaced by the suggestion and make a string again.
    currentTextAsList.pop();
    const currentTextWithoutSuggestion = currentTextAsList?.join(" ") + " ";

    // Set new text value removing any whitespace.
    let newText = currentTextWithoutSuggestion + replacementText;
    newText = newText.trim();

    if (event?.type === "keydown") {
      if (event?.key === "Enter") {
        this.term.setValue(newText);
        // Delay to prevent the form from submitting.
        setTimeout(() => {
          this.textInputElement.inputElement.nativeElement.setRangeText(
            "placeholder",
            newText.length - 1,
            newText.length - 1,
            "select",
          );
          this.textInputElement.inputElement.nativeElement.focus();
        }, 200);
      }
    } else {
      this.term.setValue(newText);
      this.textInputElement.inputElement.nativeElement.setRangeText(
        "placeholder",
        newText.length - 1,
        newText.length - 1,
        "select",
      );
      this.textInputElement.inputElement.nativeElement.focus();
    }
  }

  handleFocusOut(evnt: FocusEvent) {
    /*Close suggestions if focus is lost on the suggest input and it's child elements.*/
    const targetId = (evnt.relatedTarget as HTMLElement)?.id;
    if (!targetId) {
      this.showAutocomplete$.next(false);
    } else if (targetId !== "termInput" && !targetId.startsWith("suggestion")) {
      this.showAutocomplete$.next(false);
    }
  }

  ngOnDestroy(): void {
    this.suggestionsSub?.unsubscribe();
  }

  /**
   * Hides any suggestion box currently visible.
   */
  hideSuggestions() {
    this.showAutocomplete$.next(false);
  }
}
