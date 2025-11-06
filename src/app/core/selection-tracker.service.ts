import { Injectable } from "@angular/core";
import { components } from "./api/openapi";

@Injectable({
  providedIn: "root",
})
export class SelectionTrackerService {
  private selectedRows = new Map<
    string,
    components["schemas"]["EntityFindItem"]
  >();

  setSelected(row: components["schemas"]["EntityFindItem"]) {
    this.selectedRows.set(row.sha256, row);
  }

  removeSelected(hash: string) {
    this.selectedRows.delete(hash);
  }

  hasSelected(hash: string): boolean {
    return this.selectedRows.has(hash);
  }

  constructor() {}
}
