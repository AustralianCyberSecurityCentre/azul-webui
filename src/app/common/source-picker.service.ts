import {
  inject,
  Injectable,
  linkedSignal,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  applyEach,
  FieldTree,
  form,
  required,
  SchemaPathTree,
} from "@angular/forms/signals";
import { ActivatedRoute, convertToParamMap, ParamMap } from "@angular/router";
import { Observable } from "rxjs";
import { ApiService } from "../core/api/api.service";
import { components } from "../core/api/openapi";
import { UserService } from "../core/user.service";

export interface SourceRef {
  readonly name: string;
  readonly description: string;
  value: string;
  readonly required: boolean;
}

export interface SourceData {
  selectedSource: string;
  refs: SourceRef[];
}

export function SourceRefSchema(item: SchemaPathTree<SourceRef>) {
  if (item.required) {
    required(item.value, {
      message: (ctx) => {
        return `${ctx.valueOf(item.name)}`;
      },
      when: (fieldCtx) => fieldCtx.valueOf(item.required) === true,
    });
  }
}

@Injectable({
  providedIn: "root",
})
export class SourcePickerService {
  api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private user = inject(UserService);
  setSourceSignal: WritableSignal<string> = signal("samples");
  sources$: Observable<components["schemas"]["Response_str_Source_"]["data"]>;
  sourcesSignal: Signal<components["schemas"]["Response_str_Source_"]["data"]> =
    signal({});
  queryParamMapSignal: Signal<ParamMap | undefined> = signal(
    convertToParamMap({}),
  );
  userDetailsSignal: Signal<components["schemas"]["UserInfo"] | undefined> =
    signal(undefined);

  sourceModel: WritableSignal<SourceData>;
  sourceForm: FieldTree<SourceData, string | number>;

  // Trigger a change in the source, this triggers a change of the reference values.
  changeSource(): void {
    this.setSourceSignal.set(this.sourceModel().selectedSource);
  }

  // Get the forms error messages if there are any, if there are none return an empty list.
  getFormErrors(): string[] {
    const errors: string[] = [];
    if (this.sourceForm().invalid() === true) {
      this.sourceForm()
        .errorSummary()
        .forEach((errMsg) => {
          if (errMsg.message) {
            errors.push(errMsg.message);
          }
        });
    }
    return errors;
  }

  constructor() {
    this.sources$ = this.api.sourceReadAll();
    this.sourcesSignal = toSignal(this.sources$);
    this.queryParamMapSignal = toSignal(this.route.queryParamMap);
    this.userDetailsSignal = toSignal(this.user.userDetails$);

    this.sourceModel = linkedSignal({
      source: () => {
        return {
          sources: this.sourcesSignal(),
          queryParams: this.queryParamMapSignal(),
          userDetails: this.userDetailsSignal(),
          setSource: this.setSourceSignal(),
        };
      },
      computation: ({ sources, queryParams, userDetails, setSource }) => {
        // If there are no sources nothing can be done.
        if (sources === undefined) {
          return {
            selectedSource: setSource,
            refs: [],
          };
        }
        const currentSource = setSource;
        let hasRouteRefs = false;
        // Reference default values
        // Reference route based overrides
        const referenceDefaults = new Map<string, string>();
        if (queryParams !== undefined && queryParams.keys !== undefined) {
          for (const key of queryParams.keys) {
            if (key.startsWith("ref_")) {
              hasRouteRefs = true;
              const ref = key.slice(4);
              const val = queryParams.get(key);
              referenceDefaults.set(ref, val);
            }
          }
        }
        // Autofill references if nothing is set via route
        if (!hasRouteRefs) {
          if (userDetails?.username) {
            referenceDefaults.set("user", userDetails.username);
          }
          if (userDetails?.org) {
            referenceDefaults.set("organisation", userDetails.org);
          }
        }

        for (const sourceKey in sources) {
          if (sourceKey.toLowerCase() === currentSource.toLowerCase()) {
            const refList = sources[sourceKey]?.references;
            // References should be set as the source is valid.
            if (refList !== undefined) {
              // Setup reference values
              const newRefs: SourceRef[] = [];
              refList.forEach((ref) => {
                let defaultVal = "";
                if (referenceDefaults.has(ref.name)) {
                  defaultVal = referenceDefaults.get(ref.name);
                }
                newRefs.push({
                  name: ref.name,
                  description: ref.description,
                  value: defaultVal,
                  required: ref.required,
                });
              });
              return {
                selectedSource: currentSource,
                refs: newRefs,
              };
            }
          }
        }

        return {
          selectedSource: setSource,
          refs: [],
        };
      },
    });

    this.sourceForm = form(this.sourceModel, (f) => {
      required(f.selectedSource);
      applyEach(f.refs, SourceRefSchema);
    });
  }
}
