import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  TemplateRef,
} from "@angular/core";
import { BehaviorSubject } from "rxjs";
import * as ops from "rxjs/operators";
import { ButtonLabelComponent } from "../button-label/button-label.component";

// https://flowbite.com/docs/components/tabs/

export type Tab = {
  name: string;
  template: TemplateRef<unknown>;
  disabled?: boolean;
  context?: unknown;
  count?: string;
};

@Component({
  selector: "flow-tablist",
  templateUrl: "./tablist.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonLabelComponent],
})
export class TablistComponent implements OnChanges {
  @Input()
  protected tabs: Tab[] = [];

  protected currentTab$ = new BehaviorSubject<number>(0);
  protected currentTabTemplate$ = this.currentTab$.pipe(
    ops.map((tabIndex) => this.tabs[tabIndex]?.template),
  );
  protected currentTabContext$ = this.currentTab$.pipe(
    ops.map((tabIndex) => this.tabs[tabIndex]?.context),
  );

  ngOnChanges() {
    if (this.tabs.length === 0) {
      return;
    }

    const currentValue = this.currentTab$.value;

    if (currentValue >= this.tabs.length || this.tabs[currentValue].disabled) {
      const validTab = this.tabs.findIndex((tab) => !(tab.disabled ?? false));
      if (validTab != -1) {
        this.onTabClick(validTab);
      }
    }
  }

  onTabClick(tab: number) {
    this.currentTab$.next(tab);
  }
}
