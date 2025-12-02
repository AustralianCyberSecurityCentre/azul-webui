import { Injectable, signal, WritableSignal } from "@angular/core";
import { components } from "./api/openapi";

@Injectable({
  providedIn: "root",
})
export class PivotService {
  public SelectedFeatureSignal: WritableSignal<
    Array<components["schemas"]["FeaturePivotRequest"]>
  > = signal([
    {
      feature_name: "pe_debug_codeview_signature",
      feature_value: "PDB_70",
    },
  ]);

  isSelected(row: components["schemas"]["FeaturePivotRequest"]): boolean {
    const idx = this.SelectedFeatureSignal().findIndex((val, _idx, _obj) => {
      return (
        val.feature_name === row.feature_name &&
        val.feature_value === row.feature_value
      );
    });
    return !(idx === -1);
  }

  setSelected(row: components["schemas"]["FeaturePivotRequest"]) {
    if (!this.isSelected(row)) {
      this.SelectedFeatureSignal.set([...this.SelectedFeatureSignal(), row]);
    }
  }

  removeSelected(row: components["schemas"]["FeaturePivotRequest"]) {
    this.SelectedFeatureSignal.set(
      this.SelectedFeatureSignal().filter((val) => {
        return (
          val.feature_name !== row.feature_name ||
          val.feature_value !== row.feature_value
        );
      }),
    );
  }

  clearPivot() {
    this.SelectedFeatureSignal.set([]);
  }

  constructor() {}
}
