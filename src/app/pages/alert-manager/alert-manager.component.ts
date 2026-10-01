import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Signal,
  signal,
  untracked,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { Api } from "@app/core/services";
import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { toSignal } from "@angular/core/rxjs-interop";
import { form, required, validate } from "@angular/forms/signals";
import { components, paths } from "@app/core/api/openapi";
import {
  faAngleDown,
  faChevronDown,
  faChevronRight,
  faCircleXmark,
  faPencil,
  faPlus,
  faSpinner,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import * as ops from "rxjs/operators";

const ALL_STATUS_ENUMS: components["schemas"]["StatusEnum"][] = [
  "completed",
  "completed-empty",
  "completed-with-errors",
  "opt-out",
  "heartbeat",
  "dequeued",
  "download-requested",
  "error-exception",
  "error-network",
  "error-runner",
  "error-input",
  "error-output",
  "error-timeout",
  "error-out-of-memory",
] as const;
const ALL_BINARY_ACTIONS: components["schemas"]["BinaryAction"][] = [
  "sourced",
  "extracted",
  "augmented",
  "mapped",
  "enriched",
];

interface NameValueEntry {
  key: string;
  value: string;
}

interface CreateAlertRuleInterface {
  /** Webhook Id */
  webhook_id: string;
  alert_message: string;
  status?: components["schemas"]["StatusEnum"];
  event_type?: components["schemas"]["BinaryAction"];
  /** Plugin Name */
  plugin_name: string;
  /** Plugin Version */
  plugin_version: string;
  /** Source Name */
  source_name: string;
  /** Source Reference Key Values */
  source_reference_key_values: NameValueEntry[];
  /** Feature Name Values */
  feature_name_values: NameValueEntry[];
}

@Component({
  selector: "app-alert-manager",
  templateUrl: "./alert-manager.component.html",
  styleUrls: ["./alert-manager.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AlertManagerComponent {
  private api = inject(Api);
  private dialogService = inject(Dialog);

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;
  protected faChevronDown = faChevronDown;
  protected faChevronRight = faChevronRight;
  protected faAngleDown = faAngleDown;
  protected faTrash = faTrash;
  protected faPencil = faPencil;
  protected faPlus = faPlus;
  protected faCircleXmark = faCircleXmark;
  protected faTriangleExclamation = faTriangleExclamation;
  protected faSpinner = faSpinner;

  protected ALL_STATUS_ENUMS = ALL_STATUS_ENUMS;
  protected ALL_BINARY_ACTIONS = ALL_BINARY_ACTIONS;

  // Form
  protected createAlertRuleModel: WritableSignal<CreateAlertRuleInterface> =
    signal({
      webhook_id: "",
      alert_message: "",
      status: null,
      event_type: null,
      /** Plugin Name */
      plugin_name: "",
      /** Plugin Version */
      plugin_version: "",
      /** Source Name */
      source_name: "",
      /** Source Reference Key Values */
      source_reference_key_values: [{ key: "", value: "" }],
      /** Feature Name Values */
      feature_name_values: [{ key: "", value: "" }],
    });

  // What clearing or resetting the form should put the state to.
  // This changes when you are editing vs creating a new rule.
  protected resetFormState: CreateAlertRuleInterface = {
    webhook_id: "",
    alert_message: "",
    status: null,
    event_type: null,
    /** Plugin Name */
    plugin_name: "",
    /** Plugin Version */
    plugin_version: "",
    /** Source Name */
    source_name: "",
    /** Source Reference Key Values */
    source_reference_key_values: [{ key: "", value: "" }],
    /** Feature Name Values */
    feature_name_values: [{ key: "", value: "" }],
  };

  // Id of the rule being edited.
  protected editRuleId: WritableSignal<string> = signal("");

  protected createAlertRuleForm = form(this.createAlertRuleModel, (f) => {
    required(f.webhook_id);
    required(f.alert_message);
    validate(f.source_reference_key_values, ({ value }) => {
      for (const kv of value()) {
        if (kv.key !== "" && kv.value === "") {
          return {
            kind: "unsetSourceValue",
            message: `The source key is set to '${kv.key}' but the value is unset, the value must be set.`,
          };
        } else if (kv.value !== "" && kv.key === "") {
          return {
            kind: "unsetSourceKey",
            message: `The source has a value '${kv.value}' but has no key value set., the key value must be set.`,
          };
        } else if (
          kv.key !== "" &&
          !this.currentSourceReferences().includes(kv.key)
        ) {
          return {
            kind: "invalidSourceKeySet",
            message: `The current source does not hold the key '${kv.key}' but the key is currently set (value is '${kv.value}').`,
          };
        }
      }
      return null;
    });
    validate(f.feature_name_values, ({ value }) => {
      for (const kv of value()) {
        if (kv.key !== "" && kv.value === "") {
          return {
            kind: "unsetFeatureValue",
            message: `The feature name is set to '${kv.key}' but the value is unset, the value must be set.`,
          };
        } else if (kv.value !== "" && kv.key === "") {
          return {
            kind: "unsetFeatureName",
            message: `There is a feature value '${kv.value}' but there is no corresponding feature name, the feature name must be set.`,
          };
        }
      }
      return null;
    });
  });

  // Listed data
  protected allAlertRulesObservable$: Observable<
    readonly components["schemas"]["AlertRule"][]
  >;
  protected allAlertRules: Signal<
    readonly components["schemas"]["AlertRule"][]
  > = signal([]);
  protected allInvalidAlertRulesObservable$: Observable<
    readonly components["schemas"]["AlertRule"][]
  >;
  protected allInvalidAlertRules: Signal<
    readonly components["schemas"]["AlertRule"][]
  > = signal([]);

  protected validWebhooks: Signal<
    readonly components["schemas"]["WebhookMappingApi"][]
  > = signal([]);

  protected allPendingAlerts: Signal<
    readonly components["schemas"]["AlertHit"][]
  > = signal([]);

  protected Object = Object;
  protected createAlertRuleDialog?: DialogRef;
  protected deleteConfirmationDialog?: DialogRef;

  protected expandAlertRuleId: WritableSignal<string[]> = signal([]);

  protected ruleCreationInProgress: WritableSignal<boolean> = signal(false);
  protected lastRuleCreationError: WritableSignal<string> = signal("");

  protected reloadRules: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  protected reloadAlerts: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  protected pluginNameToVersions: Signal<Map<string, string[]>> = signal(
    new Map<string, string[]>(),
  );

  protected pluginNames: Signal<string[]> = computed(() => {
    if (this.pluginNameToVersions() !== undefined) {
      return [...this.pluginNameToVersions().keys()];
    }
    return [];
  });
  protected currentPluginVersions: Signal<string[]> = computed(() => {
    if (this.pluginNameToVersions() !== undefined) {
      const pluginName = this.createAlertRuleForm.plugin_name().controlValue();
      if (this.pluginNameToVersions().has(pluginName)) {
        // Ensure the change the plugin version is untracked by the computed section of the plugin version.
        untracked(() => {
          this.createAlertRuleForm.plugin_version().controlValue.set("");
        });
        return [
          ...this.pluginNameToVersions().get(
            this.createAlertRuleForm.plugin_name().controlValue(),
          ),
        ];
      }
    }
    return [];
  });

  protected sourceNameToReferences: Signal<Map<string, string[]>>;
  protected sourceNames: Signal<string[]> = computed(() => {
    let srcNames = [];
    if (this.sourceNameToReferences() !== undefined) {
      srcNames = [...this.sourceNameToReferences().keys()];
    }
    return srcNames;
  });
  protected currentSourceReferences: Signal<string[]> = computed(() => {
    if (this.sourceNameToReferences() === undefined) {
      return [];
    }
    // Using reference to form control value to minimise number of updates.
    const currentSourceName = this.createAlertRuleForm
      .source_name()
      .controlValue();
    if (this.sourceNameToReferences().has(currentSourceName)) {
      return this.sourceNameToReferences().get(currentSourceName);
    }
    // Couldn't find the source name so just give all source reference values
    const sourceReferenceKeys = new Set<string>();
    this.sourceNameToReferences().forEach((values) => {
      values.forEach((sourceRefVal) => {
        sourceReferenceKeys.add(sourceRefVal);
      });
    });
    return [...sourceReferenceKeys.values()];
  });

  @ViewChild("tplCreateOrUpdateRule") tplCreateOrUpdateRule;

  constructor() {
    // Load all of the possible rules
    const ruleReloadObs = combineLatest([this.reloadRules.asObservable()]);
    this.allAlertRulesObservable$ = ruleReloadObs.pipe(
      ops.switchMap(() => this.api.alerterListAllRules(true)),
    );
    this.allAlertRules = toSignal(this.allAlertRulesObservable$);

    this.allInvalidAlertRulesObservable$ = ruleReloadObs.pipe(
      ops.switchMap(() => this.api.alerterListAllInvalidRules()),
    );

    this.allInvalidAlertRules = toSignal(this.allInvalidAlertRulesObservable$);

    // Load all of the possible Alerts.
    this.allPendingAlerts = toSignal(
      this.reloadAlerts
        .asObservable()
        .pipe(ops.switchMap(() => this.api.alerterListAllPendingAlerts())),
    );

    // Load all the potential webhooks
    this.validWebhooks = toSignal(
      this.api.alerterListValidWebhooks().pipe(ops.take(1)),
    );

    this.pluginNameToVersions = toSignal(
      this.api.pluginGetAll().pipe(
        ops.map((plugins) => {
          const output = new Map<string, string[]>();
          for (const curPlugin of plugins) {
            output.set(curPlugin.newest_version.name, [...curPlugin.versions]);
          }
          return output;
        }),
        ops.shareReplay(1),
      ),
    );

    this.sourceNameToReferences = toSignal(
      this.api.sourceReadAll().pipe(
        ops.map((sources) => {
          const output = new Map<string, string[]>();
          // Map the source name to it's reference keys
          Object.keys(sources).forEach((sourceName) => {
            const refs = [];
            sources[sourceName].references.forEach((sourceRef) => {
              refs.push(sourceRef.name);
            });
            output.set(sourceName, refs);
          });
          return output;
        }),
        ops.shareReplay(1),
      ),
    );
  }

  toggleRule(ruleId: string) {
    if (this.expandAlertRuleId().includes(ruleId)) {
      const removedRule = this.expandAlertRuleId().filter((r) => r !== ruleId);
      this.expandAlertRuleId.set([...removedRule]);
    } else {
      this.expandAlertRuleId.set([...this.expandAlertRuleId(), ruleId]);
    }
  }

  openCreateRuleDialog() {
    this.resetFormState = {
      webhook_id: "",
      alert_message: "",
      status: null,
      event_type: null,
      /** Plugin Name */
      plugin_name: "",
      /** Plugin Version */
      plugin_version: "",
      /** Source Name */
      source_name: "",
      /** Source Reference Key Values */
      source_reference_key_values: [{ key: "", value: "" }],
      /** Feature Name Values */
      feature_name_values: [{ key: "", value: "" }],
    };
    if (this.editRuleId()?.length !== 0) {
      this.editRuleId.set("");
      this.resetRuleCreation();
    }
    this.createAlertRuleDialog = this.dialogService.open(
      this.tplCreateOrUpdateRule,
    );
  }

  openEditRuleDialog(rule: components["schemas"]["AlertRule"]) {
    this.editRuleId.set(rule.id);

    // Set defaults for source reference keys.
    const sourceRefKeys: NameValueEntry[] = [];
    if (
      rule?.source_reference_key_values !== null &&
      rule?.source_reference_key_values !== undefined
    ) {
      for (const k of Object.keys(rule?.source_reference_key_values)) {
        sourceRefKeys.push({
          key: k,
          value: rule?.source_reference_key_values[k],
        });
      }
    }
    if (sourceRefKeys.length === 0) {
      sourceRefKeys.push({ key: "", value: "" });
    }

    // Set defaults for feature Name Values.
    const featureNameValues: NameValueEntry[] = [];
    if (
      rule?.feature_name_values !== null &&
      rule?.feature_name_values !== undefined
    ) {
      for (const k of Object.keys(rule?.feature_name_values)) {
        featureNameValues.push({
          key: k,
          value: rule?.feature_name_values[k],
        });
      }
    }
    if (featureNameValues.length === 0) {
      featureNameValues.push({ key: "", value: "" });
    }

    this.resetFormState = {
      webhook_id: rule?.webhook_id,
      alert_message: rule?.alert_message,
      status: rule?.status,
      event_type: rule?.event_type,
      /** Plugin Name */
      plugin_name: rule?.plugin_name ? rule?.plugin_name : "",
      /** Plugin Version */
      plugin_version: rule?.plugin_version ? rule?.plugin_version : "",
      /** Source Name */
      source_name: rule?.source_name ? rule?.source_name : "",
      /** Source Reference Key Values */
      source_reference_key_values: sourceRefKeys,
      /** Feature Name Values */
      feature_name_values: featureNameValues,
    };

    this.resetRuleCreation();

    this.createAlertRuleDialog = this.dialogService.open(
      this.tplCreateOrUpdateRule,
    );
  }

  resetRuleCreation() {
    this.lastRuleCreationError.set("");
    this.createAlertRuleModel.update(() => {
      return { ...this.resetFormState };
    });
  }

  cancelRuleCreation() {
    this.createAlertRuleDialog.close();
  }

  private modifyRecordArray(
    value: NameValueEntry[],
  ): Readonly<Record<string, string>> | null {
    if (value?.length > 0) {
      const correctedSourceRefKeyVals: Readonly<Record<string, string>> =
        Object.fromEntries(
          value
            .filter((val) => val.key !== "" && val.value !== "")
            .map(({ key, value }) => {
              return [key, value];
            }),
        );

      if (this.Object.keys(correctedSourceRefKeyVals).length === 0) {
        return null;
      }
      return correctedSourceRefKeyVals;
    }
    return null;
  }

  private convertModelIntoCreationBody(): paths["/api/v0/alerter/rule/create"]["post"]["requestBody"]["content"]["application/json"] {
    const currentState = this.createAlertRuleModel();
    // Modify the source and feature Maps to be compliant with the API.
    const correctedSourceRefKeyVals = this.modifyRecordArray(
      currentState.source_reference_key_values,
    );
    const correctedFeatureValues = this.modifyRecordArray(
      currentState.feature_name_values,
    );
    // Create the request body
    const correctedFormBody: paths["/api/v0/alerter/rule/create"]["post"]["requestBody"]["content"]["application/json"] =
      {
        ...currentState,
        source_reference_key_values: correctedSourceRefKeyVals,
        feature_name_values: correctedFeatureValues,
      };
    // Clear all the null/undefined and empty string values from the form.
    const val = Object.fromEntries(
      Object.entries(correctedFormBody).filter(
        ([_, value]) => value !== null && value !== undefined && value !== "",
      ),
    ) as paths["/api/v0/alerter/rule/create"]["post"]["requestBody"]["content"]["application/json"];
    return val;
  }

  createRule() {
    const body = this.convertModelIntoCreationBody();
    this.ruleCreationInProgress.set(true);
    this.api
      .alerterCreateRule(body)
      .pipe(ops.take(1))
      .subscribe((newResp) => {
        this.ruleCreationInProgress.set(false);
        if (typeof newResp === "string") {
          this.lastRuleCreationError.set(newResp);
        }
        // Reset the form and close the dialog
        this.resetRuleCreation();
        this.createAlertRuleDialog?.close();
        this.reloadRules.next(!this.reloadRules.value);
      });
  }

  updateRule() {
    const body = this.convertModelIntoCreationBody();
    this.ruleCreationInProgress.set(true);
    this.api
      .alerterUpdateRule({ ...body, id: this.editRuleId() })
      .pipe(ops.take(1))
      .subscribe((newResp) => {
        this.ruleCreationInProgress.set(false);
        if (typeof newResp === "string") {
          this.lastRuleCreationError.set(newResp);
        }
        // Reset the form and close the dialog
        this.resetRuleCreation();
        this.createAlertRuleDialog?.close();
        this.reloadRules.next(!this.reloadRules.value);
      });
  }

  openDeleteRuleDialog(dialog, ruleId: string) {
    this.deleteConfirmationDialog = this.dialogService.open(dialog, {
      data: ruleId,
    });
  }

  openDeleteAlertsDialog(dialog) {
    this.deleteConfirmationDialog = this.dialogService.open(dialog);
  }

  deleteRule(ruleId: string) {
    this.api
      .alerterDeleteRule(ruleId)
      .pipe(ops.take(1))
      .subscribe((_res) => {
        this.reloadRules.next(!this.reloadRules.value);
      });

    this.deleteConfirmationDialog.close();
  }

  // Add a new source reference to the field.
  addNewSourceRef() {
    // If there is already an empty value present don't add another one.
    const found = this.createAlertRuleModel().source_reference_key_values.find(
      (e) => e.key === "" && e.value === "",
    );
    // No empty value present so add another
    if (found === undefined) {
      this.createAlertRuleModel.update((originalRules) => {
        return {
          ...originalRules,
          source_reference_key_values: [
            ...originalRules.source_reference_key_values,
            { key: "", value: "" },
          ],
        };
      });
    }
  }

  // Add a new feature name/value
  addNewFeatureValue() {
    // If there is already an empty value present don't add another one.
    const found = this.createAlertRuleModel().feature_name_values.find(
      (e) => e.key === "" && e.value === "",
    );
    // No empty value present so add another
    if (found === undefined) {
      this.createAlertRuleModel.update((originalRules) => {
        return {
          ...originalRules,
          feature_name_values: [
            ...originalRules.feature_name_values,
            { key: "", value: "" },
          ],
        };
      });
    }
  }

  removeSourceValueByIndex(index: number) {
    this.createAlertRuleModel.update((originalRules) => {
      const newValues = [...originalRules.source_reference_key_values];
      newValues.splice(index, 1);
      return {
        ...originalRules,
        source_reference_key_values: newValues,
      };
    });
  }

  removeFeatureValueByIndex(index: number) {
    this.createAlertRuleModel.update((originalRules) => {
      const newValues = [...originalRules.feature_name_values];
      newValues.splice(index, 1);
      return {
        ...originalRules,
        feature_name_values: newValues,
      };
    });
  }

  clearPendingAlerts() {
    this.api
      .alerterDeleteAllPendingAlerts()
      .pipe(ops.take(1))
      .subscribe(() => {
        this.reloadAlerts.next(!this.reloadAlerts.value);
        this.deleteConfirmationDialog.close();
      });
  }
}
